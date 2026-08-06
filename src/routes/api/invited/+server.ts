import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { actorToDid } from '@svelte-atproto/oauth/helper';
import { peekAllowlist } from '$lib/server/db';

/**
 * Pre-auth invite check so the sign-in sheet can tell an uninvited handle
 * immediately, before the OAuth round-trip to their PDS. Every failure mode
 * answers `invited: true` — this endpoint only ever short-circuits the happy
 * path; real enforcement happens after auth (page load + response API).
 */
export const GET: RequestHandler = async ({ url, platform }) => {
	const raw = url.searchParams.get('handle')?.trim().replace(/^@/, '') ?? '';
	const db = platform?.env?.DB;
	if (!raw || raw.length > 512 || !db) return json({ invited: true });

	const isDid = raw.startsWith('did:');
	// Resolve the handle so an entry whose DID was pinned still matches after
	// a handle change.
	const did = isDid ? raw : ((await actorToDid(raw).catch(() => null)) ?? null);

	// Unresolvable handle (resolver hiccup or typo): a handle-only lookup
	// could wrongly deny someone whose listed handle is stale, so answer the
	// non-answer and let the login flow surface any real problem.
	if (!isDid && did === null) return json({ invited: true });

	const invited = await peekAllowlist(db, { did, handle: isDid ? null : raw }).catch(() => true);
	return json({ invited });
};
