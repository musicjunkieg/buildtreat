import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { dev } from '$app/environment';
import { deadlineStatus } from '$lib/server/deadline';
import {
	addAllowlistHandles,
	clearAllAnchors,
	getAllResponses,
	grantLatePass,
	isOrganizer,
	isReopened,
	listAllowlist,
	listAnchors,
	listLatePasses,
	removeAllowlistHandle,
	revokeLatePass,
	setAnchor,
	setReopened,
	surveyGate,
	type AllowlistEntry,
	type LatePass,
	type OrganizerResponse
} from '$lib/server/organizer';
import { listWaitlist, promoteFromWaitlist, type WaitlistEntry } from '$lib/server/waitlist';

/**
 * /organizer — Bryan's side of the survey. Access policy:
 *  - signed out → minimal sign-in state (no data leaves the server)
 *  - signed in, not in ORGANIZER_DIDS → 404, indistinguishable from no route
 *  - organizer → everything
 */

export interface OrganizerPageData {
	authState: 'signed-out' | 'ok';
	/** True only for the dev ?preview fixture state — rendered on-surface. */
	preview: boolean;
	responses: OrganizerResponse[];
	allowlist: AllowlistEntry[];
	latePasses: LatePass[];
	waitlist: WaitlistEntry[];
	reopened: boolean;
	deadline: string | null;
	deadlineDisplay: string | null;
	deadlinePassed: boolean;
	anchors: string[];
	/** True when the anchor read failed — mutations are disabled for this load. */
	anchorsUnavailable: boolean;
}

const EMPTY: Omit<OrganizerPageData, 'authState'> = {
	preview: false,
	responses: [],
	allowlist: [],
	latePasses: [],
	waitlist: [],
	reopened: false,
	deadline: null,
	deadlineDisplay: null,
	deadlinePassed: false,
	anchors: [],
	anchorsUnavailable: false
};

function requireOrganizer(locals: App.Locals, platform: App.Platform | undefined): void {
	if (!locals.did || !isOrganizer(platform?.env?.ORGANIZER_DIDS, locals.did)) {
		error(404, { message: 'Not found' });
	}
}

export const load: PageServerLoad = async ({ locals, platform, url }): Promise<OrganizerPageData> => {
	// Dev-only design preview with synthetic data; `dev` is compile-time false
	// in production builds, so this path cannot ship.
	if (dev && url.searchParams.has('preview')) {
		return {
			authState: 'ok',
			preview: true,
			...previewData(),
			deadline: '2026-08-16T06:59:59Z',
			deadlineDisplay: 'August 15'
		};
	}

	if (!locals.did) {
		return { authState: 'signed-out', ...EMPTY };
	}
	requireOrganizer(locals, platform);

	const db = platform?.env?.DB;
	if (!db) error(503, { message: 'Storage is not available right now' });

	const base = deadlineStatus(platform?.env?.DEADLINE);
	// A failed anchor read must not look like "no anchors": Clear would then
	// silently delete rows that were never displayed. The flag disables all
	// anchor mutations for the rest of the page load.
	let anchorsUnavailable = false;
	const [responses, allowlist, latePasses, waitlist, reopened, anchors] = await Promise.all([
		getAllResponses(db),
		listAllowlist(db),
		listLatePasses(db),
		listWaitlist(db),
		isReopened(db),
		listAnchors(db).catch((e) => {
			console.error('anchor load failed', e);
			anchorsUnavailable = true;
			return [] as string[];
		})
	]);

	return {
		authState: 'ok',
		preview: false,
		responses,
		allowlist,
		latePasses,
		waitlist,
		reopened,
		deadline: base.deadline,
		deadlineDisplay: base.display,
		deadlinePassed: base.closed,
		anchors,
		anchorsUnavailable
	};
};

