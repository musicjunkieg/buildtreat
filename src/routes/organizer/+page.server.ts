import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { dev } from '$app/environment';
import { deadlineStatus } from '$lib/server/deadline';
import {
	addAllowlistHandles,
	clearAllAnchors,
	getAllResponses,
	grantLatePass,
	isReopened,
	listAllowlist,
	listAnchors,
	listLatePasses,
	removeAllowlistHandle,
	revokeLatePass,
	setAnchor,
	setReopened
} from '$lib/server/organizer/admin';
import { listWaitlist, promoteFromWaitlist } from '$lib/server/waitlist';
import {
	listRegistrations,
	noResponseHandles,
	registrationCounts,
	type Registration
} from '$lib/server/registration';
import { emailConfigured, sendEmail } from '$lib/server/email/email';
import { broadcastHtml } from '$lib/server/email/email-template';
import {
	createBroadcast,
	dedupeRecipients,
	getBroadcast,
	listBroadcasts,
	markRecipient,
	runBroadcast,
	unsentRecipients,
	type BroadcastView
} from '$lib/server/email/broadcasts';
import { EMAIL_RE } from '$lib/server/db';
import {
	EMPTY,
	broadcastMessage,
	requireOrganizer,
	toRegistrationView,
	type OrganizerPageData
} from '$lib/server/organizer/page-data';
import { previewData } from '$lib/server/organizer/preview';

/**
 * /organizer — Bryan's side of the survey. Access policy:
 *  - signed out → minimal sign-in state (no data leaves the server)
 *  - signed in, not in ORGANIZER_DIDS → 404, indistinguishable from no route
 *  - organizer → everything
 */

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
	const reg = deadlineStatus(platform?.env?.REG_DEADLINE);
	// A failed anchor read must not look like "no anchors": Clear would then
	// silently delete rows that were never displayed. The flag disables all
	// anchor mutations for the rest of the page load.
	let anchorsUnavailable = false;
	// A failed registration read must not look like "no registrations": the
	// panel would then render an empty ledger instead of surfacing the
	// failure. The flag switches the panel to an error state instead.
	let registrationsUnavailable = false;
	const [responses, allowlist, latePasses, waitlist, reopened, anchors, broadcasts, registrations] =
		await Promise.all([
			getAllResponses(db),
			listAllowlist(db),
			listLatePasses(db),
			listWaitlist(db),
			isReopened(db),
			listAnchors(db).catch((e) => {
				console.error('anchor load failed', e);
				anchorsUnavailable = true;
				return [] as string[];
			}),
			listBroadcasts(db).catch((e) => {
				console.error('broadcast list failed', e);
				return [] as BroadcastView[];
			}),
			listRegistrations(db).catch((e) => {
				console.error('registration list failed', e);
				registrationsUnavailable = true;
				return [] as Registration[];
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
		anchorsUnavailable,
		registrationsUnavailable,
		emailConfigured: emailConfigured(platform?.env ?? {}),
		broadcasts,
		registrations: registrations.map(toRegistrationView),
		regDeadlineDisplay: reg.display,
		regClosed: reg.closed,
		regCounts: registrationCounts(registrations, allowlist),
		regMissing: noResponseHandles(registrations, allowlist)
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
	},

	emailTest: async ({ request, locals, platform }) => {
		requireOrganizer(locals, platform);
		const form = await request.formData();
		const to = String(form.get('to') ?? '').trim();
		const subject = String(form.get('subject') ?? '').trim();
		const body = String(form.get('body') ?? '').trim();
		if (!EMAIL_RE.test(to)) return fail(400, { message: 'Enter a valid test address' });
		if (!subject || !body) return fail(400, { message: 'Subject and body are both required' });
		const result = await sendEmail(platform?.env ?? {}, { to, subject, text: body, html: broadcastHtml(subject, body) });
		if (!result.ok) {
			return fail(502, { message: `Test send failed (${result.code})${result.detail ? ` — ${result.detail}` : ''}` });
		}
		return { message: `Test sent to ${to} (message ${result.messageId})` };
	},

	emailBroadcast: async ({ request, locals, platform }) => {
		requireOrganizer(locals, platform);
		const db = platform?.env?.DB;
		if (!db) return fail(503, { message: 'Storage is not available right now' });
		const form = await request.formData();
		const subject = String(form.get('subject') ?? '').trim();
		const body = String(form.get('body') ?? '').trim();
		if (!subject || !body) return fail(400, { message: 'Subject and body are both required' });
		if (!emailConfigured(platform?.env ?? {})) return fail(503, { message: 'Email is not configured yet' });

		const responses = await getAllResponses(db);
		const recipients = dedupeRecipients(responses.map((r) => ({ did: r.did, email: r.email })));
		if (!recipients.length) return fail(400, { message: 'No respondents with emails to send to' });

		const id = await createBroadcast(db, { subject, body, sentBy: locals.did!, recipients });
		const worklist = await unsentRecipients(db, id);
		const run = await runBroadcast(
			worklist,
			(to) => sendEmail(platform!.env, { to, subject, text: body, html: broadcastHtml(subject, body), category: 'broadcast' }),
			(did, result) => markRecipient(db, id, did, result)
		);
		return { message: broadcastMessage(run) };
	},

	emailRetry: async ({ request, locals, platform }) => {
		requireOrganizer(locals, platform);
		const db = platform?.env?.DB;
		if (!db) return fail(503, { message: 'Storage is not available right now' });
		const id = Number((await request.formData()).get('id'));
		if (!Number.isInteger(id)) return fail(400, { message: 'Missing broadcast' });
		const broadcast = await getBroadcast(db, id);
		if (!broadcast) return fail(400, { message: 'Unknown broadcast' });
		if (!emailConfigured(platform?.env ?? {})) return fail(503, { message: 'Email is not configured yet' });

		const worklist = await unsentRecipients(db, id);
		if (!worklist.length) return fail(400, { message: 'Nothing left to retry for that broadcast' });
		const run = await runBroadcast(
			worklist,
			(to) =>
				sendEmail(platform!.env, {
					to,
					subject: broadcast.subject,
					text: broadcast.body,
					html: broadcastHtml(broadcast.subject, broadcast.body),
					category: 'broadcast'
				}),
			(did, result) => markRecipient(db, id, did, result)
		);
		return { message: broadcastMessage(run) };
	}
};
