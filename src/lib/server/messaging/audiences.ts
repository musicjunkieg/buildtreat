/**
 * Who a broadcast reaches — pure, no D1. Channels, audiences, the members
 * of each, per-channel recipient lists and counts, the compose picker's
 * people, and merging hand-picked extras. Re-exported by ./broadcasts, so
 * importers keep a single entry point; tests live in broadcasts.test.ts.
 */

/**
 * How a broadcast goes out. Email needs an address and dedupes on it; a DM
 * needs only the DID, so it reaches people who never gave an email and
 * separates two people who share one.
 */
export const CHANNELS = ['email', 'dm'] as const;
export type Channel = (typeof CHANNELS)[number];

export function isChannel(value: string): value is Channel {
	return (CHANNELS as readonly string[]).includes(value);
}

export interface RecipientInput {
	did: string;
	email: string;
	/** Handle at send time, kept so DM history reads as people, not DIDs. */
	handle?: string | null;
}

/**
 * Who a broadcast goes to. 'all' is every survey respondent plus anyone
 * with a confirmed registration who skipped the survey (a late invite who
 * went straight to registering); 'registered' is confirmed registrations
 * alone; 'yes' / 'maybe' / 'no' select survey respondents (by their
 * interest answer); 'yes_unregistered' and
 * 'maybe_unregistered' narrow those to respondents with no registration
 * row at all — neither confirmed nor declined — for the "you said you're
 * in, now register" nudges; 'travel' selects respondents who said they
 * could cover only some or none of their travel and haven't yet answered
 * the registration's support questions (and haven't declined); 'waitlist'
 * selects entries still waiting for a promotion. Stored on the broadcast
 * row so the history says which list each message went to.
 */
export const AUDIENCES = [
	'all',
	'registered',
	'yes',
	'yes_unregistered',
	'maybe',
	'maybe_unregistered',
	'no',
	'travel',
	'waitlist'
] as const;
export type Audience = (typeof AUDIENCES)[number];

export const audienceLabels: Record<Audience, string> = {
	all: 'Everyone',
	registered: 'Registered',
	yes: 'Yes',
	yes_unregistered: 'Yes, not registered',
	maybe: 'Maybe',
	maybe_unregistered: 'Maybe, not registered',
	no: 'No',
	travel: 'Travel help',
	waitlist: 'Waitlist'
};

export function isAudience(value: string): value is Audience {
	return (AUDIENCES as readonly string[]).includes(value);
}

export interface AudienceCount {
	id: Audience;
	label: string;
	/** Reachable people per channel — the compose form shows the one for the picked channel. */
	counts: Record<Channel, number>;
}

export interface AudienceResponse {
	did: string;
	handle?: string | null;
	email: string;
	interest: string;
	/** Survey travel answer; null when the respondent never reached that question. */
	travel?: string | null;
}

export interface AudienceWaitlistEntry {
	did: string;
	handle?: string | null;
	email: string;
	promotedAt: string | null;
}

/** The slice of a registration row the registration-aware audiences need. */
export interface AudienceRegistration {
	did: string;
	handle?: string | null;
	email: string;
	status: 'confirmed' | 'declined';
	supportNeed: string | null;
}

/**
 * Resolve an audience to the people in it, one entry per DID (first source
 * wins). Survey audiences read the interest column; the waitlist audience
 * takes entries not yet promoted (a promoted person is on the allowlist and
 * reachable through the survey). The travel audience is the nudge list for
 * the support questions: survey said partial/no, no answer yet, not
 * declined — mailed at the registration email when there is one, since
 * that's the address they confirmed last. The *_unregistered audiences are
 * the "please register" nudges: interest yes/maybe with no registration
 * row of any status, so a decline counts as having answered and drops them
 * off the list. 'registered' and 'all' are the only audiences that reach
 * someone who never took the survey — a confirmed registration is enough
 * to be on those lists.
 */
export function audienceMembers(
	audience: Audience,
	responses: AudienceResponse[],
	waitlist: AudienceWaitlistEntry[],
	registrations: AudienceRegistration[] = []
): RecipientInput[] {
	const member = (r: { did: string; handle?: string | null; email: string }, email = r.email): RecipientInput => ({
		did: r.did,
		email,
		handle: r.handle ?? null
	});
	if (audience === 'waitlist') {
		return dedupeByDid(waitlist.filter((w) => w.promotedAt === null).map((w) => member(w)));
	}
	const confirmed = registrations.filter((r) => r.status === 'confirmed');
	if (audience === 'registered') {
		return dedupeByDid(confirmed.map((r) => member(r)));
	}
	if (audience === 'all') {
		const surveyed = new Set(responses.map((r) => r.did));
		const extra = confirmed.filter((r) => !surveyed.has(r.did));
		return dedupeByDid([...responses, ...extra].map((r) => member(r)));
	}
	if (audience === 'travel') {
		const regByDid = new Map(registrations.map((r) => [r.did, r]));
		const picked = responses.filter((r) => {
			if (r.travel !== 'partial' && r.travel !== 'no') return false;
			const reg = regByDid.get(r.did);
			return !reg || (reg.status === 'confirmed' && reg.supportNeed === null);
		});
		return dedupeByDid(picked.map((r) => member(r, regByDid.get(r.did)?.email || r.email)));
	}
	if (audience === 'yes_unregistered' || audience === 'maybe_unregistered') {
		const interest = audience === 'yes_unregistered' ? 'yes' : 'maybe';
		const registered = new Set(registrations.map((r) => r.did));
		const picked = responses.filter((r) => r.interest === interest && !registered.has(r.did));
		return dedupeByDid(picked.map((r) => member(r)));
	}
	return dedupeByDid(responses.filter((r) => r.interest === audience).map((r) => member(r)));
}

