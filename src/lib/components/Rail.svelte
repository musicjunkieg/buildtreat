<script lang="ts">
	import Icon, { type IconName } from '$lib/components/Icon.svelte';
	import { itemTitles, type FeedItemId } from '$lib/content';

	let {
		current,
		completion,
		dimmed = false,
		onjump
	}: {
		current: FeedItemId;
		completion: Record<FeedItemId, boolean>;
		dimmed?: boolean;
		onjump: (id: FeedItemId) => void;
	} = $props();

	const stops: { id: FeedItemId; icon: IconName }[] = [
		{ id: 'you', icon: 'person' },
		{ id: 'interest', icon: 'heart' },
		{ id: 'travel', icon: 'plane' },
		{ id: 'dates', icon: 'calendar' },
		{ id: 'location', icon: 'pin' },
		{ id: 'review', icon: 'check' }
	];
</script>

<nav class="rail" class:dimmed aria-label="Survey sections">
	{#each stops as stop (stop.id)}
		<button
			class="stop"
			class:active={current === stop.id}
			class:done={completion[stop.id]}
			onclick={() => onjump(stop.id)}
			aria-label="{itemTitles[stop.id]}{dimmed ? ' — sign in to open' : completion[stop.id] ? ' — answered' : ''}"
			aria-current={current === stop.id ? 'true' : undefined}
		>
			<Icon name={stop.icon} size={22} />
			{#if completion[stop.id] && !dimmed}
				<span class="tick" aria-hidden="true"><Icon name="check" size={9} /></span>
			{/if}
		</button>
	{/each}
</nav>

<style>
	.rail {
		position: fixed;
		right: calc(env(safe-area-inset-right) + 0.7rem);
		top: 50%;
		translate: 0 -50%;
		z-index: 20;
		display: flex;
		flex-direction: column;
		gap: 1.15rem;
	}

	/* Signed-out: the map of what's ahead stays faint and quiet. */
	.rail.dimmed .stop {
		opacity: 0.22;
	}

	.rail.dimmed .stop:hover {
		opacity: 0.35;
		transform: none;
	}

	.stop {
		position: relative;
		display: grid;
		place-items: center;
		width: 2.4rem;
		height: 2.4rem;
		color: var(--ink);
		opacity: 0.62;
		transition:
			opacity 0.3s var(--ease-out),
			transform 0.3s var(--ease-out);
	}

	.stop:hover {
		opacity: 1;
		transform: scale(1.12);
	}

	.stop.active {
		opacity: 1;
	}

	.stop.active::after {
		content: '';
		position: absolute;
		left: -0.55rem;
		top: 50%;
		translate: 0 -50%;
		width: 3px;
		height: 3px;
		border-radius: 999px;
		background: var(--ink);
	}

	.tick {
		position: absolute;
		right: 0.05rem;
		top: 0.05rem;
		display: grid;
		place-items: center;
		width: 0.85rem;
		height: 0.85rem;
		border-radius: 999px;
		background: var(--ink);
		color: var(--on-pill);
	}

	@media (min-width: 900px) {
		.rail {
			right: calc(env(safe-area-inset-right) + 2rem);
			gap: var(--rail-gap);
		}
	}
</style>
