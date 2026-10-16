import { PAGE_H, PAGE_W, paperLabel } from '$lib/editor/editor.svelte';
import type { BoardContent, PageDoc } from '$lib/types';

const SCHEMA = 'board-import.schema.json';

/** One page in the import format (so an export can be imported again). */
function exportPage(board: BoardContent, page: PageDoc) {
	const width = page.width ?? PAGE_W;
	const height = page.height ?? PAGE_H;
	const label = paperLabel(width, height);
	const tables = board.tables.filter((t) => t.pageId === page.id);

	// Table names must be unique within a page for "table.column" references.
	const names = new Map<string, string>();
	const used = new Set<string>();
	for (const t of tables) {
		let name = t.title;
		for (let n = 2; used.has(name); n++) name = `${t.title}_${n}`;
		used.add(name);
		names.set(t.id, name);
	}

	const ref = (tableId: string, handle: string) => {
		const t = tables.find((x) => x.id === tableId);
		const row = t?.rows.find((r) => handle.startsWith(r.id));
		return t && row ? `${names.get(t.id)}.${row.name}` : undefined;
	};
	const relations = board.relations
		.map((r) => ({
			from: ref(r.sourceTable, r.sourceHandle),
			to: ref(r.targetTable, r.targetHandle),
			fromCardinality: r.sourceCard,
			toCardinality: r.targetCard
		}))
		.filter((r) => r.from && r.to);

	return {
		page: page.title,
		size: label === 'Custom' ? { width: Math.round(width), height: Math.round(height) } : label,
		x: Math.round(page.x),
		y: Math.round(page.y),
		tables: tables.map((t) => ({
			name: names.get(t.id)!,
			x: Math.round(t.x),
			y: Math.round(t.y),
			...(t.color ? { color: t.color } : {}),
			...(t.width ? { width: t.width } : {}),
			...(t.nameWidth !== undefined ? { nameWidth: t.nameWidth } : {}),
			columns: t.rows.map((r) => ({ name: r.name, ...(r.type ? { type: r.type } : {}), ...(r.key ? { key: r.key } : {}) }))
		})),
		relations
	};
}

/** Export one page, or the whole board when pageId is omitted. */
export function exportJson(board: BoardContent, pageId?: string) {
	if (pageId) {
		const page = board.pages.find((p) => p.id === pageId);
		if (!page) throw new Error('Page not found');
		return { $schema: SCHEMA, ...exportPage(board, page) };
	}
	return { $schema: SCHEMA, pages: board.pages.map((p) => exportPage(board, p)) };
}

export function downloadJson(data: unknown, filename: string) {
	const blob = new Blob([JSON.stringify(data, null, 2) + '\n'], { type: 'application/json' });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = filename.replace(/[\\/:*?"<>|]+/g, '_');
	a.click();
	setTimeout(() => URL.revokeObjectURL(url), 1000);
}
