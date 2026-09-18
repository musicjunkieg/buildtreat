<script lang="ts">
	import { enhance } from '$app/forms';
	import { dietaryOptions, registration as copy, supportNeeds, travelModes } from '$lib/content';
	import type { RegistrationErrors, RegistrationInput } from '$lib/registration';
	import { needsSupport } from '$lib/registration';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const reg = $derived(data.registration);
	const confirmed = $derived(reg.status === 'confirmed');
	// A failed or successful save echoes what was posted; otherwise the row.
	const initial = $derived<Omit<RegistrationInput, 'agreeWaiver' | 'agreeCoc'>>(
		form?.values ?? {
			name: reg.name,
			email: reg.email,
			phone: reg.phone,
			emergencyName: reg.emergencyName,
			emergencyPhone: reg.emergencyPhone,
			dietary: reg.dietary,
			dietaryOther: reg.dietaryOther,
			accessibility: reg.accessibility,
			notes: reg.notes,
			travelArrival: reg.travelArrival,
			travelDeparture: reg.travelDeparture,
			travelMode: reg.travelMode,
			travelDetails: reg.travelDetails,
			supportNeed: reg.supportNeed,
			supportAmount: reg.supportAmount,
			supportContingent: reg.supportContingent
		}
	);
	const errors = $derived<RegistrationErrors>(form?.errors ?? {});
	const message = $derived(form?.message ?? null);

	let saving = $state(false);
	let mode = $state<string | null>(null);
	let need = $state<string | null>(null);
	let contingent = $state<string | null>(null);
	$effect(() => {
		mode = initial.travelMode;
		need = initial.supportNeed;
		contingent = initial.supportContingent === null ? null : initial.supportContingent ? 'yes' : 'no';
	});
	const supportOpen = $derived(need === 'partial' || need === 'full');

	function when(iso: string): string {
		return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
	}
	const agreed = $derived(reg.agreedAt ? `agreed ${reg.waiverVersion} / ${reg.cocVersion} · ${when(reg.agreedAt)}` : 'not agreed');
</script>

