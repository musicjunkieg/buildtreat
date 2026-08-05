<script lang="ts">
	import { login } from '@svelte-atproto/oauth/client';
	import Icon from '$lib/components/Icon.svelte';
	import type { KnownUser } from '../../routes/+page.server';

	let {
		open = $bindable(),
		error,
		knownUser = null
	}: {
		open: boolean;
		error?: string | null;
		knownUser?: KnownUser | null;
	} = $props();

	let handle = $state('');
	let busy = $state(false);
	let localError = $state<string | null>(null);
	let input = $state<HTMLInputElement | null>(null);
	let useDifferent = $state(false);

	const shownError = $derived(localError ?? error ?? null);
	const welcomeBack = $derived(knownUser !== null && !useDifferent);

	/* ── handle typeahead (typeahead.waow.tech — community actor search) ── */

	interface Actor {
		handle: string;
		displayName?: string;
		avatar?: string;
	}

	let results = $state<Actor[]>([]);
	let dropdownOpen = $state(false);
	let highlighted = $state(-1);
	let searchTimer: ReturnType<typeof setTimeout> | undefined;
	let searchSeq = 0;

	function onHandleInput() {
		localError = null;
		clearTimeout(searchTimer);
		const q = handle.trim().replace(/^@/, '');
		if (q.length < 2 || q.startsWith('did:')) {
			dropdownOpen = false;
			results = [];
			return;
		}
		searchTimer = setTimeout(async () => {
			const seq = ++searchSeq;
			try {
				const res = await fetch(
					`https://typeahead.waow.tech/xrpc/tech.waow.typeahead.searchActors?q=${encodeURIComponent(q)}&limit=6`
				);
				if (!res.ok) throw new Error(String(res.status));
				const data = (await res.json()) as { actors?: Actor[] };
				if (seq !== searchSeq) return; // a newer query superseded this one
				results = data.actors ?? [];
				highlighted = -1;
				dropdownOpen = results.length > 0;
			} catch {
				// The service is experimental; the plain input keeps working without it.
				if (seq === searchSeq) dropdownOpen = false;
			}
		}, 250);
	}

	function pick(actor: Actor) {
		handle = actor.handle;
		dropdownOpen = false;
		results = [];
		void go();
	}

	function onInputKeydown(e: KeyboardEvent) {
		if (dropdownOpen) {
			if (e.key === 'ArrowDown') {
				e.preventDefault();
				highlighted = (highlighted + 1) % results.length;
				return;
			}
			if (e.key === 'ArrowUp') {
				e.preventDefault();
				highlighted = (highlighted - 1 + results.length) % results.length;
				return;
			}
			if (e.key === 'Escape') {
				e.stopPropagation();
				dropdownOpen = false;
				return;
			}
			if (e.key === 'Enter' && highlighted >= 0) {
				e.preventDefault();
				pick(results[highlighted]);
				return;
			}
		}
		if (e.key === 'Enter') {
			e.preventDefault();
			void go();
		}
	}

	/* ── sign-in ── */

	$effect(() => {
		if (open && !welcomeBack) input?.focus();
	});

	async function go(withHandle?: string) {
		const clean = (withHandle ?? handle).trim().replace(/^@/, '');
		if (!clean || busy) return;
		busy = true;
		localError = null;
		dropdownOpen = false;
		try {
			await login(clean);
		} catch (err) {
			localError = err instanceof Error ? err.message : 'Sign-in failed — try again';
			busy = false;
		}
	}

	function onkeydown(e: KeyboardEvent) {
		if (e.key === 'Escape' && !dropdownOpen) open = false;
	}
</script>

<svelte:window {onkeydown} />

