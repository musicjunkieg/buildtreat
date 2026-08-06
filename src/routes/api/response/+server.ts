import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { loadHandle } from '@svelte-atproto/oauth/helper';
import { checkAllowlist, upsertResponse, validateDraft, ValidationError } from '$lib/server/db';

export const PUT: RequestHandler = async ({ request, locals, platform }) => {
	if (!locals.did) {
		error(401, { message: 'Sign in with Atmosphere first' });
	}
	const deadline = platform?.env?.DEADLINE;
	if (deadline && Date.now() > Date.parse(deadline)) {
		const display = new Date(deadline).toLocaleDateString('en-US', {
			timeZone: 'America/Los_Angeles',
			month: 'long',
			day: 'numeric'
		});
		error(403, {
			message: `The survey closed on ${display} — answers are locked. Ping @chaosgreml.in if something needs fixing.`
		});
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
			console.error('handle load failed for', locals.did, e);
			return null;
		})) ?? null;
	const who = { did: locals.did as string, handle };

	if (!(await checkAllowlist(db, who))) {
		error(403, { message: 'This survey is invite-only — your handle isn’t on the list. DM @chaosgreml.in if that seems wrong.' });
	}

	await upsertResponse(db, who, draft);
	return json({ ok: true });
};
