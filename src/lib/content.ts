/**
 * Single source of product truth for the survey surface.
 * Facts come from PRODUCT.md — do not invent or alter claims here.
 */

export const retreat = {
	name: 'Atmospheric Builders’ Retreat',
	nameLines: ['ATMOSPHERIC', 'BUILDERS’ RETREAT.'] as [string, string],
	kicker: 'For the (very cool) builders of the Atmosphere',
	acknowledgment: ['The date is set.', 'December 4–7 — register to lock your spot.'] as [string, string],
	facts: [
		{ label: 'What', value: '3 nights · 2 full days' },
		{ label: 'Where', value: 'Palm Springs or Coachella Valley' },
		{ label: 'When', value: 'December 4–7, 2026' },
		{ label: 'Your Costs', value: 'Travel only. Lodging & food all taken care of' }
	],
	signIn: 'Sign in with Atmosphere',
	organizerLine: 'Organized by Bluesky, in partnership with',
	organizerHandle: 'chaosgreml.in',
	/**
	 * aturi.to universal link: opens the organizer's profile in whatever
	 * Atmosphere client the visitor uses (there's no cross-client DM deep
	 * link, so the profile — with its Message button — is the closest stop).
	 * DID, not handle, so the link survives handle changes.
	 */
	organizerLink: 'https://aturi.to/profile/did:plc:h3wpawnrlptr4534chevddo6',
	/** Window the availability calendar covers (inclusive). */
	window: { start: '2026-09-01', end: '2026-11-15' }
} as const;

export type InterestValue = 'yes' | 'no' | 'maybe';
export type TravelValue = 'yes' | 'partial' | 'no';
export type DayPortion = 'full' | 'first_half' | 'second_half';

export interface AvailabilityRange {
	start: string; // ISO date, inclusive
	end: string; // ISO date, inclusive
	startPortion: DayPortion;
	endPortion: DayPortion;
}

export const interestQuestion = {
	title: 'Are you in?',
	prompt:
		'Are you interested in attending a 3-night, two-full-day atproto builders’ retreat in Southern California, sometime between September 1 – November 15?',
	options: [
		{ value: 'yes', label: 'Yes' },
		{ value: 'maybe', label: 'Maybe' },
		{ value: 'no', label: 'No' }
	] as { value: InterestValue; label: string }[]
} as const;

export const travelQuestion = {
	title: 'Getting here',
	prompt: 'We will be covering the cost of lodging and food. Are you able to afford your travel to the location?',
	options: [
		{ value: 'yes', label: 'Yes, I can cover my travel' },
		{ value: 'partial', label: 'I could afford some, but would need some financial assistance' },
		{ value: 'no', label: 'I can not afford the travel' }
	] as { value: TravelValue; label: string }[]
} as const;

export interface RetreatLocation {
	id: string;
	name: string;
	note?: string;
	/** Path under /media, real photography only (evidence rule). */
	image: string;
}

export const locations: RetreatLocation[] = [
	{ id: 'palm-springs', name: 'Palm Springs', image: '/media/loc-palm-springs.jpg' },
	{ id: 'coachella-valley', name: 'Coachella Valley', image: '/media/loc-coachella-valley.jpg' },
	{ id: 'joshua-tree', name: 'Joshua Tree', image: '/media/loc-joshua-tree.jpg' },
	{ id: 'san-diego', name: 'San Diego', image: '/media/loc-san-diego.jpg' },
	{ id: 'la-metro', name: 'Los Angeles metro', note: 'if possible', image: '/media/loc-la-metro.jpg' }
];

export const datesQuestion = {
	title: 'When are you free?',
	prompt: 'Select the dates you’re available. Tap your first and last day and we’ll fill in the rest — add as many ranges as you like.',
	halfDayHint: 'On the first and last day of a range, you can mark yourself available for only the first or second half of the day.'
} as const;

export const locationQuestion = {
	title: 'Where should it be?',
	prompt: 'Do you have a preference in location? Rank your top three.',
	maxRank: 3,
	noPreference: 'I don’t have a preference — they all sound great'
} as const;

