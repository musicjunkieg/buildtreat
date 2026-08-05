<script lang="ts">
	import Icon from '$lib/components/Icon.svelte';

	import { login } from '@svelte-atproto/oauth/client';

	let { open = $bindable(), error }: { open: boolean; error?: string | null } = $props();

	let handle = $state('');
	let busy = $state(false);
	let localError = $state<string | null>(null);
	let input = $state<HTMLInputElement | null>(null);

	const shownError = $derived(localError ?? error ?? null);

	$effect(() => {
		if (open) input?.focus();
	});

	async function go(e: SubmitEvent) {
		e.preventDefault();
		const clean = handle.trim().replace(/^@/, '');
		if (!clean || busy) return;
		busy = true;
		localError = null;
		try {
			await login(clean);
		} catch (err) {
			localError = err instanceof Error ? err.message : 'Sign-in failed — try again';
			busy = false;
		}
	}

	function onkeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') open = false;
	}
</script>

<svelte:window {onkeydown} />

{#if open}
	<div class="backdrop" onclick={() => (open = false)} aria-hidden="true"></div>
	<form class="sheet" onsubmit={go} aria-label="Sign in with Atmosphere">
		<div class="sheet-head">
			<p class="kicker">Sign in with Atmosphere</p>
			<button type="button" class="close" onclick={() => (open = false)} aria-label="Close">
				<Icon name="x" size={16} />
			</button>
		</div>
		<p class="explain">
			Your ATProto account identifies you — we only read your handle and profile. No posting, ever.
		</p>
		<label class="field">
			<span class="kicker">Your handle</span>
			<input
				bind:this={input}
				bind:value={handle}
				type="text"
				name="handle"
				placeholder="you.bsky.social"
				autocapitalize="none"
				autocorrect="off"
				spellcheck="false"
				autocomplete="username"
			/>
		</label>
		{#if shownError}
			<p class="error" role="alert">{shownError}</p>
		{/if}
		<button class="pill" type="submit" disabled={!handle.trim() || busy}>
			{busy ? 'Contacting your PDS…' : 'Continue'}
			<Icon name="butterfly" size={17} />
		</button>
	</form>
{/if}

<style>
	.backdrop {
		position: fixed;
		inset: 0;
		z-index: 40;
		background: rgba(11, 9, 8, 0.55);
		backdrop-filter: blur(3px);
	}

	.sheet {
		position: fixed;
		z-index: 50;
		left: 0;
		right: 0;
		bottom: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		padding: var(--space-4) var(--gutter) calc(env(safe-area-inset-bottom) + var(--space-4));
		background: var(--ground);
		border-top: var(--hairline);
		animation: rise 0.45s var(--ease-out);
	}

	@keyframes rise {
		from {
			translate: 0 30%;
			opacity: 0;
		}
	}

	@media (min-width: 700px) {
		.sheet {
			left: 50%;
			right: auto;
			bottom: 50%;
			translate: -50% 50%;
			width: min(26rem, calc(100vw - 2 * var(--gutter)));
			border: var(--hairline);
			border-radius: 14px;
		}
	}

	.sheet-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.close {
		display: grid;
		place-items: center;
		width: 2rem;
		height: 2rem;
		border-radius: 999px;
		border: 1px solid var(--ink-45);
		color: var(--ink);
	}

	.explain {
		font-size: var(--text-author);
		color: var(--ink-70);
		line-height: 1.5;
		max-width: 40ch;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
	}

	.field .kicker {
		color: var(--ink-70);
	}

	.field input {
		background: transparent;
		border: none;
		border-bottom: 1px solid var(--ink-45);
		border-radius: 0;
		padding: 0.45rem 0 0.55rem;
		font-size: 1.125rem;
	}

	.field input::placeholder {
		color: var(--ink-45);
	}

	.field input:focus {
		outline: none;
		border-bottom-color: var(--ink);
	}

	.error {
		font-size: var(--text-author);
		line-height: 1.45;
	}
</style>
