import { retreat, type AvailabilityRange, type InterestValue } from '$lib/content';
import { diffDays, iso, parseIso } from '$lib/dates';

/**
 * Pure aggregate math for the organizer surface. Runs in the browser so the
 * all/yes-only filter recomputes without a round trip.
 *
 * The unit is the HALF-DAY SLOT: every day has a first and second half, and
 * a range contributes both halves on interior days and whatever its edge
 * portions allow on the first/last day. A single-day range intersects its
 * two edge portions.
 */

export interface RespondentAvailability {
	interest: InterestValue;
	ranges: AvailabilityRange[];
}

export interface DayLoad {
	iso: string;
	/** Respondents available in each half of this day. */
	first: number;
	second: number;
}

function* windowDays(): Generator<string> {
	const start = parseIso(retreat.window.start);
	const total = diffDays(retreat.window.start, retreat.window.end);
	for (let i = 0; i <= total; i++) {
		const d = new Date(Date.UTC(start.y, start.m - 1, start.d + i));
		yield iso(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
	}
}

/** Which halves of `day` a single range makes available. */
function halvesOn(range: AvailabilityRange, day: string): { first: boolean; second: boolean } {
	if (day < range.start || day > range.end) return { first: false, second: false };
	let first = true;
	let second = true;
	if (day === range.start) {
		if (range.startPortion === 'first_half') second = false;
		if (range.startPortion === 'second_half') first = false;
	}
	if (day === range.end) {
		if (range.endPortion === 'first_half') second = false;
		if (range.endPortion === 'second_half') first = false;
	}
	return { first, second };
}

/** Per-respondent slot lookup, unioned across their ranges. */
export function slotSet(ranges: AvailabilityRange[]): Set<string> {
	const slots = new Set<string>();
	for (const r of ranges) {
		const span = diffDays(r.start, r.end);
		const s = parseIso(r.start);
		for (let i = 0; i <= span; i++) {
			const d = new Date(Date.UTC(s.y, s.m - 1, s.d + i));
			const dayIso = iso(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
			const { first, second } = halvesOn(r, dayIso);
			if (first) slots.add(`${dayIso}:1`);
			if (second) slots.add(`${dayIso}:2`);
		}
	}
	return slots;
}

/** Availability heatmap: how many respondents can make each half-day. */
export function dayLoads(respondents: RespondentAvailability[]): DayLoad[] {
	const sets = respondents.map((r) => slotSet(r.ranges));
	const out: DayLoad[] = [];
	for (const day of windowDays()) {
		let first = 0;
		let second = 0;
		for (const s of sets) {
			if (s.has(`${day}:1`)) first++;
			if (s.has(`${day}:2`)) second++;
		}
		out.push({ iso: day, first, second });
	}
	return out;
}

/**
 * The half-day slots a respondent must cover to attend a 3-night window
 * starting `start`: arrival evening, then two full days. The third night is
 * day 2's second half (see bestWindows for why day 3 is never required).
 */
export function windowSlots(start: string): string[] {
	const s = parseIso(start);
	const day = (n: number) => {
		const d = new Date(Date.UTC(s.y, s.m - 1, s.d + n));
		return iso(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
	};
	return [`${day(0)}:2`, `${day(1)}:1`, `${day(1)}:2`, `${day(2)}:1`, `${day(2)}:2`];
}

export interface HalfOverlap {
	first: boolean;
	second: boolean;
}

/**
 * Days where EVERY given slot set is available, by half. Empty input means
 * no scenario is active — an empty map, not "everything overlaps".
 */
export function fullOverlap(sets: Set<string>[]): Map<string, HalfOverlap> {
	const out = new Map<string, HalfOverlap>();
	if (sets.length === 0) return out;
	for (const day of windowDays()) {
		const first = sets.every((s) => s.has(`${day}:1`));
		const second = sets.every((s) => s.has(`${day}:2`));
		if (first || second) out.set(day, { first, second });
	}
	return out;
}

/** How many of the given slot sets can attend the window starting `start`. */
export function windowFitCount(sets: Set<string>[], start: string): number {
	const need = windowSlots(start);
	return sets.filter((s) => need.every((k) => s.has(k))).length;
}

export interface WindowRoster {
	/** Arrival day of the 3-night window. */
	start: string;
	/** Departure day (start + 3). */
	end: string;
	/** DIDs whose slots cover every required window slot. */
	available: string[];
	/** DIDs who gave dates but miss at least one required slot. */
	unavailable: string[];
}

/**
 * Who can make the 3-night window starting `start` — same fit definition as
 * windowFitCount, partitioned into names instead of a count. Respondents
 * with no ranges never entered dates and appear in neither list.
 */
export function windowRoster(
	respondents: { did: string; ranges: AvailabilityRange[] }[],
	start: string
): WindowRoster {
	const need = windowSlots(start);
	const s = parseIso(start);
	const dep = new Date(Date.UTC(s.y, s.m - 1, s.d + 3));
	const end = iso(dep.getUTCFullYear(), dep.getUTCMonth() + 1, dep.getUTCDate());
	const available: string[] = [];
	const unavailable: string[] = [];
	for (const r of respondents) {
		if (r.ranges.length === 0) continue;
		const slots = slotSet(r.ranges);
		(need.every((k) => slots.has(k)) ? available : unavailable).push(r.did);
	}
	return { start, end, available, unavailable };
}

export interface RetreatWindow {
	/** Arrival day (evening) — the retreat runs start..end, 3 nights. */
	start: string;
	end: string;
	/** Respondents who can make the whole window (arrival eve → departure morn). */
	count: number;
	/** Of how many respondents with any availability given. */
	of: number;
}

/**
 * Score every possible 3-night window: arrive the second half of day 0, two
 * full days, depart the morning of day 3. A respondent counts when their
 * slots cover day 0's second half through day 2's second half. The third
 * night IS day 2's second half — an end portion of "full" means "there
 * through the day's end" (the survey labels the alternative "leaving
 * midday"), so departure morning is implied and must NOT be required as a
 * day-3 availability slot: that would demand a 4th calendar day for a
 * 3-night stay and silently zero out everyone who entered exactly the
 * weekend they meant.
 *
 * Ranked by count, earlier window wins ties. The returned list is
 * de-clustered: overlapping shifts of the same peak hide behind their best
 * representative, so the organizer sees `top` genuinely distinct options.
 */
export function bestWindows(respondents: RespondentAvailability[], top = 3): RetreatWindow[] {
	if (top <= 0) return [];
	const withDates = respondents.filter((r) => r.ranges.length > 0);
	const sets = withDates.map((r) => slotSet(r.ranges));
	const totalDays = diffDays(retreat.window.start, retreat.window.end);
	const start = parseIso(retreat.window.start);
	const windows: RetreatWindow[] = [];

	for (let i = 0; i + 3 <= totalDays; i++) {
		const days: string[] = [];
		for (let j = 0; j < 4; j++) {
			const d = new Date(Date.UTC(start.y, start.m - 1, start.d + i + j));
			days.push(iso(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()));
		}
		const need = windowSlots(days[0]);
		let count = 0;
		for (const s of sets) {
			if (need.every((k) => s.has(k))) count++;
		}
		windows.push({ start: days[0], end: days[3], count, of: withDates.length });
	}

	windows.sort((a, b) => b.count - a.count || (a.start < b.start ? -1 : 1));

	const picked: RetreatWindow[] = [];
	for (const w of windows) {
		if (picked.some((p) => w.start <= p.end && p.start <= w.end)) continue;
		picked.push(w);
		if (picked.length === top) break;
	}
	return picked;
}

export interface LocationTally {
	id: string;
	/** Weighted points: rank 1 = 3, rank 2 = 2, rank 3 = 1. */
	points: number;
	firsts: number;
}

export function locationTallies(rankings: string[][]): { tallies: LocationTally[]; noPreference: number } {
	const points = new Map<string, LocationTally>();
	let noPreference = 0;
	for (const ranking of rankings) {
		if (ranking.includes('no-preference')) {
			noPreference++;
			continue;
		}
		ranking.forEach((id, i) => {
			const t = points.get(id) ?? { id, points: 0, firsts: 0 };
			t.points += Math.max(3 - i, 1);
			if (i === 0) t.firsts++;
			points.set(id, t);
		});
	}
	return {
		tallies: [...points.values()].sort((a, b) => b.points - a.points || b.firsts - a.firsts),
		noPreference
	};
}
