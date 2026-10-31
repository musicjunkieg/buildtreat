import type { D1Database } from '@cloudflare/workers-types';
import type { SendResult } from './email';
import { isAudience, isChannel, type Audience, type Channel, type RecipientInput } from './audiences';

export * from './audiences';

/**
 * D1 access + orchestration for organizer broadcasts — email via comail or
 * Bluesky DMs via the chat service. Recipients are snapshotted per
 * broadcast; each row's status is the source of truth for what has actually
 * been handed to the transport. All queries are parameterized.
 * Schema: migrations/0005_broadcasts.sql (+ 0007 audience, 0009 channel/handle).
 */

export interface BroadcastRecipient {
	did: string;
	email: string;
	handle: string | null;
	status: 'pending' | 'sent' | 'failed';
	errorCode: string | null;
	messageId: string | null;
}

export interface BroadcastView {
	id: number;
	channel: Channel;
	/** Empty for DMs — the chat message has no subject line. */
	subject: string;
	body: string;
	audience: Audience;
	sentBy: string;
	createdAt: string;
	recipients: BroadcastRecipient[];
}

/** Insert the broadcast plus one pending row per recipient; returns its id. */
export async function createBroadcast(
	db: D1Database,
	input: { channel: Channel; subject: string; body: string; audience: Audience; sentBy: string; recipients: RecipientInput[] }
): Promise<number> {
	const now = new Date().toISOString();
	const row = await db
		.prepare(
			`INSERT INTO broadcasts (channel, subject, body, audience, sent_by, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6) RETURNING id`
		)
		.bind(input.channel, input.subject, input.body, input.audience, input.sentBy, now)
		.first<{ id: number }>();
	if (!row) throw new Error('broadcast insert returned no id');
	if (input.recipients.length) {
		await db.batch(
			input.recipients.map((r) =>
				db
					.prepare(
						`INSERT INTO broadcast_recipients (broadcast_id, did, email, handle, status, updated_at)
						 VALUES (?1, ?2, ?3, ?4, 'pending', ?5)`
					)
					.bind(row.id, r.did, r.email, r.handle ?? null, now)
			)
		);
	}
	return row.id;
}

/** All broadcasts, newest first, with their full recipient rows. */
export async function listBroadcasts(db: D1Database): Promise<BroadcastView[]> {
	const [broadcasts, recipients] = await db.batch([
		db.prepare(`SELECT id, channel, subject, body, audience, sent_by, created_at FROM broadcasts ORDER BY id DESC`),
		db.prepare(
			`SELECT broadcast_id, did, email, handle, status, error_code, message_id FROM broadcast_recipients ORDER BY email, handle`
		)
	]);
	const byId = new Map<number, BroadcastView>();
	for (const b of broadcasts.results as Array<{
		id: number;
		channel: string;
		subject: string;
		body: string;
		audience: string;
		sent_by: string;
		created_at: string;
	}>) {
		byId.set(b.id, {
			id: b.id,
			channel: isChannel(b.channel) ? b.channel : 'email',
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
		handle: string | null;
		status: 'pending' | 'sent' | 'failed';
		error_code: string | null;
		message_id: string | null;
	}>) {
		byId.get(r.broadcast_id)?.recipients.push({
			did: r.did,
			email: r.email,
			handle: r.handle,
			status: r.status,
			errorCode: r.error_code,
			messageId: r.message_id
		});
	}
	return [...byId.values()];
}

/** The retry worklist: everything not yet successfully handed to the transport. */
export async function unsentRecipients(db: D1Database, broadcastId: number): Promise<BroadcastRecipient[]> {
	const rows = await db
		.prepare(
			`SELECT did, email, handle, status, error_code, message_id FROM broadcast_recipients
			 WHERE broadcast_id = ?1 AND status != 'sent' ORDER BY email, handle`
		)
		.bind(broadcastId)
		.all<{
			did: string;
			email: string;
			handle: string | null;
			status: 'pending' | 'failed';
			error_code: string | null;
			message_id: string | null;
		}>();
	return rows.results.map((r) => ({
		did: r.did,
		email: r.email,
		handle: r.handle,
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

/** Channel + subject/body for a retry run. */
export async function getBroadcast(
	db: D1Database,
	broadcastId: number
): Promise<{ id: number; channel: Channel; subject: string; body: string } | null> {
	const row = await db
		.prepare(`SELECT id, channel, subject, body FROM broadcasts WHERE id = ?1`)
		.bind(broadcastId)
		.first<{ id: number; channel: string; subject: string; body: string }>();
	if (!row) return null;
	return { id: row.id, channel: isChannel(row.channel) ? row.channel : 'email', subject: row.subject, body: row.body };
}

export interface BroadcastRunResult {
	sent: number;
	failed: number;
	/** Error code that halted the run, or null if it walked the whole list. */
	stopped: string | null;
}

/**
 * Walk the worklist sequentially. Hard failures are recorded and skipped;
 * a retryable failure (rate limit, relay hiccup, expired token) is
 * recorded, then the run stops — during comail's warming period a 429
 * means every later send would also fail, so the retry button resumes
 * where this left off. `send` gets the whole row: email uses the address,
 * DM uses the DID.
 */
export async function runBroadcast(
	recipients: BroadcastRecipient[],
	send: (recipient: BroadcastRecipient) => Promise<SendResult>,
	mark: (did: string, result: SendResult) => Promise<void>
): Promise<BroadcastRunResult> {
	let sent = 0;
	let failed = 0;
	for (const r of recipients) {
		const result = await send(r);
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