/**
 * Sentinel ranking entry meaning "no location preference". Lives in the same
 * ranking array (and JSON column) as real location ids, always alone.
 */
export const NO_PREFERENCE = 'no-preference';

export const youQuestion = {
	title: 'Who’s coming',
	prompt: 'Tell us who you are — we’ll only use this to plan the retreat.'
} as const;

/**
 * Waitlist copy for uninvited visitors. Warm, two-track, never a wall —
 * the door isn't closed, it's a different door. See the design spec at
 * docs/superpowers/specs/2026-08-11-waitlist-design.md.
 */
export const waitlist = {
	/** Shown under the sign-in CTA before anyone authenticates, so neither
	 *  audience is surprised by where sign-in lands them. */
	twoTrack:
		'Invited builders sign in to answer. Not on the list yet? Sign in to join the waitlist — we’re pulling names as the dates come together.',
	invite: {
		body: 'The first invites went to a small group of builders — but the door isn’t closed. Drop your email and we’ll reach out as the dates firm up and space opens.',
		emailLabel: 'Email',
		cta: 'Join the waitlist',
		mistake: 'Think you should be on the list?'
	},
	member: {
		lead: 'You’re on the waitlist.',
		body: 'We’ll be in touch as the dates lock in and spots open.',
		change: 'Need to change your email or step off?'
	}
} as const;

/** The seven feed items, in order. */
export const feedItems = ['hero', 'you', 'interest', 'travel', 'dates', 'location', 'review'] as const;
export type FeedItemId = (typeof feedItems)[number];

export const itemTitles: Record<FeedItemId, string> = {
	hero: 'Welcome',
	you: 'You',
	interest: 'Interest',
	travel: 'Travel',
	dates: 'Dates',
	location: 'Location',
	review: 'Review'
};
/* ── Registration era (date locked 2026-08-25) ──────────────────────────
 * Spec: docs/superpowers/specs/2026-08-25-registration-design.md
 */

export const retreatDates = {
	start: '2026-12-04',
	end: '2026-12-07',
	display: 'December 4–7, 2026',
	short: 'Dec 4–7',
	nights: 3,
	arrive: 'Friday',
	depart: 'Monday morning'
} as const;

export const retreatLocation = {
	display: 'Palm Springs or Coachella Valley',
	pending: 'Venue locks with the headcount',
	explainer:
		'We book the house once we know how many are coming — Palm Springs or the Coachella Valley, decided by the final count.'
} as const;

export const dietaryOptions = [
	{ id: 'vegetarian', label: 'Vegetarian' },
	{ id: 'vegan', label: 'Vegan' },
	{ id: 'gluten_free', label: 'Gluten-free' },
	{ id: 'dairy_free', label: 'Dairy-free' },
	{ id: 'kosher', label: 'Kosher' },
	{ id: 'halal', label: 'Halal' },
	{ id: 'nut_allergy', label: 'Nut allergy' },
	{ id: 'shellfish_allergy', label: 'Shellfish allergy' }
] as const;
export type DietaryId = (typeof dietaryOptions)[number]['id'];

export const travelModes = [
	{ id: 'flying', label: 'Flying' },
	{ id: 'driving', label: 'Driving' },
	{ id: 'train', label: 'Train' },
	{ id: 'other', label: 'Other' }
] as const;
export type TravelMode = (typeof travelModes)[number]['id'];

/**
 * DRAFT agreement texts written by Claude, not a lawyer. Bryan may swap the
 * bodies at will; bump `version` when the substance changes so each
 * registration records which text it agreed to.
 */
export const waiver = {
	version: 'v1',
	title: 'Liability waiver',
	body: `I'm choosing to attend the Atmospheric Builders' Retreat (December 4–7, 2026, in the Palm Springs / Coachella Valley area) voluntarily.

I understand the retreat involves travel, shared lodging, group meals, and informal activities, and that these carry ordinary risks — including illness, injury, and loss of or damage to my belongings. I accept those risks for myself.

To the fullest extent the law allows, I release the organizers — Bryan Guffey, Bluesky Social, PBC, and anyone helping them run the retreat — from claims for injury, illness, loss, or damage arising from my participation, except where caused by their gross negligence or willful misconduct.

If I'm hurt or become ill, I consent to reasonable first aid and emergency care, and I understand I'm responsible for the cost of my own medical treatment. I confirm I have, or will arrange, any travel or health coverage I want for this trip.

I'll take reasonable care of the house and the people in it, and I'll cover damage I cause.`
} as const;

