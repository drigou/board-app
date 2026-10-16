<script lang="ts">
	import { useSvelteFlow, type NodeProps } from '@xyflow/svelte';
	import EditableText from './EditableText.svelte';
	import { getEditor } from './context';
	import { PAGE_H, PAGE_W, type PageNode } from './editor.svelte';

	let { id, data, selected }: NodeProps<PageNode> = $props();
	const editor = getEditor();
	const flow = useSvelteFlow();
</script>

<div class="page" class:selected style:width="{PAGE_W}px" style:height="{PAGE_H}px">
	<div class="header page-drag">
		<span class="grip" aria-hidden="true">⠿</span>
		<EditableText class="title" value={data.title} onsave={(t) => editor.renamePage(id, t)} />
		<span class="spacer"></span>
		<button class="nodrag" onclick={() => editor.addTable(id)}>+ Table</button>
		<button
			class="nodrag danger"
			title="Delete page"
			onclick={() => flow.deleteElements({ nodes: [{ id }] })}>🗑</button>
	</div>
	<span class="size-label">A4</span>
</div>

<style>
	.page {
		position: relative;
		background: var(--page);
		border: 1px solid var(--page-border);
		box-shadow: 0 2px 12px rgb(0 0 0 / 0.08);
		border-radius: 2px;
	}
	.page.selected {
		outline: 2px solid var(--accent);
	}
	.header {
		position: absolute;
		bottom: 100%;
		left: 0;
		right: 0;
		margin-bottom: 8px;
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 22px;
		color: var(--text);
		cursor: grab;
		pointer-events: all;
	}
	.header :global(.title) {
		font-weight: 600;
		max-width: 60%;
	}
	.grip {
		color: var(--muted);
	}
	.spacer {
		flex: 1;
	}
	button {
		font-size: 15px;
		padding: 4px 10px;
		cursor: pointer;
	}
	.size-label {
		position: absolute;
		right: 10px;
		bottom: 6px;
		font-size: 12px;
		color: var(--muted);
	}
</style>
