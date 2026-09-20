import type { SendResult } from './email';
export { DM_MAX_GRAPHEMES, graphemeCount } from '$lib/dm-text';

/**
 * Bluesky DM transport for organizer broadcasts. Signs in to the sending
 * account with an app password (the OAuth session the organizer signed in
 * with only carries the `atproto` scope, and the auth library pins one
 * scope per client, so chat can't ride on it). Chat calls go to the PDS
 * with the `atproto-proxy` header so it forwards them to the chat service.
 * One recipient per `sendDm`; broadcasts loop and record each outcome, the
 * same shape as email.ts so runBroadcast treats both channels alike.
 */

/** The slice of Platform env the transport needs (callers pass platform.env). */
export interface DmEnv {
	/** Handle (or DID) of the account the DMs come from. */
	BSKY_DM_HANDLE?: string;
	/** App password for that account, created with "Allow access to your direct messages". */
	BSKY_DM_APP_PASSWORD?: string;
	/** PDS origin; defaults to the bsky.social entryway. */
	BSKY_DM_PDS?: string;
}

export interface DmSession {
	pds: string;
	did: string;
	accessJwt: string;
}

export type DmSessionResult = { ok: true; session: DmSession } | { ok: false; code: string; detail?: string };

export interface LinkFacet {
	index: { byteStart: number; byteEnd: number };
	features: Array<{ $type: 'app.bsky.richtext.facet#link'; uri: string }>;
}

const DEFAULT_PDS = 'https://bsky.social';
const CHAT_PROXY = 'did:web:api.bsky.chat#bsky_chat';

// Refusals the chat service returns as 400s that belong to the recipient (or
// the pair), not the run — MessagesDisabled, NotFollowedBySender,
// BlockedActor, BlockedSubject, RecipientNotFound, AccountSuspended,
// ConvoLocked, InvalidConvo. Retrying later would produce the same answer,
// so the row is marked failed (code = the error name) and the loop moves on.

export function dmConfigured(env: DmEnv): boolean {
	return Boolean(env.BSKY_DM_HANDLE && env.BSKY_DM_APP_PASSWORD);
}

function pdsOrigin(env: DmEnv): string {
	return (env.BSKY_DM_PDS || DEFAULT_PDS).replace(/\/+$/, '');
}

interface XrpcError {
	status: number;
	error: string;
	message?: string;
}

async function xrpcError(res: Response): Promise<XrpcError> {
	let body: unknown = null;
	try {
		body = await res.json();
	} catch {
		/* non-JSON body: fall through to the HTTP status */
	}
	const parsed = (body ?? {}) as { error?: unknown; message?: unknown };
	return {
		status: res.status,
		error: typeof parsed.error === 'string' ? parsed.error : `HTTP_${res.status}`,
		...(typeof parsed.message === 'string' ? { message: parsed.message } : {})
	};
}

/** Sign in once per run; the access token is short-lived but outlasts a broadcast. */
export async function createDmSession(env: DmEnv, fetchFn: typeof fetch = fetch): Promise<DmSessionResult> {
	if (!dmConfigured(env)) return { ok: false, code: 'NOT_CONFIGURED' };
	const pds = pdsOrigin(env);
	let res: Response;
	try {
		res = await fetchFn(`${pds}/xrpc/com.atproto.server.createSession`, {
			method: 'POST',
			signal: AbortSignal.timeout(10_000),
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ identifier: env.BSKY_DM_HANDLE, password: env.BSKY_DM_APP_PASSWORD })
		});
	} catch (e) {
		return { ok: false, code: 'NETWORK', detail: String(e) };
	}
	if (!res.ok) {
		const err = await xrpcError(res);
		return { ok: false, code: err.error, ...(err.message ? { detail: err.message } : {}) };
	}
	let body: { did?: unknown; accessJwt?: unknown };
	try {
		body = (await res.json()) as typeof body;
	} catch {
		return { ok: false, code: 'BAD_RESPONSE', detail: 'createSession returned non-JSON' };
	}
	if (typeof body.did !== 'string' || typeof body.accessJwt !== 'string') {
		return { ok: false, code: 'BAD_RESPONSE', detail: 'createSession returned no token' };
	}
	return { ok: true, session: { pds, did: body.did, accessJwt: body.accessJwt } };
}

/** Handle → DID for the test-send box; null when it doesn't resolve. */
export async function resolveHandle(session: DmSession, handle: string, fetchFn: typeof fetch = fetch): Promise<string | null> {
	const clean = handle.trim().replace(/^@/, '').toLowerCase();
	if (!clean) return null;
	try {
		const res = await fetchFn(`${session.pds}/xrpc/com.atproto.identity.resolveHandle?handle=${encodeURIComponent(clean)}`, {
			signal: AbortSignal.timeout(10_000),
			headers: { Authorization: `Bearer ${session.accessJwt}` }
		});
		if (!res.ok) return null;
		const body = (await res.json()) as { did?: unknown };
		return typeof body.did === 'string' ? body.did : null;
	} catch {
		return null;
	}
}

