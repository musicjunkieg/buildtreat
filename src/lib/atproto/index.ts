import { createAtprotoAuth } from '@svelte-atproto/oauth/server';
import { cloudflareKV } from '@svelte-atproto/oauth/server/stores/cloudflare';
import { env } from '$env/dynamic/private';

/**
 * ATProto OAuth, identity-only (`atproto` scope): sign-in tells us who the
 * respondent is; we never read or write their repo beyond that.
 *
 * In dev (no ORIGIN set) the library runs its loopback client against
 * 127.0.0.1 and the KV stores fall back to in-memory. On Cloudflare the
 * bindings below are real KV namespaces.
 */
export const atproto = createAtprotoAuth({
	origin: env.ORIGIN || undefined,
	cookieSecret: env.COOKIE_SECRET,
	clientAssertionKey: env.CLIENT_ASSERTION_KEY,
	scope: 'atproto',
	sessions: cloudflareKV('OAUTH_SESSIONS'),
	states: cloudflareKV('OAUTH_STATES', { ttl: 600 })
});
