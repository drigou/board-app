<script lang="ts">
	/** Text that turns into an input on double-click. Calls `onsave` on Enter / blur. */
	let { value, onsave, placeholder = '', class: cls = '' }: {
		value: string;
		onsave: (value: string) => void;
		placeholder?: string;
		class?: string;
	} = $props();

	let editing = $state(false);
	let draft = $state('');

	function start() {
		draft = value;
		editing = true;
	}

	function finish(save: boolean) {
		if (!editing) return;
		editing = false;
		const next = draft.trim();
		if (save && next && next !== value) onsave(next);
	}

	function focus(el: HTMLInputElement) {
		el.focus();
		el.select();
	}
</script>

{#if editing}
	<input
		class="nodrag editable-input {cls}"
		bind:value={draft}
		{placeholder}
		use:focus
		onblur={() => finish(true)}
		onkeydown={(e) => {
			if (e.key === 'Enter') finish(true);
			if (e.key === 'Escape') finish(false);
			e.stopPropagation();
		}}
	/>
{:else}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<span class="editable {cls}" ondblclick={start} title="Double-click to rename">{value || placeholder}</span>
{/if}

<style>
	.editable {
		cursor: inherit;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.editable-input {
		font: inherit;
		color: inherit;
		background: var(--surface);
		border: 1px solid var(--accent);
		border-radius: 4px;
		padding: 0 4px;
		min-width: 0;
		width: 100%;
		outline: none;
	}
</style>
