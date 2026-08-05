import type { PageServerLoad } from './$types';
import { loadBskyProfile } from '@svelte-atproto/oauth/bsky';
import { cloudflareKV } from '@svelte-atproto/oauth/server/stores/cloudflare';
import { getResponse } from '$lib/server/db';
import type { SurveyDraft } from '$lib/survey.svelte';

export interface PageUser {
	did: string;
	handle: string | null;
	displayName: string | null;
	avatar: string | null;
}

export const load: PageServerLoad = async ({ locals, platform, url }) => {
	// The OAuth library redirects back with ?error=... when a login fails.
	const authError = url.searchParams.get('error');

	if (!locals.did) {
		return {
			user: null as PageUser | null,
			answers: null as SurveyDraft | null,
			existingResponse: false,
			authError
		};
	}

	const profileCache = platform?.env?.PROFILE_CACHE
		? cloudflareKV(platform.env.PROFILE_CACHE, { ttl: 3600 })
		: undefined;
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
		authError
	};
};
