<script lang="ts">
	import {
		Handle,
		NodeResizeControl,
		NodeToolbar,
		Position,
		ResizeControlVariant,
		type NodeProps
	} from '@xyflow/svelte';
	import EditableText from './EditableText.svelte';
	import { TABLE_COLORS, textOn } from './colors';
	import { getEditor } from './context';
	import { handleId, TABLE_MIN_W, type TableNode } from './editor.svelte';

	let { id, data, selected }: NodeProps<TableNode> = $props();
	const editor = getEditor();

	/** Key column and delete column widths (px); the rest is split between name and datatype. */
	const KEY_W = 52;
	const DEL_W = 20;

	let pickerOpen = $state(false);
	let dragRatio = $state<number | null>(null);
	let rowsEl: HTMLDivElement | undefined = $state();

	let ratio = $derived(dragRatio ?? data.nameWidth ?? 0.5);
	let headStyle = $derived(
		data.color ? `background:${data.color};color:${textOn(data.color)};` : ''
	);
	let showControls = $derived(selected && editor.mode === 'select');

	$effect(() => {
		if (!showControls) pickerOpen = false;
	});

	function pickColor(color: string | undefined) {
		// Applies to every selected table (this one included).
		const ids = editor.nodes.filter((n) => n.type === 'table' && n.selected).map((n) => n.id);
		editor.setTablesColor(ids.includes(id) ? ids : [...ids, id], color);
	}

	function onFieldKey(e: KeyboardEvent) {
		if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur();
		e.stopPropagation();
	}

	/** Drag the divider between the name and datatype columns. */
	function startSplit(e: PointerEvent) {
		if (!rowsEl) return;
		e.stopPropagation();
		e.preventDefault();
		const el = e.currentTarget as HTMLElement;
		el.setPointerCapture(e.pointerId);
		const rect = rowsEl.getBoundingClientRect();
		const scale = rect.width / rowsEl.offsetWidth; // canvas zoom
		const start = rect.left + KEY_W * scale;
		const span = rect.width - (KEY_W + DEL_W) * scale;
		const move = (ev: PointerEvent) => {
			dragRatio = Math.min(0.9, Math.max(0.1, (ev.clientX - start) / span));
		};
		const up = () => {
			el.removeEventListener('pointermove', move);
			el.removeEventListener('pointerup', up);
			if (dragRatio !== null) editor.setNameWidth(id, dragRatio);
			dragRatio = null;
		};
		el.addEventListener('pointermove', move);
		el.addEventListener('pointerup', up);
	}
</script>

