import { describe, expect, it, vi } from 'vitest';
import { dedupeRecipients, runBroadcast } from './broadcasts';
import type { BroadcastRecipient } from './broadcasts';
import type { SendResult } from './email';

describe('dedupeRecipients', () => {
	it('drops later rows whose email matches case-insensitively, keeping the first', () => {
		const out = dedupeRecipients([
			{ did: 'did:plc:a', email: 'One@Example.com' },
			{ did: 'did:plc:b', email: 'one@example.com' },
			{ did: 'did:plc:c', email: 'two@example.com' }
		]);
		expect(out).toEqual([
			{ did: 'did:plc:a', email: 'One@Example.com' },
			{ did: 'did:plc:c', email: 'two@example.com' }
		]);
	});

	it('skips rows with empty emails', () => {
		expect(dedupeRecipients([{ did: 'did:plc:a', email: '  ' }])).toEqual([]);
	});

	it('stores the trimmed email, not the raw one', () => {
		expect(dedupeRecipients([{ did: 'did:plc:a', email: '  pad@example.com ' }])).toEqual([
			{ did: 'did:plc:a', email: 'pad@example.com' }
		]);
	});
});

function recipient(did: string, email: string): BroadcastRecipient {
	return { did, email, status: 'pending', errorCode: null, messageId: null };
}

const OK: SendResult = { ok: true, messageId: '1' };
const HARD_FAIL: SendResult = { ok: false, code: 'INVALID_RECIPIENT_DOMAIN', retryable: false };
const SOFT_FAIL: SendResult = { ok: false, code: 'RATE_LIMITED', retryable: true };

describe('runBroadcast', () => {
	it('sends to every recipient and marks each outcome', async () => {
		const marked: Array<[string, SendResult]> = [];
		const result = await runBroadcast(
			[recipient('did:a', 'a@x.com'), recipient('did:b', 'b@x.com')],
			async () => OK,
			async (did, r) => {
				marked.push([did, r]);
			}
		);
		expect(result).toEqual({ sent: 2, failed: 0, stopped: null });
		expect(marked).toEqual([
			['did:a', OK],
			['did:b', OK]
		]);
	});

	it('marks a non-retryable failure and continues to later recipients', async () => {
		const send = vi.fn(async (email: string) => (email === 'a@x.com' ? HARD_FAIL : OK));
		const result = await runBroadcast(
			[recipient('did:a', 'a@x.com'), recipient('did:b', 'b@x.com')],
			send,
			async () => {}
		);
		expect(result).toEqual({ sent: 1, failed: 1, stopped: null });
		expect(send).toHaveBeenCalledTimes(2);
	});

	it('stops at the first retryable failure, leaving the rest untouched', async () => {
		const send = vi.fn(async (email: string) => (email === 'b@x.com' ? SOFT_FAIL : OK));
		const marked: string[] = [];
		const result = await runBroadcast(
			[recipient('did:a', 'a@x.com'), recipient('did:b', 'b@x.com'), recipient('did:c', 'c@x.com')],
			send,
			async (did) => {
				marked.push(did);
			}
		);
		expect(result).toEqual({ sent: 1, failed: 0, stopped: 'RATE_LIMITED' });
		expect(send).toHaveBeenCalledTimes(2); // never reaches did:c
		expect(marked).toEqual(['did:a', 'did:b']); // the soft failure is still recorded
	});
});
