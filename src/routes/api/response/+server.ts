import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { loadHandle } from '@svelte-atproto/oauth/helper';
import { checkAllowlist, upsertResponse, validateDraft, ValidationError } from '$lib/server/db';
import { surveyGate } from '$lib/server/organizer';
import { retreat } from '$lib/content';

export const PUT: RequestHandler = async ({ request, locals, platform }) => {
	if (!locals.did) {
		error(401, { message: 'Sign in with Atmosphere first' });
	}
	const db = platform?.env?.DB;
	if (!db) {
		error(503, { message: 'Storage is not available right now' });
	}

	let body: unknown;
	try {
		body = await request.json();
	} catch {
		error(400, { message: 'Send JSON' });
	}

	let draft;
	try {
		draft = validateDraft(body);
	} catch (e) {
		if (e instanceof ValidationError) error(422, { message: e.message });
		throw e;
	}

	const handle =
		(await loadHandle(locals.did).catch((e) => {
			console.error('handle load failed for', `${String(locals.did).slice(0, 14)}…`, e);
			return null;
		})) ?? null;
	const who = { did: locals.did as string, handle };

	// The deadline check honors the organizer's overrides: the global reopen
	// switch, or a late pass granted to this respondent.
	const gate = await surveyGate(db, platform?.env?.DEADLINE, who);
	if (gate.closed) {
		error(403, {
			message: `The survey closed on ${gate.display} — answers are locked. Ping @${retreat.organizerHandle} if something needs fixing.`
		});
	}

	if (!(await checkAllowlist(db, who))) {
		error(403, {
			message: `This survey is invite-only — your handle isn’t on the list. DM @${retreat.organizerHandle} if that seems wrong.`
		});
	}

	await upsertResponse(db, who, draft);
	return json({ ok: true });
};
