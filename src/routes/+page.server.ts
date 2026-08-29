import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { dev } from '$app/environment';
import { loadBskyProfile } from '@svelte-atproto/oauth/bsky';
import { actorToDid } from '@svelte-atproto/oauth/helper';
import { cloudflareKV } from '@svelte-atproto/oauth/server/stores/cloudflare';
import { codeOfConduct, retreat, waiver } from '$lib/content';
import { checkAllowlist, getResponse } from '$lib/server/db';
import { deadlineStatus } from '$lib/server/deadline';
import { sendEmail } from '$lib/server/email';
import { getRegistration, setDeclined, upsertConfirmed, type Registration } from '$lib/server/registration';
import { confirmationEmail } from '$lib/server/registration-email';
import { canConfirm, parseRegistrationForm, validateRegistration } from '$lib/registration';
import {
	backfillWaitlistHandle,
	getWaitlistEntry,
	isValidWaitlistEmail,
	joinWaitlist,
	type WaitlistState
} from '$lib/server/waitlist';
import type { SurveyDraft } from '$lib/survey.svelte';
import type { KnownUser } from '$lib/types';
import { surveyGate } from '$lib/server/organizer';

/** Enough of a DID to correlate log lines without logging the full identifier. */
const logDid = (did: string) => `${did.slice(0, 14)}…`;

export interface PageUser {
	did: string;
	handle: string | null;
	displayName: string | null;
	avatar: string | null;
}

export interface Organizer {
	handle: string;
	avatar: string | null;
}

const KNOWN_COOKIE = 'abr_known';

/** Strict shape check: the cookie value renders in the sheet and seeds login(),
 * and a sibling-subdomain page could plant a non-httpOnly copy. */
const KNOWN_HANDLE_RE = /^[a-z0-9.:-]{1,253}$/i;

function readKnownUser(raw: string | undefined): KnownUser | null {
	if (!raw) return null;
	try {
		const parsed = JSON.parse(raw) as Record<string, unknown>;
		if (typeof parsed.handle !== 'string' || !KNOWN_HANDLE_RE.test(parsed.handle)) return null;
		return {
			handle: parsed.handle,
			displayName: typeof parsed.displayName === 'string' ? parsed.displayName.slice(0, 64) : null,
			avatar:
				typeof parsed.avatar === 'string' && parsed.avatar.startsWith('https://') && parsed.avatar.length <= 512
					? parsed.avatar
					: null
		};
	} catch {
		return null;
	}
}

/** The organizer's avatar, resolved from the public appview and cached. */
async function loadOrganizer(profileCache: ReturnType<typeof cloudflareKV> | undefined): Promise<Organizer> {
	try {
		const did = await actorToDid(retreat.organizerHandle);
		if (!did) return { handle: retreat.organizerHandle, avatar: null };
		const profile = await loadBskyProfile(did, { cache: profileCache });
		return { handle: retreat.organizerHandle, avatar: profile?.avatar ?? null };
	} catch {
		return { handle: retreat.organizerHandle, avatar: null };
	}
}