async function chatCall(
	session: DmSession,
	nsid: string,
	init: { method: 'GET'; query: Record<string, string> } | { method: 'POST'; body: unknown },
	fetchFn: typeof fetch
): Promise<{ ok: true; body: unknown } | { ok: false; result: SendResult }> {
	const query = init.method === 'GET' ? `?${new URLSearchParams(init.query)}` : '';
	let res: Response;
	try {
		res = await fetchFn(`${session.pds}/xrpc/${nsid}${query}`, {
			method: init.method,
			signal: AbortSignal.timeout(10_000),
			headers: {
				Authorization: `Bearer ${session.accessJwt}`,
				'atproto-proxy': CHAT_PROXY,
				...(init.method === 'POST' ? { 'Content-Type': 'application/json' } : {})
			},
			...(init.method === 'POST' ? { body: JSON.stringify(init.body) } : {})
		});
	} catch (e) {
		return { ok: false, result: { ok: false, code: 'NETWORK', retryable: true, detail: String(e) } };
	}
	if (res.ok) {
		try {
			return { ok: true, body: await res.json() };
		} catch {
			return { ok: false, result: { ok: false, code: 'BAD_RESPONSE', retryable: true, detail: `${nsid} returned non-JSON` } };
		}
	}
	const err = await xrpcError(res);
	// 401 means our token, not their inbox: stop the run so Retry re-signs in.
	// Any other 4xx (the RECIPIENT_ERRORS set, or something unlisted) is a
	// per-recipient refusal that a later attempt would repeat.
	const retryable = res.status === 401 || res.status === 429 || res.status >= 500;
	return {
		ok: false,
		result: { ok: false, code: err.error, retryable, ...(err.message ? { detail: err.message } : {}) }
	};
}

/**
 * Open (or find) the 1:1 convo with `did`, then post `text` into it. Links
 * in the text become facets so they're tappable in the app. The message
 * view's id is the messageId recorded on the recipient row.
 */
export async function sendDm(session: DmSession, did: string, text: string, fetchFn: typeof fetch = fetch): Promise<SendResult> {
	const convo = await chatCall(session, 'chat.bsky.convo.getConvoForMembers', { method: 'GET', query: { members: did } }, fetchFn);
	if (!convo.ok) return convo.result;
	const convoId = (convo.body as { convo?: { id?: unknown } }).convo?.id;
	if (typeof convoId !== 'string') return { ok: false, code: 'BAD_RESPONSE', retryable: true, detail: 'getConvoForMembers returned no convo id' };

	const facets = linkFacets(text);
	const sent = await chatCall(
		session,
		'chat.bsky.convo.sendMessage',
		{ method: 'POST', body: { convoId, message: { text, ...(facets.length ? { facets } : {}) } } },
		fetchFn
	);
	if (!sent.ok) return sent.result;
	const id = (sent.body as { id?: unknown }).id;
	if (typeof id !== 'string') return { ok: false, code: 'BAD_RESPONSE', retryable: true, detail: 'sendMessage returned no message id' };
	return { ok: true, messageId: id };
}

// Same shape as the app's own link detector: an explicit http(s) URL, or a
// bare domain on a TLD we'd actually paste into a retreat message. The TLD
// list is deliberately short — a false positive turns a stray "v1.2" into a
// link; a miss just leaves text un-tappable.
const LINK_RE = /(^|\s|\()((https?:\/\/\S+)|((?:[a-z0-9-]+\.)+(?:at|com|org|net|social|dev|app|io|me|co|us|uk|ca|xyz)(?:\/\S*)?))/gi;
const TRAILING_PUNCT = /[.,;:!?'"’”]+$/;

/** app.bsky.richtext.facet#link entries for every URL in `text`, byte-indexed. */
export function linkFacets(text: string): LinkFacet[] {
	const enc = new TextEncoder();
	const out: LinkFacet[] = [];
	for (const m of text.matchAll(LINK_RE)) {
		let uri = m[2];
		const start = m.index! + m[1].length;
		// A bare-domain match must not swallow the local part of an email.
		if (!/^https?:\/\//i.test(uri) && start > 0 && text[start - 1] === '@') continue;
		uri = uri.replace(TRAILING_PUNCT, '');
		// Drop a closing paren that doesn't pair with one inside the URL.
		while (uri.endsWith(')') && (uri.match(/\(/g)?.length ?? 0) < (uri.match(/\)/g)?.length ?? 0)) uri = uri.slice(0, -1);
		if (!uri) continue;
		const byteStart = enc.encode(text.slice(0, start)).length;
		const byteEnd = byteStart + enc.encode(uri).length;
		const href = /^https?:\/\//i.test(uri) ? uri : `https://${uri}`;
		out.push({ index: { byteStart, byteEnd }, features: [{ $type: 'app.bsky.richtext.facet#link', uri: href }] });
	}
	return out;
}
