<script lang="ts">
	import Icon from '$lib/components/Icon.svelte';
	import { datesQuestion, retreat, type AvailabilityRange, type DayPortion } from '$lib/content';
	import { formatRange, inRange, portionLabel, rangeNights, windowMonths } from '$lib/dates';
	import type { SurveyState } from '$lib/survey.svelte';

	let {
		survey,
		signedIn,
		onsignin
	}: {
		survey: SurveyState;
		signedIn: boolean;
		onsignin: () => void;
	} = $props();

	const months = windowMonths();
	const weekdays = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

	/** In-progress drag selection. */
	let dragStart = $state<string | null>(null);
	let dragEnd = $state<string | null>(null);
	let dragging = $state(false);

	/** Index into survey.ranges currently open in the editor; null = closed. */
	let editing = $state<number | null>(null);

	/** Typed-entry state (accessible alternative). */
	let typedStart = $state('');
	let typedEnd = $state('');
	let typedError = $state('');

	const dragLo = $derived(dragStart && dragEnd ? (dragStart < dragEnd ? dragStart : dragEnd) : null);
	const dragHi = $derived(dragStart && dragEnd ? (dragStart < dragEnd ? dragEnd : dragStart) : null);

	function rangeIndexOf(day: string): number {
		return survey.ranges.findIndex((r) => inRange(day, r));
	}

	function inDrag(day: string): boolean {
		return dragLo !== null && dragHi !== null && day >= dragLo && day <= dragHi;
	}

	function pointerDown(day: string, e: PointerEvent) {
		if (!signedIn) return;
		const existing = rangeIndexOf(day);
		if (existing !== -1) {
			editing = editing === existing ? null : existing;
			return;
		}
		editing = null;
		dragging = true;
		dragStart = day;
		dragEnd = day;
		(e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
	}

	function pointerEnter(day: string) {
		if (dragging) dragEnd = day;
	}

	function pointerUp() {
		if (!dragging || !dragLo || !dragHi) {
			dragging = false;
			return;
		}
		commitRange(dragLo, dragHi);
		dragging = false;
		dragStart = null;
		dragEnd = null;
	}

	function commitRange(start: string, end: string) {
		survey.addRange({ start, end, startPortion: 'full', endPortion: 'full' });
		editing = survey.ranges.findIndex((r) => inRange(start, r));
		survey.saveLocal();
	}

	/** Keyboard flow on day cells: first Enter anchors, second completes. */
	function dayKey(day: string, e: KeyboardEvent) {
		if (!signedIn) return;
		if (e.key !== 'Enter' && e.key !== ' ') return;
		e.preventDefault();
		const existing = rangeIndexOf(day);
		if (existing !== -1) {
			editing = editing === existing ? null : existing;
			return;
		}
		if (dragStart === null) {
			dragStart = day;
			dragEnd = day;
		} else {
			const lo = dragStart < day ? dragStart : day;
			const hi = dragStart < day ? day : dragStart;
			commitRange(lo, hi);
			dragStart = null;
			dragEnd = null;
		}
	}

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
		commitRange(lo, hi);
		typedStart = '';
		typedEnd = '';
	}

	function setPortion(edge: 'start' | 'end', portion: DayPortion) {
		if (editing === null) return;
		survey.updateRange(editing, edge === 'start' ? { startPortion: portion } : { endPortion: portion });
		survey.saveLocal();
	}

	function deleteEditing() {
		if (editing === null) return;
		survey.removeRange(editing);
		editing = null;
		survey.saveLocal();
	}

	function cellState(day: string): { selected: boolean; portion: DayPortion; isEdge: boolean; active: boolean } {
		const i = rangeIndexOf(day);
		if (i !== -1) {
			const r = survey.ranges[i];
			const isStart = day === r.start;
			const isEnd = day === r.end;
			const portion: DayPortion = isStart && r.startPortion !== 'full' ? r.startPortion : isEnd && r.endPortion !== 'full' ? r.endPortion : 'full';
			return { selected: true, portion, isEdge: isStart || isEnd, active: editing === i };
		}
		return { selected: inDrag(day), portion: 'full', isEdge: false, active: false };
	}

	const editingRange = $derived<AvailabilityRange | null>(editing !== null ? (survey.ranges[editing] ?? null) : null);

	const portions: { value: DayPortion; label: string }[] = [
		{ value: 'full', label: 'Full day' },
		{ value: 'first_half', label: 'First half' },
		{ value: 'second_half', label: 'Second half' }
	];
</script>

