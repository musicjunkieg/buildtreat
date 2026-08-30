import { describe, expect, it } from 'vitest';
import {
	isRegistered,
	noResponseHandles,
	registrationCounts,
	rowToRegistration,
	travelStatus,
	type Registration
} from './registration';

function reg(over: Partial<Registration> = {}): Registration {
	return {
		did: 'did:plc:a',
		handle: 'a.test',
		name: 'A',
		email: 'a@x.com',
		status: 'confirmed',
		phone: '',
		emergencyName: 'B',
		emergencyPhone: '1',
		dietary: [],
		dietaryOther: '',
		accessibility: '',
		notes: '',
		travelArrival: '',
		travelDeparture: '',
		travelMode: null,
		travelDetails: '',
		waiverVersion: 'v1',
		cocVersion: 'v1',
		agreedAt: '2026-08-30T00:00:00Z',
		createdAt: '2026-08-30T00:00:00Z',
		updatedAt: '2026-08-30T00:00:00Z',
		...over
	};
}

describe('rowToRegistration', () => {
	it('parses the dietary JSON column and nulls', () => {
		const r = rowToRegistration({
			did: 'did:plc:a',
			handle: null,
			name: 'A',
			email: 'a@x.com',
			status: 'confirmed',
			phone: null,
			emergency_name: null,
			emergency_phone: null,
			dietary: '["vegan","kosher"]',
			dietary_other: null,
			accessibility: null,
			notes: null,
			travel_arrival: null,
			travel_departure: null,
			travel_mode: null,
			travel_details: null,
			waiver_version: null,
			coc_version: null,
			agreed_at: null,
			created_at: 'c',
			updated_at: 'u'
		});
		expect(r.dietary).toEqual(['vegan', 'kosher']);
		expect(r.phone).toBe('');
		expect(r.travelMode).toBeNull();
		expect(r.agreedAt).toBeNull();
	});

	it('survives a malformed dietary column', () => {
		const r = rowToRegistration({
			did: 'd', handle: null, name: 'A', email: 'a@x.com', status: 'declined', phone: null,
			emergency_name: null, emergency_phone: null, dietary: 'not json', dietary_other: null,
			accessibility: null, notes: null, travel_arrival: null, travel_departure: null,
			travel_mode: null, travel_details: null, waiver_version: null, coc_version: null,
			agreed_at: null, created_at: 'c', updated_at: 'u'
		});
		expect(r.dietary).toEqual([]);
	});
});

describe('isRegistered / travelStatus', () => {
	it('registered = confirmed with agreements', () => {
		expect(isRegistered(reg())).toBe(true);
		expect(isRegistered(reg({ agreedAt: null }))).toBe(false);
		expect(isRegistered(reg({ status: 'declined' }))).toBe(false);
	});

	it('travel is none / partial / complete', () => {
		expect(travelStatus(reg())).toBe('none');
		expect(travelStatus(reg({ travelMode: 'flying' }))).toBe('partial');
		expect(travelStatus(reg({ travelMode: 'flying', travelArrival: 'Fri', travelDeparture: 'Mon' }))).toBe('complete');
	});
});

describe('registrationCounts / noResponseHandles', () => {
	const allowlist = [
		{ handle: 'a.test', did: 'did:plc:a', responded: true },
		{ handle: 'b.test', did: 'did:plc:b', responded: true },
		{ handle: 'c.test', did: null, responded: false }
	];

	it('counts confirmed, registered, declined, and everyone allowlisted without a row', () => {
		const regs = [reg(), reg({ did: 'did:plc:b', handle: 'b.test', status: 'declined', agreedAt: null })];
		expect(registrationCounts(regs, allowlist)).toEqual({ confirmed: 1, registered: 1, declined: 1, noResponse: 1 });
	});

	it('matches no-response by DID or handle, case-insensitively', () => {
		const regs = [reg({ did: 'did:plc:zzz', handle: 'C.TEST' })];
		expect(noResponseHandles(regs, allowlist).map((e) => e.handle)).toEqual(['a.test', 'b.test']);
	});
});
