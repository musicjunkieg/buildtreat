import { NO_PREFERENCE } from '$lib/content';
import type { OrganizerResponse } from '$lib/server/organizer';

/**
 * RFC 4180-style CSV: quote fields containing commas, quotes, or newlines.
 * Respondent-controlled text (names, locations) also gets a leading
 * apostrophe when it starts with a formula trigger (= + - @ tab), so the
 * export can't run formulas when opened in Excel/Sheets.
 */
function field(v: string | number | null): string {
	if (v === null) return '';
	let s = String(v);
	if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
	return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows: (string | number | null)[][]): string {
	return rows.map((r) => r.map(field).join(',')).join('\r\n') + '\r\n';
}

export function responsesCsv(responses: OrganizerResponse[]): string {
	const rows: (string | number | null)[][] = [
		[
			'handle',
			'did',
			'name',
			'email',
			'home_location',
			'interest',
			'travel',
			'rank_1',
			'rank_2',
			'rank_3',
			'no_preference',
			'date_ranges',
			'submitted_at',
			'updated_at'
		]
	];
	for (const r of responses) {
		const noPref = r.ranking.includes(NO_PREFERENCE);
		const ranks = noPref ? [] : r.ranking;
		rows.push([
			r.handle,
			r.did,
			r.name,
			r.email,
			r.homeLocation,
			r.interest,
			r.travel,
			ranks[0] ?? null,
			ranks[1] ?? null,
			ranks[2] ?? null,
			noPref ? 'yes' : 'no',
			r.ranges
				.map(
					(g) =>
						`${g.start}${g.startPortion === 'full' ? '' : ` (${g.startPortion})`} to ${g.end}${g.endPortion === 'full' ? '' : ` (${g.endPortion})`}`
				)
				.join('; '),
			r.submittedAt,
			r.updatedAt
		]);
	}
	return toCsv(rows);
}

export function availabilityCsv(responses: OrganizerResponse[]): string {
	const rows: (string | number | null)[][] = [
		['handle', 'did', 'name', 'start_date', 'start_portion', 'end_date', 'end_portion']
	];
	for (const r of responses) {
		for (const g of r.ranges) {
			rows.push([r.handle, r.did, r.name, g.start, g.startPortion, g.end, g.endPortion]);
		}
	}
	return toCsv(rows);
}
