<script lang="ts">
	import Icon from '$lib/ui/Icon.svelte';
	import { retreat } from '$lib/content';

	let {
		hasRanges,
		onadd
	}: {
		/** Changes the summary copy once at least one range is committed. */
		hasRanges: boolean;
		/** Ordered, window-clamped range — the parent owns the mutation. */
		onadd: (start: string, end: string) => void;
	} = $props();

	/** Typed-entry state (accessible alternative). */
	let typedStart = $state('');
	let typedEnd = $state('');
	let typedError = $state('');

	function addTyped() {
		typedError = '';
		if (!typedStart || !typedEnd) {
			typedError = 'Pick both a start and an end date.';
			return;
		}
		let lo = typedStart;
		let hi = typedEnd;
		if (lo > hi) [lo, hi] = [hi, lo];
		if (hi < retreat.window.start || lo > retreat.window.end) {
			typedError = `Dates must fall between Sept 1 and Nov 15.`;
			return;
		}
		if (lo < retreat.window.start) lo = retreat.window.start;
		if (hi > retreat.window.end) hi = retreat.window.end;
		onadd(lo, hi);
		typedStart = '';
		typedEnd = '';
	}
</script>

<details class="typed">
	<summary>{hasRanges ? 'Add another range by typing' : 'Prefer to type your dates?'}</summary>
	<div class="typed-row">
		<label>
			<span class="kicker">From</span>
			<input type="date" min={retreat.window.start} max={retreat.window.end} bind:value={typedStart} />
		</label>
		<label>
			<span class="kicker">To</span>
			<input type="date" min={retreat.window.start} max={retreat.window.end} bind:value={typedEnd} />
		</label>
		<button class="icon-btn add" onclick={addTyped} aria-label="Add this range">
			<Icon name="plus" size={18} />
		</button>
	</div>
	{#if typedError}
		<p class="hint" role="alert">{typedError}</p>
	{/if}
</details>

<style>
	.hint {
		font-size: 0.8125rem;
		color: var(--ink-70);
		line-height: 1.4;
		max-width: 48ch;
	}

	.icon-btn {
		display: grid;
		place-items: center;
		width: 2.1rem;
		height: 2.1rem;
		border-radius: 999px;
		border: 1px solid var(--ink-45);
		color: var(--ink);
	}

	.typed summary {
		font-size: var(--text-author);
		color: var(--ink-70);
		cursor: pointer;
	}

	.typed-row {
		display: flex;
		align-items: end;
		gap: var(--space-2);
		margin-top: var(--space-2);
	}

	.typed-row label {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}

	.typed-row input {
		background: transparent;
		border: none;
		border-bottom: 1px solid var(--ink-45);
		border-radius: 0;
		padding: 0.3rem 0;
		color-scheme: dark;
	}

	.typed-row input:focus {
		outline: none;
		border-bottom-color: var(--ink);
	}
</style>
