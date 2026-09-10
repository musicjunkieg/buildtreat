import { describe, expect, it, vi } from 'vitest';
import { audienceCounts, audienceRecipients, dedupeRecipients, isAudience, runBroadcast } from './broadcasts';
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

const RESPONSES = [
	{ did: 'did:plc:y1', email: 'y1@example.com', interest: 'yes' },
	{ did: 'did:plc:y2', email: 'Y1@example.com', interest: 'yes' },
	{ did: 'did:plc:m1', email: 'm1@example.com', interest: 'maybe' },
	{ did: 'did:plc:n1', email: 'n1@example.com', interest: 'no' },
	{ did: 'did:plc:n2', email: '', interest: 'no' }
];
const WAITLIST = [
	{ did: 'did:plc:w1', email: 'w1@example.com', promotedAt: null },
	{ did: 'did:plc:w2', email: 'w2@example.com', promotedAt: '2026-08-11T17:30:00Z' }
];

describe('audienceRecipients', () => {
	it("'all' is every respondent, deduped by email", () => {
		expect(audienceRecipients('all', RESPONSES, WAITLIST).map((r) => r.did)).toEqual([
			'did:plc:y1',
			'did:plc:m1',
			'did:plc:n1'
		]);
	});

	it('survey audiences filter on the interest answer', () => {
		expect(audienceRecipients('yes', RESPONSES, WAITLIST).map((r) => r.did)).toEqual(['did:plc:y1']);
		expect(audienceRecipients('maybe', RESPONSES, WAITLIST).map((r) => r.did)).toEqual(['did:plc:m1']);
		expect(audienceRecipients('no', RESPONSES, WAITLIST).map((r) => r.did)).toEqual(['did:plc:n1']);
	});

	it("'waitlist' takes only entries not yet promoted", () => {
		expect(audienceRecipients('waitlist', RESPONSES, WAITLIST)).toEqual([{ did: 'did:plc:w1', email: 'w1@example.com' }]);
	});

	it('counts every audience in selector order', () => {
		expect(audienceCounts(RESPONSES, WAITLIST)).toEqual([
			{ id: 'all', label: 'Everyone', count: 3 },
			{ id: 'yes', label: 'Yes', count: 1 },
			{ id: 'maybe', label: 'Maybe', count: 1 },
			{ id: 'no', label: 'No', count: 1 },
			{ id: 'waitlist', label: 'Waitlist', count: 1 }
		]);
	});

	it('isAudience rejects anything a form could invent', () => {
		expect(isAudience('yes')).toBe(true);
		expect(isAudience('registered')).toBe(false);
		expect(isAudience('')).toBe(false);
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
