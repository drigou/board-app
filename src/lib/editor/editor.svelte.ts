import type { Edge, Node } from '@xyflow/svelte';
import type { BoardContent, Cardinality, KeyKind, PageDoc, RelationDoc, Row, TableDoc } from '$lib/types';

/** A4 landscape at 96 dpi. */
export const PAGE_W = 1123;
export const PAGE_H = 794;
export const PAGE_MIN_W = 300;
export const PAGE_MIN_H = 200;
/** Space kept free between pages (also leaves room for the page header). */
const PAGE_GAP = 80;
const HISTORY_LIMIT = 200;

/** Paper sizes in landscape at 96 dpi; portrait swaps width and height. */
export const PAPER_SIZES = [
	{ name: 'A4', w: 1123, h: 794 },
	{ name: 'A3', w: 1587, h: 1123 },
	{ name: 'A2', w: 2245, h: 1587 },
	{ name: 'A1', w: 3179, h: 2245 }
] as const;

/** e.g. "A4 landscape", or "Custom" when the size matches no paper size. */
export function paperLabel(width: number, height: number) {
	for (const p of PAPER_SIZES) {
		if (p.w === width && p.h === height) return `${p.name} landscape`;
		if (p.h === width && p.w === height) return `${p.name} portrait`;
	}
	return 'Custom';
}

export type Tool = 'select' | 'hand' | 'table';

export type PageData = { title: string };
export type TableData = { title: string; rows: Row[]; color?: string; nameWidth?: number };

export const TABLE_W = 320;
export const TABLE_MIN_W = 200;
export type RelationData = { sourceCard: Cardinality; targetCard: Cardinality };

export type PageNode = Node<PageData, 'page'>;
export type TableNode = Node<TableData, 'table'>;
export type BoardNode = PageNode | TableNode;
export type RelationEdge = Edge<RelationData, 'relation'>;

const uid = () => crypto.randomUUID();

/** Handle ids are `<rowId>-l` / `<rowId>-r`. */
export const handleId = (rowId: string, side: 'l' | 'r') => `${rowId}-${side}`;
const rowOfHandle = (handle: string | null | undefined) => handle?.slice(0, -2) ?? '';

function toNodes(content: BoardContent): BoardNode[] {
	const pages: PageNode[] = content.pages.map((p) => ({
		id: p.id,
		type: 'page',
		position: { x: p.x, y: p.y },
		width: p.width ?? PAGE_W,
		height: p.height ?? PAGE_H,
		data: { title: p.title },
		zIndex: 0
	}));
	const pageIds = new Set(pages.map((p) => p.id));
	const tables: TableNode[] = content.tables
		.filter((t) => pageIds.has(t.pageId))
		.map((t) => ({
			id: t.id,
			type: 'table',
			parentId: t.pageId,
			extent: 'parent',
			position: { x: t.x, y: t.y },
			width: t.width ?? TABLE_W,
			data: { title: t.title, rows: t.rows, color: t.color, nameWidth: t.nameWidth },
			dragHandle: '.table-drag',
			zIndex: 1
		}));
	// Parents must come before their children.
	return [...pages, ...tables];
}

function toEdges(content: BoardContent): RelationEdge[] {
	return content.relations.map((r) => ({
		id: r.id,
		type: 'relation',
		source: r.sourceTable,
		sourceHandle: r.sourceHandle,
		target: r.targetTable,
		targetHandle: r.targetHandle,
		data: { sourceCard: r.sourceCard, targetCard: r.targetCard },
		zIndex: 2
	}));
}

type Rect = { x: number; y: number; width: number; height: number };

const pageRect = (n: BoardNode): Rect => ({
	x: n.position.x,
	y: n.position.y,
	width: n.width ?? PAGE_W,
	height: n.height ?? PAGE_H
});

/** True when two pages are closer than PAGE_GAP. */
export function overlaps(a: Rect, b: Rect) {
	return (
		a.x < b.x + b.width + PAGE_GAP &&
		b.x < a.x + a.width + PAGE_GAP &&
		a.y < b.y + b.height + PAGE_GAP &&
		b.y < a.y + a.height + PAGE_GAP
	);
}

export class Editor {
	nodes = $state.raw<BoardNode[]>([]);
	edges = $state.raw<RelationEdge[]>([]);
	canUndo = $state(false);
	canRedo = $state(false);
	tool = $state<Tool>('select');
	/** Space held down: temporarily behave as the hand tool. */
	spaceHeld = $state(false);

	get mode(): Tool {
		return this.spaceHeld ? 'hand' : this.tool;
	}

