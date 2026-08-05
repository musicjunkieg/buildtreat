<script lang="ts">
	import '@fontsource-variable/big-shoulders';
	import '@fontsource-variable/hanken-grotesk';
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>The Atmospheric Builders’ Retreat</title>
	<meta
		name="description"
		content="A 3-night retreat for atproto builders in Southern California, sometime between Sept 1 – Nov 15. Sponsored by Bluesky. Your answers pick the dates and the place."
	/>
</svelte:head>

<!--
THESIS: One item owns the entire viewport; the survey is a feed you flick
through, not a form you scroll. Refuses the centered-card stepper on a gray
ground.
OWN-WORLD: Full-bleed desert-modern dusk photography under a bottom scrim;
pure white UI, no second color; ultra-condensed stacked display caps (Big
Shoulders); hairline ledger rows; one white pill; outline glyph rail; seven
dots; film grain.
STORY: An invited ATProto builder sees the retreat is real — sponsored by
Bluesky — signs in with Atmosphere, and answers seven items so the dates and
place can be chosen from their availability.
FIRST VIEWPORT: Kicker top-left; breathing courtyard photo; acknowledgment
couplet; stacked ATMOSPHERIC / BUILDERS' RETREAT; four ruled fact rows;
full-width pill CTA; author line; glyph rail right; dots bottom.
FORM: Full-Bleed Feed — user-chosen challenger over the assigned direction;
seed 9380440b.
FINISH: unreviewed and undocumented is unfinished; this build ends with the
finish review, the verdict, and DESIGN.md.
-->

{@render children()}
