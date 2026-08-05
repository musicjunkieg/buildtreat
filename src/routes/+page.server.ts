import type { PageServerLoad } from './$types';
import { dev } from '$app/environment';
import { loadBskyProfile } from '@svelte-atproto/oauth/bsky';
import { actorToDid } from '@svelte-atproto/oauth/helper';
import { cloudflareKV } from '@svelte-atproto/oauth/server/stores/cloudflare';
import { retreat } from '$lib/content';
import { getResponse } from '$lib/server/db';
import type { SurveyDraft } from '$lib/survey.svelte';

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

/** Non-auth identity hint so returning visitors get a one-tap sign-in. */
export interface KnownUser {
	handle: string;
	displayName: string | null;
	avatar: string | null;
}

const KNOWN_COOKIE = 'abr_known';

function readKnownUser(raw: string | undefined): KnownUser | null {
	if (!raw) return null;
	try {
		const parsed = JSON.parse(raw) as Record<string, unknown>;
		if (typeof parsed.handle !== 'string' || !parsed.handle) return null;
		return {
			handle: parsed.handle,
			displayName: typeof parsed.displayName === 'string' ? parsed.displayName : null,
			avatar: typeof parsed.avatar === 'string' ? parsed.avatar : null
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
			answers: null as SurveyDraft | null,
			existingResponse: false,
			organizer,
			knownUser,
			authError
		};
	}

	if (!locals.did) {
		return {
			user: null as PageUser | null,
			answers: null as SurveyDraft | null,
			existingResponse: false,
			organizer,
			knownUser,
			authError
		};
	}

	const profile = await loadBskyProfile(locals.did, { cache: profileCache }).catch(() => undefined);

	const user: PageUser = {
		did: locals.did,
		handle: profile?.handle ?? null,
		displayName: profile?.displayName ?? null,
		avatar: profile?.avatar ?? null
	};

	// Remember who signed in (identity hint only, no credentials) so a
	// returning visitor — even after logout — gets a one-tap re-entry.
	if (user.handle) {
		cookies.set(
			KNOWN_COOKIE,
			JSON.stringify({ handle: user.handle, displayName: user.displayName, avatar: user.avatar }),
			{ path: '/', maxAge: 60 * 60 * 24 * 180, httpOnly: true, sameSite: 'lax', secure: !dev }
		);
	}

	const db = platform?.env?.DB;
	const stored = db ? await getResponse(db, locals.did).catch(() => null) : null;

	return {
		user,
		answers: stored?.draft ?? null,
		existingResponse: stored !== null,
		organizer,
		knownUser,
		authError
	};
};
