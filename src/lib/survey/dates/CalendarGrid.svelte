<script lang="ts">
	import { portionLabel, windowMonths } from '$lib/dates';
	import { weekdays, type CellState } from './grid';

	let {
		locked,
		liveMessage,
		focusDate,
		cellState,
		onactivate,
		onpointerdown,
		onpointerenter,
		onfocus,
		onkey,
		onhoverchange
	}: {
		/** Not signed in — the grid is dimmed and every day is disabled. */
		locked: boolean;
		/** Live-region text, announced as the selection flow progresses. */
		liveMessage: string;
		/** Roving-tabindex target: the one day cell with tabindex 0. */
		focusDate: string;
		cellState: (day: string) => CellState;
		onactivate: (day: string) => void;
		onpointerdown: (day: string, e: PointerEvent) => void;
		onpointerenter: (day: string, e: PointerEvent) => void;
		onfocus: (day: string) => void;
		onkey: (day: string, e: KeyboardEvent) => void;
		/** Pointer left the grid — the new hovered day, or null. */
		onhoverchange: (day: string | null) => void;
	} = $props();

	const months = windowMonths();

	let root: HTMLDivElement | undefined = $state();

	/**
	 * Roving-tabindex handoff: the parent owns `focusDate` and decides where
	 * focus goes, but the day buttons live here, so it calls this to actually
	 * move DOM focus.
	 */
	export function focusDay(day: string) {
		root?.querySelector<HTMLButtonElement>(`button[data-date="${day}"]`)?.focus();
	}
</script>

<div
	class="calendar"
	class:locked
	role="presentation"
	bind:this={root}
	onpointerleave={() => {
		// Pointer exit must not clear a preview that keyboard focus is
		// driving: if a day cell still owns focus, keep previewing to it.
		const active = document.activeElement;
		onhoverchange(active instanceof HTMLElement && active.dataset.date ? active.dataset.date : null);
	}}
>
	<p class="visually-hidden" aria-live="polite">{liveMessage}</p>
	{#each months as month (month.month)}
		<div class="month" role="group" aria-labelledby="month-{month.month}">
			<h3 class="kicker month-name" id="month-{month.month}">{month.name}</h3>
			<div class="grid">
				{#each weekdays as wd, i (i)}
					<span class="wd" aria-hidden="true">{wd}</span>
				{/each}
				{#each { length: month.leading } as _, i (i)}
					<span class="blank" aria-hidden="true"></span>
				{/each}
				{#each month.days as day (day.iso)}
					{@const s = cellState(day.iso)}
					{#if day.inWindow}
						<button
							class="day"
							class:sel={s.selected}
							class:preview={s.preview}
							class:first-half={s.portion === 'first_half'}
							class:second-half={s.portion === 'second_half'}
							class:active={s.active}
							data-date={day.iso}
							tabindex={day.iso === focusDate ? 0 : -1}
							onclick={() => onactivate(day.iso)}
							onpointerdown={(e) => onpointerdown(day.iso, e)}
							onpointerenter={(e) => onpointerenter(day.iso, e)}
							onfocusin={() => onfocus(day.iso)}
							onkeydown={(e) => onkey(day.iso, e)}
							aria-pressed={s.selected}
							aria-label="{month.name} {day.day}{s.isAnchor
								? ', range start'
								: s.selected
									? ', available' + (s.portion === 'full' ? '' : ', ' + portionLabel(s.portion, 'start'))
									: ''}"
							disabled={locked}
						>
							<span class="num">{day.day}</span>
						</button>
					{:else}
						<span class="day out" aria-hidden="true">{day.day}</span>
					{/if}
				{/each}
			</div>
		</div>
	{/each}
</div>

<style>
	.calendar {
		flex: 1 1 0;
		min-height: 0;
		overflow-y: auto;
		overscroll-behavior: contain;
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		padding-block: var(--space-2);
		touch-action: pan-y;
		scrollbar-width: thin;
		scrollbar-color: var(--ink-35) transparent;
	}

	.calendar.locked {
		opacity: 0.5;
	}

	.month-name {
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

	.day {
		aspect-ratio: 1;
		min-height: 2.35rem;
		display: grid;
		place-items: center;
		font-size: 0.875rem;
		font-weight: 500;
		font-variant-numeric: tabular-nums;
		color: var(--ink);
		border-radius: 6px;
		/* pan-y (not none): a touch starting on a day must still scroll the
		   calendar — selection is tap-tap, not drag, on touch. */
		touch-action: pan-y;
		transition:
			background 0.15s var(--ease-out),
			color 0.15s var(--ease-out);
	}

	/* Hover must not repaint selected/preview cells — tap leaves sticky
	   hover on touch devices, which would gray out the anchored day. */
	.day:not(.out):not(:disabled):not(.sel):not(.preview):hover {
		background: var(--ink-12);
	}

	.day.sel {
		background: var(--ink);
		color: var(--on-pill);
	}

	/* Tentative fill between a pending start and the hovered/focused day —
	   a mid-step between hover (12%) and committed (full ink). */
	.day.preview {
		background: var(--ink-35);
		color: var(--ink);
	}

	.day.sel.first-half {
		background: linear-gradient(to bottom, var(--ink) 50%, var(--ink-12) 50%);
	}

	.day.sel.second-half {
		background: linear-gradient(to top, var(--ink) 50%, var(--ink-12) 50%);
	}

	/* On half-filled cells the numeral crosses white and dark halves;
	   difference-blend keeps it legible over both. */
	.day.sel.first-half .num,
	.day.sel.second-half .num {
		color: #fff;
		mix-blend-mode: difference;
	}

	.day.active {
		box-shadow: 0 0 0 2px var(--ground), 0 0 0 3.5px var(--ink);
	}

	.day.out {
		color: var(--ink-35);
		opacity: 0.45;
	}
</style>
