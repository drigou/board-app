<script lang="ts">
	import {
		Background,
		BackgroundVariant,
		ConnectionLineType,
		ConnectionMode,
		Controls,
		Panel,
		SelectionMode,
		SvelteFlow,
		useSvelteFlow,
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
	import { Editor, PAGE_H, PAGE_W, type Tool } from './editor.svelte';

	let { content, onchange }: { content: BoardContent; onchange: (content: BoardContent) => void } = $props();

	// The canvas is re-created per board (see the {#key} in the page), so reading `content` once is intended.
	// svelte-ignore state_referenced_locally
	const editor = new Editor(content, onchange);
	setEditor(editor);
	const flow = useSvelteFlow();

	const nodeTypes: NodeTypes = { page: PageNode, table: TableNode };
	const edgeTypes: EdgeTypes = { relation: RelationEdge };

	const CARDS: { value: Cardinality; label: string }[] = [
		{ value: 'one', label: 'Exactly one' },
		{ value: 'zero-or-one', label: 'Zero or one' },
		{ value: 'one-or-many', label: 'One or many' },
		{ value: 'zero-or-many', label: 'Zero or many' }
	];
	/** Width of a table figure, used to keep a newly placed table inside its page. */
	const TABLE_W = 320;

	let connecting = $state(false);
	let zoom = $state(1);
	let hint = $state('');
	let hintTimer: ReturnType<typeof setTimeout> | undefined;

	let mode = $derived(editor.mode);
	let selectedEdge = $derived(
		editor.edges.filter((e) => e.selected).length === 1 ? editor.edges.find((e) => e.selected) : undefined
	);

	const label = (nodeId: string, handle: string | null | undefined) => {
		const node = editor.nodes.find((n) => n.id === nodeId);
		if (node?.type !== 'table') return '?';
		const row = node.data.rows.find((r) => handle?.startsWith(r.id));
		return `${node.data.title}.${row?.name || '?'}`;
	};

	function showHint(text: string) {
		hint = text;
		clearTimeout(hintTimer);
		hintTimer = setTimeout(() => (hint = ''), 2000);
	}

	function setTool(tool: Tool) {
		editor.tool = tool;
		if (tool !== 'select') {
			// Nothing stays selected while panning or placing.
			editor.nodes = editor.nodes.map((n) => (n.selected ? { ...n, selected: false } : n));
			editor.edges = editor.edges.map((e) => (e.selected ? { ...e, selected: false } : e));
		}
	}

	const isTyping = (e: Event) => !!(e.target as HTMLElement).closest?.('input, textarea, select, [contenteditable]');

	function onkeydown(e: KeyboardEvent) {
		if (isTyping(e)) return;
		const key = e.key.toLowerCase();
		if (e.ctrlKey || e.metaKey) {
			if (key === 'z' && !e.shiftKey) editor.undo();
			else if ((key === 'z' && e.shiftKey) || key === 'y') editor.redo();
			else if (key === 'a' && editor.tool === 'select') editor.selectAll();
			else return;
			e.preventDefault();
			return;
		}
		if (e.key === ' ') {
			e.preventDefault();
			editor.spaceHeld = true;
		} else if (key === 'v') setTool('select');
		else if (key === 'h') setTool('hand');
		else if (e.key === 'Escape' && editor.tool === 'table') setTool('select');
	}

	function onkeyup(e: KeyboardEvent) {
		if (e.key === ' ') editor.spaceHeld = false;
	}

	/** With the table tool active: place a table where the page was clicked. */
	function onpaneclick({ event }: { event: MouseEvent }) {
		if (mode !== 'table') return;
		const p = flow.screenToFlowPosition({ x: event.clientX, y: event.clientY });
		const page = editor.nodes.find((n) => {
			if (n.type !== 'page') return false;
			const w = n.width ?? PAGE_W;
			const h = n.height ?? PAGE_H;
			return p.x >= n.position.x && p.x <= n.position.x + w && p.y >= n.position.y && p.y <= n.position.y + h;
		});
		if (!page) {
			showHint('Tables go on a page — click inside a page.');
			return;
		}
		const w = page.width ?? PAGE_W;
		const h = page.height ?? PAGE_H;
		const at = {
			x: Math.max(0, Math.min(p.x - page.position.x, w - TABLE_W)),
			y: Math.max(0, Math.min(p.y - page.position.y, h - 80))
		};
		editor.addTable(page.id, at);
		editor.tool = 'select';
	}

	function onbeforeconnect(c: Connection) {
		editor.addRelation(c);
		return false as const;
	}
</script>

<svelte:window {onkeydown} {onkeyup} onblur={() => (editor.spaceHeld = false)} />

<CardinalityMarkers />

<div class="canvas mode-{mode}" class:connecting>
	<SvelteFlow
		bind:nodes={editor.nodes}
		bind:edges={editor.edges}
		{nodeTypes}
		{edgeTypes}
		panOnDrag={mode === 'hand' ? true : [1]}
		selectionOnDrag={mode === 'select'}
		selectionMode={SelectionMode.Full}
		selectionKey={null}
		multiSelectionKey={['Shift', 'Control', 'Meta']}
		panActivationKey={null}
		nodesDraggable={mode === 'select'}
		nodesConnectable={mode === 'select'}
		elementsSelectable={mode === 'select'}
		connectionMode={ConnectionMode.Loose}
		connectionLineType={ConnectionLineType.Step}
		isValidConnection={(c) => editor.canConnect(c.source, c.target)}
		{onbeforeconnect}
		onconnectstart={() => (connecting = true)}
		onconnectend={() => (connecting = false)}
		onnodedragstop={({ nodes }) => {
			for (const n of nodes) if (n.type === 'page') editor.settlePage(n.id);
			editor.commit();
		}}
		onselectiondragstop={(_, nodes) => {
			for (const n of nodes) if (n.type === 'page') editor.settlePage(n.id);
			editor.commit();
		}}
		{onpaneclick}
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
		fitViewOptions={{ padding: 0.2 }}
		oninit={() => (zoom = flow.getZoom())}
		onmove={(_, viewport) => (zoom = viewport.zoom)}
		proOptions={{ hideAttribution: true }}
	>
		<Background variant={BackgroundVariant.Dots} gap={24} />
		<Controls showLock={false} showZoom={false} />

		<Panel position="top-left">
			<div class="bar">
				<button onclick={() => editor.addPage()}>+ Page</button>
			</div>
		</Panel>

		<Panel position="top-center">
			<div class="bar" role="toolbar" aria-label="Board tools">
				<button class="icon" class:active={mode === 'select'} title="Select (V)" aria-label="Select" onclick={() => setTool('select')}>
					<svg viewBox="0 0 24 24" width="18" height="18"><path d="M5 3l14 8-6 1.5L10 19z" fill="currentColor" /></svg>
				</button>
				<button class="icon" class:active={mode === 'hand'} title="Hand — move around (H, or hold Space)" aria-label="Hand" onclick={() => setTool('hand')}>
					<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8 13V5.5a1.5 1.5 0 013 0V12m0-1V4.5a1.5 1.5 0 013 0V12m0-6.5a1.5 1.5 0 013 0V15a6 6 0 01-6 6h-1a6 6 0 01-5-2.7L3.6 14a1.5 1.5 0 012.5-1.7L8 15" /></svg>
				</button>
				<span class="divider"></span>
				<button class="icon" onclick={() => editor.undo()} disabled={!editor.canUndo} title="Undo (Ctrl+Z)" aria-label="Undo">↶</button>
				<button class="icon" onclick={() => editor.redo()} disabled={!editor.canRedo} title="Redo (Ctrl+Shift+Z)" aria-label="Redo">↷</button>
				<span class="divider"></span>
				<button class="zoom" title="Fit everything in view" onclick={() => flow.fitView({ padding: 0.2, duration: 200 })}>
					{Math.round(zoom * 100)}%
				</button>
			</div>
		</Panel>

		<Panel position="center-left">
			<div class="bar vertical" role="toolbar" aria-label="Add objects">
				<button
					class="icon tool"
					class:active={editor.tool === 'table'}
					title="Table — then click on a page (Esc to cancel)"
					aria-label="Add table"
					onclick={() => setTool(editor.tool === 'table' ? 'select' : 'table')}
				>
					<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 9h18M3 14.5h18M9 9v11" /></svg>
					<span>Table</span>
				</button>
			</div>
		</Panel>

		{#if selectedEdge && mode === 'select'}
			{@const edge = selectedEdge}
			<Panel position="bottom-center">
				<div class="bar relation-panel">
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

		{#if hint}
			<Panel position="bottom-center"><div class="hint" role="status">{hint}</div></Panel>
		{/if}
	</SvelteFlow>
</div>

<style>
	.canvas {
		width: 100%;
		height: 100%;
	}
	/* Hand and table tools: the canvas ignores objects, so dragging pans and clicks reach the background. */
	.canvas:not(.mode-select) :global(.svelte-flow__node),
	.canvas:not(.mode-select) :global(.svelte-flow__node *),
	.canvas:not(.mode-select) :global(.svelte-flow__edge) {
		pointer-events: none !important;
	}
	.canvas.mode-hand :global(.svelte-flow__pane) {
		cursor: grab;
	}
	.canvas.mode-hand :global(.svelte-flow__pane.dragging) {
		cursor: grabbing;
	}
	.canvas.mode-table :global(.svelte-flow__pane) {
		cursor: crosshair;
	}
	.canvas.mode-select :global(.svelte-flow__pane) {
		cursor: default;
	}
	.canvas :global(.svelte-flow__node-page.selected),
	.canvas :global(.svelte-flow__node-page:focus),
	.canvas :global(.svelte-flow__node-page:focus-visible) {
		outline: none;
	}
	.canvas.connecting :global(.svelte-flow__handle) {
		opacity: 1 !important;
	}
	.bar {
		display: flex;
		gap: 4px;
		align-items: center;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 10px;
		padding: 4px;
		box-shadow: 0 2px 8px rgb(0 0 0 / 0.08);
	}
	.bar.vertical {
		flex-direction: column;
	}
	.icon {
		display: grid;
		place-items: center;
		min-width: 34px;
		height: 34px;
		padding: 0 6px;
		border: none;
		background: transparent;
		font-size: 18px;
	}
	.icon.active {
		background: color-mix(in srgb, var(--accent) 15%, transparent);
		color: var(--accent);
	}
	.tool {
		height: auto;
		padding: 6px;
		gap: 2px;
	}
	.tool span {
		font-size: 10px;
	}
	.divider {
		width: 1px;
		align-self: stretch;
		margin: 4px 2px;
		background: var(--border);
	}
	.zoom {
		border: none;
		background: transparent;
		min-width: 56px;
		font-size: 13px;
		font-variant-numeric: tabular-nums;
	}
	.relation-panel {
		gap: 6px;
		padding: 6px;
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
	.hint {
		background: var(--text);
		color: var(--surface);
		padding: 6px 12px;
		border-radius: 8px;
		font-size: 13px;
		margin-bottom: 60px;
	}
</style>
