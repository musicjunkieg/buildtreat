<script lang="ts">
	let {
		label = 'Next',
		show,
		onnext
	}: {
		label?: string;
		show: boolean;
		onnext: () => void;
	} = $props();
</script>

{#if show}
	<div class="next-row">
		<button class="next" onclick={onnext}>
			{label}
			<span class="arrow" aria-hidden="true">↓</span>
		</button>
		<span class="key-hint" aria-hidden="true">or press <kbd>↵ Enter</kbd></span>
	</div>
{/if}

<style>
	.next-row {
		display: flex;
		align-items: center;
		gap: 0.9rem;
		margin-top: var(--space-3);
		animation: rise 0.45s var(--ease-out);
	}

	@keyframes rise {
		from {
			translate: 0 10px;
			opacity: 0;
		}
	}

	.next {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.55rem 1.3rem;
		border-radius: 999px;
		background: var(--ink);
		color: var(--on-pill);
		font-weight: 650;
		font-size: 0.9375rem;
		transition: transform 0.3s var(--ease-out);
	}

	.next:hover {
		transform: scale(1.04);
	}

	.arrow {
		font-size: 0.85em;
	}

	.key-hint {
		font-size: 0.75rem;
		color: var(--ink-45);
	}

	kbd {
		font-family: inherit;
		color: var(--ink-70);
	}

	@media (pointer: coarse) {
		.key-hint {
			display: none;
		}
	}
</style>
