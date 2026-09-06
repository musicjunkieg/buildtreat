<script lang="ts">
	import Icon from '$lib/ui/Icon.svelte';
	import { datesQuestion, type AvailabilityRange, type DayPortion } from '$lib/content';
	import { formatRange, rangeNights } from '$lib/dates';

	let {
		range,
		onsetportion,
		ondelete
	}: {
		/** The committed range currently open in the editor. */
		range: AvailabilityRange;
		onsetportion: (edge: 'start' | 'end', portion: DayPortion) => void;
		ondelete: () => void;
	} = $props();

	const portions: { value: DayPortion; label: string }[] = [
		{ value: 'full', label: 'Full day' },
		{ value: 'first_half', label: 'First half' },
		{ value: 'second_half', label: 'Second half' }
	];
</script>

<div class="editor" role="group" aria-label="Edit range {formatRange(range)}">
	<div class="editor-head">
		<p class="range-label">
			{formatRange(range)}
			<span class="nights">{rangeNights(range)} night{rangeNights(range) === 1 ? '' : 's'}</span>
		</p>
		<button class="icon-btn" onclick={ondelete} aria-label="Remove this range">
			<Icon name="x" size={16} />
		</button>
	</div>
	<div class="edges">
		<div class="edge">
			<span class="kicker">First day</span>
			<div class="seg" role="radiogroup" aria-label="First day availability">
				{#each portions as p (p.value)}
					<button
						role="radio"
						aria-checked={range.startPortion === p.value}
						class:on={range.startPortion === p.value}
						onclick={() => onsetportion('start', p.value)}
					>
						{p.label}
					</button>
				{/each}
			</div>
		</div>
		<div class="edge">
			<span class="kicker">Last day</span>
			<div class="seg" role="radiogroup" aria-label="Last day availability">
				{#each portions as p (p.value)}
					<button
						role="radio"
						aria-checked={range.endPortion === p.value}
						class:on={range.endPortion === p.value}
						onclick={() => onsetportion('end', p.value)}
					>
						{p.label}
					</button>
				{/each}
			</div>
		</div>
	</div>
	<p class="hint">{datesQuestion.halfDayHint}</p>
</div>

<style>
	.editor {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		border-top: var(--hairline);
		padding-top: var(--space-2);
	}

	.editor-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.range-label {
		font-weight: 600;
		display: flex;
		align-items: baseline;
		gap: 0.6rem;
	}

	.nights {
		font-size: var(--text-author);
		font-weight: 400;
		color: var(--ink-70);
	}

	.edges {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2) var(--space-4);
	}

	.edge {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.edge .kicker {
		color: var(--ink-70);
	}

	.seg {
		display: flex;
		border: 1px solid var(--ink-45);
		border-radius: 999px;
		overflow: hidden;
	}

	.seg button {
		padding: 0.35rem 0.8rem;
		font-size: 0.8125rem;
		color: var(--ink-70);
		transition:
			background 0.2s var(--ease-out),
			color 0.2s var(--ease-out);
	}

	.seg button.on {
		background: var(--ink);
		color: var(--on-pill);
		font-weight: 600;
	}

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
</style>
