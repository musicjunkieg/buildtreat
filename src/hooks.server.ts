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
	if (origin) {
		const canonicalHost = new URL(origin).hostname;
		if (event.url.hostname.endsWith('.workers.dev') && event.url.hostname !== canonicalHost) {
			redirect(301, origin + event.url.pathname + event.url.search);
		}
	}
	return resolve(event);
};

export const handle = sequence(canonicalize, atproto.handle);
