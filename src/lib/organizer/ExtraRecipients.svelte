<script lang="ts">
	import type { SvelteSet } from 'svelte/reactivity';
	import type { Audience, BroadcastPerson, Channel } from '$lib/server/messaging/broadcasts';
	import { covered, personName, reachable } from '$lib/organizer/recipients';

	let {
		people,
		extras,
		channel,
		audience,
		audienceLabel,
		onchange
	}: {
		/** Everyone addable one at a time on top of the audience. */
		people: BroadcastPerson[];
		/** Owned by EmailPanel (it counts them); mutated here, never rebound. */
		extras: SvelteSet<string>;
		channel: Channel;
		audience: Audience;
		audienceLabel: string;
		/** Any add/remove — the panel disarms its send confirmation. */
		onchange: () => void;
	} = $props();

	let pickerValue = $state('');
	const personByDid = $derived(new Map(people.map((p) => [p.did, p])));
	const chosen = $derived([...extras].map((did) => personByDid.get(did)).filter((p): p is BroadcastPerson => !!p));
	const addable = $derived(
		people
			.filter((p) => !extras.has(p.did) && !covered(p, channel, audience) && reachable(p, channel))
			.sort((a, b) => personName(a).localeCompare(personName(b)))
	);

	function addExtra(event: Event) {
		const did = (event.currentTarget as HTMLSelectElement).value;
		if (did) extras.add(did);
		pickerValue = '';
		onchange();
	}
</script>

<div class="extras">
	<label class="kicker" for="extra-picker">Also include</label>
	<select id="extra-picker" class="picker" bind:value={pickerValue} onchange={addExtra} disabled={addable.length === 0}>
		<option value="">{addable.length ? 'Add a person…' : 'Everyone is already in this audience'}</option>
		{#each addable as p (p.did)}
			<option value={p.did}>{personName(p)}{p.handle && p.email && channel === 'email' ? ` · ${p.email}` : ''}</option>
		{/each}
	</select>
	{#if chosen.length}
		<ul class="chosen">
			{#each chosen as p (p.did)}
				<li class="chosen-chip" class:muted={covered(p, channel, audience) || !reachable(p, channel)}>
					<input type="hidden" name="extra" value={p.did} />
					<span>{personName(p)}</span>
					{#if covered(p, channel, audience)}
						<span class="chip-n">in {audienceLabel}</span>
					{:else if !reachable(p, channel)}
						<span class="chip-n">no email</span>
					{/if}
					<button
						type="button"
						class="remove"
						aria-label={`Remove ${personName(p)}`}
						onclick={() => {
							extras.delete(p.did);
							onchange();
						}}>×</button
					>
				</li>
			{/each}
		</ul>
	{/if}
</div>

<style>
	/* The add-on picker: a native select styled like the compose inputs,
	   then one removable chip per person. Muted chips are still posted —
	   the server unions and dedupes — but read as not adding to the count. */
	.extras {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.extras .kicker {
		color: var(--ink-70);
	}

	.picker {
		align-self: flex-start;
		max-width: 100%;
		background: transparent;
		border: none;
		border-bottom: 1px solid var(--ink-45);
		border-radius: 0;
		padding: 0.45rem 0;
		font-size: 0.9375rem;
		color: var(--ink);
	}

	.picker:disabled {
		color: var(--ink-45);
		cursor: default;
	}

	.picker:focus {
		outline: none;
		border-bottom-color: var(--ink);
	}

	.chosen {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	/* Duplicated from EmailPanel's chip count — scoped styles don't cross components. */
	.chip-n {
		font-variant-numeric: tabular-nums;
		color: var(--ink-45);
	}

	.chosen-chip {
		display: inline-flex;
		align-items: baseline;
		gap: 0.45rem;
		border: 1px solid var(--ink);
		border-radius: 999px;
		padding: 0.4rem 0.6rem 0.4rem 0.85rem;
		font-size: 0.8125rem;
		color: var(--ink);
		font-weight: 600;
	}

	.chosen-chip.muted {
		border-color: var(--ink-45);
		color: var(--ink-70);
		font-weight: 400;
	}

	.chosen-chip .remove {
		font-size: 1rem;
		line-height: 1;
		padding: 0 0.15rem;
		color: inherit;
	}
</style>