export const load: PageServerLoad = async ({ locals, platform, url, cookies }) => {
	// The OAuth library redirects back with ?error=... when a login fails.
	const authError = url.searchParams.get('error');

	const db = platform?.env?.DB;

	// Base gate (no respondent yet): deadline + the organizer's reopen switch.
	// A signed-in respondent gets a second look below for a late pass.
	const { deadline, closed } = await surveyGate(db, platform?.env?.DEADLINE, null);

	// Registration era: its own deadline, same parsing as the survey's.
	const reg = deadlineStatus(platform?.env?.REG_DEADLINE);
	const regBase = { regDeadline: reg.deadline, regDeadlineDisplay: reg.display, regClosed: reg.closed };
	// `?survey` reopens the read-only survey feed for people who want to see
	// what they answered; everything else lands on registration.
	const wantsSurvey = url.searchParams.has('survey');

	const profileCache = platform?.env?.PROFILE_CACHE
		? cloudflareKV(platform.env.PROFILE_CACHE, { ttl: 3600 })
		: undefined;

	const organizer = await loadOrganizer(profileCache);
	const knownUser = readKnownUser(cookies.get(KNOWN_COOKIE));

	// Dev-only design preview; `dev` is compile-time false in production
	// builds, so this path cannot ship. `?preview` = the signed-in survey;
	// `?preview=notinvited` / `=member` render the waitlist states.
	if (dev && url.searchParams.has('preview')) {
		const variant = url.searchParams.get('preview');
		const uninvited = variant === 'notinvited' || variant === 'member';
		const regVariant = variant === 'register' || variant === 'registered' || variant === 'declined';
		const previewReg: Registration | null =
			variant === 'registered' || variant === 'declined'
				? {
						did: 'did:plc:preview',
						handle: 'preview.bsky.social',
						name: 'Preview Builder',
						email: 'preview@example.com',
						status: variant === 'declined' ? 'declined' : 'confirmed',
						phone: '555-0100',
						emergencyName: 'Sam Preview',
						emergencyPhone: '555-0101',
						dietary: ['vegetarian', 'nut_allergy'],
						dietaryOther: '',
						accessibility: '',
						notes: '',
						travelArrival: 'Fri afternoon, PSP',
						travelDeparture: '',
						travelMode: 'flying',
						travelDetails: '',
						waiverVersion: variant === 'declined' ? null : 'v1',
						cocVersion: variant === 'declined' ? null : 'v1',
						agreedAt: variant === 'declined' ? null : '2026-08-30T18:00:00Z',
						createdAt: '2026-08-30T18:00:00Z',
						updatedAt: '2026-08-30T18:00:00Z'
					}
				: null;
		return {
			user: {
				did: 'did:plc:preview',
				handle: uninvited ? 'newbuilder.bsky.social' : 'preview.bsky.social',
				displayName: uninvited ? 'New Builder' : 'Preview Builder',
				avatar: null
			} as PageUser,
			allowed: !uninvited,
			waitlistState: (variant === 'member' ? 'member' : 'none') as WaitlistState,
			waitlistEmail: variant === 'member' ? 'you@example.com' : null,
			answers: null as SurveyDraft | null,
			existingResponse: false,
			organizer,
			deadline,
			closed,
			knownUser,
			authError,
			...regBase,
			registrationMode: regVariant,
			registration: previewReg,
			prefill: { name: 'Preview Builder', email: 'preview@example.com' }
		};
	}

	if (!locals.did) {
		return {
			user: null as PageUser | null,
			allowed: true,
			waitlistState: 'none' as WaitlistState,
			waitlistEmail: null as string | null,
			answers: null as SurveyDraft | null,
			existingResponse: false,
			organizer,
			deadline,
			closed,
			knownUser,
			authError,
			...regBase,
			registrationMode: false,
			registration: null as Registration | null,
			prefill: { name: '', email: '' }
		};
	}

	const profile = await loadBskyProfile(locals.did, { cache: profileCache }).catch((e) => {
		console.error('profile load failed for', logDid(locals.did), e);
		return undefined;
	});

	const user: PageUser = {
		did: locals.did,
		handle: profile?.handle ?? null,
		displayName: profile?.displayName ?? null,
		avatar: profile?.avatar ?? null
	};

	// Late passes are per-respondent: only now that we know who this is can
	// the gate answer for them specifically.
	const userGate =
		closed && db ? await surveyGate(db, platform?.env?.DEADLINE, { did: locals.did, handle: user.handle }) : null;
	const closedForUser = userGate ? userGate.closed : closed;

	// The allowlist gates the whole survey, not just submission: a signed-in
	// account that isn't invited sees the polite invite-only state and the
	// feed stays sealed. This gate is a courtesy, so it degrades OPEN: the
	// response API re-enforces authoritatively on write, and a false "not on
	// the list" screen for an invited user is worse than an uninvited one
	// browsing questions they can't submit.
	let allowed = true;
	if (db) {
		try {
			allowed = await checkAllowlist(db, { did: locals.did, handle: user.handle });
			if (!allowed && !profile) {
				// Identity resolution failed above — a handle-less lookup can't
				// confidently deny (DIDs are pre-pinned, but stay honest).
				console.error('allowlist: unverifiable without profile for', logDid(locals.did));
				allowed = true;
			}
		} catch (e) {
			console.error('allowlist check failed for', logDid(locals.did), e);
		}
	}

	// Remember who signed in (identity hint only, no credentials) so a
	// returning visitor — even after logout — gets a one-tap re-entry. Only
	// for allowed users: a denied account shouldn't be greeted back into a
	// login that will be denied again.
	if (user.handle && allowed) {
		cookies.set(
			KNOWN_COOKIE,
			JSON.stringify({ handle: user.handle, displayName: user.displayName, avatar: user.avatar }),
			// 30 days comfortably covers the survey window (see the DEADLINE
			// binding) while keeping identity-hint retention short.
			{ path: '/', maxAge: 60 * 60 * 24 * 30, httpOnly: true, sameSite: 'lax', secure: !dev }
		);
	}

	const stored =
		db && allowed
			? await getResponse(db, locals.did).catch((e) => {
					console.error('response load failed for', logDid(locals.did), e);
					return null;
				})
			: null;

	// Registration row for the front door (allowed users only).
	const registration =
		db && allowed
			? await getRegistration(db, locals.did).catch((e) => {
					console.error('registration load failed for', logDid(locals.did), e);
					return null;
				})
			: null;

	// Uninvited visitors: are they already on the waitlist? Drives the
	// invitation-vs-confirmation state on the hero. (Promoted people are
	// `allowed` and never reach this branch.)
	let waitlistState: WaitlistState = 'none';
	let waitlistEmail: string | null = null;
	if (db && !allowed) {
		const entry = await getWaitlistEntry(db, locals.did).catch((e) => {
			console.error('waitlist load failed for', logDid(locals.did), e);
			return null;
		});
		if (entry) {
			waitlistState = 'member';
			waitlistEmail = entry.email;
			// Self-heal a null/stale handle (transient profile failure at join,
			// or a later handle change) so the row stays promotable. Silent,
			// no user action — a plain revisit repairs it.
			if (user.handle && entry.handle !== user.handle) {
				await backfillWaitlistHandle(db, locals.did, user.handle).catch((e) =>
					console.error('waitlist handle backfill failed for', logDid(locals.did), e)
				);
			}
		}
	}

	return {
		user,
		allowed,
		waitlistState,
		waitlistEmail,
		answers: stored?.draft ?? null,
		existingResponse: stored !== null,
		organizer,
		deadline,
		closed: closedForUser,
		knownUser,
		authError,
		...regBase,
		registrationMode: allowed && !wantsSurvey,
		registration,
		prefill: {
			name: stored?.draft.name ?? user.displayName ?? '',
			email: stored?.draft.email ?? ''
		}
	};
};