export const actions: Actions = {
	addHandles: async ({ request, locals, platform }) => {
		requireOrganizer(locals, platform);
		const db = platform?.env?.DB;
		if (!db) return fail(503, { message: 'Storage is not available right now' });
		const raw = String((await request.formData()).get('handles') ?? '');
		if (!raw.trim()) return fail(400, { message: 'Paste at least one handle' });
		const { added, skipped } = await addAllowlistHandles(db, raw);
		return {
			message:
				`Added ${added} handle${added === 1 ? '' : 's'}` +
				(skipped.length ? ` — skipped ${skipped.length} that didn’t look like handles` : '')
		};
	},

	removeHandle: async ({ request, locals, platform }) => {
		requireOrganizer(locals, platform);
		const db = platform?.env?.DB;
		if (!db) return fail(503, { message: 'Storage is not available right now' });
		const handle = String((await request.formData()).get('handle') ?? '');
		if (!handle) return fail(400, { message: 'Missing handle' });
		await removeAllowlistHandle(db, handle);
		return { message: `Removed @${handle}` };
	},

	setReopen: async ({ request, locals, platform }) => {
		requireOrganizer(locals, platform);
		const db = platform?.env?.DB;
		if (!db) return fail(503, { message: 'Storage is not available right now' });
		const on = String((await request.formData()).get('on') ?? '') === '1';
		await setReopened(db, on);
		return { message: on ? 'Survey reopened — answers unlock for everyone' : 'Survey closed again' };
	},

	grantPass: async ({ request, locals, platform }) => {
		requireOrganizer(locals, platform);
		const db = platform?.env?.DB;
		if (!db) return fail(503, { message: 'Storage is not available right now' });
		const handle = String((await request.formData()).get('handle') ?? '').trim();
		if (!handle) return fail(400, { message: 'Type a handle to grant a pass' });
		const ok = await grantLatePass(db, handle);
		if (!ok) return fail(400, { message: `“${handle}” doesn’t look like a handle` });
		return { message: `Late pass granted to @${handle.replace(/^@/, '').toLowerCase()}` };
	},

	revokePass: async ({ request, locals, platform }) => {
		requireOrganizer(locals, platform);
		const db = platform?.env?.DB;
		if (!db) return fail(503, { message: 'Storage is not available right now' });
		const handle = String((await request.formData()).get('handle') ?? '');
		if (!handle) return fail(400, { message: 'Missing handle' });
		await revokeLatePass(db, handle);
		return { message: `Late pass revoked for @${handle}` };
	},

	promoteWaitlist: async ({ request, locals, platform }) => {
		requireOrganizer(locals, platform);
		const db = platform?.env?.DB;
		if (!db) return fail(503, { message: 'Storage is not available right now' });
		const did = String((await request.formData()).get('did') ?? '');
		if (!did) return fail(400, { message: 'Missing waitlist entry' });
		const { ok, handle } = await promoteFromWaitlist(db, did);
		if (!ok) {
			return fail(400, {
				message:
					'Could not promote — no resolved handle yet. Ask them to reopen the survey while signed in; it refreshes their handle automatically, then Promote will work.'
			});
		}
		return { message: `Promoted @${handle} — they’re on the survey now` };
	},

	toggleAnchor: async ({ request, locals, platform }) => {
		requireOrganizer(locals, platform);
		const db = platform?.env?.DB;
		if (!db) return fail(503, { message: 'Storage is not available right now' });
		const form = await request.formData();
		const did = String(form.get('did') ?? '');
		const on = String(form.get('on') ?? '') === '1';
		if (!did) return fail(400, { message: 'Missing respondent' });
		const known = await db
			.prepare(`SELECT 1 AS x FROM responses WHERE did = ?1`)
			.bind(did)
			.first<{ x: number }>();
		if (!known) return fail(400, { message: 'Not a respondent' });
		try {
			await setAnchor(db, did, on);
		} catch (e) {
			console.error('toggleAnchor failed', e);
			return fail(500, { message: 'Could not save the anchor — try again' });
		}
		return { anchorDid: did, anchorOn: on };
	},

	clearAnchors: async ({ locals, platform }) => {
		requireOrganizer(locals, platform);
		const db = platform?.env?.DB;
		if (!db) return fail(503, { message: 'Storage is not available right now' });
		try {
			await clearAllAnchors(db);
		} catch (e) {
			console.error('clearAnchors failed', e);
			return fail(500, { message: 'Could not clear anchors — try again' });
		}
		return { anchorsCleared: true };
	}
};

/* ── dev preview fixtures ─────────────────────────────────────────────── */

