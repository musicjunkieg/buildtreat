import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { peekAllowlist } from '$lib/server/db';

const HANDLE_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i;
const DID_RE = /^did:[a-z]+:[a-zA-Z0-9._:%-]+$/;

/**
 * Resolve a handle through the public appview so this Worker only ever talks
 * to public.api.bsky.app — a direct actorToDid here would fetch
 * https://<caller-string>/.well-known/atproto-did, an open request-forgery
 * primitive on an unauthenticated endpoint.
 */
async function resolveHandle(handle: string): Promise<string | null> {
	try {
		const res = await fetch(
			`https://public.api.bsky.app/xrpc/com.atproto.identity.resolveHandle?handle=${encodeURIComponent(handle)}`,
			{ signal: AbortSignal.timeout(3000) }
		);
		if (!res.ok) return null;
		const data = (await res.json()) as { did?: unknown };
		return typeof data.did === 'string' ? data.did : null;
	} catch {
		return null;
	}
}

/**
 * Coarse per-IP fixed-window throttle on the KV cache namespace. KV writes
 * aren't atomic, so a racing burst can slip a few extra requests through —
 * fine for taking the bulk-probing edge off an endpoint whose worst answer
 * is a boolean. Failures never block the caller.
 */
const RL_PER_MINUTE = 20;

async function rateLimited(kv: App.Platform['env']['PROFILE_CACHE'] | undefined, ip: string): Promise<boolean> {
	if (!kv || !ip) return false;
	try {
		const key = `rl:invited:${ip}:${Math.floor(Date.now() / 60_000)}`;
		const n = Number((await kv.get(key)) ?? '0') + 1;
		await kv.put(key, String(n), { expirationTtl: 120 });
		return n > RL_PER_MINUTE;
	} catch {
		return false;
	}
}

/**
 * Pre-auth invite check so the sign-in sheet can tell an uninvited handle
 * immediately, before the OAuth round-trip to their PDS. Anything short of a
 * confident, well-formed "no" answers `invited: true` — this endpoint only
 * ever short-circuits the happy path; real enforcement happens after auth
 * (page load + response API).
 */
export const GET: RequestHandler = async ({ url, platform, request }) => {
	const raw = url.searchParams.get('handle')?.trim().replace(/^@/, '') ?? '';
	const db = platform?.env?.DB;
	if (!raw || raw.length > 253 || !db) return json({ invited: true });

	// Budget exhausted → the same non-answer as every other soft failure.
	const ip = request.headers.get('cf-connecting-ip') ?? '';
	if (await rateLimited(platform?.env?.PROFILE_CACHE, ip)) return json({ invited: true });

	const isDid = raw.startsWith('did:');
	if (isDid ? !DID_RE.test(raw) : !HANDLE_RE.test(raw)) return json({ invited: true });

	// Resolve the handle so an entry whose DID was pinned still matches after
	// a handle change. Unresolvable (resolver hiccup or typo) is a non-answer:
	// a handle-only lookup could wrongly deny someone whose listed handle is
	// stale, so proceed to login and let it surface any real problem.
	const did = isDid ? raw : await resolveHandle(raw);
	if (!isDid && did === null) return json({ invited: true });

	const invited = await peekAllowlist(db, { did, handle: isDid ? null : raw }).catch(() => true);
	return json({ invited });
};
