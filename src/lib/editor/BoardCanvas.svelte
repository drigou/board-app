<script lang="ts">
	import {
		Background,
		BackgroundVariant,
		ConnectionLineType,
		ConnectionMode,
		Controls,
		Panel,
		SvelteFlow,
		type Connection,
		type EdgeTypes,
		type NodeTypes
	} from '@xyflow/svelte';
	import '@xyflow/svelte/dist/style.css';
	import type { BoardContent, Cardinality } from '$lib/types';
	import CardinalityMarkers from './CardinalityMarkers.svelte';
	import PageNode from './PageNode.svelte';
	import RelationEdge from './RelationEdge.svelte';
	import TableNode from './TableNode.svelte';
	import { setEditor } from './context';
	import { Editor } from './editor.svelte';

	let { content, onchange }: { content: BoardContent; onchange: (content: BoardContent) => void } = $props();

	// The canvas is re-created per board (see the {#key} in the page), so reading `content` once is intended.
	// svelte-ignore state_referenced_locally
	const editor = new Editor(content, onchange);
	setEditor(editor);

	const nodeTypes: NodeTypes = { page: PageNode, table: TableNode };
	const edgeTypes: EdgeTypes = { relation: RelationEdge };

	const CARDS: { value: Cardinality; label: string }[] = [
		{ value: 'one', label: 'Exactly one' },
		{ value: 'zero-or-one', label: 'Zero or one' },
		{ value: 'one-or-many', label: 'One or many' },
		{ value: 'zero-or-many', label: 'Zero or many' }
	];

	let connecting = $state(false);
	let selectedEdge = $derived(editor.edges.filter((e) => e.selected).length === 1 ? editor.edges.find((e) => e.selected) : undefined);

	const label = (nodeId: string, handle: string | null | undefined) => {
		const node = editor.nodes.find((n) => n.id === nodeId);
		if (node?.type !== 'table') return '?';
		const row = node.data.rows.find((r) => handle?.startsWith(r.id));
		return `${node.data.title}.${row?.name || '?'}`;
	};

	function onkeydown(e: KeyboardEvent) {
		const target = e.target as HTMLElement;
		if (target.closest('input, textarea, select, [contenteditable]')) return;
		if (!(e.ctrlKey || e.metaKey)) return;
		const key = e.key.toLowerCase();
		if (key === 'z' && !e.shiftKey) {
			e.preventDefault();
			editor.undo();
		} else if ((key === 'z' && e.shiftKey) || key === 'y') {
			e.preventDefault();
			editor.redo();
		}
	}

	function onbeforeconnect(c: Connection) {
		editor.addRelation(c);
		return false as const;
	}

	function addPage() {
		editor.addPage();
	}
</script>

<svelte:window {onkeydown} />

<CardinalityMarkers />

<div class="canvas" class:connecting>
	<SvelteFlow
		bind:nodes={editor.nodes}
		bind:edges={editor.edges}
		{nodeTypes}
		{edgeTypes}
		connectionMode={ConnectionMode.Loose}
		connectionLineType={ConnectionLineType.Step}
		isValidConnection={(c) => editor.canConnect(c.source, c.target)}
		{onbeforeconnect}
		onconnectstart={() => (connecting = true)}
		onconnectend={() => (connecting = false)}
		onnodedragstop={({ targetNode }) => {
			if (targetNode?.type === 'page') editor.settlePage(targetNode.id);
			editor.commit();
		}}
		onselectiondragstop={() => editor.commit()}
		onbeforedelete={async ({ nodes }) => {
			const pages = nodes.filter((n) => n.type === 'page').length;
			if (!pages) return true;
			return confirm(pages === 1 ? 'Delete this page and everything on it?' : `Delete ${pages} pages and everything on them?`);
		}}
		ondelete={() => editor.commit()}
		deleteKey={['Delete', 'Backspace']}
		zoomOnDoubleClick={false}
		minZoom={0.05}
		maxZoom={4}
		fitView
		fitViewOptions={{ padding: 0.15 }}
		proOptions={{ hideAttribution: true }}
	>
		<Background variant={BackgroundVariant.Dots} gap={24} />
		<Controls showLock={false} />
		<Panel position="top-left">
			<div class="toolbar">
				<button onclick={addPage}>+ Page</button>
				<button onclick={() => editor.undo()} disabled={!editor.canUndo} title="Undo (Ctrl+Z)">↶ Undo</button>
				<button onclick={() => editor.redo()} disabled={!editor.canRedo} title="Redo (Ctrl+Shift+Z)">↷ Redo</button>
			</div>
		</Panel>
		{#if selectedEdge}
			{@const edge = selectedEdge}
			<Panel position="top-center">
				<div class="relation-panel">
					<label>
						<span class="end">{label(edge.source, edge.sourceHandle)}</span>
						<select
							value={edge.data?.sourceCard}
							onchange={(e) => editor.setCardinality(edge.id, 'sourceCard', e.currentTarget.value as Cardinality)}
						>
							{#each CARDS as c (c.value)}<option value={c.value}>{c.label}</option>{/each}
						</select>
					</label>
					<button title="Swap ends" onclick={() => editor.flipRelation(edge.id)}>⇄</button>
					<label>
						<span class="end">{label(edge.target, edge.targetHandle)}</span>
						<select
							value={edge.data?.targetCard}
							onchange={(e) => editor.setCardinality(edge.id, 'targetCard', e.currentTarget.value as Cardinality)}
						>
							{#each CARDS as c (c.value)}<option value={c.value}>{c.label}</option>{/each}
						</select>
					</label>
					<button class="danger" title="Delete relation" onclick={() => editor.deleteRelation(edge.id)}>🗑</button>
				</div>
			</Panel>
		{/if}
	</SvelteFlow>
</div>

<style>
	.canvas {
		width: 100%;
		height: 100%;
	}
	/* Page bodies let clicks through to the canvas, so you can pan by dragging a page. */
	.canvas :global(.svelte-flow__node-page) {
		pointer-events: none !important;
	}
	.canvas :global(.svelte-flow__node-page.selected),
	.canvas :global(.svelte-flow__node-page:focus),
	.canvas :global(.svelte-flow__node-page:focus-visible) {
		outline: none;
	}
	.canvas.connecting :global(.svelte-flow__handle) {
		opacity: 1 !important;
	}
	.toolbar,
	.relation-panel {
		display: flex;
		gap: 6px;
		align-items: center;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 8px;
		padding: 6px;
		box-shadow: 0 2px 8px rgb(0 0 0 / 0.08);
	}
	.relation-panel label {
		display: flex;
		flex-direction: column;
		font-size: 11px;
		gap: 2px;
	}
	.end {
		color: var(--muted);
		max-width: 180px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
</style>
