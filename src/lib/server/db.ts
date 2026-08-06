import type { D1Database } from '@cloudflare/workers-types';
import type { SurveyDraft } from '$lib/survey.svelte';
import type { AvailabilityRange, InterestValue, TravelValue } from '$lib/content';
import { locations, retreat } from '$lib/content';

/**
 * D1 access for survey responses. All queries are parameterized.
 * Schema lives in migrations/0001_init.sql.
 */

const LOCATION_IDS = new Set(locations.map((l) => l.id));
const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface StoredResponse {
	draft: SurveyDraft;
	submittedAt: string;
	updatedAt: string;
}

export class ValidationError extends Error {}

function assertPortion(p: unknown): asserts p is AvailabilityRange['startPortion'] {
	if (p !== 'full' && p !== 'first_half' && p !== 'second_half') {
		throw new ValidationError('Invalid half-day value');
	}
}

/** Validate an incoming draft from the client. Throws ValidationError. */
export function validateDraft(body: unknown): SurveyDraft {
	if (typeof body !== 'object' || body === null) throw new ValidationError('Missing body');
	const b = body as Record<string, unknown>;

	const name = typeof b.name === 'string' ? b.name.trim().slice(0, 200) : '';
	const email = typeof b.email === 'string' ? b.email.trim().slice(0, 320) : '';
	const homeLocation = typeof b.homeLocation === 'string' ? b.homeLocation.trim().slice(0, 200) : '';

	if (!name) throw new ValidationError('Name is required');
	if (!EMAIL_RE.test(email)) throw new ValidationError('A valid email is required');
	if (!homeLocation) throw new ValidationError('Your location is required');

	const interest = b.interest;
	if (interest !== 'yes' && interest !== 'no' && interest !== 'maybe') {
		throw new ValidationError('Interest answer is required');
	}

	let travel: TravelValue | null = null;
	if (b.travel === 'yes' || b.travel === 'partial' || b.travel === 'no') travel = b.travel;

	const ranges: AvailabilityRange[] = [];
	if (Array.isArray(b.ranges)) {
		if (b.ranges.length > 20) throw new ValidationError('Too many date ranges');
		for (const r of b.ranges) {
			if (typeof r !== 'object' || r === null) throw new ValidationError('Bad range');
			const x = r as Record<string, unknown>;
			if (typeof x.start !== 'string' || !ISO_RE.test(x.start)) throw new ValidationError('Bad range start');
			if (typeof x.end !== 'string' || !ISO_RE.test(x.end)) throw new ValidationError('Bad range end');
			if (x.start > x.end) throw new ValidationError('Range ends before it starts');
			if (x.start < retreat.window.start || x.end > retreat.window.end) {
				throw new ValidationError('Dates must fall between Sept 1 and Nov 15');
			}
			assertPortion(x.startPortion);
			assertPortion(x.endPortion);
			ranges.push({ start: x.start, end: x.end, startPortion: x.startPortion, endPortion: x.endPortion });
		}
	}

	const ranking: string[] = [];
	if (Array.isArray(b.ranking)) {
		for (const id of b.ranking) {
			if (typeof id !== 'string' || !LOCATION_IDS.has(id)) throw new ValidationError('Unknown location');
			if (!ranking.includes(id)) ranking.push(id);
		}
		if (ranking.length > 3) throw new ValidationError('Rank at most three locations');
	}

	// "No" respondents only owe identity + interest; everyone else the full set.
	if (interest !== 'no') {
		if (travel === null) throw new ValidationError('Travel answer is required');
		if (ranges.length === 0) throw new ValidationError('At least one date range is required');
		if (ranking.length === 0) throw new ValidationError('Rank at least one location');
	}

	return { name, email, homeLocation, interest: interest as InterestValue, travel, ranges, ranking };
}