<svelte:head>
	<title>Edit registration — the Atmospheric Builders’ Retreat</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<main class="page">
	<header class="head">
		<a class="back" href="/organizer#reg-head">← Registrations</a>
		<p class="kicker">Edit registration</p>
		<h1 class="display title">{reg.name}</h1>
		<p class="sub">
			{reg.handle ? `@${reg.handle}` : reg.did} · <span class="status status-{reg.status}">{reg.status}</span> · {agreed}
		</p>
		<p class="note">
			Fields only. Status and the agreement record are theirs — this never confirms, declines, or agrees on anyone’s behalf.
		</p>
	</header>

	<form
		method="POST"
		action="?/save"
		class="body"
		use:enhance={() => {
			saving = true;
			return async ({ update }) => {
				await update({ reset: false });
				saving = false;
			};
		}}
	>
		{#if message}
			<p class="flash" role="status">{message}</p>
		{/if}

		<section>
			<div class="sec-head"><span class="kicker">{copy.sections.contact.head}</span></div>
			<div class="grid2">
				<label class="field">
					<span class="kicker lbl">{copy.sections.contact.name}</span>
					<input class="input" name="name" value={initial.name} required aria-invalid={errors.name ? 'true' : undefined} />
					{#if errors.name}<span class="error" role="alert">{errors.name}</span>{/if}
				</label>
				<label class="field">
					<span class="kicker lbl">{copy.sections.contact.email}</span>
					<input class="input" name="email" type="email" value={initial.email} required={confirmed} aria-invalid={errors.email ? 'true' : undefined} />
					{#if errors.email}<span class="error" role="alert">{errors.email}</span>{/if}
				</label>
			</div>
			<label class="field">
				<span class="kicker lbl">{copy.sections.contact.phone}</span>
				<input class="input" name="phone" type="tel" value={initial.phone} />
			</label>
		</section>

		<section>
			<div class="sec-head"><span class="kicker">{copy.sections.food.head}</span></div>
			<div class="chips" role="group" aria-label={copy.sections.food.head}>
				{#each dietaryOptions as opt (opt.id)}
					<label class="chip">
						<input type="checkbox" name="dietary" value={opt.id} checked={initial.dietary.includes(opt.id)} />
						<span>{opt.label}</span>
					</label>
				{/each}
			</div>
			{#if errors.dietary}<span class="error" role="alert">{errors.dietary}</span>{/if}
			<label class="field">
				<span class="kicker lbl">{copy.sections.food.other}</span>
				<input class="input" name="dietaryOther" value={initial.dietaryOther} />
			</label>
		</section>

		<section>
			<div class="sec-head"><span class="kicker">{copy.sections.emergency.head}</span></div>
			<div class="grid2">
				<label class="field">
					<span class="kicker lbl">{copy.sections.emergency.name}</span>
					<input class="input" name="emergencyName" value={initial.emergencyName} required={confirmed} aria-invalid={errors.emergencyName ? 'true' : undefined} />
					{#if errors.emergencyName}<span class="error" role="alert">{errors.emergencyName}</span>{/if}
				</label>
				<label class="field">
					<span class="kicker lbl">{copy.sections.emergency.phone}</span>
					<input class="input" name="emergencyPhone" type="tel" value={initial.emergencyPhone} required={confirmed} aria-invalid={errors.emergencyPhone ? 'true' : undefined} />
					{#if errors.emergencyPhone}<span class="error" role="alert">{errors.emergencyPhone}</span>{/if}
				</label>
			</div>
		</section>

		<section>
			<div class="sec-head"><span class="kicker">{copy.sections.accessibility.head}</span></div>
			<label class="field">
				<span class="kicker lbl">{copy.sections.accessibility.label}</span>
				<textarea class="input textarea" name="accessibility" rows="3">{initial.accessibility}</textarea>
			</label>
		</section>

		<section>
			<div class="sec-head"><span class="kicker">{copy.sections.notes.head}</span></div>
			<label class="field">
				<input class="input" name="notes" value={initial.notes} aria-label={copy.sections.notes.head} />
			</label>
		</section>

		<section>
			<div class="sec-head"><span class="kicker">{copy.sections.travel.head}</span></div>
			<div class="chips" role="radiogroup" aria-label={copy.sections.travel.head}>
				{#each travelModes as m (m.id)}
					<label class="chip">
						<input type="radio" name="travelMode" value={m.id} bind:group={mode} />
						<span>{m.label}</span>
					</label>
				{/each}
				<button type="button" class="quiet" onclick={() => (mode = null)} disabled={mode === null}>clear</button>
			</div>
			{#if errors.travelMode}<span class="error" role="alert">{errors.travelMode}</span>{/if}
			<div class="grid2">
				<label class="field">
					<span class="kicker lbl">{copy.sections.travel.arriving}</span>
					<input class="input" name="travelArrival" value={initial.travelArrival} placeholder={copy.sections.travel.arrivingHint} />
				</label>
				<label class="field">
					<span class="kicker lbl">{copy.sections.travel.leaving}</span>
					<input class="input" name="travelDeparture" value={initial.travelDeparture} placeholder={copy.sections.travel.leavingHint} />
				</label>
			</div>
			<label class="field">
				<span class="kicker lbl">{copy.sections.travel.details}</span>
				<input class="input" name="travelDetails" value={initial.travelDetails} placeholder={copy.sections.travel.detailsHint} />
			</label>
		</section>

		<section>
			<div class="sec-head"><span class="kicker">{copy.sections.support.head}</span></div>
			<div class="chips" role="radiogroup" aria-label={copy.sections.support.need}>
				{#each supportNeeds as n (n.id)}
					<label class="chip">
						<input type="radio" name="supportNeed" value={n.id} bind:group={need} />
						<span>{n.label}</span>
					</label>
				{/each}
				<button type="button" class="quiet" onclick={() => (need = null)} disabled={need === null}>clear</button>
			</div>
			{#if errors.supportNeed}<span class="error" role="alert">{errors.supportNeed}</span>{/if}
			{#if supportOpen}
				<div class="grid2">
					<label class="field">
						<span class="kicker lbl">{copy.sections.support.amount} (USD)</span>
						<input class="input" name="supportAmount" inputmode="numeric" value={initial.supportAmount ?? ''} aria-invalid={errors.supportAmount ? 'true' : undefined} />
						{#if errors.supportAmount}<span class="error" role="alert">{errors.supportAmount}</span>{/if}
					</label>
					<div class="field">
						<span class="kicker lbl">{copy.sections.support.contingent}</span>
						<div class="chips" role="radiogroup" aria-label={copy.sections.support.contingent}>
							<label class="chip"><input type="radio" name="supportContingent" value="yes" bind:group={contingent} /><span>Yes</span></label>
							<label class="chip"><input type="radio" name="supportContingent" value="no" bind:group={contingent} /><span>No</span></label>
						</div>
						{#if errors.supportContingent}<span class="error" role="alert">{errors.supportContingent}</span>{/if}
					</div>
				</div>
			{/if}
		</section>

		<div class="submit">
			<button class="pill save" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</button>
			<a class="quiet" href="/organizer#reg-head">Back without saving</a>
		</div>
	</form>
</main>

<style>
	.page {
		position: relative;
		min-height: 100dvh;
		background: var(--ground);
		padding: var(--space-4) var(--gutter) calc(var(--space-5) + env(safe-area-inset-bottom));
		display: grid;
		gap: var(--space-4);
		max-width: 44rem;
	}

	.page::after {
		content: '';
		position: fixed;
		inset: 0;
		background: url('/media/grain.png');
		background-size: 340px;
		opacity: 0.05;
		mix-blend-mode: screen;
		pointer-events: none;
		z-index: 5;
	}

	.head {
		display: grid;
		gap: var(--space-2);
	}

	.back,
	.quiet {
		font-size: 0.8125rem;
		color: var(--ink-70);
		text-decoration: underline;
		text-underline-offset: 3px;
	}

	.back:hover,
	.quiet:hover:not(:disabled) {
		color: var(--ink);
	}

	.quiet:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.head .kicker {
		color: var(--ink-70);
	}

	.title {
		font-size: clamp(1.9rem, 5vw, 2.6rem);
		font-weight: 650;
	}

	.sub {
		font-size: 0.9375rem;
		color: var(--ink-70);
	}

	.status {
		text-transform: uppercase;
		letter-spacing: var(--track-caps);
		font-size: 0.75rem;
		font-weight: 600;
	}

	.status-confirmed {
		color: var(--ink);
	}

	.status-declined {
		color: var(--ink-45);
	}

	.note {
		font-size: 0.8125rem;
		line-height: 1.5;
		color: var(--ink-45);
		max-width: 52ch;
	}

	.body {
		display: grid;
		gap: var(--space-4);
	}

	section {
		display: grid;
		gap: var(--space-3);
	}

	.sec-head {
		padding-top: var(--space-2);
		border-top: var(--hairline);
	}

	.sec-head .kicker {
		color: var(--ink-70);
	}

	.field {
		display: grid;
		gap: 0.35rem;
	}

	.lbl {
		color: var(--ink-70);
	}

	.input {
		width: 100%;
		background: transparent;
		border: 0;
		border-bottom: 1px solid var(--ink-45);
		border-radius: 0;
		padding: 0.45rem 0;
		font: inherit;
		font-size: 0.9375rem;
		color: var(--ink);
	}

	.input::placeholder {
		color: var(--ink-45);
	}

	.input:focus {
		outline: none;
		border-bottom-color: var(--ink);
	}

	.textarea {
		resize: vertical;
		line-height: 1.4;
	}

	.grid2 {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--space-3);
	}

	.chips {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem;
	}

	.chip {
		position: relative;
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

	.chip:has(input:checked) {
		background: var(--ink);
		color: var(--on-pill);
		border-color: var(--ink);
		font-weight: 600;
	}

	.chip:has(input:focus-visible) {
		outline: 2px solid var(--ink);
		outline-offset: 3px;
	}

	.error {
		font-size: 0.8125rem;
		color: var(--ink);
	}

	.flash {
		font-size: 0.9375rem;
		color: var(--ink);
		border-top: var(--hairline);
		border-bottom: var(--hairline);
		padding: 0.55rem 0;
	}

	.submit {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		flex-wrap: wrap;
	}

	.save {
		width: auto;
		min-height: 0;
		padding: 0.6rem 1.5rem;
		font-size: 0.9375rem;
	}

	@media (max-width: 560px) {
		.grid2 {
			grid-template-columns: 1fr;
		}
	}
</style>
