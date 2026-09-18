<script lang="ts">
	import { enhance } from '$app/forms';
	import { SvelteSet } from 'svelte/reactivity';
	import type { Audience, AudienceCount, BroadcastView, Channel } from '$lib/server/broadcasts';
	import { DM_MAX_GRAPHEMES, graphemeCount } from '$lib/dm-text';

	let {
		emailConfigured,
		dmConfigured,
		broadcasts,
		audiences
	}: {
		emailConfigured: boolean;
		dmConfigured: boolean;
		broadcasts: BroadcastView[];
		/** Recipient count per audience and channel, in display order; the first is the default. */
		audiences: AudienceCount[];
	} = $props();

	let channel = $state<Channel>('email');
	let subject = $state('');
	let body = $state('');
	let audience = $state<Audience>('all');
	const configured = $derived(channel === 'email' ? emailConfigured : dmConfigured);
	const picked = $derived(audiences.find((a) => a.id === audience) ?? audiences[0]);
	const recipientCount = $derived(picked?.counts[channel] ?? 0);
	const labelFor = (id: Audience) => audiences.find((a) => a.id === id)?.label ?? id;
	// Two-step arm/confirm instead of a browser confirm() dialog, so the
	// recipient count is visible at the moment of commitment.
	let armed = $state(false);
	let sending = $state(false);
	// Per-broadcast in-flight guard: prevents a double-click on Retry from
	// firing two concurrent retryBroadcast actions and double-sending.
	let retrying = new SvelteSet<number>();

	// The chat service counts graphemes, so the counter does too — a run of
	// emoji shouldn't read as "over" when it isn't.
	const bodyLength = $derived(graphemeCount(body));
	const dmOverflow = $derived(channel === 'dm' && bodyLength > DM_MAX_GRAPHEMES);
	const draftReady = $derived(
		body.trim().length > 0 && (channel === 'email' ? subject.trim().length > 0 : !dmOverflow)
	);
	const canSend = $derived(draftReady && recipientCount > 0);
	const testAction = $derived(channel === 'email' ? '?/emailTest' : '?/dmTest');
	const sendAction = $derived(channel === 'email' ? '?/emailBroadcast' : '?/dmBroadcast');

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

