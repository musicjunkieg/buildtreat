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

export const load: PageServerLoad = async ({ locals, platform, url }) => {
	// The OAuth library redirects back with ?error=... when a login fails.
	const authError = url.searchParams.get('error');

	const profileCache = platform?.env?.PROFILE_CACHE
		? cloudflareKV(platform.env.PROFILE_CACHE, { ttl: 3600 })
		: undefined;

	const organizer = await loadOrganizer(profileCache);

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
			authError
		};
	}

	if (!locals.did) {
		return {
			user: null as PageUser | null,
			answers: null as SurveyDraft | null,
			existingResponse: false,
			organizer,
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

	const db = platform?.env?.DB;
	const stored = db ? await getResponse(db, locals.did).catch(() => null) : null;

	return {
		user,
		answers: stored?.draft ?? null,
		existingResponse: stored !== null,
		organizer,
		authError
	};
};
