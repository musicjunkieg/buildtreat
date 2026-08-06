<script lang="ts">
	import Icon from '$lib/components/Icon.svelte';
	import { interestQuestion, itemTitles, locations, retreat, travelQuestion, type FeedItemId } from '$lib/content';
	import { formatRange, portionLabel } from '$lib/dates';
	import type { SurveyState } from '$lib/survey.svelte';

	let {
		survey,
		signedIn,
		handle,
		submitting,
		submitted,
		submitError,
		closed = false,
		deadlineDisplay = null,
		onsignin,
		onsubmit,
		onjump
	}: {
		survey: SurveyState;
		signedIn: boolean;
		handle: string | null;
		submitting: boolean;
		submitted: boolean;
		submitError: string | null;
		closed?: boolean;
		deadlineDisplay?: string | null;
		onsignin: () => void;
		onsubmit: () => void;
		onjump: (id: FeedItemId) => void;
	} = $props();

	const interestLabel = $derived(interestQuestion.options.find((o) => o.value === survey.interest)?.label ?? null);
	const travelLabel = $derived(travelQuestion.options.find((o) => o.value === survey.travel)?.label ?? null);
	const rankedNames = $derived(
		survey.ranking.map((id, i) => `${i + 1}. ${locations.find((l) => l.id === id)?.name ?? id}`)
	);

	const rows = $derived(
		[
			{ id: 'you' as FeedItemId, label: 'You', value: survey.youComplete ? `${survey.name} · ${survey.email}` : null },
			{ id: 'interest' as FeedItemId, label: 'Interest', value: interestLabel },
			{ id: 'travel' as FeedItemId, label: 'Travel', value: travelLabel },
			{
				id: 'dates' as FeedItemId,
				label: 'Dates',
				value:
					survey.ranges.length > 0
						? survey.ranges
								.map((r) => {
									let s = formatRange(r);
									const notes = [
										r.startPortion !== 'full' ? `first day ${portionLabel(r.startPortion, 'start')}` : null,
										r.endPortion !== 'full' ? `last day ${portionLabel(r.endPortion, 'end')}` : null
									].filter(Boolean);
									return notes.length ? `${s} (${notes.join(', ')})` : s;
								})
								.join(' · ')
						: null
			},
			{ id: 'location' as FeedItemId, label: 'Location', value: rankedNames.length ? rankedNames.join(' · ') : null }
		].filter((row) => !(survey.interest === 'no' && (row.id === 'travel' || row.id === 'dates' || row.id === 'location')))
	);
</script>

<div class="review">
	<div class="breathe" aria-hidden="true"></div>

	{#if submitted}
		<h2 id="review-title" class="display title">See you out there.</h2>
		<p class="prompt">
			Your answers are in{handle ? ` under @${handle}` : ''}. You can come back and update them any time before the
			survey closes — just sign in again.
		</p>
	{:else}
		<h2 id="review-title" class="display title">One last look.</h2>
		<p class="prompt">Everything you’ve told us. Tap a row to change it.</p>
	{/if}

	<ul class="ledger answers">
		{#each rows as row (row.id)}
			<li>
				<button class="row" onclick={() => onjump(row.id)}>
					<span class="row-label">{row.label}</span>
					{#if row.value}
						<span class="row-value">{row.value}</span>
					{:else}
						<span class="row-missing">not answered yet</span>
					{/if}
				</button>
			</li>
		{/each}
	</ul>

	{#if closed}
		<p class="deadline-note">
			The survey closed {deadlineDisplay ?? ''}. Answers are locked — if something needs fixing,
			<a class="dm" href={retreat.organizerLink} target="_blank" rel="noopener">DM @{retreat.organizerHandle}</a>.
		</p>
	{:else if !signedIn}
		<button class="pill" onclick={onsignin}>
			Sign in with Atmosphere to submit
			<Icon name="butterfly" size={17} />
		</button>
	{:else if submitted}
		<button class="pill ghost" onclick={onsubmit} disabled={submitting}>
			{submitting ? 'Updating…' : 'Update my answers'}
		</button>
		{#if deadlineDisplay}
			<p class="deadline-note">You can update your answers until {deadlineDisplay}, 11:59 PM Pacific.</p>
		{/if}
	{:else}
		<button class="pill" onclick={onsubmit} disabled={!survey.readyToSubmit || submitting}>
			{submitting ? 'Sending…' : survey.readyToSubmit ? 'Send it in' : 'A few answers still missing'}
		</button>
		{#if deadlineDisplay}
			<p class="deadline-note">Responses close {deadlineDisplay}, 11:59 PM Pacific.</p>
		{/if}
	{/if}

	{#if submitError}
		<p class="error" role="alert">{submitError} — your answers are saved on this device; try again in a moment.</p>
	{/if}
</div>

<style>
	.review {
		display: flex;
		flex-direction: column;
		height: 100%;
		gap: var(--space-3);
	}

	.breathe {
		flex: 1 1 auto;
		min-height: 8vh;
	}

	.title {
		font-size: clamp(2.6rem, 9vw, 4.2rem);
	}

	.prompt {
		color: var(--ink-70);
		max-width: 44ch;
		line-height: 1.5;
	}

	.answers {
		margin-block: var(--space-2);
	}

	.answers li {
		display: block;
		padding: 0;
	}

	.row {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: var(--space-3);
		width: 100%;
		padding: 0.7rem 0;
		text-align: left;
		color: inherit;
	}

	.row-label {
		flex: 0 0 auto;
		font-size: var(--text-fact);
		letter-spacing: var(--track-fact);
		text-transform: uppercase;
		font-weight: 500;
		color: var(--ink-70);
	}

	.row-value {
		font-size: 0.9375rem;
		text-align: right;
		line-height: 1.45;
	}

	.row-missing {
		font-size: 0.875rem;
		font-style: italic;
		color: var(--ink-45);
		text-align: right;
	}

	.pill.ghost {
		background: transparent;
		border: 1.5px solid var(--ink);
		color: var(--ink);
	}

	.error {
		font-size: var(--text-author);
		line-height: 1.45;
	}

	.deadline-note .dm {
		color: var(--ink);
		font-weight: 550;
		text-decoration: underline;
		text-underline-offset: 3px;
	}

	.deadline-note {
		font-size: var(--text-author);
		color: var(--ink-70);
		text-align: center;
	}
</style>
