import type { PageServerLoad } from './$types';
import { dev } from '$app/environment';
import { loadBskyProfile } from '@svelte-atproto/oauth/bsky';
import { actorToDid } from '@svelte-atproto/oauth/helper';
import { cloudflareKV } from '@svelte-atproto/oauth/server/stores/cloudflare';
import { retreat } from '$lib/content';
import { checkAllowlist, getResponse } from '$lib/server/db';
import type { SurveyDraft } from '$lib/survey.svelte';
import type { KnownUser } from '$lib/types';
import { deadlineStatus } from '$lib/server/deadline';

/** Enough of a DID to correlate log lines without logging the full identifier. */
const logDid = (did: string) => `${did.slice(0, 14)}…`;

export interface PageUser {
	did: string;
	handle: string | null;
	displayName: string | null;
	avatar: string | null;
}

export interface Organizer {
	handle: string;
	avatar: string | null;
}

const KNOWN_COOKIE = 'abr_known';

/** Strict shape check: the cookie value renders in the sheet and seeds login(),
 * and a sibling-subdomain page could plant a non-httpOnly copy. */
const KNOWN_HANDLE_RE = /^[a-z0-9.:-]{1,253}$/i;

function readKnownUser(raw: string | undefined): KnownUser | null {
	if (!raw) return null;
	try {
		const parsed = JSON.parse(raw) as Record<string, unknown>;
		if (typeof parsed.handle !== 'string' || !KNOWN_HANDLE_RE.test(parsed.handle)) return null;
		return {
			handle: parsed.handle,
			displayName: typeof parsed.displayName === 'string' ? parsed.displayName.slice(0, 64) : null,
			avatar:
				typeof parsed.avatar === 'string' && parsed.avatar.startsWith('https://') && parsed.avatar.length <= 512
					? parsed.avatar
					: null
		};
	} catch {
		return null;
	}
}

/** The organizer's avatar, resolved from the public appview and cached. */
async function loadOrganizer(profileCache: ReturnType<typeof cloudflareKV> | undefined): Promise<Organizer> {
	try {
		const did = await actorToDid(retreat.organizerHandle);
		if (!did) return { handle: retreat.organizerHandle, avatar: null };
		const profile = await loadBskyProfile(did, { cache: profileCache });
		return { handle: retreat.organizerHandle, avatar: profile?.avatar ?? null };
	} catch {
		return { handle: retreat.organizerHandle, avatar: null };
	}
}

export const load: PageServerLoad = async ({ locals, platform, url, cookies }) => {
	// The OAuth library redirects back with ?error=... when a login fails.
	const authError = url.searchParams.get('error');

	const { deadline, closed } = deadlineStatus(platform?.env?.DEADLINE);

	const profileCache = platform?.env?.PROFILE_CACHE
		? cloudflareKV(platform.env.PROFILE_CACHE, { ttl: 3600 })
		: undefined;

	const organizer = await loadOrganizer(profileCache);
	const knownUser = readKnownUser(cookies.get(KNOWN_COOKIE));

	// Dev-only design preview of the signed-in state; `dev` is compile-time
	// false in production builds, so this path cannot ship.
	if (dev && url.searchParams.has('preview')) {
		return {
			user: {
				did: 'did:plc:preview',
				handle: 'preview.bsky.social',
				displayName: 'Preview Builder',
				avatar: null
			} as PageUser,
			allowed: true,
			answers: null as SurveyDraft | null,
			existingResponse: false,
			organizer,
			deadline,
			closed,
			knownUser,
			authError
		};
	}

	if (!locals.did) {
		return {
			user: null as PageUser | null,
			allowed: true,
			answers: null as SurveyDraft | null,
			existingResponse: false,
			organizer,
			deadline,
			closed,
			knownUser,
			authError
		};
	}

	const profile = await loadBskyProfile(locals.did, { cache: profileCache }).catch((e) => {
		console.error('profile load failed for', logDid(locals.did), e);
		return undefined;
	});

	const user: PageUser = {
		did: locals.did,
		handle: profile?.handle ?? null,
		displayName: profile?.displayName ?? null,
		avatar: profile?.avatar ?? null
	};

	const db = platform?.env?.DB;

	// The allowlist gates the whole survey, not just submission: a signed-in
	// account that isn't invited sees the polite invite-only state and the
	// feed stays sealed. This gate is a courtesy, so it degrades OPEN: the
	// response API re-enforces authoritatively on write, and a false "not on
	// the list" screen for an invited user is worse than an uninvited one
	// browsing questions they can't submit.
	let allowed = true;
	if (db) {
		try {
			allowed = await checkAllowlist(db, { did: locals.did, handle: user.handle });
			if (!allowed && !profile) {
				// Identity resolution failed above — a handle-less lookup can't
				// confidently deny (DIDs are pre-pinned, but stay honest).
				console.error('allowlist: unverifiable without profile for', logDid(locals.did));
				allowed = true;
			}
		} catch (e) {
			console.error('allowlist check failed for', logDid(locals.did), e);
		}
	}

	// Remember who signed in (identity hint only, no credentials) so a
	// returning visitor — even after logout — gets a one-tap re-entry. Only
	// for allowed users: a denied account shouldn't be greeted back into a
	// login that will be denied again.
	if (user.handle && allowed) {
		cookies.set(
			KNOWN_COOKIE,
			JSON.stringify({ handle: user.handle, displayName: user.displayName, avatar: user.avatar }),
			// 30 days comfortably covers the survey window (see the DEADLINE
			// binding) while keeping identity-hint retention short.
			{ path: '/', maxAge: 60 * 60 * 24 * 30, httpOnly: true, sameSite: 'lax', secure: !dev }
		);
	}

	const stored =
		db && allowed
			? await getResponse(db, locals.did).catch((e) => {
					console.error('response load failed for', logDid(locals.did), e);
					return null;
				})
			: null;

	return {
		user,
		allowed,
		answers: stored?.draft ?? null,
		existingResponse: stored !== null,
		organizer,
		deadline,
		closed,
		knownUser,
		authError
	};
};
