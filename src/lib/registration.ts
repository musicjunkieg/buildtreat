import {
	dietaryOptions,
	registration,
	supportNeeds,
	travelModes,
	type DietaryId,
	type SupportNeed,
	type TravelMode,
	type TravelValue
} from './content';

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
	/**
	 * Travel support — asked of everyone whose survey travel answer wasn't
	 * "yes". null = not asked / not answered. Amount is whole US dollars;
	 * both amount and contingent are null unless need is partial or full.
	 */
	supportNeed: SupportNeed | null;
	supportAmount: number | null;
	supportContingent: boolean | null;
	agreeWaiver: boolean;
	agreeCoc: boolean;
}

export type RegistrationErrors = Partial<
	Record<
		| 'name'
		| 'email'
		| 'emergencyName'
		| 'emergencyPhone'
		| 'agreeWaiver'
		| 'agreeCoc'
		| 'dietary'
		| 'travelMode'
		| 'supportNeed'
		| 'supportAmount'
		| 'supportContingent',
		string
	>
>;

const DIETARY_IDS = new Set<string>(dietaryOptions.map((o) => o.id));
const TRAVEL_MODES = new Set<string>(travelModes.map((m) => m.id));
const SUPPORT_NEEDS = new Set<string>(supportNeeds.map((n) => n.id));
/** Sanity ceiling on a support estimate — nobody's flight to PSP costs this. */
export const SUPPORT_MAX = 100_000;

export function isDietaryId(id: string): id is DietaryId {
	return DIETARY_IDS.has(id);
}

export function isTravelMode(id: string): id is TravelMode {
	return TRAVEL_MODES.has(id);
}

export function isSupportNeed(id: string): id is SupportNeed {
	return SUPPORT_NEEDS.has(id);
}

/** Support is asked whenever the survey didn't say "I can cover my travel". */
export function asksSupport(surveyTravel: TravelValue | null): boolean {
	return surveyTravel !== 'yes';
}

/** Amount + contingency only make sense once someone says they need help. */
export function needsSupport(need: SupportNeed | null): boolean {
	return need === 'partial' || need === 'full';
}

/**
 * Registration-time default for the support level, carried over from the
 * survey so a "partial"/"no" answer arrives pre-selected.
 */
export function supportNeedFromSurvey(surveyTravel: TravelValue | null): SupportNeed | null {
	if (surveyTravel === 'partial') return 'partial';
	if (surveyTravel === 'no') return 'full';
	return null;
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
		supportNeed: null,
		supportAmount: null,
		supportContingent: null,
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

/** Radio with an unanswered state: 'yes' | 'no' | anything else → null. */
function yesNo(form: FormData, key: string): boolean | null {
	const v = form.get(key);
	return v === 'yes' ? true : v === 'no' ? false : null;
}

/**
 * Whole US dollars. Forgives "$1,200", "1200.50", " 800 "; anything that
 * doesn't reduce to a positive integer within SUPPORT_MAX is null, which
 * validation then reports as missing.
 */
export function parseDollars(raw: string): number | null {
	const cleaned = raw.replace(/[$,\s]/g, '').replace(/\.\d*$/, '');
	if (!/^\d{1,6}$/.test(cleaned)) return null;
	const n = Number(cleaned);
	return n > 0 && n <= SUPPORT_MAX ? n : null;
}

/** Read the posted form. No validation here — see validateRegistration. */
export function parseRegistrationForm(form: FormData): RegistrationInput {
	const mode = text(form, 'travelMode', 32);
	const need = text(form, 'supportNeed', 32);
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
		supportNeed: need ? (need as SupportNeed) : null,
		supportAmount: parseDollars(text(form, 'supportAmount', 32)),
		supportContingent: yesNo(form, 'supportContingent'),
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
	/**
	 * Require the travel-support answers (level, and — when the level is
	 * partial/full — amount and contingency). The attendee's confirm passes
	 * `asksSupport(surveyTravel)`; the organizer's edit leaves it off.
	 */
	support?: boolean;
}

/**
 * Rules for a registration. The attendee's own confirm uses the defaults.
 * The organizer's edit of someone else's row passes `agreements: false`
 * (nobody agrees for them) and, for a declined row, `confirmation: false`.
 */
export function validateRegistration(
	input: RegistrationInput,
	{ agreements = true, confirmation = true, support = false }: ValidateOptions = {}
): { ok: true; value: RegistrationInput } | { ok: false; errors: RegistrationErrors } {
	const errors: RegistrationErrors = {};
	const e = registration.errors;
	const need = input.supportNeed;
	if (!input.name) errors.name = e.name;
	if ((confirmation || input.email) && !EMAIL_RE.test(input.email)) errors.email = e.email;
	if (confirmation && !input.emergencyName) errors.emergencyName = e.emergencyName;
	if (confirmation && !input.emergencyPhone) errors.emergencyPhone = e.emergencyPhone;
	if (agreements && !input.agreeWaiver) errors.agreeWaiver = e.agreeWaiver;
	if (agreements && !input.agreeCoc) errors.agreeCoc = e.agreeCoc;
	if (input.dietary.some((id) => !isDietaryId(id))) errors.dietary = e.dietary;
	if (input.travelMode !== null && !isTravelMode(input.travelMode)) errors.travelMode = e.travelMode;
	if (need !== null && !isSupportNeed(need)) errors.supportNeed = e.supportNeed;
	else if (support && need === null) errors.supportNeed = e.supportNeed;
	if (needsSupport(need)) {
		if ((support || input.supportAmount !== null) && input.supportAmount === null) errors.supportAmount = e.supportAmount;
		if (support && input.supportContingent === null) errors.supportContingent = e.supportContingent;
	}
	if (Object.keys(errors).length) return { ok: false, errors };
	// A "none" (or unasked) level carries no amount or contingency.
	const value = needsSupport(need) ? input : { ...input, supportAmount: null, supportContingent: null };
	return { ok: true, value };
}
