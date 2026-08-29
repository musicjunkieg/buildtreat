import { retreatDates, retreatLocation, travelModes } from '../content';
import type { Registration } from './registration';

/** Plain-text confirmation, sent best-effort after a completed registration. */
export function confirmationEmail(reg: Registration): { subject: string; text: string } {
	const first = reg.name.split(' ')[0] || reg.name;
	const mode = reg.travelMode ? travelModes.find((m) => m.id === reg.travelMode)?.label : null;
	const travel =
		mode || reg.travelArrival || reg.travelDeparture
			? [
					'Your travel so far:',
					mode ? `  Getting there: ${mode}` : null,
					reg.travelArrival ? `  Arriving: ${reg.travelArrival}` : null,
					reg.travelDeparture ? `  Leaving: ${reg.travelDeparture}` : null,
					reg.travelDetails ? `  Details: ${reg.travelDetails}` : null,
					'',
					'Update it any time at https://buildersretre.at — plans change, that\'s fine.'
				]
					.filter((l) => l !== null)
					.join('\n')
			: 'You haven\'t added travel yet — no rush. Come back to https://buildersretre.at whenever your plans firm up.';

	const text = [
		`Hi ${first},`,
		'',
		`You're registered for the Atmospheric Builders' Retreat, ${retreatDates.display}.`,
		'',
		`Where: ${retreatLocation.display}. ${retreatLocation.pending} — we'll email the exact house and an itinerary once it's booked.`,
		`Arrive ${retreatDates.arrive}, leave ${retreatDates.depart}. Lodging and food are covered; you cover your travel.`,
		'',
		travel,
		'',
		'Questions? Reply to this email or DM @chaosgreml.in.',
		'',
		'— Bryan'
	].join('\n');

	return { subject: `You're registered — ${retreatDates.display}`, text };
}
