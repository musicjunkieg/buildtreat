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
	{ did: 'did:plc:y1', email: 'y1@example.com', interest: 'yes', travel: 'partial' },
	{ did: 'did:plc:y2', email: 'Y1@example.com', interest: 'yes', travel: 'yes' },
	{ did: 'did:plc:m1', email: 'm1@example.com', interest: 'maybe', travel: 'no' },
	{ did: 'did:plc:n1', email: 'n1@example.com', interest: 'no', travel: null },
	{ did: 'did:plc:n2', email: '', interest: 'no', travel: 'no' }
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
		expect(audienceRecipients('waitlist', RESPONSES, WAITLIST)).toEqual([{ did: 'did:plc:w1', email: 'w1@example.com', handle: null }]);
	});

	it("'travel' is survey partial/no who haven't answered support and haven't declined, at their registration email", () => {
		// No registrations at all: everyone who said partial/no with an email.
		expect(audienceRecipients('travel', RESPONSES, WAITLIST).map((r) => r.did)).toEqual(['did:plc:y1', 'did:plc:m1']);
		const regs = [
			{ did: 'did:plc:y1', email: 'y1-new@example.com', status: 'confirmed' as const, supportNeed: null },
			{ did: 'did:plc:m1', email: 'm1@example.com', status: 'confirmed' as const, supportNeed: 'partial' },
			{ did: 'did:plc:n2', email: 'n2@example.com', status: 'declined' as const, supportNeed: null }
		];
		expect(audienceRecipients('travel', RESPONSES, WAITLIST, regs)).toEqual([
			{ did: 'did:plc:y1', email: 'y1-new@example.com', handle: null }
		]);
	});

	it("'registered' is confirmed rows at their registration email; 'all' picks up registrants who skipped the survey", () => {
		const regs = [
			{ did: 'did:plc:y1', email: 'y1-new@example.com', status: 'confirmed' as const, supportNeed: null },
			{ did: 'did:plc:s1', email: 's1@example.com', status: 'confirmed' as const, supportNeed: null },
			{ did: 'did:plc:m1', email: 'm1@example.com', status: 'declined' as const, supportNeed: null }
		];
		expect(audienceRecipients('registered', RESPONSES, WAITLIST, regs)).toEqual([
			{ did: 'did:plc:y1', email: 'y1-new@example.com', handle: null },
			{ did: 'did:plc:s1', email: 's1@example.com', handle: null }
		]);
		// s1 never took the survey but is confirmed — Everyone still reaches them.
		expect(audienceRecipients('all', RESPONSES, WAITLIST, regs).map((r) => r.did)).toEqual([
			'did:plc:y1',
			'did:plc:m1',
			'did:plc:n1',
			'did:plc:s1'
		]);
		expect(audienceRecipients('registered', RESPONSES, WAITLIST)).toEqual([]);
	});

	it("'yes_unregistered' / 'maybe_unregistered' drop anyone with a registration row, declined included", () => {
		expect(audienceRecipients('yes_unregistered', RESPONSES, WAITLIST).map((r) => r.did)).toEqual(['did:plc:y1']);
		expect(audienceRecipients('maybe_unregistered', RESPONSES, WAITLIST).map((r) => r.did)).toEqual(['did:plc:m1']);
		const regs = [
			{ did: 'did:plc:y1', email: 'y1@example.com', status: 'confirmed' as const, supportNeed: null },
			{ did: 'did:plc:m1', email: 'm1@example.com', status: 'declined' as const, supportNeed: null }
		];
		// y1 registered, so the dupe-email y2 (same address) now surfaces.
		expect(audienceRecipients('yes_unregistered', RESPONSES, WAITLIST, regs).map((r) => r.did)).toEqual(['did:plc:y2']);
		expect(audienceRecipients('maybe_unregistered', RESPONSES, WAITLIST, regs)).toEqual([]);
	});

	it("the DM channel keeps everyone in the audience — shared and missing emails included — and carries the handle", () => {
		const withHandles = RESPONSES.map((r) => ({ ...r, handle: `${r.did.slice(8)}.test` }));
		expect(audienceRecipients('all', withHandles, WAITLIST, [], 'dm')).toEqual([
			{ did: 'did:plc:y1', email: 'y1@example.com', handle: 'y1.test' },
			{ did: 'did:plc:y2', email: 'Y1@example.com', handle: 'y2.test' },
			{ did: 'did:plc:m1', email: 'm1@example.com', handle: 'm1.test' },
			{ did: 'did:plc:n1', email: 'n1@example.com', handle: 'n1.test' },
			{ did: 'did:plc:n2', email: '', handle: 'n2.test' }
		]);
		expect(audienceRecipients('no', RESPONSES, WAITLIST, [], 'dm').map((r) => r.did)).toEqual(['did:plc:n1', 'did:plc:n2']);
	});

	it('never lists the same DID twice, even when a source repeats it', () => {
		const regs = [
			{ did: 'did:plc:y1', email: 'y1@example.com', status: 'confirmed' as const, supportNeed: null },
			{ did: 'did:plc:y1', email: 'again@example.com', status: 'confirmed' as const, supportNeed: null }
		];
		expect(audienceRecipients('registered', RESPONSES, WAITLIST, regs, 'dm')).toHaveLength(1);
	});

	it('counts every audience in selector order, per channel', () => {
		expect(audienceCounts(RESPONSES, WAITLIST)).toEqual([
			{ id: 'all', label: 'Everyone', counts: { email: 3, dm: 5 } },
			{ id: 'registered', label: 'Registered', counts: { email: 0, dm: 0 } },
			{ id: 'yes', label: 'Yes', counts: { email: 1, dm: 2 } },
			{ id: 'yes_unregistered', label: 'Yes, not registered', counts: { email: 1, dm: 2 } },
			{ id: 'maybe', label: 'Maybe', counts: { email: 1, dm: 1 } },
			{ id: 'maybe_unregistered', label: 'Maybe, not registered', counts: { email: 1, dm: 1 } },
			{ id: 'no', label: 'No', counts: { email: 1, dm: 2 } },
			{ id: 'travel', label: 'Travel help', counts: { email: 2, dm: 3 } },
			{ id: 'waitlist', label: 'Waitlist', counts: { email: 1, dm: 1 } }
		]);
	});

	it('isAudience rejects anything a form could invent', () => {
		expect(isAudience('yes')).toBe(true);
		expect(isAudience('declined')).toBe(false);
		expect(isAudience('')).toBe(false);
	});
});

