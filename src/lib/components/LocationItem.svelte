<script lang="ts">
	import Icon from '$lib/components/Icon.svelte';
	import { locationQuestion, locations } from '$lib/content';
	import type { SurveyState } from '$lib/survey.svelte';

	let {
		survey,
		signedIn,
		onsignin
	}: {
		survey: SurveyState;
		signedIn: boolean;
		onsignin: () => void;
	} = $props();
</script>

<div class="loc">
	<h2 id="location-title" class="display title">{locationQuestion.title}</h2>
	<p class="prompt">{locationQuestion.prompt}</p>

	{#if !signedIn}
		<button class="pill gate" onclick={onsignin}>
			Sign in with Atmosphere to answer
			<Icon name="butterfly" size={17} />
		</button>
	{/if}

	<ul class="places" class:locked={!signedIn}>
		{#each locations as place (place.id)}
			{@const rank = survey.rankOf(place.id)}
			<li>
				<button
					class="place"
					class:ranked={rank !== null}
					style:background-image="linear-gradient(to right, rgba(11,9,8,0.72) 18%, rgba(11,9,8,0.15) 70%, rgba(11,9,8,0.05)), url('{place.image}')"
					onclick={() => {
						survey.toggleRank(place.id);
						survey.saveLocal();
					}}
					disabled={!signedIn}
					aria-pressed={rank !== null}
					aria-label="{place.name}{place.note ? ` (${place.note})` : ''}{rank ? `, ranked ${rank}` : ''}"
				>
					<span class="place-name">
						{place.name}
						{#if place.note}<span class="note">{place.note}</span>{/if}
					</span>
					<span class="rank" class:on={rank !== null} aria-hidden="true">
						{#if rank !== null}{rank}{/if}
					</span>
				</button>
			</li>
		{/each}
	</ul>

	<p class="hint" aria-live="polite">
		{#if survey.ranking.length === 0}
			Tap places in order of preference — 1 is your favorite.
		{:else if survey.ranking.length < locationQuestion.maxRank}
			{survey.ranking.length} of {locationQuestion.maxRank} ranked. Tap again to remove.
		{:else}
			Top three set. Tap any to change your mind.
		{/if}
	</p>
</div>

<style>
	.loc {
		display: flex;
		flex-direction: column;
		height: 100%;
		gap: var(--space-2);
		padding-top: var(--space-3);
	}

	.title {
		font-size: clamp(2.2rem, 7.5vw, 3.6rem);
	}

	.prompt {
		font-size: 0.9375rem;
		color: var(--ink-70);
	}

	.gate {
		margin-block: var(--space-2);
	}

	.places {
		list-style: none;
		flex: 1 1 auto;
		min-height: 0;
		display: flex;
		flex-direction: column;
		gap: 0.55rem;
		margin-block: var(--space-2);
	}

	.places.locked {
		opacity: 0.5;
	}

	.places li {
		flex: 1 1 0;
		min-height: 3.4rem;
	}

	.place {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: space-between;
		width: 100%;
		height: 100%;
		padding: 0.9rem 1.1rem;
		border-radius: 10px;
		background-size: cover;
		background-position: center;
		color: var(--ink);
		text-align: left;
		overflow: hidden;
		transition:
			transform 0.3s var(--ease-out),
			box-shadow 0.3s var(--ease-out);
	}

	.place:not(:disabled):hover {
		transform: scale(1.012);
	}

	.place.ranked {
		box-shadow: 0 0 0 2px var(--ink);
	}

	.place-name {
		font-family: var(--font-display);
		font-weight: 650;
		font-size: clamp(1.35rem, 4.2vw, 1.9rem);
		text-transform: uppercase;
		letter-spacing: 0.01em;
		display: flex;
		align-items: baseline;
		gap: 0.6rem;
		text-shadow: 0 1px 14px rgba(11, 9, 8, 0.55);
	}

	.note {
		font-family: var(--font-body);
		font-size: 0.75rem;
		font-weight: 450;
		text-transform: none;
		letter-spacing: 0.02em;
		color: var(--ink-70);
	}

	.rank {
		flex: 0 0 auto;
		display: grid;
		place-items: center;
		width: 2.1rem;
		height: 2.1rem;
		border-radius: 999px;
		border: 1.5px solid var(--ink-70);
		font-weight: 700;
		font-size: 1.05rem;
		transition:
			background 0.2s var(--ease-out),
			color 0.2s var(--ease-out);
	}

	.rank.on {
		background: var(--ink);
		border-color: var(--ink);
		color: var(--on-pill);
	}

	.hint {
		font-size: 0.8125rem;
		color: var(--ink-70);
	}
</style>
