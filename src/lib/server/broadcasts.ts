import type { D1Database } from '@cloudflare/workers-types';
import type { SendResult } from './email';

/**
 * D1 access + orchestration for organizer email broadcasts. Recipients are
 * snapshotted per broadcast; each row's status is the source of truth for
 * what has actually been handed to comail. All queries are parameterized.
 * Schema: migrations/0005_broadcasts.sql (+ 0007 audience column).
 */

export interface RecipientInput {
	did: string;
	email: string;
}

/**
 * Who a broadcast goes to. 'all' / 'yes' / 'maybe' / 'no' select survey
 * respondents (by their interest answer); 'travel' selects respondents who
 * said they could cover only some or none of their travel and haven't yet
 * answered the registration's support questions (and haven't declined);
 * 'waitlist' selects entries still waiting for a promotion. Stored on the
 * broadcast row so the history says which list each message went to.
 */
export const AUDIENCES = ['all', 'yes', 'maybe', 'no', 'travel', 'waitlist'] as const;
export type Audience = (typeof AUDIENCES)[number];

export const audienceLabels: Record<Audience, string> = {
	all: 'Everyone',
	yes: 'Yes',
	maybe: 'Maybe',
	no: 'No',
	travel: 'Travel help',
	waitlist: 'Waitlist'
};

export function isAudience(value: string): value is Audience {
	return (AUDIENCES as readonly string[]).includes(value);
}

export interface AudienceCount {
	id: Audience;
	label: string;
	count: number;
}

export interface AudienceResponse {
	did: string;
	email: string;
	interest: string;
	/** Survey travel answer; null when the respondent never reached that question. */
	travel?: string | null;
}

export interface AudienceWaitlistEntry {
	did: string;
	email: string;
	promotedAt: string | null;
}

/** The slice of a registration row the 'travel' audience needs. */
export interface AudienceRegistration {
	did: string;
	email: string;
	status: 'confirmed' | 'declined';
	supportNeed: string | null;
}

/**
 * Resolve an audience to its deduped recipient list. Survey audiences read
 * the interest column; the waitlist audience takes entries not yet promoted
 * (a promoted person is on the allowlist and reachable through the survey).
 * The travel audience is the nudge list for the support questions: survey
 * said partial/no, no answer yet, not declined — mailed at the registration
 * email when there is one, since that's the address they confirmed last.
 */
export function audienceRecipients(
	audience: Audience,
	responses: AudienceResponse[],
	waitlist: AudienceWaitlistEntry[],
	registrations: AudienceRegistration[] = []
): RecipientInput[] {
	if (audience === 'waitlist') {
		return dedupeRecipients(waitlist.filter((w) => w.promotedAt === null).map((w) => ({ did: w.did, email: w.email })));
	}
	if (audience === 'travel') {
		const regByDid = new Map(registrations.map((r) => [r.did, r]));
		const picked = responses.filter((r) => {
			if (r.travel !== 'partial' && r.travel !== 'no') return false;
			const reg = regByDid.get(r.did);
			return !reg || (reg.status === 'confirmed' && reg.supportNeed === null);
		});
		return dedupeRecipients(picked.map((r) => ({ did: r.did, email: regByDid.get(r.did)?.email || r.email })));
	}
	const picked = audience === 'all' ? responses : responses.filter((r) => r.interest === audience);
	return dedupeRecipients(picked.map((r) => ({ did: r.did, email: r.email })));
}

/** Recipient counts for every audience — what the compose form's selector shows. */
export function audienceCounts(
	responses: AudienceResponse[],
	waitlist: AudienceWaitlistEntry[],
	registrations: AudienceRegistration[] = []
): AudienceCount[] {
	return AUDIENCES.map((id) => ({
		id,
		label: audienceLabels[id],
		count: audienceRecipients(id, responses, waitlist, registrations).length
	}));
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
	audience: Audience;
	sentBy: string;
	createdAt: string;
	recipients: BroadcastRecipient[];
}

/** First occurrence wins; comparison is on the lowercased, trimmed email. */
export function dedupeRecipients(rows: RecipientInput[]): RecipientInput[] {
	const seen = new Set<string>();
	const out: RecipientInput[] = [];
	for (const row of rows) {
		const email = row.email.trim();
		const key = email.toLowerCase();
		if (!key || seen.has(key)) continue;
		seen.add(key);
		out.push({ ...row, email });
	}
	return out;
}

/** Insert the broadcast plus one pending row per recipient; returns its id. */
export async function createBroadcast(
	db: D1Database,
	input: { subject: string; body: string; audience: Audience; sentBy: string; recipients: RecipientInput[] }
): Promise<number> {
	const now = new Date().toISOString();
	const row = await db
		.prepare(
			`INSERT INTO broadcasts (subject, body, audience, sent_by, created_at) VALUES (?1, ?2, ?3, ?4, ?5) RETURNING id`
		)
		.bind(input.subject, input.body, input.audience, input.sentBy, now)
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
		db.prepare(`SELECT id, subject, body, audience, sent_by, created_at FROM broadcasts ORDER BY id DESC`),
		db.prepare(
			`SELECT broadcast_id, did, email, status, error_code, message_id FROM broadcast_recipients ORDER BY email`
		)
	]);
	const byId = new Map<number, BroadcastView>();
	for (const b of broadcasts.results as Array<{
		id: number;
		subject: string;
		body: string;
		audience: string;
		sent_by: string;
		created_at: string;
	}>) {
		byId.set(b.id, {
			id: b.id,
			subject: b.subject,
			body: b.body,
			// Rows older than migration 0007 carry the column default; anything
			// unexpected reads as 'all' rather than breaking the history render.
			audience: isAudience(b.audience) ? b.audience : 'all',
			sentBy: b.sent_by,
			createdAt: b.created_at,
			recipients: []
		});
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

export interface BroadcastRunResult {
	sent: number;
	failed: number;
	/** Error code that halted the run, or null if it walked the whole list. */
	stopped: string | null;
}

/**
 * Walk the worklist sequentially. Hard failures are recorded and skipped;
 * a retryable failure (rate limit, relay hiccup) is recorded, then the run
 * stops — during comail's warming period a 429 means every later send
 * would also fail, so the retry button resumes where this left off.
 */
export async function runBroadcast(
	recipients: BroadcastRecipient[],
	send: (email: string) => Promise<SendResult>,
	mark: (did: string, result: SendResult) => Promise<void>
): Promise<BroadcastRunResult> {
	let sent = 0;
	let failed = 0;
	for (const r of recipients) {
		const result = await send(r.email);
		await mark(r.did, result);
		if (result.ok) {
			sent++;
		} else if (result.retryable) {
			return { sent, failed, stopped: result.code };
		} else {
			failed++;
		}
	}
	return { sent, failed, stopped: null };
}
