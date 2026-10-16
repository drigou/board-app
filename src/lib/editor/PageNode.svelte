<script lang="ts">
	import { NodeResizer, useSvelteFlow, type NodeProps } from '@xyflow/svelte';
	import EditableText from './EditableText.svelte';
	import { getEditor } from './context';
	import { PAGE_H, PAGE_MIN_H, PAGE_MIN_W, PAGE_W, PAPER_SIZES, paperLabel, type PageNode } from './editor.svelte';

	let { id, data, selected, width, height }: NodeProps<PageNode> = $props();
	const editor = getEditor();
	const flow = useSvelteFlow();

	let w = $derived(width ?? PAGE_W);
	let h = $derived(height ?? PAGE_H);
	let label = $derived(paperLabel(w, h));

	const options = PAPER_SIZES.flatMap((p) => [
		{ label: `${p.name} landscape`, w: p.w, h: p.h },
		{ label: `${p.name} portrait`, w: p.h, h: p.w }
	]);

	/** Right/bottom edge of the tables on this page (page-relative). */
	function contentSize() {
		let width = 0;
		let height = 0;
		for (const n of editor.nodes) {
			if (n.parentId !== id) continue;
			const m = flow.getInternalNode(n.id)?.measured;
			width = Math.max(width, n.position.x + (m?.width ?? 0));
			height = Math.max(height, n.position.y + (m?.height ?? 0));
		}
		return { width, height };
	}

	function pickSize(e: Event & { currentTarget: HTMLSelectElement }) {
		const opt = options.find((o) => o.label === e.currentTarget.value);
		if (!opt) return;
		if (!editor.setPageSize(id, opt.w, opt.h, contentSize())) {
			alert(`The tables on this page don't fit on ${opt.label}. Move them first.`);
		}
		e.currentTarget.value = label;
	}
</script>

<NodeResizer
	isVisible={selected && editor.mode === 'select'}
	minWidth={PAGE_MIN_W}
	minHeight={PAGE_MIN_H}
	color="var(--accent)"
	shouldResize={(_, p) => !editor.pageCollides(id, p)}
	onResizeEnd={() => editor.commit()}
/>

<div class="page" class:selected style:width="{w}px" style:height="{h}px">
	<div class="header">
		<span class="grip" aria-hidden="true">⠿</span>
		<EditableText class="title" value={data.title} onsave={(t) => editor.renamePage(id, t)} />
		<span class="spacer"></span>
		<select class="nodrag" value={label} onchange={pickSize} title="Page size">
			{#if label === 'Custom'}<option>Custom</option>{/if}
			{#each options as o (o.label)}<option>{o.label}</option>{/each}
		</select>
		<button
			class="nodrag danger"
			title="Delete page"
			onclick={() => flow.deleteElements({ nodes: [{ id }] })}>🗑</button>
	</div>
	<span class="size-label">{label}</span>
</div>

<style>
	.page {
		position: relative;
		background: var(--page);
		border: 1px solid var(--page-border);
		box-shadow: 0 2px 12px rgb(0 0 0 / 0.08);
		border-radius: 2px;
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
	button,
	select {
		font-size: 15px;
		padding: 4px 8px;
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
