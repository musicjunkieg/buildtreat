import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getAllResponses, isOrganizer } from '$lib/server/organizer';
import { availabilityCsv } from '$lib/organizer/csv';

export const GET: RequestHandler = async ({ locals, platform }) => {
	if (!locals.did || !isOrganizer(platform?.env?.ORGANIZER_DIDS, locals.did)) {
		error(404, { message: 'Not found' });
	}
	const db = platform?.env?.DB;
	if (!db) error(503, { message: 'Storage is not available right now' });

	const body = availabilityCsv(await getAllResponses(db));
	return new Response(body, {
		headers: {
			'content-type': 'text/csv; charset=utf-8',
			'content-disposition': 'attachment; filename="retreat-availability.csv"',
			'cache-control': 'no-store'
		}
	});
};