export const codeOfConduct = {
	version: 'v1',
	title: 'Code of conduct',
	body: `The retreat is a small group of builders living and working together for three nights. It only works if everyone feels safe and welcome.

Be kind and generous. Assume good faith. Make room for people quieter than you.

Harassment of any kind isn't tolerated — including unwelcome comments about someone's identity, unwanted physical contact or attention, deliberate intimidation, and photographing or recording people without consent. If someone asks you to stop, stop.

Respect boundaries in shared space: quiet hours, closed doors, other people's food and belongings, and anyone's choice not to drink.

If something happens — to you or to someone else — tell Bryan (@chaosgreml.in) in person, by DM, or by text at the number on the itinerary. Reports are handled discreetly. Anyone asked to leave for violating this code covers their own way home.`
} as const;

export const registration = {
	kicker: 'The date is set',
	ack: ['You helped pick the days.', 'Here they are.'] as [string, string],
	dateLines: ['December', '4–7, 2026.'] as [string, string],
	facts: [
		{ label: 'Palm Springs or Coachella Valley', value: '' },
		{ label: 'Venue locks with the headcount', value: '', muted: true },
		{ label: 'Lodging & food covered', value: 'Bluesky' },
		{ label: 'Register by Sept 7', value: '' }
	] as { label: string; value: string; muted?: boolean }[],
	confirm: 'I’m in',
	decline: 'I can’t make it',
	declinedLead: 'Noted — we’ll miss you.',
	declinedBody: 'If your December opens up, come back here and change your answer.',
	declinedUndo: 'Actually, I can come',
	closedLead: 'Registration closed Sept 7.',
	closedBody: 'We’ve locked the headcount to book the house. If you can still make it, DM',
	formKicker: 'Registration',
	formTitle: 'You’re in.',
	formSub: 'December 4–7, Palm Springs or the Coachella Valley. Six short sections. Travel can wait until you know.',
	sections: {
		contact: { head: 'Contact', name: 'Name', email: 'Email', phone: 'Phone', phoneHint: 'For day-of texts' },
		food: { head: 'Food', hint: 'Pick any', other: 'Anything else about food', otherHint: 'Allergies, strong dislikes, coffee opinions' },
		emergency: { head: 'Emergency contact', name: 'Name', nameHint: 'Who we call', phone: 'Phone', phoneHint: '+1' },
		accessibility: { head: 'Accessibility', hint: 'Optional', label: 'Anything we should plan for', placeholder: 'Mobility, sensory, sleep, medical — whatever helps us set the house up right' },
		notes: { head: 'Anything else', hint: 'Optional', placeholder: 'Notes for the organizers' },
		travel: { head: 'Travel', hint: 'Optional now · update anytime', arriving: 'Arriving', arrivingHint: 'Fri afternoon, PSP', leaving: 'Leaving', leavingHint: 'Mon morning', details: 'Details', detailsHint: 'Flight numbers, rideshare offers' },
		agreements: { head: 'Agreements', waiver: 'I’ve read the liability waiver', coc: 'I’ll follow the code of conduct', read: 'read it' }
	},
	submit: 'Register',
	submitHint: 'You can change everything later.',
	saving: 'Saving…',
	registeredTitle: 'You’re registered.',
	registeredSub: 'December 4–7. We’ll email the venue and itinerary once the house is booked.',
	travelNudge: 'Update as plans firm up',
	edit: 'Edit',
	surveyLink: 'Your availability survey answers',
	errors: {
		name: 'Tell us your name',
		email: 'Enter a valid email',
		emergencyName: 'Who should we call?',
		emergencyPhone: 'A phone number for them',
		agreeWaiver: 'Please read and agree to the waiver',
		agreeCoc: 'Please agree to the code of conduct',
		dietary: 'Unknown food option',
		travelMode: 'Unknown travel mode'
	}
} as const;

