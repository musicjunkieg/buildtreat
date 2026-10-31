<script lang="ts">
	import Icon from '$lib/ui/Icon.svelte';
	import NextChip from '$lib/ui/NextChip.svelte';
	import { datesQuestion, retreat, type AvailabilityRange, type DayPortion } from '$lib/content';
	import {
		addDays,
		clampToWindow,
		dayOfWeek,
		formatDay,
		formatRange,
		inRange
	} from '$lib/dates';
	import type { SurveyState } from '$lib/survey/survey.svelte';
	import CalendarGrid from './CalendarGrid.svelte';
	import RangeEditor from './RangeEditor.svelte';
	import TypedRangeForm from './TypedRangeForm.svelte';
	import type { CellState } from './grid';

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

	/** The grid instance, for handing DOM focus to the day buttons it owns. */
	let grid = $state<{ focusDay: (day: string) => void } | undefined>();

	/** Index into survey.ranges currently open in the editor; null = closed. */
	let editing = $state<number | null>(null);

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
		grid?.focusDay(target);
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

	function cellState(day: string): CellState {
		const isAnchor = day === anchor;
		const i = rangeIndexOf(day);
		if (i !== -1) {
			const r = survey.ranges[i];
			const isStart = day === r.start;
			const isEnd = day === r.end;
			const portion: DayPortion = isStart && r.startPortion !== 'full' ? r.startPortion : isEnd && r.endPortion !== 'full' ? r.endPortion : 'full';
			return { selected: true, preview: false, portion, isEdge: isStart || isEnd, active: editing === i, isAnchor };
		}
		const selected = day === anchor || inDrag(day);
		return {
			selected,
			preview: !selected && inPreview(day),
			portion: 'full',
			isEdge: false,
			active: false,
			isAnchor
		};
	}

	const editingRange = $derived<AvailabilityRange | null>(editing !== null ? (survey.ranges[editing] ?? null) : null);
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

	<CalendarGrid
		bind:this={grid}
		locked={!signedIn}
		liveMessage={anchorMessage}
		{focusDate}
		{cellState}
		onactivate={dayActivate}
		onpointerdown={pointerDown}
		onpointerenter={pointerEnter}
		onfocus={dayFocus}
		onkey={dayKey}
		onhoverchange={(day) => (hovered = day)}
	/>

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
				<RangeEditor range={editingRange} onsetportion={setPortion} ondelete={deleteEditing} />
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
				<TypedRangeForm hasRanges={survey.ranges.length > 0} onadd={commitRange} />
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
</style>
