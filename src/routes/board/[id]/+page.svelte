<script lang="ts">
	import { SvelteFlowProvider } from '@xyflow/svelte';
	import { page } from '$app/state';
	import { boards } from '$lib/boards.svelte';
	import BoardCanvas from '$lib/editor/BoardCanvas.svelte';
	import EditableText from '$lib/editor/EditableText.svelte';
	import { createSaver } from '$lib/saver.svelte';
	import type { Board } from '$lib/types';

	let board = $state<Board | null>(null);
	let error = $state('');
	const saver = createSaver();

	$effect(() => {
		const id = page.params.id!;
		let cancelled = false;
		board = null;
		error = '';
		fetch(`/api/boards/${id}`).then(async (res) => {
			if (cancelled) return;
			if (res.ok) board = await res.json();
			else error = res.status === 404 ? 'Board not found.' : 'Could not load board.';
		});
		return () => {
			cancelled = true;
			saver.flush();
		};
	});

	let meta = $derived(board ? (boards.get(board.id) ?? board) : null);
</script>

<svelte:window onbeforeunload={() => saver.flush()} />

{#if error}
	<p class="message">{error}</p>
{:else if board && meta}
	<div class="title">
		<span>{meta.emoji}</span>
		<strong><EditableText value={meta.name} onsave={(name) => boards.update(meta.id, { name })} /></strong>
		<span class="status {saver.status}">
			{saver.status === 'saving' ? 'Saving…' : saver.status === 'error' ? 'Save failed — retrying' : 'Saved ✓'}
		</span>
	</div>
	{#key board.id}
		<SvelteFlowProvider>
			<BoardCanvas content={board.content} onchange={(content) => saver.save(board!.id, content)} />
		</SvelteFlowProvider>
	{/key}
{:else}
	<p class="message">Loading…</p>
{/if}

<style>
	.title {
		position: absolute;
		z-index: 5;
		bottom: 14px;
		right: 14px;
		display: flex;
		gap: 8px;
		align-items: center;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 8px;
		padding: 6px 10px;
		font-size: 14px;
	}
	.status {
		font-size: 12px;
		color: var(--muted);
	}
	.status.error {
		color: var(--danger);
	}
	.message {
		padding: 20px;
		color: var(--muted);
	}
</style>
