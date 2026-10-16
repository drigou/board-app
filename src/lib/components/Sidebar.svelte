<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { boards } from '$lib/boards.svelte';
	import EditableText from '$lib/editor/EditableText.svelte';
	import { timeAgo } from '$lib/time';
	import { EMOJIS } from '$lib/types';
	import EmojiPicker from './EmojiPicker.svelte';

	let search = $state('');
	let pickerFor = $state<string | null>(null);
	const nameEditors: Record<string, EditableText> = {};
	let now = $state(Date.now());

	$effect(() => {
		const timer = setInterval(() => (now = Date.now()), 30_000);
		return () => clearInterval(timer);
	});

	let filtered = $derived(
		boards.list.filter((b) => b.name.toLowerCase().includes(search.trim().toLowerCase()))
	);

	async function create() {
		const emoji = EMOJIS[Math.floor(Math.random() * EMOJIS.length)];
		const board = await boards.create('Untitled board', emoji);
		search = '';
		goto(`/board/${board.id}`);
	}

	async function remove(id: string, name: string) {
		if (!confirm(`Delete board "${name}"? This cannot be undone.`)) return;
		await boards.remove(id);
		if (page.params.id === id) goto('/');
	}
</script>

<aside>
	<header>
		<h1>Boards</h1>
		<button class="primary" onclick={create}>+ New</button>
	</header>
	<input class="search" type="search" placeholder="Search boards…" bind:value={search} />
	<ul>
		{#each filtered as board (board.id)}
			<li class:active={page.params.id === board.id}>
				<div class="emoji-wrap">
					<button class="emoji" title="Change icon" onclick={() => (pickerFor = board.id)}>{board.emoji}</button>
					{#if pickerFor === board.id}
						<EmojiPicker
							onclose={() => (pickerFor = null)}
							onpick={(emoji) => {
								pickerFor = null;
								boards.update(board.id, { emoji });
							}}
						/>
					{/if}
				</div>
				<!-- svelte-ignore a11y_click_events_have_key_events -->
				<div class="info" role="link" tabindex="-1" onclick={() => goto(`/board/${board.id}`)}>
					<EditableText
						bind:this={nameEditors[board.id]}
						class="name"
						value={board.name}
						onsave={(name) => boards.update(board.id, { name })}
					/>
					<span class="time">{timeAgo(board.updated_at, now)}</span>
				</div>
				<button class="action" title="Rename board" onclick={() => nameEditors[board.id]?.start()}>✏️</button>
				<button class="action" title="Delete board" onclick={() => remove(board.id, board.name)}>🗑</button>
			</li>
		{:else}
			<li class="empty">{boards.loaded ? (search ? 'No matching boards' : 'No boards yet') : 'Loading…'}</li>
		{/each}
	</ul>
</aside>

<style>
	aside {
		width: 270px;
		flex-shrink: 0;
		display: flex;
		flex-direction: column;
		border-right: 1px solid var(--border);
		background: var(--sidebar);
		height: 100%;
	}
	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 14px 14px 8px;
	}
	h1 {
		font-size: 16px;
		margin: 0;
	}
	.search {
		margin: 0 14px 8px;
		padding: 6px 8px;
		border: 1px solid var(--border);
		border-radius: 6px;
		background: var(--surface);
		color: var(--text);
		font: inherit;
	}
	ul {
		list-style: none;
		margin: 0;
		padding: 0 6px;
		overflow-y: auto;
		flex: 1;
	}
	li {
		display: flex;
		align-items: center;
		gap: 4px;
		border-radius: 6px;
		padding: 2px 4px;
	}
	li:hover {
		background: var(--focus-bg);
	}
	li.active {
		background: color-mix(in srgb, var(--accent) 15%, transparent);
	}
	li.empty {
		color: var(--muted);
		padding: 10px;
		font-size: 13px;
	}
	.emoji-wrap {
		position: relative;
	}
	.emoji {
		font-size: 20px;
		width: 34px;
		height: 34px;
		border: none;
		background: transparent;
		cursor: pointer;
		border-radius: 6px;
		padding: 0;
	}
	.emoji:hover {
		background: var(--surface);
	}
	.info {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		padding: 4px 0;
		cursor: pointer;
	}
	.info :global(.name) {
		font-size: 14px;
		display: block;
	}
	.time {
		font-size: 11px;
		color: var(--muted);
	}
	.action {
		visibility: hidden;
		border: none;
		background: transparent;
		cursor: pointer;
		padding: 4px;
	}
	li:hover .action {
		visibility: visible;
	}
</style>
