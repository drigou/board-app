<script lang="ts">
	import { Handle, Position, type NodeProps } from '@xyflow/svelte';
	import EditableText from './EditableText.svelte';
	import { getEditor } from './context';
	import { handleId, type TableNode } from './editor.svelte';

	let { id, data, selected }: NodeProps<TableNode> = $props();
	const editor = getEditor();

	function onFieldKey(e: KeyboardEvent) {
		if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur();
		e.stopPropagation();
	}
</script>

<div class="table" class:selected>
	<div class="title-bar table-drag">
		<EditableText class="title" value={data.title} onsave={(t) => editor.renameTable(id, t)} />
	</div>
	<div class="rows">
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
	</div>
	<button class="add nodrag" onclick={() => editor.addRow(id)} title="Add row">+</button>
</div>

<style>
	.table {
		width: 320px;
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
	}
	.title-bar :global(.title) {
		flex: 1;
	}
	.row {
		position: relative;
		display: grid;
		grid-template-columns: 52px 1fr 1fr 20px;
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
	}
	.table:hover :global(.svelte-flow__handle),
	:global(.svelte-flow.connecting) .row :global(.svelte-flow__handle) {
		opacity: 1;
	}
	.row :global(.svelte-flow__handle:hover) {
		background: var(--accent);
		border-color: var(--accent);
	}
</style>
