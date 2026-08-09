<script lang="ts">
	import Icon from '$lib/components/Icon.svelte';
	import NextChip from '$lib/components/NextChip.svelte';
	import { datesQuestion, retreat, type AvailabilityRange, type DayPortion } from '$lib/content';
	import {
		addDays,
		clampToWindow,
		dayOfWeek,
		formatDay,
		formatRange,
		inRange,
		portionLabel,
		rangeNights,
		windowMonths
	} from '$lib/dates';
	import type { SurveyState } from '$lib/survey.svelte';

	let {
		survey,
		signedIn,
		onsignin,
		onnext
	}: {
		survey: SurveyState;
		signedIn: boolean;
		onsignin: () => void;
		onnext?: () => void;
	} = $props();

	const months = windowMonths();
	const weekdays = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

	/**
	 * Pending range start (bits-ui style tap-anchor / tap-complete flow).
	 * Set by the first tap/Enter on an empty day; the next tap completes
	 * the range, filling in every day between.
	 */
	let anchor = $state<string | null>(null);

	/** Day under the pointer or keyboard focus — drives the range preview. */
	let hovered = $state<string | null>(null);

	/** In-progress drag selection (mouse only; touch taps + scrolls instead). */
	let dragStart = $state<string | null>(null);
	let dragEnd = $state<string | null>(null);
	let dragging = $state(false);

	/** Swallows the synthetic click that follows a completed drag. */
	let suppressClick = false;

	/** Roving-tabindex focus target so arrow keys walk the grid. */
	let focusDate = $state<string>(retreat.window.start);

	/** Index into survey.ranges currently open in the editor; null = closed. */
	let editing = $state<number | null>(null);

	/** Typed-entry state (accessible alternative). */
	let typedStart = $state('');
	let typedEnd = $state('');
	let typedError = $state('');

	const dragLo = $derived(dragStart && dragEnd ? (dragStart < dragEnd ? dragStart : dragEnd) : null);
	const dragHi = $derived(dragStart && dragEnd ? (dragStart < dragEnd ? dragEnd : dragStart) : null);

	/** Prospective range while an anchor is set and the pointer/focus roams. */
	const previewLo = $derived(anchor && hovered ? (anchor < hovered ? anchor : hovered) : null);
	const previewHi = $derived(anchor && hovered ? (anchor < hovered ? hovered : anchor) : null);

	function rangeIndexOf(day: string): number {
		return survey.ranges.findIndex((r) => inRange(day, r));
	}

	function inDrag(day: string): boolean {
		return dragLo !== null && dragHi !== null && day >= dragLo && day <= dragHi;
	}

	function inPreview(day: string): boolean {
		return previewLo !== null && previewHi !== null && day >= previewLo && day <= previewHi;
	}

	function pointerDown(day: string, e: PointerEvent) {
		if (!signedIn || e.pointerType !== 'mouse') return;
		if (anchor !== null || rangeIndexOf(day) !== -1) return;
		editing = null;
		dragStart = day;
		dragEnd = day;
	}

	function pointerEnter(day: string, e: PointerEvent) {
		if (dragStart !== null && e.buttons === 1) {
			dragging = true;
			dragEnd = day;
		} else {
			hovered = day;
		}
	}

	function pointerUp() {
		if (dragging && dragLo && dragHi) {
			commitRange(dragLo, dragHi);
			announce(`Added ${formatDay(dragLo)} to ${formatDay(dragHi)}.`);
			suppressClick = true;
			setTimeout(() => (suppressClick = false), 0);
		}
		dragging = false;
		dragStart = null;
		dragEnd = null;
	}

	function commitRange(start: string, end: string) {
		survey.addRange({ start, end, startPortion: 'full', endPortion: 'full' });
		editing = survey.ranges.findIndex((r) => inRange(start, r));
		survey.saveLocal();
	}

	function cancelPending() {
		anchor = null;
		dragging = false;
		dragStart = null;
		dragEnd = null;
	}

	/** Announced to assistive tech as the selection flow progresses. */
	let anchorMessage = $state('');

	function announce(msg: string) {
		anchorMessage = msg;
	}

	/**
	 * Shared tap/Enter flow (bits-ui RangeCalendar model): first activation
	 * anchors the start, the second fills in the range between — in either
	 * direction. Activating a committed range opens its editor.
	 */
	function dayActivate(day: string) {
		if (suppressClick) {
			suppressClick = false;
			return;
		}
		if (!signedIn || dragging) return;
		const existing = rangeIndexOf(day);
		if (existing !== -1) {
			anchor = null;
			editing = editing === existing ? null : existing;
			return;
		}
		if (anchor === null) {
			editing = null;
			anchor = day;
			announce(
				`Range starts ${formatDay(day)}. Choose an end date — or the same date for a single day.`
			);
		} else {
			const lo = anchor < day ? anchor : day;
			const hi = anchor < day ? day : anchor;
			commitRange(lo, hi);
			announce(lo === hi ? `Added ${formatDay(lo)}.` : `Added ${formatDay(lo)} to ${formatDay(hi)}.`);
			anchor = null;
		}
	}

	/** Move roving focus to `day`, clamped into the availability window. */
	function moveFocus(day: string) {
		const target = clampToWindow(day);
		focusDate = target;
		document
			.querySelector<HTMLButtonElement>(`.calendar button[data-date="${target}"]`)
			?.focus();
	}

	function dayKey(day: string, e: KeyboardEvent) {
		if (!signedIn) return;
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			dayActivate(day);
			return;
		}
		const step: Record<string, number> = {
			ArrowLeft: -1,
			ArrowRight: 1,
			ArrowUp: -7,
			ArrowDown: 7
		};
		if (e.key in step) {
			e.preventDefault();
			moveFocus(addDays(day, step[e.key]));
		} else if (e.key === 'Home') {
			e.preventDefault();
			moveFocus(addDays(day, -dayOfWeek(day)));
		} else if (e.key === 'End') {
			e.preventDefault();
			moveFocus(addDays(day, 6 - dayOfWeek(day)));
		}
	}

	function dayFocus(day: string) {
		focusDate = day;
		hovered = day;
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

	function cellState(day: string): {
		selected: boolean;
		preview: boolean;
		portion: DayPortion;
		isEdge: boolean;
		active: boolean;
	} {
		const i = rangeIndexOf(day);
		if (i !== -1) {
			const r = survey.ranges[i];
			const isStart = day === r.start;
			const isEnd = day === r.end;
			const portion: DayPortion = isStart && r.startPortion !== 'full' ? r.startPortion : isEnd && r.endPortion !== 'full' ? r.endPortion : 'full';
			return { selected: true, preview: false, portion, isEdge: isStart || isEnd, active: editing === i };
		}
		const selected = day === anchor || inDrag(day);
		return {
			selected,
			preview: !selected && inPreview(day),
			portion: 'full',
			isEdge: false,
			active: false
		};
	}

	const editingRange = $derived<AvailabilityRange | null>(editing !== null ? (survey.ranges[editing] ?? null) : null);

	const portions: { value: DayPortion; label: string }[] = [
		{ value: 'full', label: 'Full day' },
		{ value: 'first_half', label: 'First half' },
		{ value: 'second_half', label: 'Second half' }
	];
</script>

<svelte:window
	onpointerup={pointerUp}
	onpointercancel={pointerUp}
	onkeydown={(e) => {
		if (e.key === 'Escape' && anchor !== null) {
			cancelPending();
			announce('Range start cleared.');
		}
	}}
/>

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
		role="presentation"
		onpointerleave={() => {
			// Pointer exit must not clear a preview that keyboard focus is
			// driving: if a day cell still owns focus, keep previewing to it.
			const active = document.activeElement;
			hovered = active instanceof HTMLElement && active.dataset.date ? active.dataset.date : null;
		}}
	>
		<p class="visually-hidden" aria-live="polite">{anchorMessage}</p>
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
								onclick={() => dayActivate(day.iso)}
								onpointerdown={(e) => pointerDown(day.iso, e)}
								onpointerenter={(e) => pointerEnter(day.iso, e)}
								onfocusin={() => dayFocus(day.iso)}
								onkeydown={(e) => dayKey(day.iso, e)}
								aria-pressed={s.selected}
								aria-label="{month.name} {day.day}{day.iso === anchor
									? ', range start'
									: s.selected
										? ', available' + (s.portion === 'full' ? '' : ', ' + portionLabel(s.portion, 'start'))
										: ''}"
								disabled={!signedIn}
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

	{#if signedIn}
		<div class="under">
			{#if anchor !== null}
				<div class="pending" role="status">
					<p class="hint">
						<strong>Starts {formatDay(anchor)}</strong> — tap your last day to fill in the range, or the
						same day again for just that day.
					</p>
					<button
						class="icon-btn"
						onclick={() => {
							cancelPending();
							announce('Range start cleared.');
						}}
						aria-label="Cancel range start"
					>
						<Icon name="x" size={16} />
					</button>
				</div>
			{:else if editingRange && editing !== null}
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
			{:else}
				{#if survey.ranges.length > 0}
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
				{/if}
				<details class="typed">
					<summary>{survey.ranges.length > 0 ? 'Add another range by typing' : 'Prefer to type your dates?'}</summary>
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
				{#if onnext}
					<NextChip show={survey.ranges.length > 0} {onnext} />
				{/if}
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

	.under {
		min-height: 5.5rem;
	}

	.pending {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2);
		border-top: var(--hairline);
		padding-top: var(--space-2);
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