{#each [Position.Left, Position.Right] as side (side)}
	<NodeResizeControl
		position={side}
		variant={ResizeControlVariant.Line}
		resizeDirection="horizontal"
		minWidth={TABLE_MIN_W}
		class={showControls ? 'table-resize' : 'table-resize hidden'}
		onResizeEnd={() => editor.commit()}
	/>
{/each}

<NodeToolbar isVisible={pickerOpen && showControls} position={Position.Top}>
	<div class="palette nodrag" role="listbox" aria-label="Heading colour">
		<button class="swatch default" title="Default (gray)" aria-label="Default gray" onclick={() => pickColor(undefined)}></button>
		{#each TABLE_COLORS as c (c)}
			<button class="swatch" class:current={data.color === c} style:background={c} title={c} aria-label={c} onclick={() => pickColor(c)}></button>
		{/each}
		<label class="swatch custom" title="Custom colour…">
			<input type="color" value={data.color ?? '#eef1f5'} onchange={(e) => pickColor(e.currentTarget.value)} />
			+
		</label>
	</div>
</NodeToolbar>

<div class="table" class:selected style="--name:{ratio}fr; --type:{1 - ratio}fr; --key-w:{KEY_W}px; --del-w:{DEL_W}px">
	<div class="title-bar table-drag" style={headStyle}>
		<EditableText class="title" value={data.title} onsave={(t) => editor.renameTable(id, t)} />
		{#if showControls}
			<button
				class="color-dot nodrag"
				style:background={data.color ?? 'var(--table-head)'}
				title="Heading colour"
				aria-label="Heading colour"
				onclick={() => (pickerOpen = !pickerOpen)}
			></button>
		{/if}
	</div>
	<div class="rows" bind:this={rowsEl}>
		{#each data.rows as row (row.id)}
			<div class="row">
				<Handle type="source" position={Position.Left} id={handleId(row.id, 'l')} />
				<button
					class="key nodrag"
					class:pk={row.key.includes('PK')}
					class:fk={row.key === 'FK'}
					title="Click to cycle: none → PK → FK → PK+FK"
					onclick={() => editor.cycleKey(id, row.id)}>{row.key}</button
				>
				<input
					class="nodrag name"
					class:pk={row.key.includes('PK')}
					value={row.name}
					placeholder="name"
					onchange={(e) => editor.updateRow(id, row.id, { name: e.currentTarget.value })}
					onkeydown={onFieldKey}
				/>
				<input
					class="nodrag type"
					value={row.type}
					placeholder="type"
					onchange={(e) => editor.updateRow(id, row.id, { type: e.currentTarget.value })}
					onkeydown={onFieldKey}
				/>
				<button class="delete nodrag" title="Delete row" onclick={() => editor.deleteRow(id, row.id)}>×</button>
				<Handle type="source" position={Position.Right} id={handleId(row.id, 'r')} />
			</div>
		{/each}
		{#if data.rows.length}
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div
				class="split nodrag nopan"
				class:dragging={dragRatio !== null}
				style:left="calc(var(--key-w) + (100% - var(--key-w) - var(--del-w)) * {ratio})"
				title="Drag to resize the name and datatype columns"
				onpointerdown={startSplit}
			></div>
		{/if}
	</div>
	<button class="add nodrag" onclick={() => editor.addRow(id)} title="Add row">+</button>
</div>

<style>
	.table {
		width: 100%;
		background: var(--surface);
		border: 1.5px solid var(--table-border);
		border-radius: 6px;
		font-size: 13px;
		color: var(--text);
		box-shadow: 0 1px 4px rgb(0 0 0 / 0.08);
	}
	.table.selected {
		border-color: var(--accent);
		box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 30%, transparent);
	}
	.title-bar {
		padding: 6px 10px;
		background: var(--table-head);
		border-bottom: 1.5px solid var(--table-border);
		border-radius: 5px 5px 0 0;
		font-weight: 600;
		cursor: grab;
		display: flex;
		align-items: center;
		gap: 6px;
	}
	.title-bar :global(.title) {
		flex: 1;
		min-width: 0;
	}
	.color-dot {
		width: 16px;
		height: 16px;
		padding: 0;
		border-radius: 50%;
		border: 2px solid var(--surface);
		box-shadow: 0 0 0 1px var(--table-border);
		flex-shrink: 0;
	}
	.palette {
		display: grid;
		grid-template-columns: repeat(7, 22px);
		gap: 5px;
		padding: 6px;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 8px;
		box-shadow: 0 4px 16px rgb(0 0 0 / 0.15);
	}
	.swatch {
		width: 22px;
		height: 22px;
		padding: 0;
		border-radius: 50%;
		border: 1px solid rgb(0 0 0 / 0.15);
		cursor: pointer;
	}
	.swatch:hover {
		transform: scale(1.12);
	}
	.swatch.current {
		box-shadow: 0 0 0 2px var(--accent);
	}
	.swatch.default {
		background: var(--table-head);
	}
	.swatch.custom {
		display: grid;
		place-items: center;
		font-size: 15px;
		background: conic-gradient(#f87171, #fbbf24, #4ade80, #60a5fa, #c084fc, #f87171);
		color: white;
		font-weight: 700;
	}
	.swatch.custom input {
		position: absolute;
		opacity: 0;
		width: 0;
		height: 0;
	}
	.rows {
		position: relative;
	}
	.row {
		position: relative;
		display: grid;
		grid-template-columns: var(--key-w) minmax(0, var(--name)) minmax(0, var(--type)) var(--del-w);
		align-items: center;
		border-bottom: 1px solid var(--row-border);
		height: 28px;
	}
	.row:hover .delete {
		visibility: visible;
	}
	input {
		font: inherit;
		color: inherit;
		background: transparent;
		border: none;
		padding: 0 6px;
		height: 100%;
		width: 100%;
		min-width: 0;
		outline: none;
		border-left: 1px solid var(--row-border);
	}
	input:focus {
		background: var(--focus-bg);
	}
	input.type {
		color: var(--muted);
	}
	input.pk {
		font-weight: 600;
		text-decoration: underline;
	}
	.split {
		position: absolute;
		top: 0;
		bottom: 0;
		width: 9px;
		margin-left: -4px;
		cursor: col-resize;
		z-index: 2;
	}
	.split:hover,
	.split.dragging {
		background: linear-gradient(to right, transparent 3px, var(--accent) 3px, var(--accent) 6px, transparent 6px);
	}
	.key {
		height: 100%;
		border: none;
		background: transparent;
		font: inherit;
		font-size: 11px;
		font-weight: 700;
		cursor: pointer;
		color: var(--muted);
	}
	.key:hover {
		background: var(--focus-bg);
	}
	.key.pk {
		color: var(--pk);
	}
	.key.fk {
		color: var(--fk);
	}
	.delete {
		visibility: hidden;
		border: none;
		background: transparent;
		color: var(--muted);
		cursor: pointer;
		font-size: 15px;
		padding: 0;
	}
	.delete:hover {
		color: var(--danger);
	}
	.add {
		display: block;
		width: 100%;
		border: none;
		background: transparent;
		color: var(--muted);
		font-size: 16px;
		cursor: pointer;
		padding: 2px 0;
		border-radius: 0 0 6px 6px;
	}
	.add:hover {
		background: var(--focus-bg);
		color: var(--accent);
	}
	.row :global(.svelte-flow__handle) {
		width: 9px;
		height: 9px;
		background: var(--surface);
		border: 1.5px solid var(--table-border);
		opacity: 0;
		z-index: 3;
	}
	.table:hover :global(.svelte-flow__handle) {
		opacity: 1;
	}
	.row :global(.svelte-flow__handle:hover) {
		background: var(--accent);
		border-color: var(--accent);
	}
	/* Width grips sit just outside the table's sides, so they don't collide with the row connection dots. */
	:global(.svelte-flow__resize-control.line.table-resize) {
		top: 0 !important;
		height: 100% !important;
		width: 8px !important;
		border: none !important;
		transform: none !important;
		cursor: ew-resize;
		z-index: 2;
	}
	:global(.svelte-flow__resize-control.line.table-resize.right) {
		left: auto !important;
		right: -10px !important;
	}
	:global(.svelte-flow__resize-control.line.table-resize.left) {
		right: auto !important;
		left: -10px !important;
	}
	:global(.svelte-flow__resize-control.line.table-resize:hover) {
		background: color-mix(in srgb, var(--accent) 35%, transparent);
		border-radius: 4px;
	}
	:global(.table-resize.hidden) {
		display: none;
	}
</style>
