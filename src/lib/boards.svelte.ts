import type { BoardMeta } from './types';

/** The board list shown in the side pane, kept in sync with the API. */
class Boards {
	list = $state<BoardMeta[]>([]);
	loaded = $state(false);

	async refresh() {
		const res = await fetch('/api/boards');
		if (res.ok) this.list = await res.json();
		this.loaded = true;
	}

	async create(name: string, emoji: string): Promise<BoardMeta> {
		const res = await fetch('/api/boards', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ name, emoji })
		});
		if (!res.ok) throw new Error('Could not create board');
		const board: BoardMeta = await res.json();
		this.upsert(board);
		return board;
	}

	async update(id: string, patch: { name?: string; emoji?: string }) {
		const res = await fetch(`/api/boards/${id}`, {
			method: 'PATCH',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(patch)
		});
		if (res.ok) this.upsert(await res.json());
	}

	async remove(id: string) {
		const res = await fetch(`/api/boards/${id}`, { method: 'DELETE' });
		if (res.ok || res.status === 404) this.list = this.list.filter((b) => b.id !== id);
	}

	/** Insert or replace a board and keep the list sorted by last edited. */
	upsert(board: BoardMeta) {
		this.list = [board, ...this.list.filter((b) => b.id !== board.id)].sort((a, b) =>
			b.updated_at.localeCompare(a.updated_at)
		);
	}

	get(id: string) {
		return this.list.find((b) => b.id === id);
	}
}

export const boards = new Boards();
