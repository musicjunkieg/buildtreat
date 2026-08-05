<script lang="ts">
	import Icon from '$lib/components/Icon.svelte';
	import { retreat } from '$lib/content';

	let {
		signedIn,
		organizerAvatar = null,
		onsignin,
		oncontinue
	}: {
		signedIn: boolean;
		organizerAvatar?: string | null;
		onsignin: () => void;
		oncontinue: () => void;
	} = $props();
</script>

<div class="hero">
	<p class="kicker">{retreat.kicker}</p>

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
	</ul>

	{#if signedIn}
		<button class="pill" onclick={oncontinue}>Start the survey</button>
	{:else}
		<button class="pill" onclick={onsignin}>
			{retreat.signIn}
			<Icon name="butterfly" size={19} />
		</button>
	{/if}

	<p class="author">
		{#if organizerAvatar}
			<img class="avatar" src={organizerAvatar} alt="" />
		{:else}
			<span class="avatar" aria-hidden="true"><Icon name="person" size={14} /></span>
		{/if}
		{retreat.organizerLabel} <span class="handle">@{retreat.organizerHandle}</span>
	</p>
</div>

<style>
	.hero {
		display: flex;
		flex-direction: column;
		height: 100%;
		gap: var(--space-3);
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

	.author {
		display: flex;
		align-items: center;
		gap: 0.55rem;
		margin-top: var(--space-2);
		font-size: var(--text-author);
		color: var(--ink-70);
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

	.handle {
		color: var(--ink);
		font-weight: 550;
	}
</style>
