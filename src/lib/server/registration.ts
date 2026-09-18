import type { D1Database } from '@cloudflare/workers-types';
import type { SupportNeed, TravelMode } from '../content';
import type { RegistrationInput } from '../registration';
import { isSupportNeed, isTravelMode, needsSupport } from '../registration';
import type { AllowlistEntry } from './organizer';

/**
 * D1 access for registrations — one upserted row per DID. Mirrors the
 * waitlist module's conventions: parameterized SQL, typed rows, JSDoc.
 * Schema: migrations/0006_registrations.sql (+ 0008 travel support).
 */

export interface Registration {
	did: string;
	handle: string | null;
	name: string;
	email: string;
	status: 'confirmed' | 'declined';
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
	supportNeed: SupportNeed | null;
	supportAmount: number | null;
	supportContingent: boolean | null;
	waiverVersion: string | null;
	cocVersion: string | null;
	agreedAt: string | null;
	createdAt: string;
	updatedAt: string;
}

export interface RegistrationRow {
	did: string;
	handle: string | null;
	name: string;
	email: string;
	status: string;
	phone: string | null;
	emergency_name: string | null;
	emergency_phone: string | null;
	dietary: string | null;
	dietary_other: string | null;
	accessibility: string | null;
	notes: string | null;
	travel_arrival: string | null;
	travel_departure: string | null;
	travel_mode: string | null;
	travel_details: string | null;
	support_need: string | null;
	support_amount: number | null;
	support_contingent: number | null;
	waiver_version: string | null;
	coc_version: string | null;
	agreed_at: string | null;
	created_at: string;
	updated_at: string;
}

const COLUMNS = `did, handle, name, email, status, phone, emergency_name, emergency_phone, dietary, dietary_other,
	accessibility, notes, travel_arrival, travel_departure, travel_mode, travel_details,
	support_need, support_amount, support_contingent,
	waiver_version, coc_version, agreed_at, created_at, updated_at`;

function parseDietary(raw: string | null): string[] {
	if (!raw) return [];
	try {
		const v = JSON.parse(raw) as unknown;
		return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
	} catch {
		return [];
	}
}

/** Pure row → model mapping (exported for tests). */
export function rowToRegistration(r: RegistrationRow): Registration {
	return {
		did: r.did,
		handle: r.handle,
		name: r.name,
		email: r.email,
		status: r.status === 'declined' ? 'declined' : 'confirmed',
		phone: r.phone ?? '',
		emergencyName: r.emergency_name ?? '',
		emergencyPhone: r.emergency_phone ?? '',
		dietary: parseDietary(r.dietary),
		dietaryOther: r.dietary_other ?? '',
		accessibility: r.accessibility ?? '',
		notes: r.notes ?? '',
		travelArrival: r.travel_arrival ?? '',
		travelDeparture: r.travel_departure ?? '',
		travelMode: r.travel_mode && isTravelMode(r.travel_mode) ? r.travel_mode : null,
		travelDetails: r.travel_details ?? '',
		supportNeed: r.support_need && isSupportNeed(r.support_need) ? r.support_need : null,
		supportAmount: typeof r.support_amount === 'number' && r.support_amount > 0 ? r.support_amount : null,
		supportContingent: r.support_contingent === null ? null : r.support_contingent === 1,
		waiverVersion: r.waiver_version,
		cocVersion: r.coc_version,
		agreedAt: r.agreed_at,
		createdAt: r.created_at,
		updatedAt: r.updated_at
	};
}

export type TravelStatus = 'none' | 'partial' | 'complete';

/** Registered = confirmed AND agreements signed. Derived, never stored. */
export function isRegistered(r: Registration): boolean {
	return r.status === 'confirmed' && r.agreedAt !== null;
}

export function travelStatus(r: Registration): TravelStatus {
	const filled = [r.travelMode, r.travelArrival, r.travelDeparture].filter(Boolean).length;
	if (filled === 0) return 'none';
	return filled === 3 ? 'complete' : 'partial';
}

export interface SupportCounts {
	/** Confirmed attendees who said they need some or all of their travel covered. */
	people: number;
	/** …of whom can't attend without it. */
	contingent: number;
	/** Sum of their estimates, whole US dollars. */
	total: number;
	/** The contingent subset's share of that total. */
	contingentTotal: number;
	/** Confirmed attendees who said they can cover it themselves. */
	covered: number;
}

export interface RegistrationCounts {
	confirmed: number;
	registered: number;
	declined: number;
	noResponse: number;
	support: SupportCounts;
}

/** Travel-support rollup over confirmed rows only — a decline leaves the fund. */
export function supportCounts(regs: Registration[]): SupportCounts {
	const confirmed = regs.filter((r) => r.status === 'confirmed');
	const asking = confirmed.filter((r) => needsSupport(r.supportNeed));
	const contingent = asking.filter((r) => r.supportContingent === true);
	const sum = (rows: Registration[]) => rows.reduce((n, r) => n + (r.supportAmount ?? 0), 0);
	return {
		people: asking.length,
		contingent: contingent.length,
		total: sum(asking),
		contingentTotal: sum(contingent),
		covered: confirmed.filter((r) => r.supportNeed === 'none').length
	};
}

/** Allowlisted people with no registration row, matched by DID or handle. */
export function noResponseHandles(regs: Registration[], allowlist: AllowlistEntry[]): AllowlistEntry[] {
	const dids = new Set(regs.map((r) => r.did));
	const handles = new Set(regs.map((r) => r.handle?.toLowerCase()).filter(Boolean));
	return allowlist.filter((a) => !(a.did && dids.has(a.did)) && !handles.has(a.handle.toLowerCase()));
}

