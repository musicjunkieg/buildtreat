import { dietaryOptions, registration, travelModes, type DietaryId, type TravelMode } from './content';

/**
 * Registration form model shared by the server action and the UI. Pure:
 * no SvelteKit or D1 imports, so it runs under vitest unchanged.
 * Spec: docs/superpowers/specs/2026-08-25-registration-design.md
 */

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const SHORT = 320;
const LONG = 2000;

export interface RegistrationInput {
	name: string;
	email: string;
	phone: string;
	emergencyName: string;
	emergencyPhone: string;
	dietary: string[];
	dietaryOther: string;
	accessibility: string;
	notes: string;
	travelArrival: string;
	travelDeparture: string;
	travelMode: TravelMode | null;
	travelDetails: string;
	agreeWaiver: boolean;
	agreeCoc: boolean;
}

export type RegistrationErrors = Partial<
	Record<
		'name' | 'email' | 'emergencyName' | 'emergencyPhone' | 'agreeWaiver' | 'agreeCoc' | 'dietary' | 'travelMode',
		string
	>
>;

const DIETARY_IDS = new Set<string>(dietaryOptions.map((o) => o.id));
const TRAVEL_MODES = new Set<string>(travelModes.map((m) => m.id));

export function isDietaryId(id: string): id is DietaryId {
	return DIETARY_IDS.has(id);
}

export function isTravelMode(id: string): id is TravelMode {
	return TRAVEL_MODES.has(id);
}

export function emptyRegistration(): RegistrationInput {
	return {
		name: '',
		email: '',
		phone: '',
		emergencyName: '',
		emergencyPhone: '',
		dietary: [],
		dietaryOther: '',
		accessibility: '',
		notes: '',
		travelArrival: '',
		travelDeparture: '',
		travelMode: null,
		travelDetails: '',
		agreeWaiver: false,
		agreeCoc: false
	};
}

function text(form: FormData, key: string, max: number): string {
	const v = form.get(key);
	return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

function flag(form: FormData, key: string): boolean {
	const v = form.get(key);
	return v === 'on' || v === 'true' || v === '1';
}

/** Read the posted form. No validation here — see validateRegistration. */
export function parseRegistrationForm(form: FormData): RegistrationInput {
	const mode = text(form, 'travelMode', 32);
	return {
		name: text(form, 'name', SHORT),
		email: text(form, 'email', SHORT),
		phone: text(form, 'phone', 64),
		emergencyName: text(form, 'emergencyName', SHORT),
		emergencyPhone: text(form, 'emergencyPhone', 64),
		dietary: form
			.getAll('dietary')
			.filter((v): v is string => typeof v === 'string')
			.map((v) => v.trim())
			.filter(Boolean),
		dietaryOther: text(form, 'dietaryOther', LONG),
		accessibility: text(form, 'accessibility', LONG),
		notes: text(form, 'notes', LONG),
		travelArrival: text(form, 'travelArrival', SHORT),
		travelDeparture: text(form, 'travelDeparture', SHORT),
		travelMode: mode ? (mode as TravelMode) : null,
		travelDetails: text(form, 'travelDetails', LONG),
		agreeWaiver: flag(form, 'agreeWaiver'),
		agreeCoc: flag(form, 'agreeCoc')
	};
}

/** Post-deadline rule: new confirmations close; an existing confirmed row may always be edited. */
export function canConfirm(closed: boolean, existing: { status: 'confirmed' | 'declined' } | null): boolean {
	return !closed || existing?.status === 'confirmed';
}

export interface ValidateOptions {
	/** Require both agreement boxes. The organizer's edit passes false. */
	agreements?: boolean;
	/**
	 * Require the fields that only a confirmed attendee owes us — an email
	 * and an emergency contact. A declined row never collected them, so the
	 * organizer's edit of one passes false; a non-empty email is still
	 * checked for shape.
	 */
	confirmation?: boolean;
}

/**
 * Rules for a registration. The attendee's own confirm uses the defaults.
 * The organizer's edit of someone else's row passes `agreements: false`
 * (nobody agrees for them) and, for a declined row, `confirmation: false`.
 */
export function validateRegistration(
	input: RegistrationInput,
	{ agreements = true, confirmation = true }: ValidateOptions = {}
): { ok: true; value: RegistrationInput } | { ok: false; errors: RegistrationErrors } {
	const errors: RegistrationErrors = {};
	const e = registration.errors;
	if (!input.name) errors.name = e.name;
	if ((confirmation || input.email) && !EMAIL_RE.test(input.email)) errors.email = e.email;
	if (confirmation && !input.emergencyName) errors.emergencyName = e.emergencyName;
	if (confirmation && !input.emergencyPhone) errors.emergencyPhone = e.emergencyPhone;
	if (agreements && !input.agreeWaiver) errors.agreeWaiver = e.agreeWaiver;
	if (agreements && !input.agreeCoc) errors.agreeCoc = e.agreeCoc;
	if (input.dietary.some((id) => !isDietaryId(id))) errors.dietary = e.dietary;
	if (input.travelMode !== null && !isTravelMode(input.travelMode)) errors.travelMode = e.travelMode;
	return Object.keys(errors).length ? { ok: false, errors } : { ok: true, value: input };
}
