<script lang="ts">
	import { expoOut } from 'svelte/easing';
	import Heatmap from '$lib/organizer/Heatmap.svelte';
	import {
		bestWindows,
		dayLoads,
		fullOverlap,
		slotSet,
		windowFitCount,
		windowRoster
	} from '$lib/organizer/aggregate';
	import { formatDay, parseIso } from '$lib/dates';
	import type { OrganizerResponse } from '$lib/server/organizer/admin';

	let {
		responses,
		anchors,
		anchorBusy,
		anchorsLocked,
		onclear,
		filter,
		onfilter
	}: {
		/** Every response — the all/yes filter is applied in here. */
		responses: OrganizerResponse[];
		/** DIDs anchored in the current scenario. */
		anchors: string[];
		/** True while an anchor mutation is in flight — Clear is locked out. */
		anchorBusy: boolean;
		/** True when the saved anchor set couldn't be read — Clear is disabled. */
		anchorsLocked: boolean;
		onclear: () => void;
		/** Owned by the page (a callback, not bind:) so the rail's location
		 * tally can follow the same toggle. A bind: here would wrap the page's
		 * SSR in a settle loop that drops its <title>. */
		filter: 'all' | 'yes';
		onfilter: (f: 'all' | 'yes') => void;
	} = $props();

	/* ── aggregates ── */

	const filtered = $derived(filter === 'yes' ? responses.filter((r) => r.interest === 'yes') : responses);
	const loads = $derived(dayLoads(filtered));
	// 5 distinct (non-overlapping) candidates — enough to surface real
	// alternatives beyond the single strongest cluster.
	const windows = $derived(bestWindows(filtered, 5));
	const withDates = $derived(filtered.filter((r) => r.ranges.length > 0).length);

	/* ── window-roster drawer: pick a window, see who's in it by name ── */

	let selectedWindow = $state<string | null>(null); // window start iso, or null

	const roster = $derived(
		selectedWindow === null
			? null
			: windowRoster(
					filtered.map((r) => ({ did: r.did, ranges: r.ranges })),
					selectedWindow
				)
	);

	/** Same DID→display-name fallback the scenario chip uses (@handle, else name). */
	const rosterName = (did: string) => {
		const r = responses.find((x) => x.did === did);
		return r ? (r.handle ? `@${r.handle}` : r.name) : did;
	};

	/** Drawer reveal: height + opacity, quick exponential ease-out. This transition
	    compiles to element.animate() (Web Animations API), which the global CSS
	    prefers-reduced-motion reset can't reach — WAAPI runs outside CSS animation
	    properties. The guard has to live here instead. */
	function drawerReveal(node: HTMLElement, { duration = 180 } = {}) {
		if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
			return { duration: 0 };
		}
		const height = node.scrollHeight;
		return {
			duration,
			easing: expoOut,
			css: (t: number) => `height: ${t * height}px; opacity: ${t}; overflow: hidden;`
		};
	}

	/* ── anchor scenario ──
	   Anchors are chosen from ALL responses, independent of the all/yes
	   filter: the scenario asks "when can THESE people make it", and that
	   answer shouldn't shift when the denominator toggle does. */

	const anchorPeople = $derived(
		anchors.map((did) => responses.find((r) => r.did === did)).filter((r): r is OrganizerResponse => r !== undefined)
	);
	const anchorSets = $derived(anchorPeople.map((r) => slotSet(r.ranges)));
	const overlap = $derived(anchors.length > 0 ? fullOverlap(anchorSets) : null);
	const sharedFullDays = $derived(overlap ? [...overlap.values()].filter((o) => o.first && o.second).length : 0);
	const anchorNames = $derived(anchorPeople.map((r) => (r.handle ? `@${r.handle}` : r.name)));

	function fmtWindow(start: string, end: string): string {
		const wd = (s: string) => {
			const p = parseIso(s);
			return new Date(Date.UTC(p.y, p.m - 1, p.d)).toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
		};
		return `${wd(start)} ${formatDay(start)} – ${wd(end)} ${formatDay(end)}`;
	}
</script>

