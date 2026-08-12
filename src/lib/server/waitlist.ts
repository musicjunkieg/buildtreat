import type { D1Database } from '@cloudflare/workers-types';
import { EMAIL_RE } from './db';

/**
 * D1 access for the waitlist — uninvited-but-interested visitors who signed
 * in but aren't on the allowlist. All queries are parameterized.
 * Schema: migrations/0003_waitlist.sql. Design spec:
 * docs/superpowers/specs/2026-08-11-waitlist-design.md.
 */

export interface WaitlistEntry {
	did: string;
	handle: string | null;
	email: string;
	createdAt: string;
	promotedAt: string | null;
}

/** 'none' = not on the list; 'member' = waiting (or already promoted). */
export type WaitlistState = 'none' | 'member';

export { EMAIL_RE };

/**
 * Add (or update) a waitlist entry. Idempotent on DID: re-signing-in and
 * re-submitting updates the email/handle rather than duplicating. The handle
 * is authoritative (resolved from the caller's DID), never client-supplied,
 * so promotion can safely allowlist it.
 */
export async function joinWaitlist(
	db: D1Database,
	who: { did: string; handle: string | null; email: string }
): Promise<void> {
	const now = new Date().toISOString();
	await db
		.prepare(
			`INSERT INTO waitlist (did, handle, email, created_at)
			 VALUES (?1, ?2, ?3, ?4)
			 ON CONFLICT(did) DO UPDATE SET handle = excluded.handle, email = excluded.email`
		)
		.bind(who.did, who.handle, who.email, now)
		.run();
}

/** The visitor's own waitlist row, for the confirmation state. */
export async function getWaitlistEntry(db: D1Database, did: string): Promise<WaitlistEntry | null> {
	const row = await db
		.prepare(`SELECT did, handle, email, created_at, promoted_at FROM waitlist WHERE did = ?1`)
		.bind(did)
		.first<{ did: string; handle: string | null; email: string; created_at: string; promoted_at: string | null }>();
	if (!row) return null;
	return { did: row.did, handle: row.handle, email: row.email, createdAt: row.created_at, promotedAt: row.promoted_at };
}

/** Full list for the organizer, oldest first. */
export async function listWaitlist(db: D1Database): Promise<WaitlistEntry[]> {
	const rows = await db
		.prepare(`SELECT did, handle, email, created_at, promoted_at FROM waitlist ORDER BY created_at`)
		.all<{ did: string; handle: string | null; email: string; created_at: string; promoted_at: string | null }>();
	return rows.results.map((r) => ({
		did: r.did,
		handle: r.handle,
		email: r.email,
		createdAt: r.created_at,
		promotedAt: r.promoted_at
	}));
}

/**
 * Promote a waitlist entry into the allowlist. Inserts the (lowercased)
 * handle — pinning the DID so a later handle change can't lock them out —
 * and stamps promoted_at. The existing survey gate then admits them with
 * the identity they already have. No-op-safe on a missing/handleless row.
 */
export async function promoteFromWaitlist(db: D1Database, did: string): Promise<{ ok: boolean; handle: string | null }> {
	const entry = await getWaitlistEntry(db, did);
	if (!entry || !entry.handle) return { ok: false, handle: entry?.handle ?? null };
	const handle = entry.handle.replace(/^@/, '').toLowerCase();
	const now = new Date().toISOString();
	await db.batch([
		// Pin the DID; if the handle is already allowlisted, keep any existing DID.
		db
			.prepare(
				`INSERT INTO allowlist (handle, did) VALUES (?1, ?2)
				 ON CONFLICT(handle) DO UPDATE SET did = COALESCE(allowlist.did, excluded.did)`
			)
			.bind(handle, entry.did),
		db.prepare(`UPDATE waitlist SET promoted_at = ?1 WHERE did = ?2`).bind(now, did)
	]);
	return { ok: true, handle };
}

/** Validate a submitted waitlist email. Mirrors the survey's rule. */
export function isValidWaitlistEmail(email: string): boolean {
	return EMAIL_RE.test(email);
}
