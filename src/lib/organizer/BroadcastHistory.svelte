<script lang="ts">
	import { enhance } from '$app/forms';
	import { SvelteSet } from 'svelte/reactivity';
	import type { Audience, AudienceCount, BroadcastView } from '$lib/server/messaging/broadcasts';

	let {
		broadcasts,
		audiences,
		emailConfigured,
		dmConfigured
	}: {
		broadcasts: BroadcastView[];
		/** For the audience label on each row. */
		audiences: AudienceCount[];
		emailConfigured: boolean;
		dmConfigured: boolean;
	} = $props();

	const labelFor = (id: Audience) => audiences.find((a) => a.id === id)?.label ?? id;
	// Per-broadcast in-flight guard: prevents a double-click on Retry from
	// firing two concurrent retryBroadcast actions and double-sending.
	let retrying = new SvelteSet<number>();

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

	/** DMs have no subject; the history leads with the opening line instead. */
	function title(b: BroadcastView): string {
		if (b.subject) return b.subject;
		const line = b.body.split('\n')[0].trim();
		return line.length > 72 ? `${line.slice(0, 71)}…` : line;
	}

	function who(r: BroadcastView['recipients'][number]): string {
		if (r.email) return r.email;
		return r.handle ? `@${r.handle}` : `${r.did.slice(0, 20)}…`;
	}

	function shortDate(iso: string): string {
		return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
	}

	function canRetry(b: BroadcastView): boolean {
		return b.channel === 'dm' ? dmConfigured : emailConfigured;
	}
</script>

<div class="history-block">
	<h3 class="kicker history-head">Past broadcasts</h3>
	<ul class="history">
		{#each broadcasts as b (b.id)}
			{@const c = counts(b)}
			<li>
				<details>
					<summary>
						<span class="hist-subject">
							{#if b.channel === 'dm'}<span class="tag">DM</span>{/if}
							{title(b)}
						</span>
						<span class="section-sub hist-meta">
							{shortDate(b.createdAt)} · {labelFor(b.audience)} · {c.sent} sent{c.failed ? ` · ${c.failed} failed` : ''}{c.pending
								? ` · ${c.pending} pending`
								: ''}
						</span>
					</summary>
					<p class="body-preview">{b.body}</p>
					<ul class="recipients">
						{#each b.recipients as r (r.did)}
							<li data-status={r.status}>
								{who(r)} — {r.status}{r.errorCode ? ` (${r.errorCode})` : ''}
							</li>
						{/each}
					</ul>
					{#if canRetry(b) && c.failed + c.pending > 0}
						<form
							method="POST"
							action="?/retryBroadcast"
							use:enhance={() => {
								retrying.add(b.id);
								return async ({ update }) => {
									retrying.delete(b.id);
									await update({ reset: false });
								};
							}}
						>
							<input type="hidden" name="id" value={b.id} />
							<button class="btn-ghost" disabled={retrying.has(b.id)}>Retry {c.failed + c.pending} unsent</button>
						</form>
					{/if}
				</details>
			</li>
		{/each}
	</ul>
</div>

<style>
	/* .section-sub, .tag and .btn-ghost are duplicated from EmailPanel —
	   Svelte scopes <style> per-component. */
	.section-sub {
		margin-top: 0.35rem;
		font-size: 0.8125rem;
		color: var(--ink-70);
	}

	.tag {
		display: inline-block;
		border: 1px solid var(--ink-45);
		border-radius: 999px;
		padding: 0.05rem 0.5rem;
		margin-right: 0.35rem;
		font-size: 0.6875rem;
		font-weight: 600;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--ink-70);
		vertical-align: 0.1em;
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
