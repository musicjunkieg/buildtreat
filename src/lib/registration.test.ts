import { describe, expect, it } from 'vitest';
import {
	asksSupport,
	canConfirm,
	emptyRegistration,
	isDietaryId,
	isSupportNeed,
	isTravelMode,
	needsSupport,
	parseDollars,
	parseRegistrationForm,
	supportNeedFromSurvey,
	validateRegistration,
	type RegistrationInput
} from './registration';

function complete(): RegistrationInput {
	return {
		...emptyRegistration(),
		name: 'Maren Costa',
		email: 'maren@costa.dev',
		emergencyName: 'Sam Costa',
		emergencyPhone: '+1 555 0100',
		agreeWaiver: true,
		agreeCoc: true
	};
}

describe('parseRegistrationForm', () => {
	it('reads every field, trims text, collects dietary checkboxes, and maps agreement checkboxes', () => {
		const fd = new FormData();
		fd.set('name', '  Maren Costa ');
		fd.set('email', 'maren@costa.dev');
		fd.set('phone', '555-0100');
		fd.set('emergencyName', 'Sam');
		fd.set('emergencyPhone', '555-0101');
		fd.append('dietary', 'vegetarian');
		fd.append('dietary', 'nut_allergy');
		fd.set('dietaryOther', 'no cilantro');
		fd.set('accessibility', 'ground floor please');
		fd.set('notes', 'bringing a guitar');
		fd.set('travelArrival', 'Fri 3pm');
		fd.set('travelDeparture', 'Mon 9am');
		fd.set('travelMode', 'driving');
		fd.set('travelDetails', 'can carpool from LA');
		fd.set('supportNeed', 'partial');
		fd.set('supportAmount', '$1,200');
		fd.set('supportContingent', 'yes');
		fd.set('agreeWaiver', 'on');
		// agreeCoc omitted → false
		expect(parseRegistrationForm(fd)).toEqual({
			name: 'Maren Costa',
			email: 'maren@costa.dev',
			phone: '555-0100',
			emergencyName: 'Sam',
			emergencyPhone: '555-0101',
			dietary: ['vegetarian', 'nut_allergy'],
			dietaryOther: 'no cilantro',
			accessibility: 'ground floor please',
			notes: 'bringing a guitar',
			travelArrival: 'Fri 3pm',
			travelDeparture: 'Mon 9am',
			travelMode: 'driving',
			travelDetails: 'can carpool from LA',
			supportNeed: 'partial',
			supportAmount: 1200,
			supportContingent: true,
			agreeWaiver: true,
			agreeCoc: false
		});
	});

	it('leaves support unanswered when the section was never shown', () => {
		const parsed = parseRegistrationForm(new FormData());
		expect(parsed.supportNeed).toBeNull();
		expect(parsed.supportAmount).toBeNull();
		expect(parsed.supportContingent).toBeNull();
	});

	it('treats a missing or empty travel mode as null and caps long text', () => {
		const fd = new FormData();
		fd.set('notes', 'x'.repeat(5000));
		const parsed = parseRegistrationForm(fd);
		expect(parsed.travelMode).toBeNull();
		expect(parsed.notes).toHaveLength(2000);
	});
});

describe('parseDollars', () => {
	it('forgives currency formatting and drops cents', () => {
		expect(parseDollars('$1,200')).toBe(1200);
		expect(parseDollars(' 800 ')).toBe(800);
		expect(parseDollars('450.75')).toBe(450);
	});

	it('rejects empty, zero, negative, non-numeric, and absurd values', () => {
		expect(parseDollars('')).toBeNull();
		expect(parseDollars('0')).toBeNull();
		expect(parseDollars('-50')).toBeNull();
		expect(parseDollars('a lot')).toBeNull();
		expect(parseDollars('1000000')).toBeNull();
	});
});

describe('travel support helpers', () => {
	it('asks everyone whose survey answer was not "yes"', () => {
		expect(asksSupport('yes')).toBe(false);
		expect(asksSupport('partial')).toBe(true);
		expect(asksSupport('no')).toBe(true);
		expect(asksSupport(null)).toBe(true);
	});

	it('seeds the level from the survey answer', () => {
		expect(supportNeedFromSurvey('partial')).toBe('partial');
		expect(supportNeedFromSurvey('no')).toBe('full');
		expect(supportNeedFromSurvey('yes')).toBeNull();
		expect(supportNeedFromSurvey(null)).toBeNull();
	});

	it('only partial/full carry an amount', () => {
		expect(needsSupport('partial')).toBe(true);
		expect(needsSupport('full')).toBe(true);
		expect(needsSupport('none')).toBe(false);
		expect(needsSupport(null)).toBe(false);
	});
});

