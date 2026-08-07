<script lang="ts">
	import Icon from '$lib/components/Icon.svelte';
	import { locations, NO_PREFERENCE, type TravelValue } from '$lib/content';
	import { formatRange, portionLabel } from '$lib/dates';
	import type { OrganizerResponse } from '$lib/server/organizer';

	let {
		responses,
		avatars
	}: {
		responses: OrganizerResponse[];
		/** did → avatar URL, resolved client-side from the public appview. */
		avatars: Map<string, string>;
	} = $props();

	const locationName = new Map(locations.map((l) => [l.id, l.name]));

	const travelLabel: Record<TravelValue, string> = {
		yes: 'Covered',
		partial: 'Needs some help',
		no: 'Needs full help'
	};

	type SortKey = 'updated' | 'name' | 'interest';
	let sortBy = $state<SortKey>('updated');
	let expanded = $state<string | null>(null);

	const interestOrder = { yes: 0, maybe: 1, no: 2 };

	const sorted = $derived(
		[...responses].sort((a, b) => {
			if (sortBy === 'name') return a.name.localeCompare(b.name);
			if (sortBy === 'interest') return interestOrder[a.interest] - interestOrder[b.interest];
			return b.updatedAt.localeCompare(a.updatedAt);
		})
	);

	function shortDate(iso: string): string {
		const d = new Date(iso);
		return d.toLocaleDateString('en-US', { timeZone: 'America/Los_Angeles', month: 'short', day: 'numeric' });
	}

	function rankingLine(r: OrganizerResponse): string {
		if (r.ranking.includes(NO_PREFERENCE)) return 'No preference — they all sound great';
		if (r.ranking.length === 0) return '—';
		return r.ranking.map((id, i) => `${i + 1}. ${locationName.get(id) ?? id}`).join('   ');
	}

	function edgeNote(portion: string, edge: 'start' | 'end'): string {
		return portion === 'full' ? '' : ` (${portionLabel(portion as 'first_half' | 'second_half', edge)})`;
	}

	const headers: { key: SortKey | null; label: string; class?: string }[] = [
		{ key: null, label: 'Respondent' },
		{ key: 'name', label: 'Name' },
		{ key: null, label: 'From', class: 'col-city' },
		{ key: 'interest', label: 'In?' },
		{ key: null, label: 'Travel', class: 'col-travel' },
		{ key: null, label: 'Dates' },
		{ key: 'updated', label: 'Updated', class: 'col-updated' }
	];
</script>