{#if open}
	<div class="backdrop" onclick={() => (open = false)} aria-hidden="true"></div>
	<div class="sheet" role="dialog" aria-modal="true" aria-label="Sign in with Atmosphere">
		<div class="sheet-head">
			<p class="kicker">Sign in with Atmosphere</p>
			<button type="button" class="close" onclick={() => (open = false)} aria-label="Close">
				<Icon name="x" size={16} />
			</button>
		</div>

		{#if welcomeBack && knownUser}
			<div class="known">
				{#if knownUser.avatar}
					<img class="known-avatar" src={knownUser.avatar} alt="" />
				{:else}
					<span class="known-avatar fallback" aria-hidden="true"><Icon name="person" size={20} /></span>
				{/if}
				<div class="known-who">
					<p class="known-name">{knownUser.displayName ?? `@${knownUser.handle}`}</p>
					<p class="known-handle">Hey, it’s you — @{knownUser.handle}</p>
				</div>
			</div>
			{#if shownError}
				<p class="error" role="alert">{shownError}</p>
			{/if}
			<button class="pill" onclick={() => void go(knownUser.handle)} disabled={busy}>
				{busy ? 'Contacting your PDS…' : `Continue as @${knownUser.handle}`}
				<Icon name="butterfly" size={17} />
			</button>
			<button type="button" class="alt" onclick={() => (useDifferent = true)}>
				Use a different account
			</button>
		{:else}
			<p class="explain">
				Your ATProto account identifies you — we only read your handle and profile. No posting, ever.
			</p>
			<div class="field">
				<label class="kicker" for="signin-handle">Your handle</label>
				<div class="combo">
					<input
						id="signin-handle"
						bind:this={input}
						bind:value={handle}
						type="text"
						name="handle"
						placeholder="you.bsky.social"
						autocapitalize="none"
						autocorrect="off"
						spellcheck="false"
						autocomplete="username"
						role="combobox"
						aria-expanded={dropdownOpen}
						aria-controls="handle-results"
						aria-autocomplete="list"
						oninput={onHandleInput}
						onkeydown={onInputKeydown}
					/>
					{#if dropdownOpen}
						<ul class="results" id="handle-results" role="listbox">
							{#each results as actor, i (actor.handle)}
								<li role="option" aria-selected={i === highlighted}>
									<button
										type="button"
										class="result"
										class:hl={i === highlighted}
										onclick={() => pick(actor)}
										onmouseenter={() => (highlighted = i)}
									>
										{#if actor.avatar}
											<img class="result-avatar" src={actor.avatar} alt="" loading="lazy" />
										{:else}
											<span class="result-avatar fallback" aria-hidden="true"><Icon name="person" size={14} /></span>
										{/if}
										<span class="result-info">
											<span class="result-name">{actor.displayName || actor.handle}</span>
											<span class="result-handle">@{actor.handle}</span>
										</span>
									</button>
								</li>
							{/each}
						</ul>
					{/if}
				</div>
			</div>
			{#if shownError}
				<p class="error" role="alert">{shownError}</p>
			{/if}
			<button class="pill" onclick={() => void go()} disabled={!handle.trim() || busy}>
				{busy ? 'Contacting your PDS…' : 'Continue'}
				<Icon name="butterfly" size={17} />
			</button>
		{/if}
	</div>
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

	/* ── welcome back ── */

	.known {
		display: flex;
		align-items: center;
		gap: 0.9rem;
	}

	.known-avatar {
		width: 3rem;
		height: 3rem;
		border-radius: 999px;
		object-fit: cover;
		border: 1px solid var(--ink-45);
	}

	.known-avatar.fallback {
		display: grid;
		place-items: center;
		color: var(--ink-70);
	}

	.known-name {
		font-weight: 650;
		font-size: 1.0625rem;
	}

	.known-handle {
		font-size: var(--text-author);
		color: var(--ink-70);
	}

	.alt {
		align-self: center;
		font-size: var(--text-author);
		color: var(--ink-70);
		text-decoration: underline;
		text-underline-offset: 3px;
	}

	.alt:hover {
		color: var(--ink);
	}

	/* ── handle field + typeahead ── */

	.field {
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
	}

	.field .kicker {
		color: var(--ink-70);
	}

	.combo {
		position: relative;
	}

	.combo input {
		width: 100%;
		background: transparent;
		border: none;
		border-bottom: 1px solid var(--ink-45);
		border-radius: 0;
		padding: 0.45rem 0 0.55rem;
		font-size: 1.125rem;
		caret-color: var(--ink);
	}

	.combo input::placeholder {
		color: var(--ink-45);
	}

	.combo input:focus {
		outline: none;
		border-bottom-color: var(--ink);
	}

	.results {
		position: absolute;
		/* The sheet is bottom-docked on phones, so results open upward. */
		bottom: calc(100% + 0.4rem);
		left: 0;
		right: 0;
		z-index: 60;
		list-style: none;
		background: var(--ground);
		border: var(--hairline);
		border-radius: 10px;
		max-height: 14rem;
		overflow-y: auto;
		box-shadow: 0 -8px 28px rgba(11, 9, 8, 0.6);
	}

	@media (min-width: 700px) {
		.results {
			bottom: auto;
			top: calc(100% + 0.4rem);
			box-shadow: 0 8px 28px rgba(11, 9, 8, 0.6);
		}
	}

	.result {
		display: flex;
		align-items: center;
		gap: 0.7rem;
		width: 100%;
		padding: 0.55rem 0.8rem;
		text-align: left;
		color: var(--ink);
		transition: background 0.15s var(--ease-out);
	}

	.result.hl,
	.result:hover {
		background: var(--ink-12);
	}

	.result-avatar {
		flex: 0 0 auto;
		width: 2rem;
		height: 2rem;
		border-radius: 999px;
		object-fit: cover;
	}

	.result-avatar.fallback {
		display: grid;
		place-items: center;
		border: 1px solid var(--ink-45);
		color: var(--ink-70);
	}

	.result-info {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}

	.result-name {
		font-size: 0.9375rem;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.result-handle {
		font-size: var(--text-author);
		color: var(--ink-70);
	}

	.error {
		font-size: var(--text-author);
		line-height: 1.45;
	}
</style>