describe('validateRegistration', () => {
	it('accepts a complete confirmation', () => {
		const res = validateRegistration(complete());
		expect(res.ok).toBe(true);
	});

	it('requires name, valid email, emergency name + phone, and both agreements', () => {
		const res = validateRegistration({ ...emptyRegistration(), email: 'nope' });
		expect(res.ok).toBe(false);
		if (res.ok) return;
		expect(Object.keys(res.errors).sort()).toEqual(
			['agreeCoc', 'agreeWaiver', 'email', 'emergencyName', 'emergencyPhone', 'name'].sort()
		);
	});

	it('skips the agreement rule when the organizer edits fields on behalf', () => {
		const input = { ...complete(), agreeWaiver: false, agreeCoc: false };
		expect(validateRegistration(input).ok).toBe(false);
		expect(validateRegistration(input, { agreements: false })).toEqual({ ok: true, value: input });
	});

	it('relaxes the confirmation-only fields for a declined row, but still checks a typed email', () => {
		const declined = { ...emptyRegistration(), name: 'Sam' };
		expect(validateRegistration(declined).ok).toBe(false);
		expect(validateRegistration(declined, { agreements: false, confirmation: false })).toEqual({
			ok: true,
			value: declined
		});
		const typo = { ...declined, email: 'nope' };
		const res = validateRegistration(typo, { agreements: false, confirmation: false });
		expect(res.ok).toBe(false);
		if (!res.ok) expect(Object.keys(res.errors)).toEqual(['email']);
	});

	it('rejects unknown dietary ids and travel modes', () => {
		const res = validateRegistration({
			...complete(),
			dietary: ['vegan', 'glass'],
			travelMode: 'teleport' as never
		});
		expect(res.ok).toBe(false);
		if (res.ok) return;
		expect(res.errors.dietary).toBeDefined();
		expect(res.errors.travelMode).toBeDefined();
	});

	it('requires the support level, amount, and contingency when asked', () => {
		const r = validateRegistration({ ...complete(), supportNeed: null }, { support: true });
		expect(r.ok).toBe(false);
		if (!r.ok) expect(Object.keys(r.errors)).toEqual(['supportNeed']);

		const r2 = validateRegistration({ ...complete(), supportNeed: 'full' }, { support: true });
		expect(r2.ok).toBe(false);
		if (!r2.ok) expect(Object.keys(r2.errors).sort()).toEqual(['supportAmount', 'supportContingent']);

		const r3 = validateRegistration(
			{ ...complete(), supportNeed: 'partial', supportAmount: 600, supportContingent: false },
			{ support: true }
		);
		expect(r3.ok).toBe(true);
	});

	it('accepts "I can cover it" without an amount and clears any stale amount', () => {
		const r = validateRegistration(
			{ ...complete(), supportNeed: 'none', supportAmount: 600, supportContingent: true },
			{ support: true }
		);
		expect(r.ok).toBe(true);
		if (r.ok) {
			expect(r.value.supportAmount).toBeNull();
			expect(r.value.supportContingent).toBeNull();
		}
	});

	it('does not require support when not asked, but still rejects an unknown level', () => {
		expect(validateRegistration(complete()).ok).toBe(true);
		const r = validateRegistration({ ...complete(), supportNeed: 'lots' as never });
		expect(r.ok).toBe(false);
		if (!r.ok) expect(r.errors.supportNeed).toBeDefined();
	});

	it('leaves travel and optional fields free', () => {
		const res = validateRegistration({ ...complete(), travelArrival: '', travelMode: null, accessibility: '' });
		expect(res.ok).toBe(true);
	});
});

describe('id guards', () => {
	it('recognises support levels', () => {
		expect(isSupportNeed('full')).toBe(true);
		expect(isSupportNeed('yes')).toBe(false);
	});

	it('recognise content ids only', () => {
		expect(isDietaryId('kosher')).toBe(true);
		expect(isDietaryId('paleo')).toBe(false);
		expect(isTravelMode('train')).toBe(true);
		expect(isTravelMode('boat')).toBe(false);
	});
});

describe('canConfirm', () => {
	it('allows a new confirmation while open', () => {
		expect(canConfirm(false, null)).toBe(true);
	});

	it('allows a declined visitor to confirm while open', () => {
		expect(canConfirm(false, { status: 'declined' })).toBe(true);
	});

	it('refuses a new confirmation once closed', () => {
		expect(canConfirm(true, null)).toBe(false);
	});

	it('refuses a declined visitor once closed', () => {
		expect(canConfirm(true, { status: 'declined' })).toBe(false);
	});

	it('always allows editing an existing confirmed row, even closed', () => {
		expect(canConfirm(true, { status: 'confirmed' })).toBe(true);
	});
});
