<script lang="ts">
	import { login } from '@svelte-atproto/oauth/client';
	import Icon from '$lib/ui/Icon.svelte';
	import { retreat } from '$lib/content';

	/* ── sign-in (signed-out state) ── */

	let handle = $state('');
	let busy = $state(false);
	let signinError = $state<string | null>(null);

	async function signIn() {
		const clean = handle.trim().replace(/^@/, '');
		if (!clean || busy) return;
		busy = true;
		signinError = null;
		try {
			await login(clean);
		} catch (e) {
			signinError = e instanceof Error ? e.message : 'Sign-in failed — try again';
			busy = false;
		}
	}
</script>

<main class="gate">
	<div class="gate-box">
		<h1 class="display gate-title">Organizer.</h1>
		<p class="gate-explain">
			This side is for the organizers of the Atmospheric Builders’ Retreat. Sign in and we’ll check.
		</p>
		<div class="gate-field">
			<label class="kicker" for="org-handle">Your handle</label>
			<input
				id="org-handle"
				type="text"
				bind:value={handle}
				placeholder="you.bsky.social"
				autocapitalize="none"
				autocorrect="off"
				spellcheck="false"
				autocomplete="username"
				onkeydown={(e) => e.key === 'Enter' && signIn()}
			/>
		</div>
		{#if signinError}
			<p class="gate-error" role="alert">{signinError}</p>
		{/if}
		<button class="pill" onclick={signIn} disabled={!handle.trim() || busy}>
			{busy ? 'Contacting your PDS…' : retreat.signIn}
			<Icon name="butterfly" size={17} />
		</button>
	</div>
</main>

<style>
	/* ── shared ground: the world without its photographs ── */

	.gate {
		position: relative;
		min-height: 100dvh;
		background: var(--ground);
	}

	.gate::after {
		content: '';
		position: fixed;
		inset: 0;
		background: url('/media/grain.png');
		background-size: 340px;
		/* Overlay-blend vanishes on flat near-black (it needs midtones under
		   it, which the survey's photos supply). Screen-blend at lower opacity
		   is the same grain made visible on this surface's solid ground. */
		opacity: 0.05;
		mix-blend-mode: screen;
		pointer-events: none;
		z-index: 5;
	}

	/* ── signed-out gate ── */

	.gate {
		display: grid;
		place-items: center;
		padding: var(--gutter);
	}

	.gate-box {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		width: min(24rem, 100%);
	}

	.gate-title {
		/* The documented title ramp — the gate is a mini hero. */
		font-size: clamp(2.2rem, 7.5vw, 3.6rem);
	}

	.gate-explain {
		font-size: 0.9375rem;
		line-height: 1.5;
		color: var(--ink-70);
		max-width: 34ch;
	}

	.gate-field {
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
	}

	.gate-field .kicker {
		color: var(--ink-70);
	}

	.gate-field input {
		background: transparent;
		border: none;
		border-bottom: 1px solid var(--ink-45);
		border-radius: 0;
		padding: 0.45rem 0 0.55rem;
		font-size: 1.125rem;
		caret-color: var(--ink);
	}

	.gate-field input::placeholder {
		color: var(--ink-45);
	}

	.gate-field input:focus {
		outline: none;
		border-bottom-color: var(--ink);
	}

	.gate-error {
		font-size: var(--text-author);
		line-height: 1.45;
	}
</style>
