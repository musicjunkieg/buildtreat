import { describe, expect, it } from 'vitest';
import { confirmationEmail } from './registration-email';
import type { Registration } from './registration';

const base: Registration = {
	did: 'did:plc:a', handle: 'maren.dev', name: 'Maren Costa', email: 'maren@costa.dev', status: 'confirmed',
	phone: '', emergencyName: 'Sam', emergencyPhone: '1', dietary: ['vegetarian'], dietaryOther: '',
	accessibility: '', notes: '', travelArrival: '', travelDeparture: '', travelMode: null, travelDetails: '',
	supportNeed: null, supportAmount: null, supportContingent: null,
	waiverVersion: 'v1', cocVersion: 'v1', agreedAt: '2026-08-30T00:00:00Z', createdAt: 'c', updatedAt: 'u'
};

describe('confirmationEmail', () => {
	it('names the dates, the venue-pending line, and a travel nudge when travel is empty', () => {
		const { subject, text } = confirmationEmail(base);
		expect(subject).toContain('December 4–7');
		expect(text).toContain('Palm Springs or Coachella Valley');
		expect(text).toContain('Venue locks with the headcount');
		expect(text).toMatch(/travel/i);
		expect(text).toContain('Maren');
	});

	it('echoes travel answers when present', () => {
		const { text } = confirmationEmail({ ...base, travelMode: 'driving', travelArrival: 'Fri 3pm', travelDeparture: 'Mon 9am' });
		expect(text).toContain('Driving');
		expect(text).toContain('Fri 3pm');
		expect(text).toContain('Mon 9am');
	});

	it('treats travelDetails-only as travel present, skipping the nudge', () => {
		const { text } = confirmationEmail({ ...base, travelDetails: 'AS 1234' });
		expect(text).toContain('AS 1234');
		expect(text).not.toContain('haven’t added travel');
	});
});

describe('confirmationEmail — travel support', () => {
	it('echoes the amount and contingency when support was requested', () => {
		const { text } = confirmationEmail({ ...base, supportNeed: 'full', supportAmount: 1200, supportContingent: true });
		expect(text).toContain('$1,200');
		expect(text).toContain('can’t come without it');
	});

	it('says nothing about support when it was not requested', () => {
		expect(confirmationEmail(base).text).not.toContain('Travel support');
		expect(confirmationEmail({ ...base, supportNeed: 'none' }).text).not.toContain('Travel support');
	});
});
