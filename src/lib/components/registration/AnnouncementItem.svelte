<script lang="ts">
	import { enhance } from '$app/forms';
	import { logout } from '@svelte-atproto/oauth/client';
	import Icon from '$lib/components/Icon.svelte';
	import { registration, retreat } from '$lib/content';

	// Aliased on destructure: a local binding literally named `state` makes
	// the `$state` rune below ambiguous to the Svelte compiler.
	let {
		state: regState,
		deadlineDisplay = null,
		organizerAvatar = null,
		busy = false,
		onconfirm
	}: {
		state: 'open' | 'declined' | 'closed';
		deadlineDisplay?: string | null;
		organizerAvatar?: string | null;
		busy?: boolean;
		onconfirm: () => void;
	} = $props();

	let declining = $state(false);
</script>

<div class="ann">
	<div class="topline">
		<p class="kicker">{registration.kicker}</p>
		<button class="signout" onclick={() => void logout()}>sign out</button>
	</div>

	<div class="breathe" aria-hidden="true"></div>

	<p class="ack">{registration.ack[0]}<br />{registration.ack[1]}</p>

	<h1 id="ann-title" class="display date">
		<span class="l1">{registration.dateLines[0]}</span>
		<span class="l2">{registration.dateLines[1]}</span>
	</h1>

	<ul class="ledger facts">
		{#each registration.facts as fact (fact.label)}
			<li class:muted={fact.muted}>
				<span class="fact-label">{fact.label}</span>
				{#if fact.value}
					<span class="fact-value">
						{#if fact.value === 'Bluesky'}
							<span class="keep">{fact.value} <Icon name="butterfly" size={15} label="Bluesky" /></span>
						{:else}
							{fact.value}
						{/if}
					</span>
				{/if}
			</li>
		{/each}
	</ul>

	{#if regState === 'closed'}
		<p class="note" role="status">
			<strong>{registration.closedLead}</strong>
			{registration.closedBody}
			<a class="handle" href={retreat.organizerLink} target="_blank" rel="noopener">@{retreat.organizerHandle}</a>.
		</p>
	{:else if regState === 'declined'}
		<p class="note" role="status"><strong>{registration.declinedLead}</strong> {registration.declinedBody}</p>
		<button class="pill" onclick={onconfirm} disabled={busy}>{registration.declinedUndo}</button>
	{:else}
		<div class="actions">
			<button class="pill" onclick={onconfirm} disabled={busy}>{registration.confirm}</button>
			<form
				method="POST"
				action="?/decline"
				use:enhance={() => {
					declining = true;
					return async ({ update }) => {
						await update();
						declining = false;
					};
				}}
			>
				<button class="quiet" type="submit" disabled={declining || busy}>{registration.decline}</button>
			</form>
		</div>
	{/if}

	<p class="author">
		<span class="avatar" style:background-image={organizerAvatar ? `url(${organizerAvatar})` : undefined}></span>
		<span class="author-text"
			>{retreat.organizerLine}
			<a class="handle" href={retreat.organizerLink} target="_blank" rel="noopener">@{retreat.organizerHandle}</a></span
		>
	</p>
</div>

<style>
	.ann {
		display: flex;
		flex-direction: column;
		min-height: 100%;
	}

	/* Copied verbatim from HeroItem.svelte's .topline/.signout — same kicker
	   row grammar, no visual truth in the comp (it doesn't model app chrome). */
	.topline {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: var(--space-3);
	}

	.signout {
		flex: 0 0 auto;
		font-size: var(--text-kicker);
		letter-spacing: var(--track-caps);
		text-transform: uppercase;
		color: var(--ink-70);
		text-decoration: underline;
		text-underline-offset: 3px;
	}

	.signout:hover {
		color: var(--ink);
	}

	.breathe {
		flex: 1 1 auto;
		min-height: 10vh;
	}

	.ack {
		font-size: var(--text-ack);
		line-height: 1.4;
		margin-bottom: var(--space-2);
		max-width: 22ch;
	}

	.date {
		display: grid;
	}

	.l1 {
		font-size: var(--display-l1);
	}

	.l2 {
		font-size: var(--display-l2);
	}

	.facts {
		margin: var(--space-3) 0;
	}

	.facts li.muted .fact-label {
		color: var(--ink-70);
	}

	.fact-value {
		color: var(--ink-70);
		text-align: right;
		text-wrap: balance;
	}

	.keep {
		white-space: nowrap;
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
	}

	.actions {
		display: grid;
		gap: var(--space-2);
		justify-items: center;
	}

	.quiet {
		font-size: var(--text-author);
		color: var(--ink-70);
		text-decoration: underline;
		text-underline-offset: 3px;
	}

	.quiet:disabled {
		opacity: 0.55;
	}

	.note {
		font-size: var(--text-author);
		line-height: 1.5;
		color: var(--ink-70);
		max-width: 40ch;
		margin-bottom: var(--space-3);
	}

	.note strong {
		color: var(--ink);
		font-weight: 550;
	}

	.handle {
		color: var(--ink);
		font-weight: 550;
		text-decoration: underline;
		text-underline-offset: 3px;
	}

	.author {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		margin-top: var(--space-3);
		font-size: var(--text-author);
		color: var(--ink-70);
	}

	.author-text {
		line-height: 1.35;
		text-wrap: balance;
	}

	.avatar {
		width: 1.9rem;
		height: 1.9rem;
		border-radius: 999px;
		border: 1px solid var(--ink-45);
		background: var(--ink-12) center/cover no-repeat;
	}
</style>
