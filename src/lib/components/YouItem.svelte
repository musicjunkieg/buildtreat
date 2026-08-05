<script lang="ts">
	import QuestionScaffold from '$lib/components/QuestionScaffold.svelte';
	import { youQuestion } from '$lib/content';
	import type { SurveyState } from '$lib/survey.svelte';

	let {
		survey,
		signedIn,
		handle,
		onsignin
	}: {
		survey: SurveyState;
		signedIn: boolean;
		handle: string | null;
		onsignin: () => void;
	} = $props();
</script>

<QuestionScaffold titleId="you-title" title={youQuestion.title} prompt={youQuestion.prompt} {signedIn} {onsignin}>
	{#if handle}
		<p class="signed">answering as <span class="handle">@{handle}</span></p>
	{/if}
	<div class="field">
		<label class="kicker" for="you-name">Name</label>
		<input id="you-name" type="text" autocomplete="name" bind:value={survey.name} onblur={() => survey.saveLocal()} />
	</div>
	<div class="field">
		<label class="kicker" for="you-email">Email</label>
		<input
			id="you-email"
			type="email"
			autocomplete="email"
			bind:value={survey.email}
			onblur={() => survey.saveLocal()}
			aria-invalid={!survey.emailValid}
			aria-describedby={survey.emailValid ? undefined : 'you-email-error'}
		/>
		{#if !survey.emailValid}
			<p id="you-email-error" class="error">That doesn’t look like an email address — check for typos.</p>
		{/if}
	</div>
	<div class="field">
		<label class="kicker" for="you-location">Where you’re based</label>
		<input
			id="you-location"
			type="text"
			placeholder="City, region, or timezone"
			bind:value={survey.homeLocation}
			onblur={() => survey.saveLocal()}
		/>
	</div>
</QuestionScaffold>

<style>
	.signed {
		font-size: var(--text-author);
		color: var(--ink-70);
	}

	.handle {
		color: var(--ink);
		font-weight: 550;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
	}

	.field label {
		color: var(--ink-70);
	}

	.field input {
		background: transparent;
		border: none;
		border-bottom: 1px solid var(--ink-45);
		padding: 0.45rem 0 0.55rem;
		font-size: 1.125rem;
		border-radius: 0;
		caret-color: var(--ink);
		transition: border-color 0.25s var(--ease-out);
	}

	.field input::placeholder {
		color: var(--ink-45);
	}

	.field input:focus {
		outline: none;
		border-bottom-color: var(--ink);
	}

	.field input[aria-invalid='true'] {
		border-bottom-color: var(--ink);
		border-bottom-width: 2px;
	}

	.error {
		font-size: var(--text-author);
		color: var(--ink);
	}
</style>