export function registrationCounts(regs: Registration[], allowlist: AllowlistEntry[]): RegistrationCounts {
	return {
		confirmed: regs.filter((r) => r.status === 'confirmed').length,
		registered: regs.filter(isRegistered).length,
		declined: regs.filter((r) => r.status === 'declined').length,
		noResponse: noResponseHandles(regs, allowlist).length,
		support: supportCounts(regs)
	};
}

/** D1 has no boolean: null stays null, otherwise 0/1. */
function contingentFlag(v: boolean | null): number | null {
	return v === null ? null : v ? 1 : 0;
}

export async function getRegistration(db: D1Database, did: string): Promise<Registration | null> {
	const row = await db.prepare(`SELECT ${COLUMNS} FROM registrations WHERE did = ?1`).bind(did).first<RegistrationRow>();
	return row ? rowToRegistration(row) : null;
}

/**
 * Save a confirmed registration. Preserves created_at and the FIRST
 * agreed_at (re-submitting doesn't re-date the agreement); versions update
 * to whatever text was agreed to this time.
 */
export async function upsertConfirmed(
	db: D1Database,
	who: { did: string; handle: string | null },
	input: RegistrationInput,
	versions: { waiver: string; coc: string }
): Promise<void> {
	const now = new Date().toISOString();
	await db
		.prepare(
			`INSERT INTO registrations (${COLUMNS})
			 VALUES (?1, ?2, ?3, ?4, 'confirmed', ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21, ?21, ?21)
			 ON CONFLICT(did) DO UPDATE SET
			   handle = excluded.handle, name = excluded.name, email = excluded.email, status = 'confirmed',
			   phone = excluded.phone, emergency_name = excluded.emergency_name, emergency_phone = excluded.emergency_phone,
			   dietary = excluded.dietary, dietary_other = excluded.dietary_other, accessibility = excluded.accessibility,
			   notes = excluded.notes, travel_arrival = excluded.travel_arrival, travel_departure = excluded.travel_departure,
			   travel_mode = excluded.travel_mode, travel_details = excluded.travel_details,
			   support_need = excluded.support_need, support_amount = excluded.support_amount,
			   support_contingent = excluded.support_contingent,
			   waiver_version = excluded.waiver_version, coc_version = excluded.coc_version,
			   agreed_at = COALESCE(registrations.agreed_at, excluded.agreed_at),
			   updated_at = excluded.updated_at`
		)
		.bind(
			who.did,
			who.handle,
			input.name,
			input.email,
			input.phone || null,
			input.emergencyName,
			input.emergencyPhone,
			JSON.stringify(input.dietary),
			input.dietaryOther || null,
			input.accessibility || null,
			input.notes || null,
			input.travelArrival || null,
			input.travelDeparture || null,
			input.travelMode,
			input.travelDetails || null,
			input.supportNeed,
			input.supportAmount,
			contingentFlag(input.supportContingent),
			versions.waiver,
			versions.coc,
			now
		)
		.run();
}

/** Record a decline. Keeps any previously entered details; clears nothing. */
export async function setDeclined(
	db: D1Database,
	who: { did: string; handle: string | null; name: string; email: string }
): Promise<void> {
	const now = new Date().toISOString();
	await db
		.prepare(
			`INSERT INTO registrations (did, handle, name, email, status, created_at, updated_at)
			 VALUES (?1, ?2, ?3, ?4, 'declined', ?5, ?5)
			 ON CONFLICT(did) DO UPDATE SET handle = excluded.handle, status = 'declined', updated_at = excluded.updated_at`
		)
		.bind(who.did, who.handle, who.name, who.email, now)
		.run();
}

/**
 * Organizer edit of an existing row: the form fields only. Status, the
 * agreement versions/timestamp, handle, and created_at are the attendee's
 * own and stay untouched — the organizer fixes a phone number or a flight,
 * never agrees to anything on someone's behalf. Returns false when the DID
 * has no row.
 */
export async function updateRegistrationFields(
	db: D1Database,
	did: string,
	input: Omit<RegistrationInput, 'agreeWaiver' | 'agreeCoc'>
): Promise<boolean> {
	const now = new Date().toISOString();
	const result = await db
		.prepare(
			`UPDATE registrations SET
			   name = ?1, email = ?2, phone = ?3, emergency_name = ?4, emergency_phone = ?5,
			   dietary = ?6, dietary_other = ?7, accessibility = ?8, notes = ?9,
			   travel_arrival = ?10, travel_departure = ?11, travel_mode = ?12, travel_details = ?13,
			   support_need = ?14, support_amount = ?15, support_contingent = ?16,
			   updated_at = ?17
			 WHERE did = ?18`
		)
		.bind(
			input.name,
			input.email,
			input.phone || null,
			input.emergencyName,
			input.emergencyPhone,
			JSON.stringify(input.dietary),
			input.dietaryOther || null,
			input.accessibility || null,
			input.notes || null,
			input.travelArrival || null,
			input.travelDeparture || null,
			input.travelMode,
			input.travelDetails || null,
			input.supportNeed,
			input.supportAmount,
			contingentFlag(input.supportContingent),
			now,
			did
		)
		.run();
	return (result.meta.changes ?? 0) > 0;
}

/** Organizer roster, most recently updated first. */
export async function listRegistrations(db: D1Database): Promise<Registration[]> {
	const rows = await db.prepare(`SELECT ${COLUMNS} FROM registrations ORDER BY updated_at DESC`).all<RegistrationRow>();
	return rows.results.map(rowToRegistration);
}
