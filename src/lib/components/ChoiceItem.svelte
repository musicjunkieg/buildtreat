<script lang="ts">
	import QuestionScaffold from '$lib/components/QuestionScaffold.svelte';

	let {
		titleId,
		title,
		prompt,
		name,
		options,
		value,
		signedIn,
		onsignin,
		onchange,
		onnext
	}: {
		titleId: string;
		title: string;
		prompt: string;
		name: string;
		options: readonly { value: string; label: string }[];
		value: string | null;
		signedIn: boolean;
		onsignin: () => void;
		onchange: (value: string) => void;
		onnext?: () => void;
	} = $props();
</script>

<QuestionScaffold {titleId} {title} {prompt} {signedIn} {onsignin} complete={value !== null} {onnext}>
	<fieldset class="options" aria-labelledby={titleId}>
		{#each options as option (option.value)}
			<label class="option" class:on={value === option.value}>
				<input
					type="radio"
					{name}
					value={option.value}
					checked={value === option.value}
					onchange={() => onchange(option.value)}
				/>
				<span class="ring" aria-hidden="true"></span>
				<span class="label">{option.label}</span>
			</label>
		{/each}
	</fieldset>
</QuestionScaffold>

<style>
	.options {
		border: none;
		display: flex;
		flex-direction: column;
	}

	.option {
		display: flex;
		align-items: center;
		gap: 0.9rem;
		padding: 0.95rem 0;
		border-top: var(--hairline);
		cursor: pointer;
		color: var(--ink-70);
		transition: color 0.25s var(--ease-out);
	}

	.option:last-child {
		border-bottom: var(--hairline);
	}

	.option:hover,
	.option.on {
		color: var(--ink);
	}

	.option input {
		position: absolute;
		opacity: 0;
		width: 1px;
		height: 1px;
	}

	.ring {
		flex: 0 0 auto;
		width: 1.15rem;
		height: 1.15rem;
		border-radius: 999px;
		border: 1.75px solid currentColor;
		display: grid;
		place-items: center;
		transition: background 0.2s var(--ease-out);
	}

	.option.on .ring {
		background: var(--ink);
		border-color: var(--ink);
		box-shadow: inset 0 0 0 3px var(--ground);
	}

	.option input:focus-visible + .ring {
		outline: 2px solid var(--ink);
		outline-offset: 3px;
	}

	.label {
		font-size: 1.0625rem;
		line-height: 1.4;
	}
</style>