	#past: string[] = [];
	#future: string[] = [];
	#current: string;
	#onchange: (content: BoardContent) => void;

	constructor(content: BoardContent, onchange: (content: BoardContent) => void) {
		this.#onchange = onchange;
		this.#load(content);
		this.#current = JSON.stringify(this.snapshot());
	}

	#load(content: BoardContent) {
		this.nodes = toNodes(content);
		this.edges = toEdges(content);
	}

	snapshot(): BoardContent {
		const pages: PageDoc[] = [];
		const tables: TableDoc[] = [];
		for (const n of this.nodes) {
			if (n.type === 'page') {
				const { width, height } = pageRect(n);
				pages.push({ id: n.id, title: n.data.title, x: n.position.x, y: n.position.y, width, height });
			} else if (n.type === 'table' && n.parentId) {
				tables.push({
					id: n.id,
					pageId: n.parentId,
					x: n.position.x,
					y: n.position.y,
					title: n.data.title,
					rows: n.data.rows,
					...(n.data.color ? { color: n.data.color } : {}),
					...(n.width && n.width !== TABLE_W ? { width: Math.round(n.width) } : {}),
					...(n.data.nameWidth !== undefined && n.data.nameWidth !== 0.5 ? { nameWidth: n.data.nameWidth } : {})
				});
			}
		}
		const relations: RelationDoc[] = this.edges.map((e) => ({
			id: e.id,
			sourceTable: e.source,
			sourceHandle: e.sourceHandle ?? '',
			targetTable: e.target,
			targetHandle: e.targetHandle ?? '',
			sourceCard: e.data?.sourceCard ?? 'zero-or-many',
			targetCard: e.data?.targetCard ?? 'one'
		}));
		return { version: 1, pages, tables, relations };
	}

	/** Record the current state as an undo step (no-op when nothing changed) and save it. */
	commit() {
		const next = JSON.stringify(this.snapshot());
		if (next === this.#current) return;
		this.#past.push(this.#current);
		if (this.#past.length > HISTORY_LIMIT) this.#past.shift();
		this.#future = [];
		this.#current = next;
		this.#sync();
	}

	undo() {
		const prev = this.#past.pop();
		if (prev === undefined) return;
		this.#future.push(this.#current);
		this.#restore(prev);
	}

	redo() {
		const next = this.#future.pop();
		if (next === undefined) return;
		this.#past.push(this.#current);
		this.#restore(next);
	}

	#restore(serialized: string) {
		this.#current = serialized;
		this.#load(JSON.parse(serialized));
		this.#sync();
	}

	#sync() {
		this.canUndo = this.#past.length > 0;
		this.canRedo = this.#future.length > 0;
		this.#onchange(JSON.parse(this.#current));
	}

	// ---- pages ----

	addPage() {
		const pages = this.nodes.filter((n) => n.type === 'page').map(pageRect);
		let rect: Rect = { x: 0, y: 0, width: PAGE_W, height: PAGE_H };
		if (pages.length) {
			const rightmost = pages.reduce((a, b) => (b.x + b.width > a.x + a.width ? b : a));
			rect = { ...rect, x: rightmost.x + rightmost.width + PAGE_GAP, y: rightmost.y };
		}
		const position = this.#freeSpot(rect, null);
		const page: PageNode = {
			id: uid(),
			type: 'page',
			position,
			width: PAGE_W,
			height: PAGE_H,
			data: { title: `Page ${pages.length + 1}` },
			zIndex: 0
		};
		// Pages go first so they stay before all children.
		this.nodes = [page, ...this.nodes];
		this.commit();
		return page;
	}

	/** After a page was dropped or resized: push it out of any page it overlaps. */
	settlePage(id: string) {
		const page = this.nodes.find((n) => n.id === id);
		if (!page || page.type !== 'page') return;
		const position = this.#freeSpot(pageRect(page), id);
		if (position.x !== page.position.x || position.y !== page.position.y) {
			this.nodes = this.nodes.map((n) => (n.id === id ? { ...n, position } : n));
		}
	}

	/** Would a page with this rect overlap another page? */
	pageCollides(id: string, rect: Rect) {
		return this.nodes.some((n) => n.type === 'page' && n.id !== id && overlaps(rect, pageRect(n)));
	}

	/** Find the closest position to `start` that doesn't overlap another page. */
	#freeSpot(start: Rect, ignoreId: string | null) {
		const others = this.nodes.filter((n) => n.type === 'page' && n.id !== ignoreId).map(pageRect);
		const free = (p: { x: number; y: number }) => !others.some((o) => overlaps({ ...start, ...p }, o));
		if (free(start)) return { x: start.x, y: start.y };
		// Candidate spots: snapped against every edge of every other page; pick the nearest free one.
		const candidates: { x: number; y: number }[] = [];
		for (const o of others) {
			candidates.push(
				{ x: o.x + o.width + PAGE_GAP, y: start.y },
				{ x: o.x - start.width - PAGE_GAP, y: start.y },
				{ x: start.x, y: o.y + o.height + PAGE_GAP },
				{ x: start.x, y: o.y - start.height - PAGE_GAP }
			);
		}
		const dist = (p: { x: number; y: number }) => Math.hypot(p.x - start.x, p.y - start.y);
		const best = candidates.filter(free).sort((a, b) => dist(a) - dist(b))[0];
		if (best) return best;
		const maxRight = Math.max(...others.map((o) => o.x + o.width));
		return { x: maxRight + PAGE_GAP, y: start.y };
	}

	/**
	 * Resize a page to a paper size. Returns false when its tables wouldn't fit.
	 * `contentSize` is the extent of the page's tables (right/bottom edge, page-relative).
	 */
	setPageSize(id: string, width: number, height: number, contentSize: { width: number; height: number }) {
		if (width < contentSize.width || height < contentSize.height) return false;
		this.nodes = this.nodes.map((n) => (n.id === id ? { ...n, width, height } : n));
		this.settlePage(id);
		this.commit();
		return true;
	}

	/** Apply an import (see $lib/import/plan) as a single undo step. */
	applyImport(plan: {
		newPages: { id: string; title: string; width: number; height: number; x?: number; y?: number }[];
		resizePages: { id: string; width: number; height: number }[];
		tables: TableDoc[];
		relations: RelationDoc[];
		removeTableIds: string[];
	}) {
		const removed = new Set(plan.removeTableIds);
		const resize = new Map(plan.resizePages.map((r) => [r.id, r]));
		let nodes = this.nodes
			.filter((n) => !removed.has(n.id))
			.map((n) => {
				const r = resize.get(n.id);
				return { ...n, selected: false, ...(r ? { width: r.width, height: r.height } : {}) } as BoardNode;
			});
		this.edges = this.edges.filter((e) => !removed.has(e.source) && !removed.has(e.target));

		// New pages: at their own position if given, else to the right of everything; never overlapping.
		const newPages: PageNode[] = [];
		for (const p of plan.newPages) {
			const others = [...nodes, ...newPages].filter((n) => n.type === 'page').map(pageRect);
			const right = others.length ? Math.max(...others.map((o) => o.x + o.width)) + PAGE_GAP : 0;
			const top = others.length ? Math.min(...others.map((o) => o.y)) : 0;
			const rect = { x: p.x ?? right, y: p.y ?? top, width: p.width, height: p.height };
			this.nodes = [...newPages, ...nodes];
			const position = this.#freeSpot(rect, null);
			newPages.push({
				id: p.id,
				type: 'page',
				position,
				width: p.width,
				height: p.height,
				data: { title: p.title },
				zIndex: 0
			});
		}
		const tableNodes: TableNode[] = plan.tables.map((t) => ({
			id: t.id,
			type: 'table',
			parentId: t.pageId,
			extent: 'parent',
			position: { x: t.x, y: t.y },
			width: t.width ?? TABLE_W,
			data: { title: t.title, rows: t.rows, color: t.color, nameWidth: t.nameWidth },
			dragHandle: '.table-drag',
			zIndex: 1,
			selected: true
		}));
		this.nodes = [...newPages, ...nodes, ...tableNodes];
		for (const r of plan.resizePages) this.settlePage(r.id);
		this.edges = [...this.edges, ...toEdges({ version: 1, pages: [], tables: [], relations: plan.relations })];
		this.commit();
	}

	selectAll() {
		this.nodes = this.nodes.map((n) => ({ ...n, selected: true }));
		this.edges = this.edges.map((e) => ({ ...e, selected: true }));
	}

	renamePage(id: string, title: string) {
		this.#updateData(id, (d: PageData) => ({ ...d, title }));
	}

	// ---- tables ----

	/** Add a table to a page; `at` is page-relative (defaults to a cascading spot near the top-left). */
	addTable(pageId: string, at?: { x: number; y: number }) {
		const count = this.nodes.filter((n) => n.type === 'table' && n.parentId === pageId).length;
		const offset = (count % 10) * 30;
		const table: TableNode = {
			id: uid(),
			type: 'table',
			parentId: pageId,
			extent: 'parent',
			position: at ?? { x: 40 + offset, y: 40 + offset },
			width: TABLE_W,
			data: { title: 'new_table', rows: [{ id: uid(), key: 'PK', name: 'id', type: 'integer' }] },
			dragHandle: '.table-drag',
			zIndex: 1,
			selected: true
		};
		this.nodes = [...this.nodes.map((n) => (n.selected ? { ...n, selected: false } : n)), table];
		this.commit();
		return table;
	}

	/** Set the heading colour of tables (undefined = default gray). */
	setTablesColor(ids: string[], color: string | undefined) {
		const set = new Set(ids);
		this.nodes = this.nodes.map((n) =>
			set.has(n.id) && n.type === 'table' ? { ...n, data: { ...n.data, color } } : n
		);
		this.commit();
	}

	setNameWidth(id: string, nameWidth: number) {
		this.#updateData(id, (d: TableData) => ({ ...d, nameWidth: Math.round(nameWidth * 100) / 100 }));
	}

	renameTable(id: string, title: string) {
		this.#updateData(id, (d: TableData) => ({ ...d, title }));
	}

	addRow(tableId: string) {
		this.#updateData(tableId, (d: TableData) => ({
			...d,
			rows: [...d.rows, { id: uid(), key: '' as KeyKind, name: '', type: '' }]
		}));
	}

	updateRow(tableId: string, rowId: string, patch: Partial<Omit<Row, 'id'>>) {
		this.#updateData(tableId, (d: TableData) => ({
			...d,
			rows: d.rows.map((r) => (r.id === rowId ? { ...r, ...patch } : r))
		}));
	}

	cycleKey(tableId: string, rowId: string) {
		const order: KeyKind[] = ['', 'PK', 'FK', 'PK+FK'];
		const node = this.nodes.find((n) => n.id === tableId);
		const row = node?.type === 'table' ? node.data.rows.find((r) => r.id === rowId) : undefined;
		if (!row) return;
		this.updateRow(tableId, rowId, { key: order[(order.indexOf(row.key) + 1) % order.length] });
	}

	deleteRow(tableId: string, rowId: string) {
		this.edges = this.edges.filter(
			(e) =>
				!(e.source === tableId && rowOfHandle(e.sourceHandle) === rowId) &&
				!(e.target === tableId && rowOfHandle(e.targetHandle) === rowId)
		);
		this.#updateData(tableId, (d: TableData) => ({ ...d, rows: d.rows.filter((r) => r.id !== rowId) }));
	}

	// ---- relations ----

	/** Relations may only connect tables on the same page. */
	canConnect(source: string, target: string) {
		const a = this.nodes.find((n) => n.id === source);
		const b = this.nodes.find((n) => n.id === target);
		return !!a && !!b && a.type === 'table' && b.type === 'table' && a.parentId === b.parentId;
	}

	addRelation(c: { source: string; sourceHandle?: string | null; target: string; targetHandle?: string | null }) {
		if (!this.canConnect(c.source, c.target) || !c.sourceHandle || !c.targetHandle) return;
		if (c.source === c.target && rowOfHandle(c.sourceHandle) === rowOfHandle(c.targetHandle)) return;
		const edge: RelationEdge = {
			id: uid(),
			type: 'relation',
			source: c.source,
			sourceHandle: c.sourceHandle,
			target: c.target,
			targetHandle: c.targetHandle,
			data: { sourceCard: 'zero-or-many', targetCard: 'one' },
			zIndex: 2
		};
		this.edges = [...this.edges, edge];
		this.commit();
	}

	setCardinality(edgeId: string, end: 'sourceCard' | 'targetCard', card: Cardinality) {
		this.edges = this.edges.map((e) =>
			e.id === edgeId ? { ...e, data: { ...(e.data as RelationData), [end]: card } } : e
		);
		this.commit();
	}

	/** Swap the relation's ends (and their cardinalities). */
	flipRelation(edgeId: string) {
		this.edges = this.edges.map((e) =>
			e.id === edgeId
				? {
						...e,
						source: e.target,
						sourceHandle: e.targetHandle,
						target: e.source,
						targetHandle: e.sourceHandle,
						data: { sourceCard: e.data!.targetCard, targetCard: e.data!.sourceCard }
					}
				: e
		);
		this.commit();
	}

	deleteRelation(edgeId: string) {
		this.edges = this.edges.filter((e) => e.id !== edgeId);
		this.commit();
	}

	// ---- helpers ----

	#updateData<D>(id: string, fn: (data: D) => D) {
		this.nodes = this.nodes.map((n) => (n.id === id ? ({ ...n, data: fn(n.data as D) } as BoardNode) : n));
		this.commit();
	}
}
