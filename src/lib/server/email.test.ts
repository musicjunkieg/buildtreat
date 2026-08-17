import { describe, expect, it, vi } from 'vitest';
import { emailConfigured, sendEmail, type EmailEnv } from './email';

const ENV: EmailEnv = {
	EMAIL_FROM: 'hello@buildersretre.at',
	COMAIL_DID: 'did:plc:test',
	COMAIL_API_KEY: 'atmos_secret'
};

const MSG = { to: 'user@example.com', subject: 'Hi', text: 'Hello there' };

function jsonResponse(status: number, body: unknown): Response {
	return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

describe('emailConfigured', () => {
	it('is true only when all three values are present', () => {
		expect(emailConfigured(ENV)).toBe(true);
		expect(emailConfigured({ ...ENV, COMAIL_API_KEY: undefined })).toBe(false);
		expect(emailConfigured({})).toBe(false);
	});
});

describe('sendEmail', () => {
	it('returns NOT_CONFIGURED without calling fetch when the key is missing', async () => {
		const fetchFn = vi.fn();
		const res = await sendEmail({ ...ENV, COMAIL_API_KEY: undefined }, MSG, fetchFn as unknown as typeof fetch);
		expect(res).toEqual({ ok: false, code: 'NOT_CONFIGURED', retryable: false });
		expect(fetchFn).not.toHaveBeenCalled();
	});

	it('posts the message with DID + bearer headers and returns the messageId as a string', async () => {
		const fetchFn = vi.fn(async () => jsonResponse(200, { accepted: [{ recipient: MSG.to, messageId: 448 }], rejected: [] }));
		const res = await sendEmail(ENV, { ...MSG, category: 'broadcast' }, fetchFn as unknown as typeof fetch);
		expect(res).toEqual({ ok: true, messageId: '448' });
		const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
		expect(url).toBe('https://smtp.atmos.email/v1/send');
		expect(init.method).toBe('POST');
		const headers = init.headers as Record<string, string>;
		expect(headers['X-Atmos-DID']).toBe('did:plc:test');
		expect(headers['Authorization']).toBe('Bearer atmos_secret');
		const body = JSON.parse(String(init.body));
		expect(body).toEqual({
			from: 'hello@buildersretre.at',
			to: 'user@example.com',
			subject: 'Hi',
			text: 'Hello there',
			category: 'broadcast'
		});
	});

	it('maps a comail error body to a non-retryable failure for auth codes', async () => {
		const fetchFn = vi.fn(async () => jsonResponse(403, { error: 'domain not enrolled', code: 'DOMAIN_MISMATCH' }));
		const res = await sendEmail(ENV, MSG, fetchFn as unknown as typeof fetch);
		expect(res).toEqual({ ok: false, code: 'DOMAIN_MISMATCH', retryable: false, detail: 'domain not enrolled' });
	});

	it('flags RATE_LIMITED and 5xx codes as retryable', async () => {
		for (const [status, code] of [
			[429, 'RATE_LIMITED'],
			[503, 'QUEUE_FULL'],
			[503, 'TEMPORARILY_UNAVAILABLE'],
			[500, 'INTERNAL_ERROR']
		] as const) {
			const fetchFn = vi.fn(async () => jsonResponse(status, { error: 'x', code }));
			const res = await sendEmail(ENV, MSG, fetchFn as unknown as typeof fetch);
			expect(res).toMatchObject({ ok: false, code, retryable: true });
		}
	});

	it('treats a network throw as retryable NETWORK', async () => {
		const fetchFn = vi.fn(async () => {
			throw new TypeError('fetch failed');
		});
		const res = await sendEmail(ENV, MSG, fetchFn as unknown as typeof fetch);
		expect(res).toMatchObject({ ok: false, code: 'NETWORK', retryable: true });
	});

	it('treats a non-JSON body as retryable BAD_RESPONSE', async () => {
		const fetchFn = vi.fn(async () => new Response('<html>gateway error</html>', { status: 502 }));
		const res = await sendEmail(ENV, MSG, fetchFn as unknown as typeof fetch);
		expect(res).toMatchObject({ ok: false, code: 'BAD_RESPONSE', retryable: true });
	});

	it('treats a 200 with no accepted entry as retryable BAD_RESPONSE', async () => {
		const fetchFn = vi.fn(async () => jsonResponse(200, { accepted: [], rejected: [] }));
		const res = await sendEmail(ENV, MSG, fetchFn as unknown as typeof fetch);
		expect(res).toMatchObject({ ok: false, code: 'BAD_RESPONSE', retryable: true });
	});
});
