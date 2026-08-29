<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { expoOut } from 'svelte/easing';
	import { deserialize, enhance } from '$app/forms';
	import { login } from '@svelte-atproto/oauth/client';
	import Icon from '$lib/components/Icon.svelte';
	import EmailPanel from '$lib/components/organizer/EmailPanel.svelte';
	import Heatmap from '$lib/components/organizer/Heatmap.svelte';
	import RegistrationsPanel from '$lib/components/organizer/RegistrationsPanel.svelte';
	import ResponsesTable from '$lib/components/organizer/ResponsesTable.svelte';
	import {
		bestWindows,
		dayLoads,
		fullOverlap,
		locationTallies,
		slotSet,
		windowFitCount,
		windowRoster
	} from '$lib/organizer/aggregate';
	import { locations, retreat } from '$lib/content';
	import { formatDay, parseIso } from '$lib/dates';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	/* ── sign-in (signed-out state) ── */

	let handle = $state('');
	let busy = $state(false);
	let signinError = $state<string | null>(null);

	async function signIn() {
		const clean = handle.trim().replace(/^@/, '');
		if (!clean || busy) return;
		busy = true;
		signinError = null;
		try {
			await login(clean);
		} catch (e) {
			signinError = e instanceof Error ? e.message : 'Sign-in failed — try again';
			busy = false;
		}
	}

	/* ── aggregates ── */

	let filter = $state<'all' | 'yes'>('all');

	const filtered = $derived(filter === 'yes' ? data.responses.filter((r) => r.interest === 'yes') : data.responses);
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
		const r = data.responses.find((x) => x.did === did);
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
	const tallies = $derived(locationTallies(filtered.map((r) => r.ranking)));
	const maxPoints = $derived(Math.max(1, ...tallies.tallies.map((t) => t.points)));

	const locationName = new Map(locations.map((l) => [l.id, l.name]));

	/* ── anchor scenario ──
	   Anchors are chosen from ALL responses, independent of the all/yes
	   filter: the scenario asks "when can THESE people make it", and that
	   answer shouldn't shift when the denominator toggle does. */

	let anchors = $state<string[]>(untrack(() => data.anchors));
	let anchorBusy = $state(false);

	/** Optimistic toggle, persisted via ?/toggleAnchor; rolls back on failure.
	    anchorBusy is a shared mutation lock: toggles and Clear are serialized
	    so a quick on/off can't complete out of order, and nothing mutates when
	    the load couldn't read the saved set (data.anchorsUnavailable). */
	async function toggleAnchor(did: string) {
		if (anchorBusy || data.anchorsUnavailable) return;
		const on = !anchors.includes(did);
		const prev = anchors;
		anchors = on ? [...anchors, did] : anchors.filter((d) => d !== did);
		if (data.preview) return;
		anchorBusy = true;
		const body = new FormData();
		body.set('did', did);
		body.set('on', on ? '1' : '0');
		try {
			const res = await fetch('?/toggleAnchor', { method: 'POST', body });
			const result = deserialize(await res.text());
			if (result.type === 'failure' || result.type === 'error') anchors = prev;
		} catch {
			anchors = prev;
		} finally {
			anchorBusy = false;
		}
	}

	async function clearAnchors() {
		if (anchorBusy || data.anchorsUnavailable) return;
		anchorBusy = true;
		const prev = anchors;
		anchors = [];
		if (data.preview) {
			anchorBusy = false;
			return;
		}
		try {
			const res = await fetch('?/clearAnchors', { method: 'POST', body: new FormData() });
			const result = deserialize(await res.text());
			if (result.type === 'failure' || result.type === 'error') anchors = prev;
		} catch {
			anchors = prev;
		} finally {
			anchorBusy = false;
		}
	}

	const anchorPeople = $derived(
		anchors
			.map((did) => data.responses.find((r) => r.did === did))
			.filter((r): r is (typeof data.responses)[number] => r !== undefined)
	);
	const anchorSets = $derived(anchorPeople.map((r) => slotSet(r.ranges)));
	const overlap = $derived(anchors.length > 0 ? fullOverlap(anchorSets) : null);
	const sharedFullDays = $derived(overlap ? [...overlap.values()].filter((o) => o.first && o.second).length : 0);
	const anchorNames = $derived(anchorPeople.map((r) => (r.handle ? `@${r.handle}` : r.name)));

	/* ── waitlist ── */
	const waitlistWaiting = $derived(data.waitlist.filter((w) => !w.promotedAt));
	const waitlistPromoted = $derived(data.waitlist.filter((w) => w.promotedAt));
	function joinedDate(iso: string): string {
		return new Date(iso).toLocaleDateString('en-US', {
			timeZone: 'America/Los_Angeles',
			month: 'short',
			day: 'numeric'
		});
	}

	const stats = $derived({
		total: data.responses.length,
		yes: data.responses.filter((r) => r.interest === 'yes').length,
		maybe: data.responses.filter((r) => r.interest === 'maybe').length,
		no: data.responses.filter((r) => r.interest === 'no').length,
		travelHelp: data.responses.filter((r) => r.travel === 'partial' || r.travel === 'no').length
	});

	const daysLeft = $derived(
		data.deadline ? Math.max(0, Math.ceil((Date.parse(data.deadline) - Date.now()) / 86_400_000)) : null
	);

	const deadlineLine = $derived(
		data.reopened
			? 'Reopened — accepting answers'
			: data.deadlinePassed
				? `Closed ${data.deadlineDisplay}`
				: `Closes ${data.deadlineDisplay}`
	);

	function fmtWindow(start: string, end: string): string {
		const wd = (s: string) => {
			const p = parseIso(s);
			return new Date(Date.UTC(p.y, p.m - 1, p.d)).toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
		};
		return `${wd(start)} ${formatDay(start)} – ${wd(end)} ${formatDay(end)}`;
	}

	/* ── avatars, resolved from the public appview in batches ── */

	let avatars = $state(new Map<string, string>());

	onMount(async () => {
		const dids = data.responses.map((r) => r.did).filter((d) => !d.startsWith('did:plc:preview'));
		const next = new Map<string, string>();
		for (let i = 0; i < dids.length; i += 25) {
			const batch = dids.slice(i, i + 25);
			try {
				const qs = batch.map((d) => `actors=${encodeURIComponent(d)}`).join('&');
				const res = await fetch(`https://public.api.bsky.app/xrpc/app.bsky.actor.getProfiles?${qs}`, {
					signal: AbortSignal.timeout(5000)
				});
				if (!res.ok) continue;
				const json = (await res.json()) as { profiles?: { did: string; avatar?: string }[] };
				for (const p of json.profiles ?? []) {
					if (p.avatar) next.set(p.did, p.avatar);
				}
			} catch {
				// Avatars are a nicety; the fallback circle carries the row.
			}
		}
		avatars = next;
	});

	/* ── override + allowlist form feedback ── */

	let message = $derived(form && 'message' in form ? (form.message as string) : null);
	let latePassesOpen = $state(false);

	// The direction contract must survive the production build; the compiler
	// strips literal HTML comments, so it is emitted with @html like the
	// layout's survey contract.
	const contract = `<!--
THESIS: One room where the organizer reads the whole survey; the availability
heatmap answers "when can they come" at a glance. Refuses the KPI-card
dashboard-on-gray.
OWN-WORLD: The Dusk Feed world at Operate density - solid #0b0908 with the
grain tile, one white ink stepped 100/70/45/35/12, Big Shoulders caps for the
rail title and section heads, Hanken Grotesk for data, hairline ledgers, the
white pill for real actions. No cards, no shadows, no second color.
STORY: Bryan signs in, reads the counts, sees the bright band in October,
picks a window, checks who needs travel help, manages the list, exports.
FIRST VIEWPORT: fixed left rail (title, deadline, stat stack, location tally,
overrides, export) | content: WHEN CAN THEY COME heatmap + best windows.
FORM: Command rail - approved comp .impeccable/mocks/org-b.png, option B of 3
visualize comps. No concept-seed roll was run: composition was fixed by the
confirmed shape brief (Operate, established world) and Bryan's comp choice;
recorded here so the absent seed key reads as a decision, not an omission.
FINISH: unreviewed and undocumented is unfinished; this build ends with the
finish review, the verdict, and DESIGN.md.
-->`;
</script>

