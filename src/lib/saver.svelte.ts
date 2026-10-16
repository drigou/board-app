import { boards } from './boards.svelte';
import type { BoardContent } from './types';

const DELAY = 800;

/** Debounced autosave of a board's content. */
export function createSaver() {
	let status = $state<'saved' | 'saving' | 'error'>('saved');
	let pending: { id: string; content: BoardContent } | null = null;
	let timer: ReturnType<typeof setTimeout> | undefined;

	async function send(keepalive = false) {
		clearTimeout(timer);
		if (!pending) return;
		const { id, content } = pending;
		pending = null;
		try {
			const res = await fetch(`/api/boards/${id}`, {
				method: 'PATCH',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ content }),
				keepalive
			});
			if (!res.ok) throw new Error(String(res.status));
			boards.upsert(await res.json());
			if (!pending) status = 'saved';
		} catch {
			// Keep the newest content and retry.
			pending ??= { id, content };
			status = 'error';
			timer = setTimeout(() => send(), 3000);
		}
	}

	return {
		get status() {
			return status;
		},
		save(id: string, content: BoardContent) {
			pending = { id, content };
			status = 'saving';
			clearTimeout(timer);
			timer = setTimeout(() => send(), DELAY);
		},
		/** Send any pending change right away (e.g. when leaving the board). */
		flush() {
			if (pending) send(true);
		}
	};
}
