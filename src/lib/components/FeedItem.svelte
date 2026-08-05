<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		id,
		media,
		mediaWide,
		mediaAlt = '',
		eager = false,
		darker = false,
		labelledby,
		children
	}: {
		id: string;
		media?: string;
		mediaWide?: string;
		mediaAlt?: string;
		eager?: boolean;
		darker?: boolean;
		labelledby?: string;
		children: Snippet;
	} = $props();
</script>

<section class="item" {id} aria-labelledby={labelledby} class:darker>
	{#if media}
		<picture>
			{#if mediaWide}
				<source media="(min-aspect-ratio: 1/1)" srcset={mediaWide} />
			{/if}
			<img class="media" src={media} alt={mediaAlt} loading={eager ? 'eager' : 'lazy'} decoding="async" />
		</picture>
	{/if}
	<div class="scrim" aria-hidden="true"></div>
	<div class="grain" aria-hidden="true"></div>
	<div class="content">
		{@render children()}
	</div>
</section>

<style>
	.item {
		position: relative;
		height: 100dvh;
		scroll-snap-align: start;
		scroll-snap-stop: always;
		overflow: hidden;
		background: var(--ground);
	}

	.media {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
		object-position: center 30%;
	}

	.scrim {
		position: absolute;
		inset: 0;
		background: linear-gradient(
			to bottom,
			rgba(11, 9, 8, 0.22) 0%,
			rgba(11, 9, 8, 0) 14%,
			rgba(11, 9, 8, 0) 34%,
			rgba(11, 9, 8, 0.52) 58%,
			rgba(11, 9, 8, 0.9) 82%,
			rgba(11, 9, 8, 0.97) 100%
		);
	}

	.darker .scrim {
		background: linear-gradient(
			to bottom,
			rgba(11, 9, 8, 0.45) 0%,
			rgba(11, 9, 8, 0.28) 20%,
			rgba(11, 9, 8, 0.55) 48%,
			rgba(11, 9, 8, 0.93) 78%,
			rgba(11, 9, 8, 0.98) 100%
		);
	}

	.grain {
		position: absolute;
		inset: 0;
		background-image: url('/media/grain.png');
		background-size: 340px;
		opacity: 0.07;
		mix-blend-mode: overlay;
		pointer-events: none;
	}

	.content {
		position: relative;
		height: 100%;
		display: flex;
		flex-direction: column;
		padding: calc(env(safe-area-inset-top) + var(--space-4)) var(--gutter)
			calc(env(safe-area-inset-bottom) + var(--space-5));
		/* Keep text clear of the fixed glyph rail on the right. */
		padding-right: calc(var(--gutter) + 2.4rem);
	}

	@media (min-width: 900px) {
		.content {
			max-width: 620px;
			margin-inline: max(var(--gutter), calc((100vw - 1160px) / 2)) auto;
			padding-inline: 0;
		}
	}
</style>
