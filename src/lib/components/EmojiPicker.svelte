<script lang="ts">
	import { EMOJIS } from '$lib/types';

	let { onpick, onclose }: { onpick: (emoji: string) => void; onclose: () => void } = $props();
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && onclose()} />

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="backdrop" onclick={onclose}></div>
<div class="picker" role="dialog" aria-label="Choose an icon">
	{#each EMOJIS as emoji (emoji)}
		<button onclick={() => onpick(emoji)}>{emoji}</button>
	{/each}
</div>

<style>
	.backdrop {
		position: fixed;
		inset: 0;
		z-index: 10;
	}
	.picker {
		position: absolute;
		z-index: 11;
		top: 100%;
		left: 0;
		display: grid;
		grid-template-columns: repeat(6, 1fr);
		gap: 2px;
		padding: 6px;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 8px;
		box-shadow: 0 4px 16px rgb(0 0 0 / 0.15);
	}
	button {
		font-size: 20px;
		width: 34px;
		height: 34px;
		border: none;
		background: transparent;
		border-radius: 6px;
		cursor: pointer;
		padding: 0;
	}
	button:hover {
		background: var(--focus-bg);
	}
</style>
