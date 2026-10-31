import { fail, type Actions } from '@sveltejs/kit';
import { getAllResponses } from '$lib/server/organizer/admin';
import { listWaitlist } from '$lib/server/waitlist';
import { listRegistrations } from '$lib/server/registration';
import { emailConfigured, sendEmail } from '$lib/server/messaging/email';
import { broadcastHtml } from '$lib/server/messaging/email-template';
import { DM_MAX_GRAPHEMES, createDmSession, dmConfigured, graphemeCount, resolveHandle, sendDm } from '$lib/server/messaging/bsky-dm';
import {
	audienceRecipients,
	broadcastPeople,
	createBroadcast,
	getBroadcast,
	isAudience,
	mergeRecipients,
	markRecipient,
	runBroadcast,
	unsentRecipients,
	type BroadcastPerson
} from '$lib/server/messaging/broadcasts';
import { EMAIL_RE } from '$lib/server/db';
import { broadcastMessage, requireOrganizer } from './page-data';

/**
 * The organizer console's messaging actions — test sends, email and Bluesky
 * DM broadcasts, and retry — spread into /organizer's `actions`. Every
 * action re-checks `requireOrganizer` itself; nothing here trusts the route.
 */

/**
 * The hand-picked extras posted as repeated `extra` fields, resolved against
 * the people the panel actually knows. An unknown DID means a stale form
 * (someone dropped out between page load and send) or a tampered one;
 * either way the organizer should reload rather than mail a guess.
 */
function pickExtras(
	form: FormData,
	people: BroadcastPerson[]
): { ok: true; people: BroadcastPerson[] } | { ok: false; message: string } {
	const wanted = [...new Set(form.getAll('extra').map(String).filter(Boolean))];
	const byDid = new Map(people.map((p) => [p.did, p]));
	const picked: BroadcastPerson[] = [];
	for (const did of wanted) {
		const person = byDid.get(did);
		if (!person) return { ok: false, message: 'One of the added people is no longer on the list — reload and try again' };
		picked.push(person);
	}
	return { ok: true, people: picked };
}