function recipient(did: string, email: string): BroadcastRecipient {
	return { did, email, handle: null, status: 'pending', errorCode: null, messageId: null };
}

const OK: SendResult = { ok: true, messageId: '1' };
const HARD_FAIL: SendResult = { ok: false, code: 'INVALID_RECIPIENT_DOMAIN', retryable: false };
const SOFT_FAIL: SendResult = { ok: false, code: 'RATE_LIMITED', retryable: true };

describe('runBroadcast', () => {
	it('hands each whole recipient row to send and marks each outcome', async () => {
		const marked: Array<[string, SendResult]> = [];
		const seen: string[] = [];
		const result = await runBroadcast(
			[recipient('did:a', 'a@x.com'), recipient('did:b', 'b@x.com')],
			async (r) => {
				seen.push(r.did);
				return OK;
			},
			async (did, r) => {
				marked.push([did, r]);
			}
		);
		expect(result).toEqual({ sent: 2, failed: 0, stopped: null });
		expect(seen).toEqual(['did:a', 'did:b']);
		expect(marked).toEqual([
			['did:a', OK],
			['did:b', OK]
		]);
	});

	it('marks a non-retryable failure and continues to later recipients', async () => {
		const send = vi.fn(async (r: BroadcastRecipient) => (r.email === 'a@x.com' ? HARD_FAIL : OK));
		const result = await runBroadcast(
			[recipient('did:a', 'a@x.com'), recipient('did:b', 'b@x.com')],
			send,
			async () => {}
		);
		expect(result).toEqual({ sent: 1, failed: 1, stopped: null });
		expect(send).toHaveBeenCalledTimes(2);
	});

	it('stops at the first retryable failure, leaving the rest untouched', async () => {
		const send = vi.fn(async (r: BroadcastRecipient) => (r.email === 'b@x.com' ? SOFT_FAIL : OK));
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
