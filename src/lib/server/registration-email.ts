import { retreatDates, retreatLocation, travelModes } from '../content';
import { needsSupport } from '../registration';
import { brandedEmail, heroImage, locationImages, retreatFacts } from './email-template';
import type { Registration } from './registration';

/** Confirmation (text + branded html), sent best-effort after a completed registration. */
export function confirmationEmail(reg: Registration): { subject: string; text: string; html: string } {
	const first = reg.name.split(' ')[0] || reg.name;
	const mode = reg.travelMode ? travelModes.find((m) => m.id === reg.travelMode)?.label : null;
	const travel =
		mode || reg.travelArrival || reg.travelDeparture || reg.travelDetails
			? [
					'Your travel so far:',
					mode ? `  Getting there: ${mode}` : null,
					reg.travelArrival ? `  Arriving: ${reg.travelArrival}` : null,
					reg.travelDeparture ? `  Leaving: ${reg.travelDeparture}` : null,
					reg.travelDetails ? `  Details: ${reg.travelDetails}` : null,
					'',
					'Update it any time at https://buildersretre.at — plans change, that’s fine.'
				]
					.filter((l) => l !== null)
					.join('\n')
			: 'You haven’t added travel yet — no rush. Come back to https://buildersretre.at whenever your plans firm up.';
	// Echo a support request so the number they gave us is on the record.
	const support = needsSupport(reg.supportNeed)
		? [
				`Travel support: you asked for about $${(reg.supportAmount ?? 0).toLocaleString('en-US')}` +
					(reg.supportContingent === true
						? ' and told us you can’t come without it.'
						: reg.supportContingent === false
							? ' and that you’ll come either way.'
							: '.'),
				'We’re taking the numbers to Bluesky and will follow up once the fund is sized.'
			].join(' ')
		: null;

	const text = [
		`Hi ${first},`,
		'',
		`You’re registered for the Atmospheric Builders’ Retreat, ${retreatDates.display}.`,
		'',
		`Where: ${retreatLocation.display}. ${retreatLocation.pending} — we’ll email the exact house and an itinerary once it’s booked.`,
		`Arrive ${retreatDates.arrive}, leave ${retreatDates.depart}. Lodging and food are covered; you cover your travel.`,
		'',
		travel,
		...(support ? ['', support] : []),
		'',
		'Questions? Reply to this email or DM @chaosgreml.in.',
		'',
		'— Bryan'
	].join('\n');

	const html = brandedEmail({
		heading: 'You’re in',
		body: text,
		hero: heroImage(),
		facts: [...retreatFacts(), { label: 'Arrive', value: retreatDates.arrive }, { label: 'Leave', value: retreatDates.depart }],
		images: locationImages(),
		cta: { label: 'Update your travel', url: 'https://buildersretre.at' },
		footer: 'Reply to this email any time — it goes straight to Bryan.'
	});

	return { subject: `You’re registered — ${retreatDates.display}`, text, html };
}
