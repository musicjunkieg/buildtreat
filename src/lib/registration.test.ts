import { describe, expect, it } from 'vitest';
import {
	canConfirm,
	emptyRegistration,
	isDietaryId,
	isTravelMode,
	parseRegistrationForm,
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
			agreeWaiver: true,
			agreeCoc: false
		});
	});

	it('treats a missing or empty travel mode as null and caps long text', () => {
		const fd = new FormData();
		fd.set('notes', 'x'.repeat(5000));
		const parsed = parseRegistrationForm(fd);
		expect(parsed.travelMode).toBeNull();
		expect(parsed.notes).toHaveLength(2000);
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

	it('leaves travel and optional fields free', () => {
		const res = validateRegistration({ ...complete(), travelArrival: '', travelMode: null, accessibility: '' });
		expect(res.ok).toBe(true);
	});
});

describe('id guards', () => {
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
