import { describe, expect, it, vi } from 'vitest';
import {
	DM_MAX_GRAPHEMES,
	createDmSession,
	dmConfigured,
	graphemeCount,
	linkFacets,
	resolveHandle,
	sendDm,
	type DmEnv,
	type DmSession
} from './bsky-dm';

const ENV: DmEnv = { BSKY_DM_HANDLE: 'buildersretre.at', BSKY_DM_APP_PASSWORD: 'abcd-efgh-ijkl-mnop' };
const SESSION: DmSession = { pds: 'https://bsky.social', did: 'did:plc:sender', accessJwt: 'jwt' };

function jsonResponse(status: number, body: unknown): Response {
	return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

type Call = [string, RequestInit];
const calls = (fn: ReturnType<typeof vi.fn>) => fn.mock.calls as unknown as Call[];

describe('dmConfigured', () => {
	it('needs both the handle and the app password', () => {
		expect(dmConfigured(ENV)).toBe(true);
		expect(dmConfigured({ ...ENV, BSKY_DM_APP_PASSWORD: undefined })).toBe(false);
		expect(dmConfigured({})).toBe(false);
	});
});

describe('createDmSession', () => {
	it('refuses without calling fetch when unconfigured', async () => {
		const fetchFn = vi.fn();
		expect(await createDmSession({}, fetchFn as unknown as typeof fetch)).toEqual({
			ok: false,
			code: 'NOT_CONFIGURED'
		});
		expect(fetchFn).not.toHaveBeenCalled();
	});

	it('posts identifier + password to the configured PDS and keeps the access token', async () => {
		const fetchFn = vi.fn(async () => jsonResponse(200, { did: 'did:plc:sender', handle: 'buildersretre.at', accessJwt: 'jwt', refreshJwt: 'r' }));
		const res = await createDmSession({ ...ENV, BSKY_DM_PDS: 'https://pds.example/' }, fetchFn as unknown as typeof fetch);
		expect(res).toEqual({ ok: true, session: { pds: 'https://pds.example', did: 'did:plc:sender', accessJwt: 'jwt' } });
		const [url, init] = calls(fetchFn)[0];
		expect(url).toBe('https://pds.example/xrpc/com.atproto.server.createSession');
		expect(JSON.parse(init.body as string)).toEqual({ identifier: 'buildersretre.at', password: 'abcd-efgh-ijkl-mnop' });
	});

	it('defaults to bsky.social and surfaces the XRPC error name', async () => {
		const fetchFn = vi.fn(async () => jsonResponse(401, { error: 'AuthenticationRequired', message: 'Invalid identifier or password' }));
		const res = await createDmSession(ENV, fetchFn as unknown as typeof fetch);
		expect(res).toEqual({ ok: false, code: 'AuthenticationRequired', detail: 'Invalid identifier or password' });
		expect(calls(fetchFn)[0][0]).toBe('https://bsky.social/xrpc/com.atproto.server.createSession');
	});

	it('reports a network failure as NETWORK', async () => {
		const fetchFn = vi.fn(async () => {
			throw new TypeError('fetch failed');
		});
		const res = await createDmSession(ENV, fetchFn as unknown as typeof fetch);
		expect(res).toMatchObject({ ok: false, code: 'NETWORK' });
	});
});

describe('resolveHandle', () => {
	it('returns the DID for a handle, tolerating a leading @', async () => {
		const fetchFn = vi.fn(async () => jsonResponse(200, { did: 'did:plc:target' }));
		expect(await resolveHandle(SESSION, '@Someone.bsky.social', fetchFn as unknown as typeof fetch)).toBe('did:plc:target');
		expect(calls(fetchFn)[0][0]).toBe('https://bsky.social/xrpc/com.atproto.identity.resolveHandle?handle=someone.bsky.social');
	});

	it('returns null when the handle does not resolve', async () => {
		const fetchFn = vi.fn(async () => jsonResponse(400, { error: 'InvalidRequest', message: 'Unable to resolve handle' }));
		expect(await resolveHandle(SESSION, 'nobody.example', fetchFn as unknown as typeof fetch)).toBeNull();
	});
});

describe('sendDm', () => {
	it('opens the convo through the chat proxy, then sends the message with link facets', async () => {
		const fetchFn = vi
			.fn()
			.mockResolvedValueOnce(jsonResponse(200, { convo: { id: 'convo1' } }))
			.mockResolvedValueOnce(jsonResponse(200, { id: 'msg1', rev: 'a', text: 'x', sender: { did: 'did:plc:sender' }, sentAt: 'now' }));
		const res = await sendDm(SESSION, 'did:plc:target', 'Register at buildersretre.at/register please', fetchFn as unknown as typeof fetch);
		expect(res).toEqual({ ok: true, messageId: 'msg1' });

		const [convoUrl, convoInit] = calls(fetchFn)[0];
		expect(convoUrl).toBe('https://bsky.social/xrpc/chat.bsky.convo.getConvoForMembers?members=did%3Aplc%3Atarget');
		const convoHeaders = convoInit.headers as Record<string, string>;
		expect(convoHeaders['atproto-proxy']).toBe('did:web:api.bsky.chat#bsky_chat');
		expect(convoHeaders.Authorization).toBe('Bearer jwt');

		const [sendUrl, sendInit] = calls(fetchFn)[1];
		expect(sendUrl).toBe('https://bsky.social/xrpc/chat.bsky.convo.sendMessage');
		expect(sendInit.method).toBe('POST');
		expect((sendInit.headers as Record<string, string>)['atproto-proxy']).toBe('did:web:api.bsky.chat#bsky_chat');
		expect(JSON.parse(sendInit.body as string)).toEqual({
			convoId: 'convo1',
			message: {
				text: 'Register at buildersretre.at/register please',
				facets: [
					{
						index: { byteStart: 12, byteEnd: 37 },
						features: [{ $type: 'app.bsky.richtext.facet#link', uri: 'https://buildersretre.at/register' }]
					}
				]
			}
		});
	});

	it('omits facets when the text has no links', async () => {
		const fetchFn = vi
			.fn()
			.mockResolvedValueOnce(jsonResponse(200, { convo: { id: 'c' } }))
			.mockResolvedValueOnce(jsonResponse(200, { id: 'm' }));
		await sendDm(SESSION, 'did:plc:t', 'hello there', fetchFn as unknown as typeof fetch);
		expect(JSON.parse(calls(fetchFn)[1][1].body as string)).toEqual({ convoId: 'c', message: { text: 'hello there' } });
	});

	it('maps recipient-side refusals to a hard failure and skips the send', async () => {
		for (const name of ['MessagesDisabled', 'NotFollowedBySender', 'BlockedActor', 'BlockedSubject', 'RecipientNotFound', 'AccountSuspended']) {
			const fetchFn = vi.fn(async () => jsonResponse(400, { error: name, message: 'nope' }));
			const res = await sendDm(SESSION, 'did:plc:t', 'hi', fetchFn as unknown as typeof fetch);
			expect(res).toEqual({ ok: false, code: name, retryable: false, detail: 'nope' });
			expect(fetchFn).toHaveBeenCalledTimes(1);
		}
	});

	it('treats rate limits, server errors, expired auth, and network failures as retryable', async () => {
		const limited = await sendDm(SESSION, 'did:plc:t', 'hi', vi.fn(async () => jsonResponse(429, { error: 'RateLimitExceeded' })) as unknown as typeof fetch);
		expect(limited).toMatchObject({ ok: false, code: 'RateLimitExceeded', retryable: true });

		const down = await sendDm(SESSION, 'did:plc:t', 'hi', vi.fn(async () => new Response('bad gateway', { status: 502 })) as unknown as typeof fetch);
		expect(down).toMatchObject({ ok: false, code: 'HTTP_502', retryable: true });

		const expired = await sendDm(SESSION, 'did:plc:t', 'hi', vi.fn(async () => jsonResponse(401, { error: 'ExpiredToken' })) as unknown as typeof fetch);
		expect(expired).toMatchObject({ ok: false, code: 'ExpiredToken', retryable: true });

		const net = await sendDm(
			SESSION,
			'did:plc:t',
			'hi',
			vi.fn(async () => {
				throw new Error('boom');
			}) as unknown as typeof fetch
		);
		expect(net).toMatchObject({ ok: false, code: 'NETWORK', retryable: true });
	});

	it('fails hard when sendMessage rejects the convo', async () => {
		const fetchFn = vi
			.fn()
			.mockResolvedValueOnce(jsonResponse(200, { convo: { id: 'c' } }))
			.mockResolvedValueOnce(jsonResponse(400, { error: 'ConvoLocked', message: 'locked' }));
		expect(await sendDm(SESSION, 'did:plc:t', 'hi', fetchFn as unknown as typeof fetch)).toEqual({
			ok: false,
			code: 'ConvoLocked',
			retryable: false,
			detail: 'locked'
		});
	});
});

describe('linkFacets', () => {
	it('finds http(s) URLs and bare domains, trimming trailing punctuation', () => {
		expect(linkFacets('See https://example.com/a?b=1, and buildersretre.at.')).toEqual([
			{ index: { byteStart: 4, byteEnd: 29 }, features: [{ $type: 'app.bsky.richtext.facet#link', uri: 'https://example.com/a?b=1' }] },
			{ index: { byteStart: 35, byteEnd: 51 }, features: [{ $type: 'app.bsky.richtext.facet#link', uri: 'https://buildersretre.at' }] }
		]);
	});

	it('uses UTF-8 byte offsets, not code units', () => {
		const [facet] = linkFacets('héllo buildersretre.at');
		expect(facet.index).toEqual({ byteStart: 7, byteEnd: 23 });
	});

	it('ignores email addresses, version numbers, and unknown TLDs', () => {
		expect(linkFacets('mail bryan@example.com or v1.2.3 or foo.notatld')).toEqual([]);
	});

	it('keeps a balanced closing paren but drops an unbalanced one', () => {
		expect(linkFacets('(see example.com/a_(b))').map((f) => f.features[0].uri)).toEqual(['https://example.com/a_(b)']);
		expect(linkFacets('(see example.com/a)').map((f) => f.features[0].uri)).toEqual(['https://example.com/a']);
	});
});

describe('graphemeCount', () => {
	it('counts user-perceived characters against the 1000 cap', () => {
		expect(DM_MAX_GRAPHEMES).toBe(1000);
		expect(graphemeCount('abc')).toBe(3);
		expect(graphemeCount('👩‍👩‍👧‍👦 ok')).toBe(4);
	});
});
