<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { deserialize } from '$app/forms';
	import AllowlistSection from '$lib/organizer/AllowlistSection.svelte';
	import AvailabilitySection from '$lib/organizer/AvailabilitySection.svelte';
	import EmailPanel from '$lib/organizer/EmailPanel.svelte';
	import OrganizerGate from '$lib/organizer/OrganizerGate.svelte';
	import OrganizerRail from '$lib/organizer/OrganizerRail.svelte';
	import RegistrationsPanel from '$lib/organizer/RegistrationsPanel.svelte';
	import ResponsesTable from '$lib/organizer/ResponsesTable.svelte';
	import WaitlistSection from '$lib/organizer/WaitlistSection.svelte';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	/* ── all/yes filter ──
	   Owned by the availability section (its control lives in that section
	   head) and bound here so the rail's location tally, which reads the same
	   narrowed set, follows the toggle. */

	let filter = $state<'all' | 'yes'>('all');

	const filtered = $derived(filter === 'yes' ? data.responses.filter((r) => r.interest === 'yes') : data.responses);

	/* ── anchor scenario ──
	   Shared state: the availability section reads the anchor set, the
	   responses table toggles it. */

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
	<OrganizerGate />
{:else}
	<main class="page">
		<OrganizerRail
			responses={data.responses}
			{filtered}
			latePasses={data.latePasses}
			reopened={data.reopened}
			deadlinePassed={data.deadlinePassed}
			{deadlineLine}
			preview={data.preview}
		/>

		<div class="content">
			{#if message}
				<p class="flash" role="status">{message}</p>
			{/if}

			<AvailabilitySection
				responses={data.responses}
				{anchors}
				{anchorBusy}
				anchorsLocked={data.anchorsUnavailable}
				onclear={clearAnchors}
				bind:filter
			/>

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

			<AllowlistSection allowlist={data.allowlist} />

			<WaitlistSection waitlist={data.waitlist} />

			<RegistrationsPanel
				registrations={data.registrations}
				counts={data.regCounts}
				missing={data.regMissing}
				deadlineDisplay={data.regDeadlineDisplay}
				closed={data.regClosed}
				unavailable={data.registrationsUnavailable}
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

	.page {
		position: relative;
		min-height: 100dvh;
		background: var(--ground);
	}

	.page::after {
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

	/* ── frame: rail + content ── */

	.page {
		display: grid;
		grid-template-columns: clamp(16rem, 22vw, 20rem) 1fr;
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

	/* ── mobile: the rail folds into a header ── */

	@media (max-width: 900px) {
		.page {
			grid-template-columns: 1fr;
		}

		.content {
			padding-top: var(--space-4);
		}
	}
</style>
