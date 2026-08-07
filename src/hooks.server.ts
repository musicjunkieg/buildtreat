import { redirect, type Handle } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { dev } from '$app/environment';
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

/**
 * Workaround for @svelte-atproto/oauth 0.3.x: startLogin queues the
 * oauth_return_to cookie via event.cookies.set(), but the login handler
 * returns its own Response straight from the handle hook — bypassing
 * resolve(), which is what serializes queued cookies. The cookie never
 * reaches the browser, so the OAuth callback always falls back to "/"
 * (an organizer signing in at /organizer landed on the survey).
 * Until it's fixed upstream, set the cookie ourselves on the way out.
 */
const RETURN_TO_RE = /^\/(?!\/)/;
const returnToFix: Handle = async ({ event, resolve }) => {
	if (event.url.pathname !== '/oauth/login' || event.request.method !== 'POST') {
		return resolve(event);
	}

	let returnTo: string | null = null;
	try {
		const clone = event.request.clone();
		if ((clone.headers.get('content-type') ?? '').includes('application/json')) {
			const body = (await clone.json()) as { returnTo?: unknown };
			if (typeof body.returnTo === 'string') returnTo = body.returnTo;
		} else {
			const fd = await clone.formData();
			const v = fd.get('returnTo');
			if (typeof v === 'string') returnTo = v;
		}
	} catch {
		// Unparseable body — the library will reject it; nothing to do here.
	}

	const response = await resolve(event);

	// Same safety and lifetime rules as the library's own cookie: relative
	// path only (no scheme-relative //), 10 minutes, value encoded the way
	// the callback's decodeURIComponent expects.
	if (response.ok && returnTo && RETURN_TO_RE.test(returnTo)) {
		// `Secure` only outside dev, mirroring the library (the dev server is
		// plain http and the browser would drop a Secure cookie there).
		response.headers.append(
			'set-cookie',
			`oauth_return_to=${encodeURIComponent(returnTo)}; Path=/; HttpOnly; SameSite=Lax;${dev ? '' : ' Secure;'} Max-Age=600`
		);
	}
	return response;
};

export const handle = sequence(canonicalize, returnToFix, atproto.handle);
