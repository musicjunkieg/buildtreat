import { error } from '@sveltejs/kit';
import {
	isOrganizer,
	type AllowlistEntry,
	type LatePass,
	type OrganizerResponse
} from '$lib/server/organizer/admin';
import type { WaitlistEntry } from '$lib/server/waitlist';
import {
	isRegistered,
	travelStatus,
	type Registration,
	type RegistrationCounts,
	type TravelStatus
} from '$lib/server/registration';
import type { BroadcastView } from '$lib/server/email/broadcasts';

/**
 * Registrations panel view row. `isRegistered`/`travelStatus` from
 * $lib/server/registration are pure but the module lives under $lib/server,
 * so a client component (RegistrationsPanel.svelte, and +page.svelte itself)
 * cannot import them as values — SvelteKit's illegal-import guard blocks any
 * runtime import from $lib/server/* into browser-reachable code, regardless
 * of what the module actually touches at runtime. So the derived fields are
 * computed once here, server-side, and shipped down as plain data.
 */
export type RegistrationView = Registration & { travel: TravelStatus; registered: boolean };

export function toRegistrationView(r: Registration): RegistrationView {
	return { ...r, travel: travelStatus(r), registered: isRegistered(r) };
}

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
	/** True when the registrations read failed — the panel shows an error, not an empty list. */
	registrationsUnavailable: boolean;
	/** False until COMAIL_API_KEY + vars are set — renders setup hints. */
	emailConfigured: boolean;
	broadcasts: BroadcastView[];
	registrations: RegistrationView[];
	regDeadlineDisplay: string | null;
	regClosed: boolean;
	regCounts: RegistrationCounts;
	regMissing: AllowlistEntry[];
}

export const EMPTY: Omit<OrganizerPageData, 'authState'> = {
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
	anchorsUnavailable: false,
	registrationsUnavailable: false,
	emailConfigured: false,
	broadcasts: [],
	registrations: [],
	regDeadlineDisplay: null,
	regClosed: false,
	regCounts: { confirmed: 0, registered: 0, declined: 0, noResponse: 0 },
	regMissing: []
};

export function requireOrganizer(locals: App.Locals, platform: App.Platform | undefined): void {
	if (!locals.did || !isOrganizer(platform?.env?.ORGANIZER_DIDS, locals.did)) {
		error(404, { message: 'Not found' });
	}
}

export function broadcastMessage(run: { sent: number; failed: number; stopped: string | null }): string {
	const parts = [`Sent ${run.sent}`];
	if (run.failed) parts.push(`${run.failed} failed`);
	if (run.stopped) parts.push(`paused on ${run.stopped} — use Retry to resume`);
	return parts.join(' · ');
}
