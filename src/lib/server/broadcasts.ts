import type { D1Database } from '@cloudflare/workers-types';
import type { SendResult } from './email';

/**
 * D1 access + orchestration for organizer email broadcasts. Recipients are
 * snapshotted per broadcast; each row's status is the source of truth for
 * what has actually been handed to comail. All queries are parameterized.
 * Schema: migrations/0005_broadcasts.sql.
 */

export interface RecipientInput {
	did: string;
	email: string;
}

export interface BroadcastRecipient {
	did: string;
	email: string;
	status: 'pending' | 'sent' | 'failed';
	errorCode: string | null;
	messageId: string | null;
}

export interface BroadcastView {
	id: number;
	subject: string;
	body: string;
	sentBy: string;
	createdAt: string;
	recipients: BroadcastRecipient[];
}

/** First occurrence wins; comparison is on the lowercased, trimmed email. */
export function dedupeRecipients(rows: RecipientInput[]): RecipientInput[] {
	const seen = new Set<string>();
	const out: RecipientInput[] = [];
	for (const row of rows) {
		const key = row.email.trim().toLowerCase();
		if (!key || seen.has(key)) continue;
		seen.add(key);
		out.push(row);
	}
	return out;
}

/** Insert the broadcast plus one pending row per recipient; returns its id. */
export async function createBroadcast(
	db: D1Database,
	input: { subject: string; body: string; sentBy: string; recipients: RecipientInput[] }
): Promise<number> {
	const now = new Date().toISOString();
	const row = await db
		.prepare(`INSERT INTO broadcasts (subject, body, sent_by, created_at) VALUES (?1, ?2, ?3, ?4) RETURNING id`)
		.bind(input.subject, input.body, input.sentBy, now)
		.first<{ id: number }>();
	if (!row) throw new Error('broadcast insert returned no id');
	if (input.recipients.length) {
		await db.batch(
			input.recipients.map((r) =>
				db
					.prepare(
						`INSERT INTO broadcast_recipients (broadcast_id, did, email, status, updated_at)
						 VALUES (?1, ?2, ?3, 'pending', ?4)`
					)
					.bind(row.id, r.did, r.email, now)
			)
		);
	}
	return row.id;
}

/** All broadcasts, newest first, with their full recipient rows. */
export async function listBroadcasts(db: D1Database): Promise<BroadcastView[]> {
	const [broadcasts, recipients] = await db.batch([
		db.prepare(`SELECT id, subject, body, sent_by, created_at FROM broadcasts ORDER BY id DESC`),
		db.prepare(
			`SELECT broadcast_id, did, email, status, error_code, message_id FROM broadcast_recipients ORDER BY email`
		)
	]);
	const byId = new Map<number, BroadcastView>();
	for (const b of broadcasts.results as Array<{ id: number; subject: string; body: string; sent_by: string; created_at: string }>) {
		byId.set(b.id, { id: b.id, subject: b.subject, body: b.body, sentBy: b.sent_by, createdAt: b.created_at, recipients: [] });
	}
	for (const r of recipients.results as Array<{
		broadcast_id: number;
		did: string;
		email: string;
		status: 'pending' | 'sent' | 'failed';
		error_code: string | null;
		message_id: string | null;
	}>) {
		byId.get(r.broadcast_id)?.recipients.push({
			did: r.did,
			email: r.email,
			status: r.status,
			errorCode: r.error_code,
			messageId: r.message_id
		});
	}
	return [...byId.values()];
}

/** The retry worklist: everything not yet successfully handed to comail. */
export async function unsentRecipients(db: D1Database, broadcastId: number): Promise<BroadcastRecipient[]> {
	const rows = await db
		.prepare(
			`SELECT did, email, status, error_code, message_id FROM broadcast_recipients
			 WHERE broadcast_id = ?1 AND status != 'sent' ORDER BY email`
		)
		.bind(broadcastId)
		.all<{ did: string; email: string; status: 'pending' | 'failed'; error_code: string | null; message_id: string | null }>();
	return rows.results.map((r) => ({
		did: r.did,
		email: r.email,
		status: r.status,
		errorCode: r.error_code,
		messageId: r.message_id
	}));
}

/**
 * Persist one send outcome. Success → 'sent'. Non-retryable failure →
 * 'failed'. Retryable failure keeps status 'pending' (the loop stops and a
 * later retry picks the row up again) but records the code for the UI.
 */
export async function markRecipient(db: D1Database, broadcastId: number, did: string, result: SendResult): Promise<void> {
	const now = new Date().toISOString();
	if (result.ok) {
		await db
			.prepare(
				`UPDATE broadcast_recipients SET status = 'sent', message_id = ?1, error_code = NULL, updated_at = ?2
				 WHERE broadcast_id = ?3 AND did = ?4`
			)
			.bind(result.messageId, now, broadcastId, did)
			.run();
		return;
	}
	const status = result.retryable ? 'pending' : 'failed';
	await db
		.prepare(
			`UPDATE broadcast_recipients SET status = ?1, error_code = ?2, updated_at = ?3
			 WHERE broadcast_id = ?4 AND did = ?5`
		)
		.bind(status, result.code, now, broadcastId, did)
		.run();
}

/** Subject/body for a retry run. */
export async function getBroadcast(db: D1Database, broadcastId: number): Promise<{ id: number; subject: string; body: string } | null> {
	const row = await db
		.prepare(`SELECT id, subject, body FROM broadcasts WHERE id = ?1`)
		.bind(broadcastId)
		.first<{ id: number; subject: string; body: string }>();
	return row ?? null;
}