export const broadcastActions = {
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
		const audience = String(form.get('audience') ?? 'all');
		if (!subject || !body) return fail(400, { message: 'Subject and body are both required' });
		if (!isAudience(audience)) return fail(400, { message: 'Pick who this goes to' });
		if (!emailConfigured(platform?.env ?? {})) return fail(503, { message: 'Email is not configured yet' });

		const [responses, waitlist, registrations] = await Promise.all([getAllResponses(db), listWaitlist(db), listRegistrations(db)]);
		const extras = pickExtras(form, broadcastPeople(responses, waitlist, registrations));
		if (!extras.ok) return fail(400, { message: extras.message });
		const recipients = mergeRecipients(
			audienceRecipients(audience, responses, waitlist, registrations, 'email'),
			extras.people,
			'email'
		);
		if (!recipients.length) return fail(400, { message: 'Nobody with an email to send to' });

		const id = await createBroadcast(db, { channel: 'email', subject, body, audience, sentBy: locals.did!, recipients });
		const worklist = await unsentRecipients(db, id);
		const run = await runBroadcast(
			worklist,
			(r) => sendEmail(platform!.env, { to: r.email, subject, text: body, html: broadcastHtml(subject, body), category: 'broadcast' }),
			(did, result) => markRecipient(db, id, did, result)
		);
		return { message: broadcastMessage(run) };
	},

	dmTest: async ({ request, locals, platform }) => {
		requireOrganizer(locals, platform);
		const form = await request.formData();
		const to = String(form.get('to') ?? '').trim();
		const body = String(form.get('body') ?? '').trim();
		if (!to) return fail(400, { message: 'Enter a handle to test with' });
		const tooLong = dmTooLong(body);
		if (tooLong) return fail(400, tooLong);
		const session = await createDmSession(platform?.env ?? {});
		if (!session.ok) return fail(502, { message: dmSessionMessage(session) });
		const did = await resolveHandle(session.session, to);
		if (!did) return fail(400, { message: `Couldn’t resolve ${to} to an account` });
		const result = await sendDm(session.session, did, body);
		if (!result.ok) {
			return fail(502, { message: `Test DM failed (${result.code})${result.detail ? ` — ${result.detail}` : ''}` });
		}
		return { message: `Test DM sent to ${to}` };
	},

	dmBroadcast: async ({ request, locals, platform }) => {
		requireOrganizer(locals, platform);
		const db = platform?.env?.DB;
		if (!db) return fail(503, { message: 'Storage is not available right now' });
		const form = await request.formData();
		const body = String(form.get('body') ?? '').trim();
		const audience = String(form.get('audience') ?? 'all');
		const tooLong = dmTooLong(body);
		if (tooLong) return fail(400, tooLong);
		if (!isAudience(audience)) return fail(400, { message: 'Pick who this goes to' });
		if (!dmConfigured(platform?.env ?? {})) return fail(503, { message: 'Bluesky DMs are not configured yet' });

		const [responses, waitlist, registrations] = await Promise.all([getAllResponses(db), listWaitlist(db), listRegistrations(db)]);
		const extras = pickExtras(form, broadcastPeople(responses, waitlist, registrations));
		if (!extras.ok) return fail(400, { message: extras.message });
		const recipients = mergeRecipients(
			audienceRecipients(audience, responses, waitlist, registrations, 'dm'),
			extras.people,
			'dm'
		);
		if (!recipients.length) return fail(400, { message: 'Nobody to send to' });

		// Sign in before snapshotting so a bad app password doesn't leave a
		// broadcast with every row pending and nothing to retry against.
		const session = await createDmSession(platform!.env);
		if (!session.ok) return fail(502, { message: dmSessionMessage(session) });

		const id = await createBroadcast(db, { channel: 'dm', subject: '', body, audience, sentBy: locals.did!, recipients });
		const worklist = await unsentRecipients(db, id);
		const run = await runBroadcast(
			worklist,
			(r) => sendDm(session.session, r.did, body),
			(did, result) => markRecipient(db, id, did, result)
		);
		return { message: broadcastMessage(run) };
	},

	retryBroadcast: async ({ request, locals, platform }) => {
		requireOrganizer(locals, platform);
		const db = platform?.env?.DB;
		if (!db) return fail(503, { message: 'Storage is not available right now' });
		const id = Number((await request.formData()).get('id'));
		if (!Number.isInteger(id)) return fail(400, { message: 'Missing broadcast' });
		const broadcast = await getBroadcast(db, id);
		if (!broadcast) return fail(400, { message: 'Unknown broadcast' });

		const worklist = await unsentRecipients(db, id);
		if (!worklist.length) return fail(400, { message: 'Nothing left to retry for that broadcast' });

		if (broadcast.channel === 'dm') {
			if (!dmConfigured(platform?.env ?? {})) return fail(503, { message: 'Bluesky DMs are not configured yet' });
			const session = await createDmSession(platform!.env);
			if (!session.ok) return fail(502, { message: dmSessionMessage(session) });
			const run = await runBroadcast(
				worklist,
				(r) => sendDm(session.session, r.did, broadcast.body),
				(did, result) => markRecipient(db, id, did, result)
			);
			return { message: broadcastMessage(run) };
		}

		if (!emailConfigured(platform?.env ?? {})) return fail(503, { message: 'Email is not configured yet' });
		const run = await runBroadcast(
			worklist,
			(r) =>
				sendEmail(platform!.env, {
					to: r.email,
					subject: broadcast.subject,
					text: broadcast.body,
					html: broadcastHtml(broadcast.subject, broadcast.body),
					category: 'broadcast'
				}),
			(did, result) => markRecipient(db, id, did, result)
		);
		return { message: broadcastMessage(run) };
	}
} satisfies Actions;

/** Validation shared by the DM test and broadcast actions; null when the body is fine. */
function dmTooLong(body: string): { message: string } | null {
	if (!body) return { message: 'Write the message first' };
	const n = graphemeCount(body);
	if (n > DM_MAX_GRAPHEMES) return { message: `DMs max out at ${DM_MAX_GRAPHEMES} characters — this one is ${n}` };
	return null;
}

function dmSessionMessage(res: { ok: false; code: string; detail?: string }): string {
	if (res.code === 'NOT_CONFIGURED') return 'Bluesky DMs are not configured yet';
	return `Couldn’t sign in to the DM account (${res.code})${res.detail ? ` — ${res.detail}` : ''}`;
}