<section aria-labelledby="when-head">
	<div class="section-head">
		<div>
			<h2 class="display section-title" id="when-head">When can they come</h2>
			<p class="section-sub">Sept 1 – Nov 15 · brighter days mean more people</p>
		</div>
		<div class="filter" role="group" aria-label="Which respondents count">
			<button class="filter-btn" class:on={filter === 'all'} onclick={() => onfilter('all')} aria-pressed={filter === 'all'}>
				Everyone
			</button>
			<button class="filter-btn" class:on={filter === 'yes'} onclick={() => onfilter('yes')} aria-pressed={filter === 'yes'}>
				Yes only
			</button>
		</div>
	</div>

	{#if anchors.length > 0}
		<!-- Outside the withDates gate on purpose: anchors are
		     filter-independent, so their status line (and the only
		     Clear affordance) must survive a filter that empties
		     the dated-response set. -->
		<div class="scenario">
			<span class="scenario-kicker">Scenario</span>
			<!-- The live region wraps only the changing text: a control
			     inside role=status would be re-announced on every
			     update and is mishandled by some assistive tech. -->
			<span class="scenario-line" role="status">
				Anchored on {anchorNames.join(', ')} — {sharedFullDays}
				full day{sharedFullDays === 1 ? '' : 's'} they all share
			</span>
			<button
				class="scenario-clear"
				onclick={onclear}
				disabled={anchorBusy || anchorsLocked}
				title={anchorsLocked ? 'Saved anchors could not be loaded — reload to re-enable' : undefined}
				>Clear</button
			>
		</div>
	{/if}

	{#if withDates > 0}
		<Heatmap {loads} total={withDates} {overlap} />

		<ol class="windows" class:with-anchors={anchors.length > 0} aria-label="Best 3-night windows">
			{#each windows as w, i (w.start)}
				{@const fit = anchors.length > 0 ? windowFitCount(anchorSets, w.start) : 0}
				{@const open = selectedWindow === w.start}
				{@const drawerId = `roster-drawer-${w.start}`}
				<li class="window-row" class:best={i === 0}>
					<button
						type="button"
						class="window-toggle"
						class:open
						aria-expanded={open}
						aria-controls={open && roster ? drawerId : undefined}
						onclick={() => (selectedWindow = open ? null : w.start)}
					>
						<span class="window-kicker">{i === 0 ? 'Best window' : `№ ${i + 1}`}</span>
						<span class="window-dates">{fmtWindow(w.start, w.end)}</span>
						<span class="window-count">{w.count} of {w.of} available</span>
						{#if anchors.length > 0}
							<span
								class="window-anchors"
								class:full={fit === anchors.length}
								title={fit === anchors.length
									? 'Every anchored person can make this window'
									: `${fit} of ${anchors.length} anchored people can make this window`}
							>
								<span class="window-anchor-dot" aria-hidden="true"></span>
								{fit}/{anchors.length} anchors
							</span>
						{/if}
					</button>
					{#if open && roster}
						<div
							class="roster-drawer"
							id={drawerId}
							role="group"
							aria-label={`Roster for ${fmtWindow(w.start, w.end)}`}
							transition:drawerReveal
						>
							<div class="roster-group">
								<p class="roster-label">Can make it ({roster.available.length})</p>
								{#if roster.available.length > 0}
									<div class="roster-names">
										{#each roster.available as did (did)}
											<span class="roster-name" class:anchored={anchors.includes(did)}>
												{#if anchors.includes(did)}<span class="roster-anchor-dot" aria-hidden="true"
													></span>{/if}{rosterName(did)}{#if anchors.includes(did)}<span class="visually-hidden">
														(anchored)</span
													>{/if}
											</span>
										{/each}
									</div>
								{:else}
									<p class="roster-empty">No one yet</p>
								{/if}
							</div>
							<div class="roster-sep" aria-hidden="true"></div>
							<div class="roster-group">
								<p class="roster-label">Can't ({roster.unavailable.length})</p>
								{#if roster.unavailable.length > 0}
									<div class="roster-names">
										{#each roster.unavailable as did (did)}
											<span class="roster-name" class:anchored={anchors.includes(did)}>
												{#if anchors.includes(did)}<span class="roster-anchor-dot" aria-hidden="true"
													></span>{/if}{rosterName(did)}{#if anchors.includes(did)}<span class="visually-hidden">
														(anchored)</span
													>{/if}
											</span>
										{/each}
									</div>
								{:else}
									<p class="roster-empty">Everyone with dates can make it</p>
								{/if}
							</div>
						</div>
					{/if}
				</li>
			{/each}
		</ol>
	{:else}
		<p class="section-empty">No availability yet — the heatmap lights up as answers come in.</p>
	{/if}
</section>

<style>
	/* Duplicated from +page.svelte — Svelte scopes <style> per-component,
	   so the page's section/head/sub/empty rules don't reach this component. */
	section {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}

	.section-head {
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		gap: var(--space-3);
		flex-wrap: wrap;
	}

	.section-title {
		/* The documented `place` ramp — section heads sit below the rail title. */
		font-size: clamp(1.35rem, 4.2vw, 1.9rem);
		font-weight: 650;
	}

	.section-sub {
		margin-top: 0.35rem;
		font-size: 0.8125rem;
		color: var(--ink-70);
	}

	.section-empty {
		color: var(--ink-70);
		font-size: 0.9375rem;
		padding: var(--space-3) 0;
		border-top: var(--hairline);
		border-bottom: var(--hairline);
	}

	.filter {
		display: flex;
		border: 1px solid var(--ink-45);
		border-radius: 999px;
		overflow: hidden;
	}

	.filter-btn {
		padding: 0.35rem 0.9rem;
		font-size: 0.8125rem;
		color: var(--ink-70);
		transition:
			background 0.2s var(--ease-out),
			color 0.2s var(--ease-out);
	}

	.filter-btn.on {
		background: var(--ink);
		color: var(--on-pill);
		font-weight: 600;
	}

	.windows {
		list-style: none;
	}

	.window-row {
		border-top: var(--hairline);
	}

	/* The row's own affordance: a real button carrying the existing grid
	   layout, dimmed to 70% ink when closed, full ink when its drawer is
	   open — the row itself is the "selected" indicator. */
	.window-toggle {
		display: grid;
		grid-template-columns: 7.5rem 1fr auto;
		grid-template-areas: 'kicker dates count';
		align-items: baseline;
		gap: var(--space-3);
		width: 100%;
		padding: 0.65rem 0;
		font-size: 0.9375rem;
		text-align: left;
		opacity: 0.7;
		transition: opacity 0.2s var(--ease-out);
	}

	.window-toggle:hover,
	.window-toggle:focus-visible,
	.window-toggle.open {
		opacity: 1;
	}

	.windows.with-anchors .window-toggle {
		grid-template-columns: 7.5rem 1fr auto auto;
		grid-template-areas: 'kicker dates count anchors';
	}

	.window-kicker {
		grid-area: kicker;
	}

	.window-dates {
		grid-area: dates;
	}

	.window-count {
		grid-area: count;
	}

	/* Narrow screens: the row stacks into two lines so the dates keep a full
	   measure instead of wrapping word-per-line beside three other columns. */
	@media (max-width: 640px) {
		.window-toggle,
		.windows.with-anchors .window-toggle {
			grid-template-columns: 1fr auto;
			grid-template-areas:
				'kicker anchors'
				'dates dates'
				'count count';
			row-gap: 0.2rem;
		}
	}

	/* ── window-roster drawer ── */

	.roster-drawer {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		padding-bottom: var(--space-2);
	}

	.roster-group {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.roster-label {
		font-size: 0.6875rem;
		font-weight: 500;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--ink-45);
	}

	.roster-names {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem var(--space-3);
	}

	.roster-name {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		/* DESIGN.md's `compact` interim step — dense name lists, review values. */
		font-size: 0.9375rem;
		font-weight: 400;
		line-height: 1.45;
		color: var(--ink-70);
	}

	.roster-name.anchored {
		color: var(--ink);
	}

	.roster-anchor-dot {
		width: 0.6rem;
		height: 0.6rem;
		flex-shrink: 0;
		border-radius: 999px;
		border: 1.5px solid currentcolor;
		background: var(--ink);
	}

	.roster-empty {
		font-size: var(--text-author);
		color: var(--ink-45);
	}

	.roster-sep {
		border-top: 1px dotted var(--ink-12);
	}

	/* ── anchor scenario ── */

	.scenario {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 0.6rem var(--space-3);
		padding: 0.55rem 0;
		border-top: var(--hairline);
		border-bottom: var(--hairline);
		margin-bottom: var(--space-3);
		font-size: 0.9375rem;
	}

	.scenario-kicker {
		font-size: 0.6875rem;
		font-weight: 500;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--ink);
	}

	.scenario-line {
		color: var(--ink-70);
	}

	.scenario-clear {
		margin-left: auto;
		font-size: 0.8125rem;
		color: var(--ink-70);
		text-decoration: underline;
		text-underline-offset: 3px;
	}

	.scenario-clear:hover {
		color: var(--ink);
	}

	.window-anchors {
		grid-area: anchors;
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		font-size: 0.8125rem;
		font-variant-numeric: tabular-nums;
		/* ink-70, not ink-45: the count is data and must clear AA contrast;
		   the hollow-vs-filled dot still separates partial from full. */
		color: var(--ink-70);
		white-space: nowrap;
	}

	.window-anchors.full {
		color: var(--ink);
	}

	.window-anchor-dot {
		width: 0.6rem;
		height: 0.6rem;
		border-radius: 999px;
		border: 1.5px solid currentcolor;
		align-self: center;
	}

	.window-anchors.full .window-anchor-dot {
		background: var(--ink);
	}

	.window-row:last-child {
		border-bottom: var(--hairline);
	}

	.window-kicker {
		font-size: 0.6875rem;
		font-weight: 500;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--ink-45);
	}

	.window-row.best .window-kicker {
		color: var(--ink);
	}

	.window-dates {
		font-weight: 550;
	}

	.window-row:not(.best) .window-dates {
		color: var(--ink-70);
		font-weight: 400;
	}

	.window-count {
		font-variant-numeric: tabular-nums;
		color: var(--ink-70);
	}

	.window-row.best .window-count {
		color: var(--ink);
	}
</style>