/**
 * The recipient list a broadcast on `channel` actually snapshots: email
 * drops people without an address and collapses shared addresses; DM keeps
 * everyone, since the DID is the address.
 */
export function audienceRecipients(
	audience: Audience,
	responses: AudienceResponse[],
	waitlist: AudienceWaitlistEntry[],
	registrations: AudienceRegistration[] = [],
	channel: Channel = 'email'
): RecipientInput[] {
	const members = audienceMembers(audience, responses, waitlist, registrations);
	return channel === 'email' ? dedupeRecipients(members) : members;
}

/** Recipient counts for every audience and channel — what the compose form's selector shows. */
export function audienceCounts(
	responses: AudienceResponse[],
	waitlist: AudienceWaitlistEntry[],
	registrations: AudienceRegistration[] = []
): AudienceCount[] {
	return AUDIENCES.map((id) => ({
		id,
		label: audienceLabels[id],
		counts: {
			email: audienceRecipients(id, responses, waitlist, registrations, 'email').length,
			dm: audienceRecipients(id, responses, waitlist, registrations, 'dm').length
		}
	}));
}

/**
 * One pickable person for the compose form's "also include" list: everyone
 * the organizer panel knows about — survey respondents, registrants of
 * either status, waitlisters promoted or not — plus the audiences that
 * would already reach them, so the picker can hide people the chosen
 * audience covers and the count can stay honest.
 */
export interface BroadcastPerson {
	did: string;
	handle: string | null;
	/** Registration email when there is one, else survey, else waitlist. */
	email: string;
	/**
	 * Per channel, the audiences that actually deliver to this person: on DM
	 * that's membership; on email it's membership with a usable address, or
	 * their address already being in the audience's list under another DID.
	 */
	audiences: Record<Channel, Audience[]>;
}

/**
 * Every known person once, in source order (survey, registration,
 * waitlist), tagged with the audiences that reach them on each channel. A
 * declined registrant or a promoted waitlister belongs to no audience at
 * all; someone whose survey email is blank is in `all` on DM but not on
 * email — exactly who the picker exists for.
 */
export function broadcastPeople(
	responses: AudienceResponse[],
	waitlist: AudienceWaitlistEntry[],
	registrations: AudienceRegistration[] = []
): BroadcastPerson[] {
	const regByDid = new Map(registrations.map((r) => [r.did, r]));
	const seen = new Set<string>();
	const people: BroadcastPerson[] = [];
	for (const row of [...responses, ...registrations, ...waitlist]) {
		if (seen.has(row.did)) continue;
		seen.add(row.did);
		const reg = regByDid.get(row.did);
		people.push({
			did: row.did,
			handle: row.handle ?? reg?.handle ?? null,
			email: (reg?.email || row.email).trim(),
			audiences: { email: [], dm: [] }
		});
	}
	for (const audience of AUDIENCES) {
		const members = audienceMembers(audience, responses, waitlist, registrations);
		const dmDids = new Set(members.map((m) => m.did));
		const mailed = dedupeRecipients(members);
		const emailDids = new Set(mailed.map((m) => m.did));
		const emailAddrs = new Set(mailed.map((m) => m.email.toLowerCase()));
		for (const p of people) {
			if (dmDids.has(p.did)) p.audiences.dm.push(audience);
			if (emailDids.has(p.did) || (p.email && emailAddrs.has(p.email.toLowerCase()))) p.audiences.email.push(audience);
		}
	}
	return people;
}

/**
 * Audience recipients plus hand-picked extras, under the channel's rules:
 * the audience row wins when a DID appears in both — except that a blank
 * audience email takes the extra's address, since that's the whole reason
 * the person was added — then email drops blank and shared addresses while
 * DM keeps every DID.
 */
export function mergeRecipients(base: RecipientInput[], extras: BroadcastPerson[], channel: Channel): RecipientInput[] {
	const extraByDid = new Map(extras.map((p) => [p.did, p]));
	const inBase = new Set(base.map((r) => r.did));
	const filled = base.map((r) => {
		const p = extraByDid.get(r.did);
		return p && !r.email.trim() && p.email ? { ...r, email: p.email } : r;
	});
	const added = extras.filter((p) => !inBase.has(p.did)).map((p) => ({ did: p.did, email: p.email, handle: p.handle }));
	const merged = dedupeByDid([...filled, ...added]);
	return channel === 'email' ? dedupeRecipients(merged) : merged;
}

/** First occurrence wins; one entry per DID. */
function dedupeByDid(rows: RecipientInput[]): RecipientInput[] {
	const seen = new Set<string>();
	return rows.filter((r) => !seen.has(r.did) && seen.add(r.did));
}

/** First occurrence wins; comparison is on the lowercased, trimmed email. */
export function dedupeRecipients(rows: RecipientInput[]): RecipientInput[] {
	const seen = new Set<string>();
	const out: RecipientInput[] = [];
	for (const row of rows) {
		const email = row.email.trim();
		const key = email.toLowerCase();
		if (!key || seen.has(key)) continue;
		seen.add(key);
		out.push({ ...row, email });
	}
	return out;
}
