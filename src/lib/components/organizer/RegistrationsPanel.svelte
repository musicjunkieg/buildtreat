<script lang="ts">
	import { dietaryOptions, travelModes } from '$lib/content';
	// Type-only: $lib/server/registration is a server module, and SvelteKit's
	// illegal-import guard blocks any RUNTIME import from it reaching the
	// browser bundle — `import type` is erased entirely by the compiler, so
	// it never shows up in the resolved module graph. The pure functions
	// (isRegistered, travelStatus, registrationCounts, noResponseHandles)
	// live server-side in +page.server.ts instead; this component only
	// receives their already-computed results as props.
	import type { Registration, RegistrationCounts, TravelStatus } from '$lib/server/registration';
	import type { AllowlistEntry } from '$lib/server/organizer';

	type RegistrationRow = Registration & { travel: TravelStatus; registered: boolean };

	let {
		registrations,
		counts,
		missing,
		deadlineDisplay,
		closed
	}: {
		registrations: RegistrationRow[];
		counts: RegistrationCounts;
		missing: AllowlistEntry[];
		deadlineDisplay: string | null;
		closed: boolean;
	} = $props();

	const confirmed = $derived(registrations.filter((r) => r.status === 'confirmed'));
	const declined = $derived(registrations.filter((r) => r.status === 'declined'));

	function diet(r: RegistrationRow): string {
		const labels = r.dietary.map((id) => dietaryOptions.find((o) => o.id === id)?.label ?? id);
		if (r.dietaryOther) labels.push(r.dietaryOther);
		return labels.join(', ') || '—';
	}
	function mode(r: RegistrationRow): string {
		return r.travelMode ? (travelModes.find((m) => m.id === r.travelMode)?.label ?? r.travelMode) : '—';
	}
	function when(iso: string): string {
		return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
	}
</script>

<section aria-labelledby="reg-head">
	<div class="section-head">
		<h2 id="reg-head" class="display section-title">Registrations</h2>
		<p class="section-sub">
			{#if closed}Closed {deadlineDisplay}{:else if deadlineDisplay}Register by {deadlineDisplay}{/if}
			· <a class="quiet" href="/organizer/registrations.csv">Download CSV</a>
		</p>
	</div>

	<ul class="ledger counts">
		<li><span class="kicker">Confirmed</span><span class="n">{counts.confirmed}</span></li>
		<li><span class="kicker">Fully registered</span><span class="n">{counts.registered}</span></li>
		<li><span class="kicker">Declined</span><span class="n">{counts.declined}</span></li>
		<li><span class="kicker">No response yet</span><span class="n">{counts.noResponse}</span></li>
	</ul>

	{#if confirmed.length === 0}
		<p class="section-empty">No one has registered yet.</p>
	{:else}
		<div class="table-wrap">
			<table class="reg-table">
				<thead>
					<tr><th class="kicker">Who</th><th class="kicker">Food</th><th class="kicker">Access</th><th class="kicker">Travel</th><th class="kicker">Agreed</th><th class="kicker">Updated</th></tr>
				</thead>
				<tbody>
					{#each confirmed as r (r.did)}
						<tr>
							<td><strong>{r.name}</strong><br /><span class="dim">{r.handle ? `@${r.handle}` : r.did.slice(0, 16)}</span></td>
							<td>{diet(r)}</td>
							<td class:dim={!r.accessibility}>{r.accessibility || '—'}</td>
							<td><span class="kicker status-{r.travel}">{r.travel}</span><br /><span class="dim">{mode(r)}{r.travelArrival ? ` · ${r.travelArrival}` : ''}{r.travelDeparture ? ` → ${r.travelDeparture}` : ''}</span></td>
							<td>{r.registered ? `${r.waiverVersion} / ${r.cocVersion}` : '—'}</td>
							<td class="dim">{when(r.updatedAt)}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}

	{#if declined.length}
		<details class="sub">
			<summary class="kicker">Declined · {declined.length}</summary>
			<ul class="plain">{#each declined as r (r.did)}<li>{r.name} <span class="dim">{r.handle ? `@${r.handle}` : ''}</span></li>{/each}</ul>
		</details>
	{/if}

	{#if missing.length}
		<details class="sub">
			<summary class="kicker">No response yet · {missing.length}</summary>
			<ul class="plain">{#each missing as m (m.handle)}<li>@{m.handle}</li>{/each}</ul>
		</details>
	{/if}
</section>

<style>
	.section-head { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: var(--space-2); }
	.section-title { font-size: clamp(1.35rem, 4.2vw, 1.9rem); font-weight: 650; letter-spacing: 0.01em; }
	.section-sub { margin-top: 0.35rem; font-size: 0.8125rem; color: var(--ink-70); }
	.section-empty { color: var(--ink-70); font-size: 0.9375rem; padding: 0.65rem 0; border-top: var(--hairline); border-bottom: var(--hairline); }
	.quiet { color: var(--ink-70); text-decoration: underline; text-underline-offset: 3px; }
	.quiet:hover { color: var(--ink); }
	.counts { margin: var(--space-3) 0; }
	.counts .kicker { color: var(--ink-70); }
	.counts .n { font-family: var(--font-display); font-weight: 700; font-size: 1.6rem; line-height: 0.92; font-variant-numeric: tabular-nums; }
	.table-wrap { overflow-x: auto; }
	.reg-table { width: 100%; border-collapse: collapse; font-size: 0.9375rem; }
	.reg-table th { text-align: left; padding: 0.5rem 0.6rem 0.5rem 0; border-bottom: var(--hairline); color: var(--ink-70); }
	.reg-table td { vertical-align: top; padding: 0.7rem 0.6rem 0.7rem 0; border-bottom: 1px solid rgba(255, 255, 255, 0.14); }
	.dim { color: var(--ink-70); }
	.status-none { color: var(--ink-45); }
	.status-partial { color: var(--ink-70); }
	.status-complete { color: var(--ink); }
	.sub { margin-top: var(--space-3); }
	.sub summary { cursor: pointer; color: var(--ink-70); }
	.plain { list-style: none; margin-top: var(--space-2); display: grid; gap: 0.35rem; font-size: 0.9375rem; }
</style>