/** Deterministic synthetic dataset for the ?preview design state. */
function previewData(): Omit<OrganizerPageData, 'authState' | 'preview' | 'deadline' | 'deadlineDisplay'> {
	const first = ['Maren', 'Chris', 'Koko', 'Evan', 'Lauren', 'Jacob', 'Priya', 'Sam', 'Dana', 'Alex', 'Noor', 'Theo'];
	const last = ['Costa', 'Lee', 'Nguyen', 'Mono', 'Bell', 'Foster', 'Shah', 'Rivera', 'Kim', 'Okafor', 'Haddad', 'Ames'];
	const cities = [
		'Portland, OR',
		'San Diego, CA',
		'Los Angeles, CA',
		'Joshua Tree, CA',
		'Austin, TX',
		'Phoenix, AZ',
		'Seattle, WA',
		'Brooklyn, NY',
		'Denver, CO',
		'Oakland, CA'
	];
	const locIds = ['palm-springs', 'coachella-valley', 'joshua-tree', 'san-diego', 'la-metro'];
	const interests = ['yes', 'yes', 'yes', 'yes', 'maybe', 'maybe', 'no'] as const;
	const travels = ['yes', 'yes', 'partial', 'no'] as const;
	const portions = ['full', 'full', 'full', 'first_half', 'second_half'] as const;

	// Small deterministic PRNG — Date.now()/Math.random() would make every
	// screenshot round a different dataset.
	let seed = 9380440;
	const rnd = (n: number) => {
		seed = (seed * 48271) % 2147483647;
		return seed % n;
	};

	const responses: OrganizerResponse[] = [];
	for (let i = 0; i < 37; i++) {
		const name = `${first[rnd(first.length)]} ${last[rnd(last.length)]}`;
		const handle = `${name.split(' ')[0].toLowerCase()}${i}.bsky.social`;
		const interest = interests[rnd(interests.length)];
		const nRanges = interest === 'no' ? 0 : 1 + rnd(3);
		const ranges = [];
		let cursor = 1 + rnd(20);
		for (let r = 0; r < nRanges; r++) {
			// Cluster availability toward early/mid October so the heatmap has a
			// visible story rather than uniform noise.
			const month = rnd(10) < 6 ? 10 : rnd(2) === 0 ? 9 : 11;
			const maxDay = month === 11 ? 12 : 24;
			const startDay = Math.min(cursor + rnd(8), maxDay);
			const len = 2 + rnd(6);
			const endDay = Math.min(startDay + len, month === 11 ? 15 : 30);
			ranges.push({
				start: `2026-${String(month).padStart(2, '0')}-${String(startDay).padStart(2, '0')}`,
				end: `2026-${String(month).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`,
				startPortion: portions[rnd(portions.length)],
				endPortion: portions[rnd(portions.length)]
			});
			cursor = endDay + 2;
		}
		const ranking =
			interest === 'no' ? [] : rnd(8) === 0 ? ['no-preference'] : [...locIds].sort(() => rnd(3) - 1).slice(0, 3);
		responses.push({
			did: `did:plc:preview${i}`,
			handle,
			name,
			email: `${handle.split('.')[0]}@example.com`,
			homeLocation: cities[rnd(cities.length)],
			interest,
			travel: interest === 'no' ? null : travels[rnd(travels.length)],
			ranking,
			ranges,
			submittedAt: `2026-08-${String(1 + rnd(6)).padStart(2, '0')}T18:${String(10 + rnd(49))}:00Z`,
			updatedAt: `2026-08-${String(4 + rnd(3)).padStart(2, '0')}T2${rnd(4)}:${String(10 + rnd(49))}:00Z`
		});
	}

	return {
		responses,
		allowlist: [
			...responses.slice(0, 30).map((r) => ({ handle: r.handle as string, did: r.did, responded: true })),
			{ handle: 'waverly.bsky.social', did: null, responded: false },
			{ handle: 'clara.notes.dev', did: null, responded: false },
			{ handle: 'buildwithbeck.com', did: null, responded: false }
		],
		latePasses: [{ handle: 'waverly.bsky.social', did: null, grantedAt: '2026-08-06T21:04:00Z' }],
		waitlist: [
			{ did: 'did:plc:wl0', handle: 'juno.bsky.social', email: 'juno@example.com', createdAt: '2026-08-10T15:22:00Z', promotedAt: null },
			{ did: 'did:plc:wl1', handle: 'rafi.dev', email: 'rafi@example.com', createdAt: '2026-08-10T18:40:00Z', promotedAt: null },
			{ did: 'did:plc:wl2', handle: 'm.harbor.social', email: 'harbor@example.com', createdAt: '2026-08-11T09:05:00Z', promotedAt: null },
			{ did: 'did:plc:wl3', handle: 'okoye.bsky.social', email: 'okoye@example.com', createdAt: '2026-08-09T12:00:00Z', promotedAt: '2026-08-11T17:30:00Z' }
		],
		reopened: false,
		deadlinePassed: false,
		anchors: ['did:plc:preview2', 'did:plc:preview5'],
		anchorsUnavailable: false
	};
}
