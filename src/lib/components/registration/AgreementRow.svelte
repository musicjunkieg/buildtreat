<script lang="ts">
	let {
		name,
		label,
		title,
		body,
		version,
		checked = false,
		error = null
	}: {
		name: 'agreeWaiver' | 'agreeCoc';
		label: string;
		title: string;
		body: string;
		version: string;
		checked?: boolean;
		error?: string | null;
	} = $props();

	let on = $state(false);
	let open = $state(false);
	const id = $derived(`${name}-text`);

	$effect(() => {
		on = checked;
	});
</script>

<li class="row" class:on>
	<label class="check">
		<input type="checkbox" {name} bind:checked={on} required aria-describedby={id} aria-invalid={error ? 'true' : undefined} />
		<span class="ring" aria-hidden="true"></span>
		<span class="text">
			{label}
			<button type="button" class="read" aria-expanded={open} aria-controls={id} onclick={() => (open = !open)}>read it</button>
			<span class="ver">{version}</span>
		</span>
	</label>
	{#if error}<p class="error" role="alert">{error}</p>{/if}
	<div class="body" {id} hidden={!open}>
		<p class="body-title">{title}</p>
		{#each body.split('\n\n') as para (para)}
			<p>{para}</p>
		{/each}
	</div>
</li>

<style>
	.row { padding: 0.85rem 0; border-top: var(--hairline); }
	.row:last-child { border-bottom: var(--hairline); }
	.check { display: flex; align-items: center; gap: 0.9rem; cursor: pointer; }
	.check input { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
	.ring { flex: none; width: 1.15rem; height: 1.15rem; border-radius: 999px; border: 1.75px solid currentColor; transition: background 0.2s var(--ease-out); }
	.check input:checked + .ring { background: var(--ink); box-shadow: inset 0 0 0 3px var(--ground); }
	.check input:focus-visible + .ring { outline: 2px solid var(--ink); outline-offset: 3px; }
	.text { font-size: 0.9375rem; line-height: 1.35; }
	.read { color: var(--ink-70); text-decoration: underline; text-underline-offset: 3px; font-size: var(--text-author); margin-left: 0.35rem; }
	.read:hover { color: var(--ink); }
	.ver { color: var(--ink-45); font-size: 0.75rem; letter-spacing: 0.1em; text-transform: uppercase; margin-left: 0.4rem; }
	.error { margin-top: 0.4rem; font-size: var(--text-author); color: var(--ink); }
	.body { margin: var(--space-2) 0 0 2.05rem; display: grid; gap: var(--space-2); color: var(--ink-70); font-size: 0.9375rem; line-height: 1.5; max-width: 60ch; }
	.body[hidden] {
		display: none;
	}
	.body-title { color: var(--ink); font-weight: 550; }
</style>
