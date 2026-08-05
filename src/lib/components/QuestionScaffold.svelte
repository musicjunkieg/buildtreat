<script lang="ts">
	import Icon from '$lib/components/Icon.svelte';
	import type { Snippet } from 'svelte';

	let {
		titleId,
		title,
		prompt,
		signedIn,
		onsignin,
		children
	}: {
		titleId: string;
		title: string;
		prompt: string;
		signedIn: boolean;
		onsignin: () => void;
		children: Snippet;
	} = $props();
</script>

<div class="q">
	<div class="breathe" aria-hidden="true"></div>
	<h2 id={titleId} class="display title">{title}</h2>
	<p class="prompt">{prompt}</p>
	{#if signedIn}
		<div class="controls">
			{@render children()}
		</div>
	{:else}
		<button class="pill gate" onclick={onsignin}>
			Sign in with Atmosphere to answer
			<Icon name="butterfly" size={17} />
		</button>
	{/if}
</div>

<style>
	.q {
		display: flex;
		flex-direction: column;
		height: 100%;
		gap: var(--space-3);
	}

	.breathe {
		flex: 1 1 auto;
		min-height: 8vh;
	}

	.title {
		font-size: clamp(2.6rem, 9vw, 4.2rem);
	}

	.prompt {
		font-size: var(--text-body);
		line-height: 1.5;
		color: var(--ink);
		max-width: 46ch;
	}

	.controls {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}

	.gate {
		margin-top: var(--space-2);
	}
</style>
