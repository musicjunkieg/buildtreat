import { retreat, type AvailabilityRange, type DayPortion } from '$lib/content';

/** ISO date string helpers — all dates are naive calendar dates (no TZ math). */

export function iso(y: number, m: number, d: number): string {
	return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export function parseIso(s: string): { y: number; m: number; d: number } {
	const [y, m, d] = s.split('-').map(Number);
	return { y, m, d };
}

/** Days between two ISO dates (b - a). */
export function diffDays(a: string, b: string): number {
	const pa = parseIso(a);
	const pb = parseIso(b);
	const ua = Date.UTC(pa.y, pa.m - 1, pa.d);
	const ub = Date.UTC(pb.y, pb.m - 1, pb.d);
	return Math.round((ub - ua) / 86_400_000);
}

export function compareIso(a: string, b: string): number {
	return a < b ? -1 : a > b ? 1 : 0;
}

export function clampToWindow(s: string): string {
	if (s < retreat.window.start) return retreat.window.start;
	if (s > retreat.window.end) return retreat.window.end;
	return s;
}

export function inWindow(s: string): boolean {
	return s >= retreat.window.start && s <= retreat.window.end;
}

export interface CalendarDay {
	iso: string;
	day: number;
	inWindow: boolean;
}

export interface CalendarMonth {
	year: number;
	month: number; // 1-based
	name: string;
	/** Leading blanks for the weekday offset (weeks start Sunday). */
	leading: number;
	days: CalendarDay[];
}

const MONTH_NAMES = [
	'January',
	'February',
	'March',
	'April',
	'May',
	'June',
	'July',
	'August',
	'September',
	'October',
	'November',
	'December'
];

/** The months the availability window spans, fully materialized. */
export function windowMonths(): CalendarMonth[] {
	const start = parseIso(retreat.window.start);
	const end = parseIso(retreat.window.end);
	const months: CalendarMonth[] = [];
	let y = start.y;
	let m = start.m;
	while (y < end.y || (y === end.y && m <= end.m)) {
		const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
		const leading = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
		const days: CalendarDay[] = [];
		for (let d = 1; d <= daysInMonth; d++) {
			const s = iso(y, m, d);
			days.push({ iso: s, day: d, inWindow: inWindow(s) });
		}
		months.push({ year: y, month: m, name: MONTH_NAMES[m - 1], leading, days });
		m++;
		if (m > 12) {
			m = 1;
			y++;
		}
	}
	return months;
}

/** True when `day` falls inside `range` (inclusive). */
export function inRange(day: string, range: AvailabilityRange): boolean {
	return day >= range.start && day <= range.end;
}

export function rangesOverlap(a: AvailabilityRange, b: AvailabilityRange): boolean {
	return a.start <= b.end && b.start <= a.end;
}

/** Merge overlapping/adjacent ranges, keeping edge portions of the outermost edges. */
export function normalizeRanges(ranges: AvailabilityRange[]): AvailabilityRange[] {
	const sorted = [...ranges].sort((a, b) => compareIso(a.start, b.start));
	const out: AvailabilityRange[] = [];
	for (const r of sorted) {
		const last = out[out.length - 1];
		if (last && (rangesOverlap(last, r) || diffDays(last.end, r.start) === 1)) {
			if (r.end > last.end) {
				last.end = r.end;
				last.endPortion = r.endPortion;
			}
		} else {
			out.push({ ...r });
		}
	}
	return out;
}

export function portionLabel(portion: DayPortion, edge: 'start' | 'end'): string {
	if (portion === 'full') return 'full day';
	if (portion === 'first_half') return edge === 'end' ? 'first half only (leaving midday)' : 'first half only';
	return edge === 'start' ? 'second half only (arriving midday)' : 'second half only';
}

export function formatDay(s: string): string {
	const { m, d } = parseIso(s);
	return `${MONTH_NAMES[m - 1].slice(0, 3)} ${d}`;
}

export function formatRange(r: AvailabilityRange): string {
	const days = diffDays(r.start, r.end) + 1;
	if (days === 1) return formatDay(r.start);
	return `${formatDay(r.start)} – ${formatDay(r.end)}`;
}

export function rangeNights(r: AvailabilityRange): number {
	return diffDays(r.start, r.end);
}
