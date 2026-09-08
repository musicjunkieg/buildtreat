import type { AllowlistEntry, LatePass, OrganizerResponse } from '$lib/server/organizer/admin';
import { noResponseHandles, registrationCounts, type Registration } from '$lib/server/registration';
import { toRegistrationView, type OrganizerPageData } from './page-data';

/* ── dev preview fixtures ─────────────────────────────────────────────── */

/** Deterministic synthetic dataset for the ?preview design state. */
export function previewData(): Omit<OrganizerPageData, 'authState' | 'preview' | 'deadline' | 'deadlineDisplay'> {
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

	const previewAllowlist: AllowlistEntry[] = [
		...responses.slice(0, 30).map((r) => ({ handle: r.handle as string, did: r.did, responded: true })),
		{ handle: 'waverly.bsky.social', did: null, responded: false },
		{ handle: 'clara.notes.dev', did: null, responded: false },
		{ handle: 'buildwithbeck.com', did: null, responded: false }
	];

	const previewRegistrations: Registration[] = [
		{
			did: 'did:plc:preview0',
			handle: 'maren0.bsky.social',
			name: 'Maren Costa',
			email: 'maren0@example.com',
			status: 'confirmed',
			phone: '555-0100',
			emergencyName: 'Sam Costa',
			emergencyPhone: '555-0101',
			dietary: ['vegetarian', 'nut_allergy'],
			dietaryOther: '',
			accessibility: '',
			notes: '',
			travelArrival: 'Fri 3pm PSP',
			travelDeparture: 'Mon 9am',
			travelMode: 'flying',
			travelDetails: 'AS 1234',
			waiverVersion: 'v1',
			cocVersion: 'v1',
			agreedAt: '2026-08-30T18:00:00Z',
			createdAt: '2026-08-30T18:00:00Z',
			updatedAt: '2026-08-31T09:00:00Z'
		},
		{
			did: 'did:plc:preview1',
			handle: 'chris1.bsky.social',
			name: 'Chris Lee',
			email: 'chris1@example.com',
			status: 'confirmed',
			phone: '',
			emergencyName: 'Pat Lee',
			emergencyPhone: '555-0102',
			dietary: [],
			dietaryOther: '',
			accessibility: 'Ground-floor room, please',
			notes: '',
			travelArrival: '',
			travelDeparture: '',
			travelMode: 'driving',
			travelDetails: '',
			waiverVersion: 'v1',
			cocVersion: 'v1',
			agreedAt: '2026-08-30T19:00:00Z',
			createdAt: '2026-08-30T19:00:00Z',
			updatedAt: '2026-08-30T19:00:00Z'
		},
		{
			did: 'did:plc:preview2',
			handle: 'koko2.bsky.social',
			name: 'Koko Nguyen',
			email: 'koko2@example.com',
			status: 'declined',
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
			waiverVersion: null,
			cocVersion: null,
			agreedAt: null,
			createdAt: '2026-08-30T20:00:00Z',
			updatedAt: '2026-08-30T20:00:00Z'
		}
	];

	return {
		responses,
		allowlist: previewAllowlist,
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
		anchorsUnavailable: false,
		registrationsUnavailable: false,
		emailConfigured: true,
		regDeadlineDisplay: 'September 7',
		regClosed: false,
		registrations: previewRegistrations.map(toRegistrationView),
		regCounts: registrationCounts(previewRegistrations, previewAllowlist),
		regMissing: noResponseHandles(previewRegistrations, previewAllowlist),
		broadcasts: [
			{
				id: 1,
				subject: 'October dates are locked',
				body: 'Hi builders — we picked the window. Details on the site.',
				sentBy: 'did:plc:h3wpawnrlptr4534chevddo6',
				createdAt: '2026-08-14T20:11:00Z',
				recipients: [
					{ did: 'did:plc:preview0', email: 'maren0@example.com', status: 'sent', errorCode: null, messageId: '101' },
					{ did: 'did:plc:preview1', email: 'chris1@example.com', status: 'sent', errorCode: null, messageId: '102' },
					{ did: 'did:plc:preview2', email: 'koko2@example.com', status: 'failed', errorCode: 'INVALID_RECIPIENT_DOMAIN', messageId: null },
					{ did: 'did:plc:preview3', email: 'evan3@example.com', status: 'pending', errorCode: 'RATE_LIMITED', messageId: null }
				]
			}
		]
	};
}
