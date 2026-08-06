<script lang="ts">
	import { logout } from '@svelte-atproto/oauth/client';
	import QuestionScaffold from '$lib/components/QuestionScaffold.svelte';
	import { youQuestion } from '$lib/content';
	import type { SurveyState } from '$lib/survey.svelte';

	let {
		survey,
		signedIn,
		handle,
		onsignin,
		onnext
	}: {
		survey: SurveyState;
		signedIn: boolean;
		handle: string | null;
		onsignin: () => void;
		onnext?: () => void;
	} = $props();

	function fieldEnter(e: KeyboardEvent, nextId: string | null) {
		if (e.key !== 'Enter') return;
		e.preventDefault();
		if (nextId) {
			document.getElementById(nextId)?.focus();
		} else if (survey.youComplete) {
			onnext?.();
		}
	}

	/** ZIP lookup: five digits resolve to "City, ST" via zippopotam.us. */
	let zipStatus = $state<'idle' | 'looking' | 'notfound'>('idle');
	let zipTimer: ReturnType<typeof setTimeout> | undefined;
	let zipSeq = 0;

	async function resolveZip(raw: string) {
		const seq = ++zipSeq;
		zipStatus = 'looking';
		try {
			const res = await fetch(`https://api.zippopotam.us/us/${raw}`);
			if (!res.ok) throw new Error(String(res.status));
			const data = (await res.json()) as { places?: { 'place name': string; 'state abbreviation': string }[] };
			if (seq !== zipSeq) return; // a newer lookup superseded this one
			// Only apply if the field still holds exactly what we looked up —
			// never clobber text the user kept typing (e.g. a ZIP+4).
			if (survey.homeLocation.trim() !== raw) return;
			const place = data.places?.[0];
			if (place) {
				survey.homeLocation = `${place['place name']}, ${place['state abbreviation']}`;
				zipStatus = 'idle';
				survey.saveLocal();
			} else {
				zipStatus = 'notfound';
			}
		} catch {
			// Offline or unknown ZIP — leave what they typed; it's still an answer.
			if (seq === zipSeq) zipStatus = 'notfound';
		}
	}

	function scheduleZip(delay: number) {
		clearTimeout(zipTimer);
		const raw = survey.homeLocation.trim();
		if (!/^\d{5}$/.test(raw)) return;
		zipTimer = setTimeout(() => void resolveZip(raw), delay);
	}

	function locationInput() {
		if (zipStatus === 'notfound') zipStatus = 'idle';
		scheduleZip(400);
	}
</script>

<QuestionScaffold titleId="you-title" title={youQuestion.title} prompt={youQuestion.prompt} {signedIn} {onsignin} complete={survey.youComplete} {onnext}>
	{#if handle}
		<p class="signed">
			answering as <span class="handle">@{handle}</span>
			<button class="signout" onclick={() => void logout()}>not you? sign out</button>
		</p>
	{/if}
	<div class="field">
		<label class="kicker" for="you-name">Name</label>
		<input id="you-name" type="text" autocomplete="name" bind:value={survey.name} onblur={() => survey.saveLocal()} onkeydown={(e) => fieldEnter(e, 'you-email')} />
	</div>
	<div class="field">
		<label class="kicker" for="you-email">Email</label>
		<input
			id="you-email"
			type="email"
			autocomplete="email"
			bind:value={survey.email}
			onblur={() => survey.saveLocal()}
			onkeydown={(e) => fieldEnter(e, 'you-location')}
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
			placeholder="City, state — or ZIP code"
			bind:value={survey.homeLocation}
			oninput={locationInput}
			onblur={() => {
				scheduleZip(0);
				survey.saveLocal();
			}}
			onkeydown={(e) => fieldEnter(e, null)}
		/>
		{#if zipStatus === 'looking'}
			<p class="zip-hint">Looking up that ZIP…</p>
		{:else if zipStatus === 'notfound'}
			<p class="zip-hint">Couldn’t match that ZIP — city and state works too.</p>
		{/if}
	</div>
</QuestionScaffold>

<style>
	.signed {
		font-size: var(--text-author);
		color: var(--ink-70);
	}

	.signout {
		margin-left: 0.5rem;
		font-size: var(--text-author);
		color: var(--ink-45);
		text-decoration: underline;
		text-underline-offset: 3px;
	}

	.signout:hover {
		color: var(--ink);
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

	.zip-hint {
		font-size: var(--text-author);
		color: var(--ink-70);
	}
</style>