<section aria-labelledby="email-head">
	<div class="section-head">
		<h2 class="display section-title" id="email-head">Email &amp; DMs</h2>
	</div>

	<fieldset class="channel">
		<legend class="kicker">Send as</legend>
		<div class="chips">
			<label class="chip">
				<input type="radio" name="channel" value="email" bind:group={channel} onchange={() => (armed = false)} />
				<span>Email</span>
			</label>
			<label class="chip">
				<input type="radio" name="channel" value="dm" bind:group={channel} onchange={() => (armed = false)} />
				<span>Bluesky DM</span>
			</label>
		</div>
	</fieldset>

	{#if !configured && channel === 'email'}
		<p class="warn" role="alert">
			Email isn’t set up yet. Enroll <code>buildersretre.at</code> in comail, then set the
			<code>COMAIL_API_KEY</code> secret (vars <code>EMAIL_FROM</code> and <code>COMAIL_DID</code> ship in
			wrangler.jsonc). Until then, composing is disabled.
		</p>
	{:else if !configured}
		<p class="warn" role="alert">
			DMs aren’t set up yet. On the sending Bluesky account, create an app password with
			<em>Allow access to your direct messages</em> checked, then set the <code>BSKY_DM_HANDLE</code> and
			<code>BSKY_DM_APP_PASSWORD</code> secrets. Until then, composing is disabled.
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
			{#if channel === 'email'}
				<label class="kicker" for="email-subject">Subject</label>
				<input id="email-subject" name="subject" bind:value={subject} maxlength="200" autocomplete="off" />
			{/if}

			<div class="body-head">
				<label class="kicker" for="email-body">{channel === 'email' ? 'Body (plain text)' : 'Message'}</label>
				{#if channel === 'dm'}
					<span class="kicker counter" class:over={dmOverflow} aria-live="polite">{bodyLength}/{DM_MAX_GRAPHEMES}</span>
				{/if}
			</div>
			<textarea id="email-body" name="body" bind:value={body} rows="8"></textarea>
			{#if channel === 'dm'}
				<p class="hint">
					Links become tappable. Only people who allow DMs from anyone — or who follow the sending account — can be
					reached; anyone else shows as failed in the history.
				</p>
			{/if}

			<div class="send-row">
				<div class="test-to">
					{#if channel === 'email'}
						<label class="kicker" for="email-test-to">Test address</label>
						<input id="email-test-to" name="to" type="email" placeholder="you@example.com" autocomplete="off" />
					{:else}
						<label class="kicker" for="dm-test-to">Test handle</label>
						<input id="dm-test-to" name="to" type="text" placeholder="you.bsky.social" autocomplete="off" />
					{/if}
				</div>
				<button class="btn-ghost" formaction={testAction} disabled={!draftReady || sending}>Send test</button>
			</div>

			<fieldset class="audience">
				<legend class="kicker">Send to</legend>
				<div class="chips">
					{#each audiences as a (a.id)}
						<label class="chip" class:empty={a.counts[channel] === 0}>
							<input type="radio" name="audience" value={a.id} bind:group={audience} onchange={() => (armed = false)} />
							<span>{a.label}</span>
							<span class="chip-n">{a.counts[channel]}</span>
						</label>
					{/each}
				</div>
			</fieldset>

			<div class="send-row">
				{#if armed}
					<button class="pill confirm-pill" formaction={sendAction} disabled={!canSend || sending}>
						Really {channel === 'email' ? 'send' : 'DM'} {recipientCount} {recipientCount === 1 ? 'person' : 'people'} · {picked?.label ?? ''}
					</button>
					<button class="btn-ghost" type="button" onclick={() => (armed = false)}>Cancel</button>
				{:else}
					<button class="btn-ghost arm-btn" type="button" disabled={!canSend || sending} onclick={() => (armed = true)}>
						{channel === 'email' ? 'Send' : 'DM'} {recipientCount} {recipientCount === 1 ? 'person' : 'people'}…
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

	/* Channel + audience selectors: the survey's chip language at organizer
	   density. Audience chips carry a count so the choice and its reach read
	   together; the count follows whichever channel is picked. */
	.channel,
	.audience {
		border: 0;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.channel legend,
	.audience legend {
		color: var(--ink-70);
		padding: 0;
		margin-bottom: 0.5rem;
	}

	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.chip {
		position: relative;
		display: inline-flex;
		align-items: baseline;
		gap: 0.45rem;
		border: 1px solid var(--ink-45);
		border-radius: 999px;
		padding: 0.4rem 0.85rem;
		font-size: 0.8125rem;
		color: var(--ink-70);
		cursor: pointer;
		transition:
			background 0.15s var(--ease-out),
			color 0.15s var(--ease-out);
	}

	.chip input {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
	}

	.chip-n {
		font-variant-numeric: tabular-nums;
		color: var(--ink-45);
	}

	.chip.empty {
		color: var(--ink-45);
	}

	.chip:has(input:checked) {
		background: var(--ink);
		color: var(--on-pill);
		border-color: var(--ink);
		font-weight: 600;
	}

	.chip:has(input:checked) .chip-n {
		color: var(--on-pill);
		opacity: 0.7;
	}

	.chip:has(input:focus-visible) {
		outline: 2px solid var(--ink);
		outline-offset: 3px;
	}

	.body-head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: var(--space-3);
	}

	.counter {
		font-variant-numeric: tabular-nums;
		color: var(--ink-45);
	}

	/* Over the cap: full ink weight, no second color — same rule as failed rows. */
	.counter.over {
		color: var(--ink);
		font-weight: 600;
	}

	.hint {
		font-size: 0.8125rem;
		line-height: 1.5;
		color: var(--ink-70);
		max-width: 62ch;
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
