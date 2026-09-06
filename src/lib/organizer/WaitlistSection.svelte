<script lang="ts">
	import { enhance } from '$app/forms';
	import type { WaitlistEntry } from '$lib/server/waitlist';

	let { waitlist }: { waitlist: WaitlistEntry[] } = $props();

	const waitlistWaiting = $derived(waitlist.filter((w) => !w.promotedAt));
	const waitlistPromoted = $derived(waitlist.filter((w) => w.promotedAt));
	function joinedDate(iso: string): string {
		return new Date(iso).toLocaleDateString('en-US', {
			timeZone: 'America/Los_Angeles',
			month: 'short',
			day: 'numeric'
		});
	}
</script>

<section aria-labelledby="wait-head">
	<div class="section-head">
		<h2 class="display section-title" id="wait-head">Waitlist</h2>
	</div>

	{#if waitlist.length === 0}
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
</style>
