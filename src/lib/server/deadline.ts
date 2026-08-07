/**
 * DEADLINE env parsing shared by the page load and the response API so the
 * two can never disagree about whether the survey is closed. A missing or
 * malformed value fails open: the survey keeps accepting responses.
 */
export function deadlineStatus(raw: string | undefined | null): {
	deadline: string | null;
	closed: boolean;
	display: string | null;
} {
	const at = raw ? Date.parse(raw) : NaN;
	if (Number.isNaN(at)) return { deadline: null, closed: false, display: null };
	return {
		deadline: raw ?? null,
		closed: Date.now() > at,
		display: new Date(at).toLocaleDateString('en-US', {
			timeZone: 'America/Los_Angeles',
			month: 'long',
			day: 'numeric'
		})
	};
}