export const actions: Actions = {
	// Join the waitlist. Requires an authenticated session; the handle is
	// resolved from the DID server-side (never trusted from the form) so a
	// later promotion allowlists the right identity. On success the load
	// re-runs and the hero flips to the confirmation state.
	joinWaitlist: async ({ locals, platform, request }) => {
		if (!locals.did) return fail(401, { waitlistError: 'Sign in first, then add your name.' });
		const db = platform?.env?.DB;
		if (!db) return fail(503, { waitlistError: 'Storage is not available right now — try again shortly.' });

		const email = String((await request.formData()).get('email') ?? '')
			.trim()
			.slice(0, 320);
		if (!isValidWaitlistEmail(email)) {
			return fail(400, { waitlistError: 'Enter a valid email so we can reach you.' });
		}

		const profileCache = platform?.env?.PROFILE_CACHE
			? cloudflareKV(platform.env.PROFILE_CACHE, { ttl: 3600 })
			: undefined;
		const profile = await loadBskyProfile(locals.did, { cache: profileCache }).catch(() => undefined);

		try {
			await joinWaitlist(db, { did: locals.did, handle: profile?.handle ?? null, email });
		} catch (e) {
			console.error('waitlist join failed for', logDid(locals.did), e);
			return fail(500, { waitlistError: 'Something went wrong adding you — please try again.' });
		}
		return { joined: true };
	},

	// Confirm attendance + the full form. Deadline rule: a NEW confirmation
	// is refused after REG_DEADLINE; an existing confirmed row may always be
	// edited (travel firms up late by design).
	register: async ({ locals, platform, request }) => {
		if (!locals.did) return fail(401, { regMessage: 'Sign in first.' });
		const db = platform?.env?.DB;
		if (!db) return fail(503, { regMessage: 'Storage is not available right now — try again shortly.' });

		const input = parseRegistrationForm(await request.formData());
		const checked = validateRegistration(input);
		if (!checked.ok) return fail(400, { regErrors: checked.errors, regValues: input });

		const profileCache = platform?.env?.PROFILE_CACHE
			? cloudflareKV(platform.env.PROFILE_CACHE, { ttl: 3600 })
			: undefined;
		const profile = await loadBskyProfile(locals.did, { cache: profileCache }).catch(() => undefined);
		const handle = profile?.handle ?? null;

		try {
			const allowed = await checkAllowlist(db, { did: locals.did, handle });
			if (!allowed) return fail(403, { regMessage: 'Registration is for invited builders.' });

			const existing = await getRegistration(db, locals.did);
			const { closed } = deadlineStatus(platform?.env?.REG_DEADLINE);
			if (!canConfirm(closed, existing)) return fail(403, { regClosed: true });

			await upsertConfirmed(db, { did: locals.did, handle }, checked.value, {
				waiver: waiver.version,
				coc: codeOfConduct.version
			});

			// Best-effort confirmation: never blocks the registration.
			if (!existing || existing.status !== 'confirmed') {
				const saved = await getRegistration(db, locals.did);
				if (saved) {
					const mail = confirmationEmail(saved);
					const result = await sendEmail(platform?.env ?? {}, { to: saved.email, ...mail });
					if (!result.ok) console.error('registration confirmation email failed', result.code, result.detail ?? '');
				}
			}
		} catch (e) {
			console.error('registration save failed for', logDid(locals.did), e);
			return fail(500, { regMessage: 'Something went wrong saving your registration — please try again.' });
		}
		return { registered: true };
	},

	// One tap, no form. Always allowed, before or after the deadline.
	decline: async ({ locals, platform }) => {
		if (!locals.did) return fail(401, { regMessage: 'Sign in first.' });
		const db = platform?.env?.DB;
		if (!db) return fail(503, { regMessage: 'Storage is not available right now — try again shortly.' });

		const profileCache = platform?.env?.PROFILE_CACHE
			? cloudflareKV(platform.env.PROFILE_CACHE, { ttl: 3600 })
			: undefined;
		const profile = await loadBskyProfile(locals.did, { cache: profileCache }).catch(() => undefined);
		const handle = profile?.handle ?? null;

		try {
			const allowed = await checkAllowlist(db, { did: locals.did, handle });
			if (!allowed) return fail(403, { regMessage: 'Registration is for invited builders.' });
			const stored = await getResponse(db, locals.did).catch(() => null);
			await setDeclined(db, {
				did: locals.did,
				handle,
				name: stored?.draft.name ?? profile?.displayName ?? handle ?? locals.did,
				email: stored?.draft.email ?? ''
			});
		} catch (e) {
			console.error('registration decline failed for', logDid(locals.did), e);
			return fail(500, { regMessage: 'Something went wrong — please try again.' });
		}
		return { declined: true };
	}
};
