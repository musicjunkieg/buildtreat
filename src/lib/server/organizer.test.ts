import { describe, expect, it } from 'vitest';
import type { D1Database } from '@cloudflare/workers-types';
import { registrationGate } from './organizer';

const PAST = '2026-09-21T06:59:59Z';
const FUTURE = '2099-01-01T00:00:00Z';
const WHO = { did: 'did:plc:chris', handle: 'chrisshank.com' };

/** Just enough D1 for hasLatePass: one SELECT that may hit, one UPDATE that pins. */
function fakeDb(passes: Array<{ handle: string; did: string | null }>): D1Database {
	const stmt = (sql: string) => ({
		bind: (...args: unknown[]) => ({
			first: async () => {
				const [did, handle] = args as [string, string | null];
				return passes.find((p) => p.did === did || (handle && p.handle.toLowerCase() === handle.toLowerCase())) ?? null;
			},
			run: async () => ({ success: true, meta: {} }),
			all: async () => ({ results: [], success: true, meta: {} })
		}),
		sql
	});
	return { prepare: stmt } as unknown as D1Database;
}

describe('registrationGate', () => {
	it('is open before the deadline, no lookups needed', async () => {
		const gate = await registrationGate(undefined, FUTURE, WHO);
		expect(gate).toMatchObject({ closed: false, latePass: false, deadline: FUTURE });
	});

	it('fails open on a missing or malformed deadline', async () => {
		expect((await registrationGate(fakeDb([]), undefined, WHO)).closed).toBe(false);
		expect((await registrationGate(fakeDb([]), 'soon', WHO)).closed).toBe(false);
	});

	it('is closed after the deadline for anonymous visitors and people without a pass', async () => {
		expect((await registrationGate(fakeDb([{ handle: 'chrisshank.com', did: null }]), PAST, null)).closed).toBe(true);
		expect((await registrationGate(fakeDb([]), PAST, WHO)).closed).toBe(true);
	});

	it('a late pass by handle or DID reopens it for that person only', async () => {
		const byHandle = await registrationGate(fakeDb([{ handle: 'ChrisShank.com', did: null }]), PAST, WHO);
		expect(byHandle).toMatchObject({ closed: false, latePass: true });
		const byDid = await registrationGate(fakeDb([{ handle: 'old.handle', did: 'did:plc:chris' }]), PAST, {
			did: 'did:plc:chris',
			handle: null
		});
		expect(byDid).toMatchObject({ closed: false, latePass: true });
		expect((await registrationGate(fakeDb([{ handle: 'ChrisShank.com', did: null }]), PAST, { did: 'did:plc:other', handle: 'other.com' })).closed).toBe(true);
	});

	it('stays closed when the pass lookup itself fails', async () => {
		const broken = { prepare: () => { throw new Error('boom'); } } as unknown as D1Database;
		expect((await registrationGate(broken, PAST, WHO)).closed).toBe(true);
	});
});
