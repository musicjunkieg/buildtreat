import type { Audience, BroadcastPerson, Channel } from '$lib/server/messaging/broadcasts';

/**
 * Pure helpers shared by EmailPanel and ExtraRecipients for the hand-picked
 * extras that ride along with a broadcast audience. Types only from
 * $lib/server — `import type` is erased, so this stays client-importable.
 */

export function personName(p: BroadcastPerson): string {
	return p.handle ? `@${p.handle}` : p.email || `${p.did.slice(0, 20)}…`;
}

/** DMs reach anyone with a DID; email needs an address. */
export function reachable(p: BroadcastPerson, channel: Channel): boolean {
	return channel === 'dm' || p.email.length > 0;
}

/** Already in the picked audience on this channel, so adding them changes nothing. */
export function covered(p: BroadcastPerson, channel: Channel, audience: Audience): boolean {
	return p.audiences[channel].includes(audience);
}
