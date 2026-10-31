<script lang="ts">
	import { windowMonths, formatDay } from '$lib/dates';
	import type { DayLoad, HalfOverlap } from '$lib/organizer/aggregate';

	let {
		loads,
		total,
		overlap = null
	}: {
		loads: DayLoad[];
		/** Denominator: respondents in the current filter with any availability. */
		total: number;
		/**
		 * Anchor-scenario overlap: days where every anchored person is
		 * available, by half. Null when no scenario is active.
		 */
		overlap?: Map<string, HalfOverlap> | null;
	} = $props();

	const months = windowMonths();
	const weekdays = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

	const byDay = $derived(new Map(loads.map((l) => [l.iso, l])));
	const peak = $derived(Math.max(1, ...loads.map((l) => Math.max(l.first, l.second))));

	/**
	 * Cell intensity is white opacity — the world's one ink doing the data
	 * work. Alpha floor of 0.05 keeps "one person" visible against zero.
	 */
	function alpha(count: number): number {
		if (count <= 0) return 0;
		return 0.05 + 0.95 * (count / peak);
	}

	function cellStyle(load: DayLoad | undefined): string {
		if (!load) return '';
		const a1 = alpha(load.first);
		const a2 = alpha(load.second);
		// Numeral color flips at mid-intensity: difference-blend turns mid-gray
		// on mid-alpha fills, so contrast is computed, not blended.
		const numeral = (a1 + a2) / 2 > 0.5 ? 'var(--ground)' : 'var(--ink)';
		return `background: linear-gradient(to bottom, rgba(255,255,255,${a1.toFixed(3)}) 0 50%, rgba(255,255,255,${a2.toFixed(3)}) 50% 100%); color: ${numeral};`;
	}

	function cellLabel(iso: string, load: DayLoad | undefined): string {
		const anchored = overlap?.get(iso);
		const suffix = anchored ? (anchored.first && anchored.second ? ' · all anchors' : anchored.first ? ' · all anchors (first half)' : ' · all anchors (second half)') : '';
		if (!load) return formatDay(iso) + suffix;
		if (load.first === load.second) return `${formatDay(iso)} — ${load.first} of ${total} available${suffix}`;
		return `${formatDay(iso)} — ${load.first} of ${total} first half, ${load.second} second half${suffix}`;
	}

	/** Legend stops sampled off the live scale. */
	const legendStops = $derived([0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(f * peak)));
</script>

