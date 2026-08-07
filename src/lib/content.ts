/**
 * Single source of product truth for the survey surface.
 * Facts come from PRODUCT.md — do not invent or alter claims here.
 */

export const retreat = {
	name: 'Atmospheric Builders’ Retreat',
	nameLines: ['ATMOSPHERIC', 'BUILDERS’ RETREAT.'] as [string, string],
	kicker: 'For the (very cool) builders of the Atmosphere',
	acknowledgment: ['An awesome event is calling', 'Help us pick the dates and narrow down a location.'] as [
		string,
		string
	],
	facts: [
		{ label: 'What', value: '3 nights · 2 full days' },
		{ label: 'Where', value: 'Southern California' },
		{ label: 'When', value: 'Sometime between Sept 1 – Nov 15' },
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
	prompt: 'Select the dates you’re available. Add as many ranges as you like — drag across days or type them in.',
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
