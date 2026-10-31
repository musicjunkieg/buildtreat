<script lang="ts">
	import { onDestroy } from 'svelte';
	import Icon from '$lib/ui/Icon.svelte';

	let {
		id,
		value = $bindable(),
		dropdownOpen = $bindable(false),
		oninput,
		onsubmit
	}: {
		/** id of the input, wired to its label. */
		id: string;
		value: string;
		/** Mirrored out to the sheet: an open dropdown swallows window Escape. */
		dropdownOpen?: boolean;
		/** Fires before each search, so the sheet can drop stale errors. */
		oninput?: () => void;
		/** Enter with nothing highlighted, or a picked result. */
		onsubmit: (handle?: string) => void;
	} = $props();

	let input: HTMLInputElement | null = null;

	/** The sheet's modal focus management focuses this field on open. */
	export function focus() {
		input?.focus();
	}

	/* ── handle typeahead (typeahead.waow.tech — community actor search) ── */

	interface Actor {
		handle: string;
		displayName?: string;
		avatar?: string;
	}

	let results = $state<Actor[]>([]);
	let highlighted = $state(-1);
	let searchTimer: ReturnType<typeof setTimeout> | undefined;
	let searchSeq = 0;

	/** Kill the pending debounce AND any in-flight response — stale results
	 * must never reopen the dropdown or apply after input changed. */
	export function invalidateSearch() {
		clearTimeout(searchTimer);
		searchSeq++;
	}

	/** The sheet drops this field from the DOM when it closes — a pending
	 * debounce or in-flight response must not outlive it. */
	onDestroy(invalidateSearch);

	function onHandleInput() {
		oninput?.();
		invalidateSearch();
		const q = value.trim().replace(/^@/, '');
		if (q.length < 2 || q.startsWith('did:')) {
			dropdownOpen = false;
			results = [];
			return;
		}
		const seq = searchSeq;
		searchTimer = setTimeout(async () => {
			try {
				const res = await fetch(
					`https://typeahead.waow.tech/xrpc/tech.waow.typeahead.searchActors?q=${encodeURIComponent(q)}&limit=6`,
					{ signal: AbortSignal.timeout(3000) }
				);
				if (!res.ok) throw new Error(String(res.status));
				const data = (await res.json()) as { actors?: Actor[] };
				if (seq !== searchSeq) return; // a newer query superseded this one
				// Dedupe by handle: the keyed each would crash on duplicates.
				results = [
					...new Map(
						(data.actors ?? []).filter((a) => typeof a.handle === 'string').map((a) => [a.handle, a])
					).values()
				];
				highlighted = -1;
				dropdownOpen = results.length > 0;
			} catch {
				// The service is experimental; the plain input keeps working without it.
				if (seq === searchSeq) dropdownOpen = false;
			}
		}, 250);
	}

	function pick(actor: Actor) {
		value = actor.handle;
		dropdownOpen = false;
		results = [];
		onsubmit(actor.handle);
	}

	function onInputKeydown(e: KeyboardEvent) {
		if (dropdownOpen) {
			if (e.key === 'ArrowDown') {
				e.preventDefault();
				highlighted = (highlighted + 1) % results.length;
				document.getElementById(`handle-opt-${highlighted}`)?.scrollIntoView({ block: 'nearest' });
				return;
			}
			if (e.key === 'ArrowUp') {
				e.preventDefault();
				// From the unset state (-1), the first ArrowUp lands on the LAST
				// result, not the second-to-last.
				highlighted = highlighted <= 0 ? results.length - 1 : highlighted - 1;
				document.getElementById(`handle-opt-${highlighted}`)?.scrollIntoView({ block: 'nearest' });
				return;
			}
			if (e.key === 'Escape') {
				e.stopPropagation();
				invalidateSearch();
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
			onsubmit();
		}
	}
</script>

<div class="field">
	<label class="kicker" for={id}>Your handle</label>
	<div
		class="combo"
		onfocusout={(e) => {
			const combo = e.currentTarget as HTMLElement;
			if (!combo.contains(e.relatedTarget as Node)) dropdownOpen = false;
		}}
	>
		<input
			{id}
			bind:this={input}
			bind:value={value}
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
			aria-activedescendant={dropdownOpen && highlighted >= 0 ? `handle-opt-${highlighted}` : undefined}
			oninput={onHandleInput}
			onkeydown={onInputKeydown}
		/>
		{#if dropdownOpen}
			<ul class="results" id="handle-results" role="listbox">
				{#each results as actor, i (actor.handle)}
					<!-- svelte-ignore a11y_click_events_have_key_events -- combobox pattern: keyboard interaction lives on the input -->
					<li
						id="handle-opt-{i}"
						class="result"
						class:hl={i === highlighted}
						role="option"
						aria-selected={i === highlighted}
						onmousedown={(e) => e.preventDefault()}
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
					</li>
				{/each}
			</ul>
		{/if}
	</div>
</div>

<style>
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
		cursor: pointer;
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
</style>
