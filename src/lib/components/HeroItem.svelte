<script lang="ts">
	import { enhance } from '$app/forms';
	import { logout } from '@svelte-atproto/oauth/client';
	import Icon from '$lib/components/Icon.svelte';
	import { retreat, waitlist } from '$lib/content';

	let {
		signedIn,
		notInvited = false,
		deniedHandle = null,
		waitlistState = 'none',
		waitlistEmail = null,
		waitlistError = null,
		closed = false,
		deadlineDisplay = null,
		organizerAvatar = null,
		onsignin,
		oncontinue
	}: {
		signedIn: boolean;
		notInvited?: boolean;
		deniedHandle?: string | null;
		waitlistState?: 'none' | 'member';
		waitlistEmail?: string | null;
		waitlistError?: string | null;
		closed?: boolean;
		deadlineDisplay?: string | null;
		organizerAvatar?: string | null;
		onsignin: () => void;
		oncontinue: () => void;
	} = $props();

	let joining = $state(false);
</script>

<div class="hero">
	<div class="topline">
		<p class="kicker">{retreat.kicker}</p>
		{#if signedIn || notInvited}
			<button class="signout" onclick={() => void logout()}>sign out</button>
		{/if}
	</div>

	<div class="breathe" aria-hidden="true"></div>

	<p class="ack">
		{retreat.acknowledgment[0]}<br />{retreat.acknowledgment[1]}
	</p>

	<h1 id="hero-title" class="display name">
		<span class="l1">{retreat.nameLines[0]}</span>
		<span class="l2">{retreat.nameLines[1]}</span>
	</h1>

	<ul class="ledger facts">
		{#each retreat.facts as fact (fact.label)}
			<li>
				<span class="fact-label">{fact.label}</span>
				<span class="fact-value">
					{#if 'bluesky' in fact && fact.bluesky}
						<!-- Keep the mark glued to the last word so it never wraps alone. -->
						{fact.value.split(' ').slice(0, -1).join(' ')}
						<span class="keep">
							{fact.value.split(' ').at(-1)}
							<Icon name="butterfly" size={15} label="Bluesky" />
						</span>
					{:else}
						{fact.value}
					{/if}
				</span>
			</li>
		{/each}
		{#if deadlineDisplay}
			<li>
				<span class="fact-label">Respond by</span>
				<span class="fact-value">{deadlineDisplay}, 11:59 PM Pacific</span>
			</li>
		{/if}
	</ul>

	{#if notInvited && waitlistState === 'member'}
		<div class="waitlist-note">
			<!-- Live region wraps only the changing text; the DM link stays
			     outside it (a control inside role=status is re-announced and
			     mishandled by some assistive tech). -->
			<p class="closed-note" role="status">
				<strong>{waitlist.member.lead}</strong>
				{waitlist.member.body}{waitlistEmail ? ` We’ll reach you at ${waitlistEmail}.` : ''}
			</p>
			<p class="waitlist-aside">
				{waitlist.member.change} DM
				<a class="handle" href={retreat.organizerLink} target="_blank" rel="noopener">@{retreat.organizerHandle}</a>.
			</p>
		</div>
	{:else if notInvited}
		<div class="waitlist-join">
			<p class="closed-note">{waitlist.invite.body}</p>
			<form method="POST" action="?/joinWaitlist" use:enhance={() => {
				joining = true;
				return async ({ update }) => {
					await update();
					joining = false;
				};
			}}>
				<label class="waitlist-field">
					<span class="kicker">{waitlist.invite.emailLabel}</span>
					<input
						type="email"
						name="email"
						required
						autocomplete="email"
						placeholder="you@example.com"
						aria-invalid={waitlistError ? 'true' : undefined}
					/>
				</label>
				{#if waitlistError}
					<p class="waitlist-error" role="alert">{waitlistError}</p>
				{/if}
				<button class="pill" type="submit" disabled={joining}>
					{joining ? 'Adding you…' : waitlist.invite.cta}
				</button>
			</form>
			<p class="waitlist-aside">
				{waitlist.invite.mistake} DM
				<a class="handle" href={retreat.organizerLink} target="_blank" rel="noopener">@{retreat.organizerHandle}</a>.
			</p>
		</div>
	{:else if closed}
		<p class="closed-note">
			Responses closed {deadlineDisplay ?? ''} — thanks to everyone who answered. Need to change something?
			DM <a class="handle" href={retreat.organizerLink} target="_blank" rel="noopener">@{retreat.organizerHandle}</a>.
		</p>
	{:else if signedIn}
		<button class="pill" onclick={oncontinue}>Start the survey</button>
	{:else}
		<button class="pill" onclick={onsignin}>
			{retreat.signIn}
			<Icon name="butterfly" size={19} />
		</button>
		<p class="two-track">{waitlist.twoTrack}</p>
	{/if}

	<p class="author">
		<span class="avatars" aria-hidden="true">
			<span class="avatar mark"><Icon name="butterfly" size={15} /></span>
			{#if organizerAvatar}
				<img class="avatar overlap" src={organizerAvatar} alt="" />
			{:else}
				<span class="avatar overlap"><Icon name="person" size={14} /></span>
			{/if}
		</span>
		<span class="author-text">
			{retreat.organizerLine}
			<a class="handle" href={retreat.organizerLink} target="_blank" rel="noopener">@{retreat.organizerHandle}</a>
		</span>
	</p>
</div>

<style>
	.hero {
		display: flex;
		flex-direction: column;
		height: 100%;
		gap: var(--space-3);
	}

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
		min-height: 12vh;
	}

	.ack {
		font-size: var(--text-ack);
		line-height: 1.4;
		max-width: 38ch;
	}

	.name {
		display: flex;
		flex-direction: column;
		margin-block: var(--space-1) var(--space-2);
	}

	.l1 {
		font-size: var(--display-l1);
	}

	.l2 {
		font-size: var(--display-l2);
	}

	.facts {
		margin-bottom: var(--space-3);
	}

	.fact-label {
		color: var(--ink-70);
		flex: 0 0 auto;
	}

	.fact-value {
		text-align: right;
		text-wrap: balance;
	}

	.keep {
		white-space: nowrap;
	}

	.keep :global(svg) {
		vertical-align: -0.15em;
		margin-left: 0.2rem;
	}

	.closed-note {
		font-size: var(--text-body);
		line-height: 1.5;
		color: var(--ink-70);
		max-width: 44ch;
		padding: 0.9rem 0;
	}

	.closed-note .handle {
		color: var(--ink);
		font-weight: 550;
	}

	.closed-note strong {
		color: var(--ink);
		font-weight: 650;
	}

	/* Two-track line under the sign-in CTA: sets expectations before auth so
	   neither audience is surprised by where sign-in lands them. */
	.two-track {
		font-size: var(--text-author);
		line-height: 1.5;
		color: var(--ink-70);
		max-width: 42ch;
		margin-top: var(--space-2);
	}

	/* Waitlist join + confirmation share the note measure; the join carries
	   the survey's underline-input grammar and the one white pill. */
	.waitlist-join,
	.waitlist-note {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		max-width: 44ch;
	}

	.waitlist-join .closed-note,
	.waitlist-note .closed-note {
		padding: 0;
	}

	.waitlist-join form {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.waitlist-field {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}

	.waitlist-field .kicker {
		color: var(--ink-70);
	}

	.waitlist-field input {
		background: transparent;
		border: none;
		border-bottom: 1px solid var(--ink-45);
		border-radius: 0;
		padding: 0.4rem 0;
		font-size: var(--text-input);
		color: var(--ink);
		color-scheme: dark;
	}

	.waitlist-field input::placeholder {
		color: var(--ink-45);
	}

	.waitlist-field input:focus {
		outline: none;
		border-bottom-color: var(--ink);
	}

	.waitlist-field input[aria-invalid='true'] {
		border-bottom-color: var(--ink);
	}

	.waitlist-error {
		font-size: var(--text-author);
		color: var(--ink);
		line-height: 1.4;
	}

	.waitlist-aside {
		font-size: var(--text-author);
		color: var(--ink-70);
		line-height: 1.4;
	}

	.waitlist-aside .handle {
		color: var(--ink);
		font-weight: 550;
	}

	.author {
		display: flex;
		align-items: center;
		gap: 0.65rem;
		margin-top: var(--space-2);
		font-size: var(--text-author);
		color: var(--ink-70);
	}

	.avatars {
		display: flex;
		flex: 0 0 auto;
	}

	.avatar {
		display: grid;
		place-items: center;
		width: 1.9rem;
		height: 1.9rem;
		border-radius: 999px;
		border: 1px solid var(--ink-45);
		color: var(--ink-70);
		object-fit: cover;
	}

	.avatar.mark {
		color: var(--ink);
		background: var(--ground);
	}

	.avatar.overlap {
		margin-left: -0.55rem;
		background: var(--ground);
	}

	.author-text {
		line-height: 1.35;
		text-wrap: balance;
	}

	.handle {
		color: var(--ink);
		font-weight: 550;
	}

	a.handle {
		text-decoration: underline;
		text-underline-offset: 3px;
		text-decoration-color: var(--ink-45);
	}

	a.handle:hover {
		text-decoration-color: var(--ink);
	}
</style>