<div class="dates">
	<h2 id="dates-title" class="display title">{datesQuestion.title}</h2>
	<p class="prompt">{datesQuestion.prompt}</p>

	{#if !signedIn}
		<button class="pill gate" onclick={onsignin}>
			Sign in with Atmosphere to answer
			<Icon name="butterfly" size={17} />
		</button>
	{/if}

	<div
		class="calendar"
		class:locked={!signedIn}
		role="application"
		aria-label="Availability calendar, September 1 to November 15"
		onpointerup={pointerUp}
		onpointercancel={pointerUp}
	>
		{#each months as month (month.month)}
			<div class="month">
				<h3 class="kicker month-name">{month.name}</h3>
				<div class="grid" role="grid">
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
								class:first-half={s.portion === 'first_half'}
								class:second-half={s.portion === 'second_half'}
								class:active={s.active}
								onpointerdown={(e) => pointerDown(day.iso, e)}
								onpointerenter={() => pointerEnter(day.iso)}
								onkeydown={(e) => dayKey(day.iso, e)}
								aria-pressed={s.selected}
								aria-label="{month.name} {day.day}{s.selected ? ', available' + (s.portion === 'full' ? '' : ', ' + portionLabel(s.portion, 'start')) : ''}"
								disabled={!signedIn}
							>
								{day.day}
							</button>
						{:else}
							<span class="day out" aria-hidden="true">{day.day}</span>
						{/if}
					{/each}
				</div>
			</div>
		{/each}
	</div>

	{#if signedIn}
		<div class="under">
			{#if editingRange && editing !== null}
				<div class="editor" role="group" aria-label="Edit range {formatRange(editingRange)}">
					<div class="editor-head">
						<p class="range-label">
							{formatRange(editingRange)}
							<span class="nights">{rangeNights(editingRange)} night{rangeNights(editingRange) === 1 ? '' : 's'}</span>
						</p>
						<button class="icon-btn" onclick={deleteEditing} aria-label="Remove this range">
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
										aria-checked={editingRange.startPortion === p.value}
										class:on={editingRange.startPortion === p.value}
										onclick={() => setPortion('start', p.value)}
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
										aria-checked={editingRange.endPortion === p.value}
										class:on={editingRange.endPortion === p.value}
										onclick={() => setPortion('end', p.value)}
									>
										{p.label}
									</button>
								{/each}
							</div>
						</div>
					</div>
					<p class="hint">{datesQuestion.halfDayHint}</p>
				</div>
			{:else if survey.ranges.length > 0}
				<ul class="chips" aria-label="Your available ranges">
					{#each survey.ranges as range, i (range.start)}
						<li>
							<button class="chip" onclick={() => (editing = i)}>
								{formatRange(range)}
								{#if range.startPortion !== 'full' || range.endPortion !== 'full'}
									<span class="half-dot" aria-hidden="true"></span>
								{/if}
							</button>
						</li>
					{/each}
				</ul>
			{:else}
				<details class="typed">
					<summary>Prefer to type your dates?</summary>
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
			{/if}
		</div>
	{/if}
</div>

<style>
	.dates {
		display: flex;
		flex-direction: column;
		height: 100%;
		gap: var(--space-2);
		padding-top: var(--space-3);
	}

	.title {
		font-size: clamp(2.2rem, 7.5vw, 3.6rem);
	}

	.prompt {
		font-size: 0.9375rem;
		line-height: 1.45;
		color: var(--ink-70);
		max-width: 44ch;
	}

	.gate {
		margin-block: var(--space-2);
	}

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
		touch-action: none;
		transition:
			background 0.15s var(--ease-out),
			color 0.15s var(--ease-out);
	}

	.day:not(.out):not(:disabled):hover {
		background: var(--ink-12);
	}

	.day.sel {
		background: var(--ink);
		color: var(--on-pill);
	}

	.day.sel.first-half {
		background: linear-gradient(to bottom, var(--ink) 50%, var(--ink-12) 50%);
		color: var(--ink);
	}

	.day.sel.second-half {
		background: linear-gradient(to top, var(--ink) 50%, var(--ink-12) 50%);
		color: var(--ink);
	}

	.day.active {
		box-shadow: 0 0 0 2px var(--ground), 0 0 0 3.5px var(--ink);
	}

	.day.out {
		color: var(--ink-35);
		opacity: 0.45;
	}

	.under {
		min-height: 5.5rem;
	}

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

	.chips {
		list-style: none;
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		border-top: var(--hairline);
		padding-top: var(--space-2);
	}

	.chip {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		padding: 0.4rem 0.9rem;
		border: 1px solid var(--ink-45);
		border-radius: 999px;
		font-size: 0.8125rem;
		color: var(--ink);
	}

	.half-dot {
		width: 0.45rem;
		height: 0.45rem;
		border-radius: 999px;
		background: linear-gradient(to bottom, var(--ink) 50%, transparent 50%);
		border: 1px solid var(--ink);
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