<div class="heatmap">
	<div
		class="months"
		role="img"
		aria-label="Availability heatmap, September 1 to November 15. Brighter days mean more people available. {total} respondents gave dates.{overlap
			? ` Outlined days are the ${overlap.size} where every anchored person is available — for the whole day, or for the half the outline marks.`
			: ''}"
	>
		{#each months as month (month.month)}
			<div class="month">
				<span class="kicker month-name" aria-hidden="true">{month.name}</span>
				<div class="grid" aria-hidden="true">
					{#each weekdays as wd, i (i)}
						<span class="wd">{wd}</span>
					{/each}
					{#each { length: month.leading } as _, i (i)}
						<span class="blank"></span>
					{/each}
					{#each month.days as day (day.iso)}
						{#if day.inWindow}
							{@const load = byDay.get(day.iso)}
							{@const a = overlap?.get(day.iso)}
							<span
								class="cell"
								class:anchor-full={a && a.first && a.second}
								class:anchor-first={a && a.first && !a.second}
								class:anchor-second={a && !a.first && a.second}
								style={cellStyle(load)}
								title={cellLabel(day.iso, load)}
							>
								<span class="num">{day.day}</span>
							</span>
						{:else}
							<span class="cell out">{day.day}</span>
						{/if}
					{/each}
				</div>
			</div>
		{/each}
	</div>

	<div class="keys">
		<div class="key">
			<span class="key-label">How many of {total} are available</span>
			<span class="key-end">0</span>
			<span class="swatches">
				{#each legendStops as stop, i (i)}
					<span class="swatch" style="background: rgba(255,255,255,{alpha(stop).toFixed(3)})"></span>
				{/each}
			</span>
			<span class="key-end">{peak}</span>
		</div>
		<div class="key">
			<span class="split-swatch" aria-hidden="true"></span>
			<span class="key-label">half-day arrival / departure</span>
		</div>
		{#if overlap}
			<div class="key">
				<span class="ring-swatch" aria-hidden="true"></span>
				<span class="key-label">all anchored people available</span>
			</div>
		{/if}
	</div>
</div>

<style>
	.heatmap {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}

	.months {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: var(--space-4);
	}

	@media (max-width: 900px) {
		.months {
			grid-template-columns: 1fr;
			gap: var(--space-3);
		}
	}

	.month-name {
		display: block;
		margin-bottom: 0.6rem;
		color: var(--ink-70);
	}

	.grid {
		display: grid;
		grid-template-columns: repeat(7, 1fr);
		gap: 3px;
	}

	.wd {
		text-align: center;
		font-size: 0.625rem;
		letter-spacing: 0.12em;
		color: var(--ink-45);
		padding-bottom: 0.3rem;
	}

	.cell {
		aspect-ratio: 1;
		min-height: 2rem;
		display: grid;
		place-items: center;
		font-size: 0.8125rem;
		font-weight: 500;
		font-variant-numeric: tabular-nums;
		border-radius: 6px;
		border: 1px solid rgba(255, 255, 255, 0.07);
	}

	.cell .num {
		color: inherit;
	}

	.cell.out {
		border: none;
		color: var(--ink-35);
		opacity: 0.45;
	}

	/* Anchor-scenario overlap: the one ink as a ring. Full-day overlap rings
	   the whole cell; half-day overlap rings only that half, echoing the
	   split-cell language. */
	.cell {
		position: relative;
	}

	.cell.anchor-full,
	.cell.anchor-first,
	.cell.anchor-second {
		border-color: transparent;
	}

	.cell.anchor-full::after,
	.cell.anchor-first::after,
	.cell.anchor-second::after {
		content: '';
		position: absolute;
		pointer-events: none;
		border: 2px solid var(--ink);
		/* Punched ring (the world's radio-dot device, not elevation): a
		   ground-colored halo on both sides of the ink stroke. The days all
		   anchors share are usually the BRIGHTEST cells — a bare white ring
		   disappears on their near-white fill; the dark halo keeps it
		   legible on any alpha. */
		box-shadow:
			0 0 0 1.5px var(--ground),
			inset 0 0 0 1.5px var(--ground);
	}

	.cell.anchor-full::after {
		inset: 0;
		border-radius: 6px;
	}

	.cell.anchor-first::after {
		inset: 0 0 50% 0;
		border-radius: 6px 6px 0 0;
	}

	.cell.anchor-second::after {
		inset: 50% 0 0 0;
		border-radius: 0 0 6px 6px;
	}

	.keys {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2) var(--space-5);
	}

	.key {
		display: flex;
		align-items: center;
		gap: 0.7rem;
	}

	.key-label {
		font-size: 0.75rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		font-weight: 500;
		color: var(--ink-70);
	}

	.swatches {
		display: flex;
		gap: 3px;
	}

	.swatch {
		width: 1.15rem;
		height: 1.15rem;
		border-radius: 6px;
		border: 1px solid rgba(255, 255, 255, 0.07);
	}

	.key-end {
		font-size: 0.6875rem;
		color: var(--ink-45);
		font-variant-numeric: tabular-nums;
	}

	.split-swatch {
		width: 1.15rem;
		height: 1.15rem;
		border-radius: 6px;
		background: linear-gradient(to bottom, var(--ink) 50%, var(--ink-12) 50%);
	}

	.ring-swatch {
		width: 1.15rem;
		height: 1.15rem;
		border-radius: 6px;
		border: 2px solid var(--ink);
		/* Mid-alpha fill so the legend demonstrates the halo the way it
		   appears on a bright cell. */
		background: rgba(255, 255, 255, 0.45);
		box-shadow:
			0 0 0 1.5px var(--ground),
			inset 0 0 0 1.5px var(--ground);
	}
</style>