export async function upsertResponse(
	db: D1Database,
	who: { did: string; handle: string | null },
	draft: SurveyDraft
): Promise<void> {
	const now = new Date().toISOString();
	const statements = [
		db
			.prepare(
				`INSERT INTO responses (did, handle, name, email, home_location, interest, travel, location_ranking, submitted_at, updated_at)
				 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?9)
				 ON CONFLICT(did) DO UPDATE SET
					handle = excluded.handle, name = excluded.name, email = excluded.email,
					home_location = excluded.home_location, interest = excluded.interest,
					travel = excluded.travel, location_ranking = excluded.location_ranking,
					updated_at = excluded.updated_at`
			)
			.bind(
				who.did,
				who.handle,
				draft.name,
				draft.email,
				draft.homeLocation,
				draft.interest,
				draft.travel,
				JSON.stringify(draft.ranking),
				now
			),
		db.prepare(`DELETE FROM availability_ranges WHERE did = ?1`).bind(who.did),
		...draft.ranges.map((r) =>
			db
				.prepare(
					`INSERT INTO availability_ranges (did, start_date, end_date, start_portion, end_portion)
					 VALUES (?1, ?2, ?3, ?4, ?5)`
				)
				.bind(who.did, r.start, r.end, r.startPortion, r.endPortion)
		)
	];
	await db.batch(statements);
}

export async function getResponse(db: D1Database, did: string): Promise<StoredResponse | null> {
	const row = await db
		.prepare(
			`SELECT name, email, home_location, interest, travel, location_ranking, submitted_at, updated_at
			 FROM responses WHERE did = ?1`
		)
		.bind(did)
		.first<{
			name: string;
			email: string;
			home_location: string;
			interest: InterestValue;
			travel: TravelValue | null;
			location_ranking: string;
			submitted_at: string;
			updated_at: string;
		}>();
	if (!row) return null;

	const rangeRows = await db
		.prepare(
			`SELECT start_date, end_date, start_portion, end_portion
			 FROM availability_ranges WHERE did = ?1 ORDER BY start_date`
		)
		.bind(did)
		.all<{
			start_date: string;
			end_date: string;
			start_portion: AvailabilityRange['startPortion'];
			end_portion: AvailabilityRange['endPortion'];
		}>();

	let ranking: string[] = [];
	try {
		const parsed = JSON.parse(row.location_ranking);
		if (Array.isArray(parsed)) ranking = parsed.filter((x): x is string => typeof x === 'string');
	} catch {
		// Corrupt ranking JSON — treat as unranked rather than failing the load.
	}

	return {
		draft: {
			name: row.name,
			email: row.email,
			homeLocation: row.home_location,
			interest: row.interest,
			travel: row.travel,
			ranges: rangeRows.results.map((r) => ({
				start: r.start_date,
				end: r.end_date,
				startPortion: r.start_portion,
				endPortion: r.end_portion
			})),
			ranking
		},
		submittedAt: row.submitted_at,
		updatedAt: row.updated_at
	};
}

/**
 * Allowlist policy: an EMPTY allowlist admits everyone (pre-launch state,
 * documented in the surface brief); once handles exist, only they may submit.
 * Matching is by handle (case-insensitive) or DID; on first login the DID is
 * recorded next to the handle so later handle changes don't lock anyone out.
 */
/**
 * Read-only allowlist lookup for the pre-auth sign-in check. Unlike
 * checkAllowlist it never pins a DID — the caller may only have an
 * unauthenticated handle typed into the sign-in sheet.
 */
export async function peekAllowlist(
	db: D1Database,
	who: { did: string | null; handle: string | null }
): Promise<boolean> {
	const count = await db.prepare(`SELECT COUNT(*) AS n FROM allowlist`).first<{ n: number }>();
	if (!count || count.n === 0) return true;

	const row = await db
		.prepare(
			`SELECT 1 AS hit FROM allowlist WHERE (?1 IS NOT NULL AND did = ?1) OR lower(handle) = lower(?2) LIMIT 1`
		)
		.bind(who.did, who.handle ?? '')
		.first();
	return row !== null;
}

export async function checkAllowlist(
	db: D1Database,
	who: { did: string; handle: string | null }
): Promise<boolean> {
	const count = await db.prepare(`SELECT COUNT(*) AS n FROM allowlist`).first<{ n: number }>();
	if (!count || count.n === 0) return true;

	const row = await db
		.prepare(`SELECT handle FROM allowlist WHERE did = ?1 OR lower(handle) = lower(?2) LIMIT 1`)
		.bind(who.did, who.handle ?? '')
		.first<{ handle: string }>();
	if (!row) return false;

	await db.prepare(`UPDATE allowlist SET did = ?1 WHERE lower(handle) = lower(?2) AND did IS NULL`).bind(
		who.did,
		row.handle
	).run();
	return true;
}