<svelte:head>
	<title>Organizer — the Atmospheric Builders’ Retreat</title>
	<meta name="robots" content="noindex" />
</svelte:head>

{@html contract}

{#if data.authState === 'signed-out'}
	<main class="gate">
		<div class="gate-box">
			<h1 class="display gate-title">Organizer.</h1>
			<p class="gate-explain">
				This side is for the organizers of the Atmospheric Builders’ Retreat. Sign in and we’ll check.
			</p>
			<div class="gate-field">
				<label class="kicker" for="org-handle">Your handle</label>
				<input
					id="org-handle"
					type="text"
					bind:value={handle}
					placeholder="you.bsky.social"
					autocapitalize="none"
					autocorrect="off"
					spellcheck="false"
					autocomplete="username"
					onkeydown={(e) => e.key === 'Enter' && signIn()}
				/>
			</div>
			{#if signinError}
				<p class="gate-error" role="alert">{signinError}</p>
			{/if}
			<button class="pill" onclick={signIn} disabled={!handle.trim() || busy}>
				{busy ? 'Contacting your PDS…' : retreat.signIn}
				<Icon name="butterfly" size={17} />
			</button>
		</div>
	</main>
{:else}
	<main class="page">
		<aside class="rail">
			<div class="rail-top">
				<h1 class="display rail-title"><span>Atmospheric</span><span>Organizer.</span></h1>
				<p class="deadline" class:reopened={data.reopened}>{deadlineLine}</p>
				{#if data.preview}
					<p class="preview-flag">Synthetic preview data</p>
				{/if}
			</div>

			<ul class="stats" aria-label="Response counts">
				<li><span class="stat-num">{stats.total}</span><span class="stat-label">Responses</span></li>
				<li><span class="stat-num">{stats.yes}</span><span class="stat-label">Yes</span></li>
				<li><span class="stat-num">{stats.maybe}</span><span class="stat-label">Maybe</span></li>
				<li><span class="stat-num">{stats.no}</span><span class="stat-label">No</span></li>
				<li><span class="stat-num">{stats.travelHelp}</span><span class="stat-label">Need travel help</span></li>
			</ul>

			<section class="rail-section" aria-labelledby="loc-head">
				<h2 class="kicker rail-head" id="loc-head">Locations</h2>
				{#if tallies.tallies.length > 0}
					<ol class="loc-list">
						{#each tallies.tallies as t, i (t.id)}
							<li>
								<span class="loc-rank">{i + 1}</span>
								<span class="loc-name">{locationName.get(t.id) ?? t.id}</span>
								<span class="loc-bar" style="scale: {(t.points / maxPoints).toFixed(3)} 1"></span>
								<span class="loc-pts">{t.points}</span>
							</li>
						{/each}
					</ol>
					{#if tallies.noPreference > 0}
						<p class="loc-nopref">{tallies.noPreference} no preference</p>
					{/if}
				{:else}
					<p class="loc-nopref">No rankings yet</p>
				{/if}
			</section>

			<section class="rail-section" aria-labelledby="override-head">
				<h2 class="kicker rail-head" id="override-head">Deadline</h2>
				<form method="POST" action="?/setReopen" use:enhance class="toggle-row">
					<input type="hidden" name="on" value={data.reopened ? '0' : '1'} />
					<span class="toggle-label">
						Reopen survey
						{#if !data.deadlinePassed && !data.reopened}
							<span class="toggle-hint">for when the deadline passes</span>
						{/if}
					</span>
					<button type="submit" class="switch" role="switch" aria-checked={data.reopened} aria-label="Reopen survey">
						<span class="knob"></span>
					</button>
				</form>

				<div class="toggle-row passes-row">
					<button class="toggle-label passes-btn" onclick={() => (latePassesOpen = !latePassesOpen)} aria-expanded={latePassesOpen}>
						Late passes · {data.latePasses.length}
						<Icon name="chevron-down" size={13} />
					</button>
				</div>
				{#if latePassesOpen}
					<div class="passes">
						{#if data.latePasses.length > 0}
							<ul class="pass-list">
								{#each data.latePasses as p (p.handle)}
									<li>
										<span class="pass-handle">@{p.handle}</span>
										<form method="POST" action="?/revokePass" use:enhance>
											<input type="hidden" name="handle" value={p.handle} />
											<button class="chip-x" aria-label="Revoke late pass for @{p.handle}"><Icon name="x" size={12} /></button>
										</form>
									</li>
								{/each}
							</ul>
						{/if}
						<form method="POST" action="?/grantPass" use:enhance class="pass-add">
							<label class="visually-hidden" for="pass-handle">Handle to grant a late pass</label>
							<input id="pass-handle" type="text" name="handle" placeholder="handle.bsky.social" autocapitalize="none" spellcheck="false" />
							<button class="chip-add" aria-label="Grant late pass"><Icon name="plus" size={14} /></button>
						</form>
						<p class="passes-hint">A late pass lets one person answer after the deadline.</p>
					</div>
				{/if}
			</section>

			<div class="rail-end">
				<a class="pill export" href="/organizer/responses.csv" download>Export CSV</a>
				<a class="quiet-link" href="/organizer/availability.csv" download>availability ranges →</a>
				<a class="quiet-link" href="/">← the survey</a>
			</div>
		</aside>

		<div class="content">
			{#if message}
				<p class="flash" role="status">{message}</p>
			{/if}

			<section aria-labelledby="when-head">
				<div class="section-head">
					<div>
						<h2 class="display section-title" id="when-head">When can they come</h2>
						<p class="section-sub">Sept 1 – Nov 15 · brighter days mean more people</p>
					</div>
					<div class="filter" role="group" aria-label="Which respondents count">
						<button class="filter-btn" class:on={filter === 'all'} onclick={() => (filter = 'all')} aria-pressed={filter === 'all'}>
							Everyone
						</button>
						<button class="filter-btn" class:on={filter === 'yes'} onclick={() => (filter = 'yes')} aria-pressed={filter === 'yes'}>
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
							onclick={clearAnchors}
							disabled={anchorBusy || data.anchorsUnavailable}
							title={data.anchorsUnavailable ? 'Saved anchors could not be loaded — reload to re-enable' : undefined}
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

			<section aria-labelledby="resp-head">
				<div class="section-head">
					<h2 class="display section-title" id="resp-head">Responses</h2>
				</div>
				<ResponsesTable
					responses={data.responses}
					{avatars}
					{anchors}
					ontoggleanchor={toggleAnchor}
					anchorsLocked={data.anchorsUnavailable}
				/>
			</section>

			<section aria-labelledby="allow-head">
				<div class="section-head">
					<h2 class="display section-title" id="allow-head">Allowlist</h2>
				</div>

				{#if data.allowlist.length === 0}
					<p class="warn" role="alert">
						The list is empty — right now anyone with the link can respond. Add handles below to make the survey
						invite-only.
					</p>
				{:else}
					<p class="section-sub">
						{data.allowlist.length} invited · {data.allowlist.filter((a) => a.responded).length} responded
					</p>
				{/if}

				{#if data.allowlist.length > 0}
					<ul class="chips" aria-label="Invited handles">
						{#each data.allowlist as entry (entry.handle)}
							<li class="chip" class:responded={entry.responded}>
								{#if entry.responded}<Icon name="check" size={12} label="Responded" />{/if}
								<span>@{entry.handle}</span>
								<form method="POST" action="?/removeHandle" use:enhance>
									<input type="hidden" name="handle" value={entry.handle} />
									<button class="chip-x" aria-label="Remove @{entry.handle} from the allowlist"><Icon name="x" size={12} /></button>
								</form>
							</li>
						{/each}
					</ul>
				{/if}

				<form method="POST" action="?/addHandles" use:enhance class="add-form">
					<label class="kicker" for="add-handles">Add handles</label>
					<textarea
						id="add-handles"
						name="handles"
						rows="3"
						placeholder="one per line — @ optional, commas and spaces fine"
					></textarea>
					<button class="pill add-pill" type="submit">Add to allowlist</button>
				</form>
			</section>

			<section aria-labelledby="wait-head">
				<div class="section-head">
					<h2 class="display section-title" id="wait-head">Waitlist</h2>
				</div>

				{#if data.waitlist.length === 0}
					<p class="section-empty">No one on the waitlist yet — uninvited visitors can add themselves from the sign-in screen.</p>
				{:else}
					<p class="section-sub">
						{waitlistWaiting.length} waiting{waitlistPromoted.length > 0 ? ` · ${waitlistPromoted.length} promoted` : ''}
					</p>

					{#if waitlistWaiting.length > 0}
						<ul class="waitlist-rows" aria-label="Waiting to be promoted">
							{#each waitlistWaiting as w (w.did)}
								<li class="waitlist-row">
									<span class="wl-handle">{w.handle ? `@${w.handle}` : w.did.slice(0, 16) + '…'}</span>
									<a class="wl-email" href="mailto:{w.email}">{w.email}</a>
									<span class="wl-joined">joined {joinedDate(w.createdAt)}</span>
									<form method="POST" action="?/promoteWaitlist" use:enhance>
										<input type="hidden" name="did" value={w.did} />
										<button
											class="wl-promote"
											type="submit"
											disabled={!w.handle}
											title={w.handle ? 'Add to the allowlist — they can take the survey immediately' : 'No resolved handle yet — ask them to sign in again'}
										>
											Promote
										</button>
									</form>
								</li>
							{/each}
						</ul>
					{/if}

					{#if waitlistPromoted.length > 0}
						<details class="wl-promoted">
							<summary>Promoted ({waitlistPromoted.length})</summary>
							<ul class="wl-promoted-list">
								{#each waitlistPromoted as w (w.did)}
									<li>{w.handle ? `@${w.handle}` : w.did.slice(0, 16) + '…'} <span class="wl-joined">· {w.email}</span></li>
								{/each}
							</ul>
						</details>
					{/if}
				{/if}
			</section>

			<RegistrationsPanel
				registrations={data.registrations}
				counts={data.regCounts}
				missing={data.regMissing}
				deadlineDisplay={data.regDeadlineDisplay}
				closed={data.regClosed}
			/>

			<EmailPanel
				configured={data.emailConfigured}
				broadcasts={data.broadcasts}
				respondentCount={new Set(data.responses.map((r) => r.email.trim().toLowerCase()).filter(Boolean)).size}
			/>
		</div>
	</main>
{/if}

<style>
	/* ── shared ground: the world without its photographs ── */

	.page,
	.gate {
		position: relative;
		min-height: 100dvh;
		background: var(--ground);
	}

	.page::after,
	.gate::after {
		content: '';
		position: fixed;
		inset: 0;
		background: url('/media/grain.png');
		background-size: 340px;
		/* Overlay-blend vanishes on flat near-black (it needs midtones under
		   it, which the survey's photos supply). Screen-blend at lower opacity
		   is the same grain made visible on this surface's solid ground. */
		opacity: 0.05;
		mix-blend-mode: screen;
		pointer-events: none;
		z-index: 5;
	}

	/* ── signed-out gate ── */

	.gate {
		display: grid;
		place-items: center;
		padding: var(--gutter);
	}

	.gate-box {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		width: min(24rem, 100%);
	}

	.gate-title {
		/* The documented title ramp — the gate is a mini hero. */
		font-size: clamp(2.2rem, 7.5vw, 3.6rem);
	}

	.gate-explain {
		font-size: 0.9375rem;
		line-height: 1.5;
		color: var(--ink-70);
		max-width: 34ch;
	}

	.gate-field {
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
	}

	.gate-field .kicker {
		color: var(--ink-70);
	}

	.gate-field input {
		background: transparent;
		border: none;
		border-bottom: 1px solid var(--ink-45);
		border-radius: 0;
		padding: 0.45rem 0 0.55rem;
		font-size: 1.125rem;
		caret-color: var(--ink);
	}

	.gate-field input::placeholder {
		color: var(--ink-45);
	}

	.gate-field input:focus {
		outline: none;
		border-bottom-color: var(--ink);
	}

	.gate-error {
		font-size: var(--text-author);
		line-height: 1.45;
	}

	/* ── frame: rail + content ── */

	.page {
		display: grid;
		grid-template-columns: clamp(16rem, 22vw, 20rem) 1fr;
	}

	.rail {
		position: sticky;
		top: 0;
		align-self: start;
		height: 100dvh;
		overflow-y: auto;
		scrollbar-width: thin;
		scrollbar-color: var(--ink-35) transparent;
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		padding: var(--space-4) var(--space-4) 0 var(--gutter);
		border-right: var(--hairline);
	}

	.rail-title {
		display: flex;
		flex-direction: column;
		font-size: clamp(1.9rem, 2.6vw, 2.6rem);
	}

	.deadline {
		margin-top: var(--space-2);
		font-size: var(--text-author);
		color: var(--ink-70);
	}

	.deadline.reopened {
		color: var(--ink);
	}

	.preview-flag {
		display: inline-block;
		width: max-content;
		margin-top: var(--space-2);
		padding: 0.25rem 0.7rem;
		border: 1px solid var(--ink-45);
		border-radius: 999px;
		font-size: 0.6875rem;
		font-weight: 500;
		letter-spacing: 0.18em;
		text-transform: uppercase;
	}

	.stats {
		list-style: none;
	}

	.stats li {
		display: flex;
		align-items: baseline;
		gap: var(--space-2);
		padding: 0.45rem 0;
		border-top: var(--hairline);
	}

	.stats li:last-child {
		border-bottom: var(--hairline);
	}

	.stat-num {
		/* The comp's rail numerals are condensed display digits — the
		   documented title ramp's endpoints, interpolated by viewport HEIGHT
		   so the whole rail (overrides included) fits the first viewport. */
		min-width: 1.6ch;
		font-family: var(--font-display);
		font-size: clamp(2.2rem, 3.2vh, 3.6rem);
		font-weight: 700;
		line-height: 0.92;
		font-variant-numeric: tabular-nums;
	}

	.stat-label {
		font-size: 0.6875rem;
		font-weight: 500;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--ink-70);
	}

	.rail-section {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.rail-head {
		color: var(--ink-45);
	}

	.loc-list {
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	/* The comp's ledger geometry: rank, name, tally, count share one
	   baseline; the bar runs the slack between name and count. */
	.loc-list li {
		display: grid;
		grid-template-columns: 1.1rem auto minmax(1.5rem, 1fr) auto;
		grid-template-areas: 'rank name bar pts';
		align-items: center;
		column-gap: 0.5rem;
	}

	.loc-rank {
		grid-area: rank;
		font-size: 0.75rem;
		color: var(--ink-45);
		font-variant-numeric: tabular-nums;
	}

	.loc-name {
		grid-area: name;
		font-size: 0.9375rem;
	}

	.loc-bar {
		grid-area: bar;
		width: 100%;
		height: 2px;
		background: var(--ink);
		opacity: 0.75;
		border-radius: 999px;
		transform-origin: left center;
		transition: scale 0.3s var(--ease-out);
	}

	.loc-pts {
		grid-area: pts;
		font-size: 0.8125rem;
		color: var(--ink-70);
		font-variant-numeric: tabular-nums;
	}

	.loc-nopref {
		font-size: 0.8125rem;
		color: var(--ink-45);
	}

	.toggle-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2);
		padding: 0.45rem 0;
		border-top: var(--hairline);
	}

	.toggle-label {
		display: flex;
		flex-direction: column;
		font-size: 0.9375rem;
		color: var(--ink);
		text-align: left;
	}

	.toggle-hint {
		font-size: 0.75rem;
		color: var(--ink-45);
	}

	.switch {
		flex: 0 0 auto;
		width: 2.6rem;
		height: 1.5rem;
		border-radius: 999px;
		border: 1px solid var(--ink-45);
		display: flex;
		align-items: center;
		padding: 0 0.2rem;
		transition: background 0.2s var(--ease-out);
	}

	.switch .knob {
		width: 1rem;
		height: 1rem;
		border-radius: 999px;
		background: var(--ink);
		transition: translate 0.2s var(--ease-out);
	}

	.switch[aria-checked='true'] {
		background: var(--ink);
		border-color: var(--ink);
	}

	.switch[aria-checked='true'] .knob {
		background: var(--ground);
		translate: 1.05rem 0;
	}

	.passes-row {
		border-bottom: var(--hairline);
	}

	.passes-btn {
		flex-direction: row;
		align-items: center;
		gap: 0.4rem;
		color: var(--ink);
	}

	.passes-btn[aria-expanded='true'] :global(svg) {
		rotate: 180deg;
	}

	.passes {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		padding-bottom: 0.55rem;
		border-bottom: var(--hairline);
	}

	.pass-list {
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.pass-list li {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
	}

	.pass-handle {
		font-size: 0.875rem;
	}

	.pass-add {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.pass-add input {
		flex: 1 1 auto;
		min-width: 0;
		background: transparent;
		border: none;
		border-bottom: 1px solid var(--ink-45);
		border-radius: 0;
		padding: 0.3rem 0;
		font-size: 0.9375rem;
	}

	.pass-add input:focus {
		outline: none;
		border-bottom-color: var(--ink);
	}

	.passes-hint {
		font-size: 0.75rem;
		line-height: 1.4;
		color: var(--ink-45);
	}

	/* Docked action footer: sticks to the rail's bottom even when the rail
	   scrolls, so Export never leaves reach on short screens. */
	.rail-end {
		position: sticky;
		bottom: 0;
		margin-top: auto;
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		padding: var(--space-2) 0 calc(env(safe-area-inset-bottom) + var(--space-2));
		background: var(--ground);
		border-top: var(--hairline);
	}

	.export {
		text-decoration: none;
	}

	.quiet-link {
		font-size: var(--text-author);
		color: var(--ink-70);
		text-decoration: underline;
		text-underline-offset: 3px;
	}

	.quiet-link:hover {
		color: var(--ink);
	}

	/* ── content column ── */

	.content {
		display: flex;
		flex-direction: column;
		gap: var(--space-5);
		padding: var(--space-4) var(--gutter) var(--space-5);
		min-width: 0;
	}

	.flash {
		font-size: var(--text-author);
		color: var(--ink);
		border-top: var(--hairline);
		border-bottom: var(--hairline);
		padding: 0.55rem 0;
	}

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
		border: 1.5px solid currentColor;
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
		border: 1.5px solid currentColor;
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

	/* ── allowlist ── */

	.warn {
		font-size: 0.9375rem;
		line-height: 1.5;
		padding: 0.65rem 0;
		border-top: 1px solid var(--ink);
		border-bottom: 1px solid var(--ink);
		max-width: 62ch;
	}

	.chips {
		list-style: none;
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.chip {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		padding: 0.35rem 0.5rem 0.35rem 0.9rem;
		border: 1px solid var(--ink-45);
		border-radius: 999px;
		font-size: 0.8125rem;
	}

	.chip.responded {
		border-color: var(--ink);
	}

	.chip form {
		display: flex;
	}

	.chip-x,
	.chip-add {
		display: grid;
		place-items: center;
		width: 1.5rem;
		height: 1.5rem;
		border-radius: 999px;
		color: var(--ink-45);
		transition: color 0.15s var(--ease-out);
	}

	.chip-add {
		border: 1px solid var(--ink-45);
		width: 2rem;
		height: 2rem;
		color: var(--ink);
	}

	.chip-x:hover {
		color: var(--ink);
	}

	.add-form {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		max-width: 34rem;
	}

	.add-form .kicker {
		color: var(--ink-70);
	}

	.add-form textarea {
		background: transparent;
		border: none;
		border-bottom: 1px solid var(--ink-45);
		border-radius: 0;
		padding: 0.45rem 0;
		font: inherit;
		font-size: 0.9375rem;
		color: var(--ink);
		resize: vertical;
	}

	.add-form textarea::placeholder {
		color: var(--ink-45);
	}

	.add-form textarea:focus {
		outline: none;
		border-bottom-color: var(--ink);
	}

	.add-pill {
		align-self: flex-start;
		width: auto;
	}

	/* ── waitlist rows ── */

	.waitlist-rows {
		list-style: none;
	}

	.waitlist-row {
		display: grid;
		grid-template-columns: minmax(9rem, auto) 1fr auto auto;
		grid-template-areas: 'handle email joined promote';
		align-items: baseline;
		gap: var(--space-2) var(--space-3);
		padding: 0.65rem 0;
		border-top: var(--hairline);
		font-size: 0.9375rem;
	}

	.waitlist-row:last-child {
		border-bottom: var(--hairline);
	}

	.wl-handle {
		grid-area: handle;
	}
	.wl-email {
		grid-area: email;
	}
	.wl-joined {
		grid-area: joined;
	}
	.waitlist-row form {
		grid-area: promote;
		justify-self: end;
	}

	/* Narrow: the email must never collapse to zero (it's how the organizer
	   reaches people). Stack handle+promote, then email, then joined. */
	@media (max-width: 640px) {
		.waitlist-row {
			grid-template-columns: 1fr auto;
			grid-template-areas:
				'handle promote'
				'email email'
				'joined joined';
			row-gap: 0.3rem;
			align-items: center;
		}
	}

	.wl-handle {
		font-weight: 550;
		white-space: nowrap;
	}

	.wl-email {
		color: var(--ink-70);
		text-decoration: underline;
		text-underline-offset: 3px;
		text-decoration-color: var(--ink-45);
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.wl-email:hover {
		color: var(--ink);
		text-decoration-color: var(--ink);
	}

	.wl-joined {
		font-size: 0.8125rem;
		color: var(--ink-45);
		white-space: nowrap;
	}

	.wl-promote {
		border: 1px solid var(--ink-45);
		border-radius: 999px;
		padding: 0.3rem 0.9rem;
		font-size: 0.8125rem;
		font-weight: 600;
		color: var(--ink);
		white-space: nowrap;
		transition:
			background 0.15s var(--ease-out),
			color 0.15s var(--ease-out);
	}

	.wl-promote:hover:not(:disabled) {
		background: var(--ink);
		color: var(--on-pill);
	}

	.wl-promote:disabled {
		opacity: 0.4;
	}

	.wl-promoted {
		margin-top: var(--space-2);
	}

	.wl-promoted summary {
		font-size: var(--text-author);
		color: var(--ink-70);
		cursor: pointer;
	}

	.wl-promoted-list {
		list-style: none;
		margin-top: var(--space-2);
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		font-size: 0.875rem;
		color: var(--ink-70);
	}

	/* ── mobile: the rail folds into a header ── */

	@media (max-width: 900px) {
		.page {
			grid-template-columns: 1fr;
		}

		.rail {
			position: static;
			height: auto;
			overflow: visible;
			border-right: none;
			border-bottom: var(--hairline);
			padding: var(--space-4) var(--gutter) 0;
		}

		.rail-end {
			position: static;
			margin-top: 0;
		}

		.content {
			padding-top: var(--space-4);
		}
	}
</style>
