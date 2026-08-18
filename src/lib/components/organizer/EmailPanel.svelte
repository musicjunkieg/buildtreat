<script lang="ts">
	import { enhance } from '$app/forms';
	import type { BroadcastView } from '$lib/server/broadcasts';

	let {
		configured,
		broadcasts,
		respondentCount
	}: {
		configured: boolean;
		broadcasts: BroadcastView[];
		respondentCount: number;
	} = $props();

	let subject = $state('');
	let body = $state('');
	// Two-step arm/confirm instead of a browser confirm() dialog, so the
	// recipient count is visible at the moment of commitment.
	let armed = $state(false);
	let sending = $state(false);

	const draftReady = $derived(subject.trim().length > 0 && body.trim().length > 0);

	function counts(b: BroadcastView): { sent: number; failed: number; pending: number } {
		let sent = 0,
			failed = 0,
			pending = 0;
		for (const r of b.recipients) {
			if (r.status === 'sent') sent++;
			else if (r.status === 'failed') failed++;
			else pending++;
		}
		return { sent, failed, pending };
	}

	function shortDate(iso: string): string {
		return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
	}
</script>

<section aria-labelledby="email-head">
	<div class="section-head">
		<h2 class="display section-title" id="email-head">Email</h2>
	</div>

	{#if !configured}
		<p class="warn" role="alert">
			Email isn’t set up yet. Enroll <code>buildersretre.at</code> in comail, then set the
			<code>COMAIL_API_KEY</code> secret (vars <code>EMAIL_FROM</code> and <code>COMAIL_DID</code> ship in
			wrangler.jsonc). Until then, composing is disabled.
		</p>
	{:else}
		<form
			method="POST"
			class="compose"
			use:enhance={() => {
				sending = true;
				return async ({ update }) => {
					sending = false;
					armed = false;
					await update({ reset: false });
				};
			}}
		>
			<label class="kicker" for="email-subject">Subject</label>
			<input id="email-subject" name="subject" bind:value={subject} maxlength="200" autocomplete="off" />

			<label class="kicker" for="email-body">Body (plain text)</label>
			<textarea id="email-body" name="body" bind:value={body} rows="8"></textarea>

			<div class="send-row">
				<div class="test-to">
					<label class="kicker" for="email-test-to">Test address</label>
					<input id="email-test-to" name="to" type="email" placeholder="you@example.com" autocomplete="off" />
				</div>
				<button class="btn-ghost" formaction="?/emailTest" disabled={!draftReady || sending}>Send test</button>
			</div>

			<div class="send-row">
				{#if armed}
					<button class="pill confirm-pill" formaction="?/emailBroadcast" disabled={!draftReady || sending}>
						Really send to {respondentCount} {respondentCount === 1 ? 'person' : 'people'}
					</button>
					<button class="btn-ghost" type="button" onclick={() => (armed = false)}>Cancel</button>
				{:else}
					<button class="btn-ghost arm-btn" type="button" disabled={!draftReady || sending} onclick={() => (armed = true)}>
						Send to {respondentCount} respondent{respondentCount === 1 ? '' : 's'}…
					</button>
				{/if}
			</div>
		</form>
	{/if}

	{#if broadcasts.length > 0}
		<div class="history-block">
			<h3 class="kicker history-head">Past broadcasts</h3>
			<ul class="history">
				{#each broadcasts as b (b.id)}
					{@const c = counts(b)}
					<li>
						<details>
							<summary>
								<span class="hist-subject">{b.subject}</span>
								<span class="section-sub hist-meta">
									{shortDate(b.createdAt)} · {c.sent} sent{c.failed ? ` · ${c.failed} failed` : ''}{c.pending
										? ` · ${c.pending} pending`
										: ''}
								</span>
							</summary>
							<p class="body-preview">{b.body}</p>
							<ul class="recipients">
								{#each b.recipients as r (r.did)}
									<li data-status={r.status}>
										{r.email} — {r.status}{r.errorCode ? ` (${r.errorCode})` : ''}
									</li>
								{/each}
							</ul>
							{#if configured && c.failed + c.pending > 0}
								<form method="POST" action="?/emailRetry" use:enhance>
									<input type="hidden" name="id" value={b.id} />
									<button class="btn-ghost">Retry {c.failed + c.pending} unsent</button>
								</form>
							{/if}
						</details>
					</li>
				{/each}
			</ul>
		</div>
	{:else if configured}
		<p class="section-empty">No broadcasts sent yet.</p>
	{/if}
</section>

<style>
	/* Duplicated from +page.svelte — Svelte scopes <style> per-component,
	   so the page's section/warn/empty rules don't reach this component. */
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

	.warn {
		font-size: 0.9375rem;
		line-height: 1.5;
		padding: 0.65rem 0;
		border-top: 1px solid var(--ink);
		border-bottom: 1px solid var(--ink);
		max-width: 62ch;
	}

	.compose .kicker {
		color: var(--ink-70);
	}

	.compose {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		max-width: 40rem;
	}

	.compose input,
	.compose textarea {
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

	.compose input::placeholder,
	.compose textarea::placeholder {
		color: var(--ink-45);
	}

	.compose input:focus,
	.compose textarea:focus {
		outline: none;
		border-bottom-color: var(--ink);
	}

	.send-row {
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		gap: var(--space-3);
		flex-wrap: wrap;
	}

	.test-to {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		flex: 1 1 auto;
		min-width: 12rem;
	}

	/* Secondary action: hairline pill that fills solid on hover, same
	   language as .wl-promote — everything short of the real commit. */
	.btn-ghost {
		flex-shrink: 0;
		border: 1px solid var(--ink-45);
		border-radius: 999px;
		padding: 0.5rem 1.1rem;
		font-size: 0.8125rem;
		font-weight: 600;
		color: var(--ink);
		white-space: nowrap;
		transition:
			background 0.15s var(--ease-out),
			color 0.15s var(--ease-out);
	}

	.btn-ghost:hover:not(:disabled) {
		background: var(--ink);
		color: var(--on-pill);
	}

	.btn-ghost:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.arm-btn {
		align-self: flex-end;
	}

	/* The real commit — the solid white pill, reserved for actions that
	   can't be undone. */
	.confirm-pill {
		width: auto;
		min-height: 0;
		padding: 0.55rem 1.4rem;
		font-size: 0.875rem;
	}

	.warn code {
		font-family: var(--font-body);
		background: var(--ink-12);
		padding: 0.1em 0.35em;
		border-radius: 6px;
		font-size: 0.9em;
	}

	.history-block {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.history-head {
		color: var(--ink-70);
	}

	.history {
		list-style: none;
		display: flex;
		flex-direction: column;
	}

	.history li {
		border-top: var(--hairline);
	}

	.history li:last-child {
		border-bottom: var(--hairline);
	}

	.history summary {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: var(--space-3);
		flex-wrap: wrap;
		padding: 0.65rem 0;
		cursor: pointer;
		font-size: 0.9375rem;
	}

	.hist-subject {
		font-weight: 550;
	}

	.hist-meta {
		margin-top: 0;
		white-space: nowrap;
	}

	.body-preview {
		white-space: pre-wrap;
		font-size: 0.9375rem;
		line-height: 1.5;
		color: var(--ink-70);
		padding-bottom: var(--space-2);
	}

	.recipients {
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		font-size: 0.8125rem;
		padding-bottom: var(--space-2);
	}

	.recipients li {
		color: var(--ink-70);
	}

	/* Failed rows carry the eye without a second color — full ink weight
	   is the only emphasis this world allows. */
	.recipients li[data-status='failed'] {
		color: var(--ink);
		font-weight: 600;
	}

	.recipients li[data-status='pending'] {
		color: var(--ink-45);
	}
</style>
