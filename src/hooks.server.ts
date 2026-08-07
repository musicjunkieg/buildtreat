import { redirect, type Handle } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { atproto } from '$lib/atproto';

/**
 * The worker still answers on its workers.dev hostname; canonicalize to the
 * real domain so old links keep working and OAuth (whose client_id is bound
 * to ORIGIN) never runs on the wrong host.
 */
const canonicalize: Handle = async ({ event, resolve }) => {
	const origin = event.platform?.env?.ORIGIN;
	if (origin && URL.canParse(origin)) {
		const canonicalHost = new URL(origin).hostname;
		if (event.url.hostname.endsWith('.workers.dev') && event.url.hostname !== canonicalHost) {
			// 308, not 301: a redirected PUT /api/response must keep its method
			// and body.
			const target = new URL(origin);
			target.pathname = event.url.pathname;
			target.search = event.url.search;
			redirect(308, target.toString());
		}
	}
	return resolve(event);
};

export const handle = sequence(canonicalize, atproto.handle);
