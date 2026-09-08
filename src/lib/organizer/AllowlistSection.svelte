<script lang="ts">
	import { enhance } from '$app/forms';
	import Icon from '$lib/ui/Icon.svelte';
	import type { AllowlistEntry } from '$lib/server/organizer/admin';

	let { allowlist }: { allowlist: AllowlistEntry[] } = $props();
</script>

<section aria-labelledby="allow-head">
	<div class="section-head">
		<h2 class="display section-title" id="allow-head">Allowlist</h2>
	</div>

	{#if allowlist.length === 0}
		<p class="warn" role="alert">
			The list is empty — right now anyone with the link can respond. Add handles below to make the survey
			invite-only.
		</p>
	{:else}
		<p class="section-sub">
			{allowlist.length} invited · {allowlist.filter((a) => a.responded).length} responded
		</p>
	{/if}

	{#if allowlist.length > 0}
		<ul class="chips" aria-label="Invited handles">
			{#each allowlist as entry (entry.handle)}
				<li class="chip" class:responded={entry.responded}>
					{#if entry.responded}<Icon name="check" size={12} label="Responded" />{/if}
					<span>@{entry.handle}</span>
					<form method="POST" action="?/removeHandle" use:enhance>
						<input type="hidden" name="handle" value={entry.handle} />
						<button class="chip-x" aria-label="Remove @{entry.handle} from the allowlist"><Icon name="x" size={12} /></button>
					</form>
				</li>
			{/each}
		</ul>
	{/if}

	<form method="POST" action="?/addHandles" use:enhance class="add-form">
		<label class="kicker" for="add-handles">Add handles</label>
		<textarea
			id="add-handles"
			name="handles"
			rows="3"
			placeholder="one per line — @ optional, commas and spaces fine"
		></textarea>
		<button class="pill add-pill" type="submit">Add to allowlist</button>
	</form>
</section>

<style>
	/* Duplicated from +page.svelte — Svelte scopes <style> per-component,
	   so the page's section/head/sub rules don't reach this component. */
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

	/* ── allowlist ── */

	.warn {
		font-size: 0.9375rem;
		line-height: 1.5;
		padding: 0.65rem 0;
		border-top: 1px solid var(--ink);
		border-bottom: 1px solid var(--ink);
		max-width: 62ch;
	}

	.chips {
		list-style: none;
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.chip {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		padding: 0.35rem 0.5rem 0.35rem 0.9rem;
		border: 1px solid var(--ink-45);
		border-radius: 999px;
		font-size: 0.8125rem;
	}

	.chip.responded {
		border-color: var(--ink);
	}

	.chip form {
		display: flex;
	}

	.chip-x {
		display: grid;
		place-items: center;
		width: 1.5rem;
		height: 1.5rem;
		border-radius: 999px;
		color: var(--ink-45);
		transition: color 0.15s var(--ease-out);
	}

	.chip-x:hover {
		color: var(--ink);
	}

	.add-form {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		max-width: 34rem;
	}

	.add-form .kicker {
		color: var(--ink-70);
	}

	.add-form textarea {
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

	.add-form textarea::placeholder {
		color: var(--ink-45);
	}

	.add-form textarea:focus {
		outline: none;
		border-bottom-color: var(--ink);
	}

	.add-pill {
		align-self: flex-start;
		width: auto;
	}
</style>
