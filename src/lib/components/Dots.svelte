<script lang="ts">
	import { feedItems, itemTitles, type FeedItemId } from '$lib/content';

	let {
		current,
		onjump
	}: {
		current: FeedItemId;
		onjump: (id: FeedItemId) => void;
	} = $props();
</script>

<nav class="dots" aria-label="Progress">
	{#each feedItems as id (id)}
		<button
			class="dot"
			class:on={current === id}
			onclick={() => onjump(id)}
			aria-label={itemTitles[id]}
			aria-current={current === id ? 'true' : undefined}
		></button>
	{/each}
</nav>

<style>
	.dots {
		position: fixed;
		left: 50%;
		translate: -50% 0;
		bottom: calc(env(safe-area-inset-bottom) + 0.9rem);
		z-index: 20;
		display: flex;
		gap: 0.7rem;
	}

	.dot {
		width: 0.5rem;
		height: 0.5rem;
		border-radius: 999px;
		background: var(--ink);
		opacity: 0.35;
		transition:
			opacity 0.3s var(--ease-out),
			transform 0.3s var(--ease-out);
	}

	.dot:hover {
		opacity: 0.7;
	}

	.dot.on {
		opacity: 1;
		transform: scale(1.25);
	}
</style>