<table class="table">
	<thead>
		<tr>
			<th class="expand-col"><span class="visually-hidden">Details</span></th>
			{#each headers as h (h.label)}
				<th class={h.class}>
					{#if h.key}
						<button class="sort" class:on={sortBy === h.key} onclick={() => (sortBy = h.key!)}>
							{h.label}{#if sortBy === h.key}<Icon name="chevron-down" size={12} />{/if}
						</button>
					{:else}
						{h.label}
					{/if}
				</th>
			{/each}
		</tr>
	</thead>
	<tbody>
		{#each sorted as r (r.did)}
			{@const open = expanded === r.did}
			<tr class="row" class:open>
				<td class="expand-col">
					<button
						class="expand"
						onclick={() => (expanded = open ? null : r.did)}
						aria-expanded={open}
						aria-label="{open ? 'Hide' : 'Show'} details for {r.name}"
					>
						<Icon name="chevron-down" size={14} />
					</button>
				</td>
				<td>
					<span class="who">
						{#if avatars.get(r.did)}
							<img class="avatar" src={avatars.get(r.did)} alt="" loading="lazy" />
						{:else}
							<span class="avatar fallback" aria-hidden="true"><Icon name="person" size={13} /></span>
						{/if}
						<span class="handle">{r.handle ? `@${r.handle}` : r.did.slice(0, 14) + '…'}</span>
					</span>
				</td>
				<td class="name">{r.name}</td>
				<td class="col-city muted">{r.homeLocation}</td>
				<td class="interest" data-v={r.interest}>{r.interest.toUpperCase()}</td>
				<td class="col-travel muted">{r.travel ? travelLabel[r.travel] : '—'}</td>
				<td class="num">{r.ranges.length || '—'}</td>
				<td class="col-updated muted">{shortDate(r.updatedAt)}</td>
			</tr>
			{#if open}
				<tr class="detail">
					<td></td>
					<td colspan="7">
						<div class="detail-grid">
							<div>
								<span class="kicker">Email</span>
								<p><a class="mail" href="mailto:{r.email}">{r.email}</a></p>
							</div>
							<div>
								<span class="kicker">Availability</span>
								{#if r.ranges.length > 0}
									<ul class="range-list">
										{#each r.ranges as g (g.start)}
											<li>
												{formatRange(g)}{edgeNote(g.startPortion, 'start')}{edgeNote(g.endPortion, 'end')}
											</li>
										{/each}
									</ul>
								{:else}
									<p class="muted">No dates given</p>
								{/if}
							</div>
							<div>
								<span class="kicker">Locations</span>
								<p>{rankingLine(r)}</p>
							</div>
						</div>
					</td>
				</tr>
			{/if}
		{/each}
	</tbody>
</table>

{#if responses.length === 0}
	<p class="empty">No responses yet. When builders submit the survey, they land here.</p>
{/if}

<style>
	.table {
		width: 100%;
		border-collapse: collapse;
	}

	th {
		text-align: left;
		font-size: 0.6875rem;
		font-weight: 500;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--ink-70);
		padding: 0.55rem 0.75rem 0.55rem 0;
		border-bottom: var(--hairline);
		white-space: nowrap;
	}

	.sort {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		font: inherit;
		letter-spacing: inherit;
		text-transform: inherit;
		color: inherit;
	}

	.sort:hover,
	.sort.on {
		color: var(--ink);
	}

	td {
		padding: 0.65rem 0.75rem 0.65rem 0;
		border-bottom: 1px solid rgba(255, 255, 255, 0.14);
		font-size: 0.9375rem;
		vertical-align: middle;
	}

	.expand-col {
		width: 1.9rem;
		padding-right: 0.4rem;
	}

	.expand {
		display: grid;
		place-items: center;
		width: 1.6rem;
		height: 1.6rem;
		border-radius: 999px;
		color: var(--ink-45);
		transition:
			color 0.15s var(--ease-out),
			rotate 0.2s var(--ease-out);
	}

	.row:hover .expand,
	.expand:hover {
		color: var(--ink);
	}

	.row.open .expand {
		rotate: 180deg;
		color: var(--ink);
	}

	.who {
		display: inline-flex;
		align-items: center;
		gap: 0.55rem;
	}

	.avatar {
		width: 1.9rem;
		height: 1.9rem;
		border-radius: 999px;
		object-fit: cover;
		border: 1px solid var(--ink-45);
	}

	.avatar.fallback {
		display: grid;
		place-items: center;
		color: var(--ink-70);
	}

	.handle {
		font-weight: 550;
		white-space: nowrap;
	}

	.name {
		white-space: nowrap;
	}

	.muted {
		color: var(--ink-70);
	}

	.interest {
		font-size: 0.75rem;
		font-weight: 600;
		letter-spacing: 0.1em;
	}

	.interest[data-v='maybe'] {
		color: var(--ink-70);
	}

	.interest[data-v='no'] {
		color: var(--ink-45);
	}

	.num {
		font-variant-numeric: tabular-nums;
	}

	.detail td {
		padding-top: 0.2rem;
		padding-bottom: var(--space-3);
	}

	.detail-grid {
		display: grid;
		grid-template-columns: minmax(12rem, 1fr) 2fr 2fr;
		gap: var(--space-3) var(--space-4);
		padding-top: var(--space-2);
	}

	.detail-grid .kicker {
		display: block;
		color: var(--ink-45);
		margin-bottom: 0.35rem;
	}

	.detail-grid p,
	.range-list {
		font-size: 0.9375rem;
		line-height: 1.5;
	}

	.range-list {
		list-style: none;
	}

	.mail {
		color: var(--ink);
		text-decoration: underline;
		text-underline-offset: 3px;
	}

	.empty {
		padding: var(--space-4) 0;
		color: var(--ink-70);
		font-size: 0.9375rem;
	}

	@media (max-width: 1100px) {
		.col-city {
			display: none;
		}
	}

	@media (max-width: 900px) {
		.col-updated,
		.col-travel {
			display: none;
		}

		.name {
			white-space: normal;
		}

		.detail-grid {
			grid-template-columns: 1fr;
			gap: var(--space-2);
		}
	}
</style>
