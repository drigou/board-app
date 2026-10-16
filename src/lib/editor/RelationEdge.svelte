<script lang="ts">
	import { BaseEdge, getSmoothStepPath, type EdgeProps } from '@xyflow/svelte';
	import type { RelationEdge } from './editor.svelte';

	let { id, sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition, data, selected }: EdgeProps<RelationEdge> =
		$props();

	let path = $derived(
		getSmoothStepPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition, borderRadius: 4, offset: 30 })[0]
	);
	const suffix = $derived(selected ? '-sel' : '');
</script>

<BaseEdge
	{id}
	{path}
	class={selected ? 'relation selected' : 'relation'}
	markerStart="url(#card-{data?.sourceCard ?? 'zero-or-many'}{suffix})"
	markerEnd="url(#card-{data?.targetCard ?? 'one'}{suffix})"
	interactionWidth={16}
/>

<style>
	:global(.svelte-flow__edge-path.relation) {
		stroke: var(--edge);
		stroke-width: 1.5;
	}
	:global(.svelte-flow__edge-path.relation.selected) {
		stroke: var(--accent);
		stroke-width: 2;
	}
</style>
