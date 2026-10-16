import dagre from '@dagrejs/dagre';
import { PAGE_H, PAGE_W, PAPER_SIZES } from '$lib/editor/editor.svelte';
import type { BoardContent, RelationDoc, Row, TableDoc } from '$lib/types';
import type { ColumnRef, ImportPage, ImportTable } from './parse';

/** Table figure size, used for layout before the browser has measured anything. */
export const TABLE_W = 320;
export const tableHeight = (rows: number) => 60 + rows * 28;

const MARGIN = 40;
const uid = () => crypto.randomUUID();

export type ConflictPolicy = 'skip' | 'replace' | 'copy';
/** 'new' = every imported page becomes a new page; otherwise the id of an existing page. */
export type ImportTarget = 'new' | string;

export interface ImportPlan {
	/** New pages (without position; the editor places them). */
	newPages: { id: string; title: string; width: number; height: number; x?: number; y?: number }[];
	/** Existing pages that need to grow. */
	resizePages: { id: string; width: number; height: number }[];
	tables: TableDoc[];
	relations: RelationDoc[];
	removeTableIds: string[];
	summary: string;
}

export type PlanResult = { ok: true; plan: ImportPlan } | { ok: false; errors: string[] };

/** Names of imported tables that already exist on the target page. */
export function findConflicts(pages: ImportPage[], target: ImportTarget, board: BoardContent): string[] {
	if (target === 'new' || pages.length !== 1) return [];
	const existing = new Set(board.tables.filter((t) => t.pageId === target).map((t) => t.title));
	return pages[0].tables.map((t) => t.name).filter((n) => existing.has(n));
}

/** Smallest paper size (landscape first) that fits, else a custom size. */
export function fitSize(width: number, height: number) {
	for (const p of PAPER_SIZES) {
		for (const [w, h] of [
			[p.w, p.h],
			[p.h, p.w]
		]) {
			if (width <= w && height <= h) return { width: w, height: h };
		}
	}
	return { width: Math.ceil(width), height: Math.ceil(height) };
}

/** Auto-layout tables without a position: related tables end up next to each other. */
function layout(tables: ImportTable[], links: [string, string][]) {
	const g = new dagre.graphlib.Graph();
	g.setGraph({ rankdir: 'LR', nodesep: 40, ranksep: 90, marginx: 0, marginy: 0 });
	g.setDefaultEdgeLabel(() => ({}));
	for (const t of tables) g.setNode(t.name, { width: TABLE_W, height: tableHeight(t.columns.length) });
	for (const [a, b] of links) if (g.hasNode(a) && g.hasNode(b) && a !== b) g.setEdge(a, b);
	dagre.layout(g);
	const pos = new Map<string, { x: number; y: number }>();
	for (const t of tables) {
		const n = g.node(t.name);
		pos.set(t.name, { x: Math.round(n.x - n.width / 2), y: Math.round(n.y - n.height / 2) });
	}
	return pos;
}

/**
 * Turn validated import pages into concrete board changes for the given target.
 * Fails (with all reasons) when a relation points to a table or column that doesn't exist.
 */
export function planImport(
	pages: ImportPage[],
	target: ImportTarget,
	policy: ConflictPolicy,
	board: BoardContent
): PlanResult {
	const errors: string[] = [];
	const plan: ImportPlan = { newPages: [], resizePages: [], tables: [], relations: [], removeTableIds: [], summary: '' };
	if (target !== 'new' && pages.length > 1) {
		return { ok: false, errors: ['This JSON has several pages: import it as new pages.'] };
	}

	pages.forEach((page, pi) => {
		const where = pages.length > 1 ? `pages[${pi}] ` : '';
		const existingPage = target === 'new' ? undefined : board.pages.find((p) => p.id === target);
		if (target !== 'new' && !existingPage) {
			errors.push('The selected page no longer exists.');
			return;
		}
		const pageId = existingPage?.id ?? uid();
		const existing = existingPage ? board.tables.filter((t) => t.pageId === pageId) : [];
		const existingByName = new Map(existing.map((t) => [t.title, t]));

		// Decide per imported table: create (possibly renamed / replacing) or skip.
		const byName = new Map<string, TableDoc>(); // name used in the JSON → table on the page
		const placed: { doc: TableDoc; src: ImportTable }[] = [];
		const takenNames = new Set(existing.map((t) => t.title));
		for (const src of page.tables) {
			const clash = existingByName.get(src.name);
			if (clash && policy === 'skip') {
				byName.set(src.name, clash);
				continue;
			}
			let title = src.name;
			let keepAt: { x: number; y: number } | undefined;
			if (clash && policy === 'replace') {
				plan.removeTableIds.push(clash.id);
				takenNames.delete(clash.title);
				keepAt = { x: clash.x, y: clash.y };
			} else if (clash && policy === 'copy') {
				let n = 2;
				while (takenNames.has(`${src.name}_${n}`)) n++;
				title = `${src.name}_${n}`;
			}
			takenNames.add(title);
			const rows: Row[] = src.columns.map((c) => ({ id: uid(), key: c.key, name: c.name, type: c.type }));
			const at = src.x !== undefined && src.y !== undefined ? { x: src.x, y: src.y } : keepAt;
			const doc: TableDoc = { id: uid(), pageId, x: at?.x ?? NaN, y: at?.y ?? NaN, title, rows };
			byName.set(src.name, doc);
			placed.push({ doc, src });
		}
		// Tables on the page that aren't in the JSON can still be referenced by relations.
		const removed = new Set(plan.removeTableIds);
		for (const t of existing) if (!byName.has(t.title) && !removed.has(t.id)) byName.set(t.title, t);

		// Resolve relations.
		const resolve = (r: ColumnRef, path: string) => {
			const table = byName.get(r.table);
			if (!table) {
				errors.push(`${where}${path}: table "${r.table}" not found on this page`);
				return undefined;
			}
			const row =
				table.rows.find((x) => x.name === r.column) ??
				table.rows.find((x) => x.name.toLowerCase() === r.column.toLowerCase());
			if (!row) {
				errors.push(`${where}${path}: column "${r.column}" not found in table "${r.table}"`);
				return undefined;
			}
			return { table, row };
		};
		const links: { from: NonNullable<ReturnType<typeof resolve>>; to: NonNullable<ReturnType<typeof resolve>>; rel: (typeof page.relations)[number] }[] = [];
		page.relations.forEach((rel, i) => {
			const from = resolve(rel.from, `relations[${i}].from`);
			const to = resolve(rel.to, `relations[${i}].to`);
			if (from && to) {
				if (from.table === to.table && from.row === to.row) errors.push(`${where}relations[${i}]: a column can't relate to itself`);
				else links.push({ from, to, rel });
			}
		});

		// Lay out tables without a position, below anything already on the page.
		const unplaced = placed.filter((p) => Number.isNaN(p.doc.x));
		if (unplaced.length) {
			const pos = layout(
				unplaced.map((p) => ({ ...p.src, name: p.doc.id })),
				links.map((l) => [l.to.table.id, l.from.table.id])
			);
			const keep = [...existing.filter((t) => !removed.has(t.id)), ...placed.filter((p) => !Number.isNaN(p.doc.x)).map((p) => p.doc)];
			const top = keep.length ? Math.max(...keep.map((t) => t.y + tableHeight(t.rows.length))) + 60 : MARGIN;
			for (const p of unplaced) {
				const xy = pos.get(p.doc.id)!;
				p.doc.x = MARGIN + xy.x;
				p.doc.y = top + xy.y;
			}
		}
		for (const p of placed) {
			p.doc.x = Math.max(0, Math.round(p.doc.x));
			p.doc.y = Math.max(0, Math.round(p.doc.y));
			plan.tables.push(p.doc);
		}

		// Relations: connect the facing sides of the two tables.
		for (const { from, to, rel } of links) {
			const fromLeft = from.table.x + TABLE_W / 2 <= to.table.x + TABLE_W / 2;
			const self = from.table === to.table;
			plan.relations.push({
				id: uid(),
				sourceTable: from.table.id,
				sourceHandle: `${from.row.id}-${self || fromLeft ? 'r' : 'l'}`,
				targetTable: to.table.id,
				targetHandle: `${to.row.id}-${self || !fromLeft ? 'r' : 'l'}`,
				sourceCard: rel.fromCard,
				targetCard: rel.toCard
			});
		}

		// Page size: fit everything on it.
		const all = [...existing.filter((t) => !removed.has(t.id)), ...placed.map((p) => p.doc)];
		const needW = Math.max(0, ...all.map((t) => t.x + TABLE_W)) + MARGIN;
		const needH = Math.max(0, ...all.map((t) => t.y + tableHeight(t.rows.length))) + MARGIN;
		if (existingPage) {
			const w = existingPage.width ?? PAGE_W;
			const h = existingPage.height ?? PAGE_H;
			if (needW > w || needH > h) {
				const fit = fitSize(Math.max(needW, w), Math.max(needH, h));
				plan.resizePages.push({ id: pageId, ...fit });
			}
		} else {
			const fit = page.size && page.size.width >= needW && page.size.height >= needH ? page.size : fitSize(needW, needH);
			plan.newPages.push({ id: pageId, title: page.title, ...fit, x: page.x, y: page.y });
		}
	});

	if (errors.length) return { ok: false, errors };
	const skipped = pages.reduce((n, p) => n + p.tables.length, 0) - plan.tables.length;
	plan.summary =
		`${plan.tables.length} table${plan.tables.length === 1 ? '' : 's'}, ` +
		`${plan.relations.length} relation${plan.relations.length === 1 ? '' : 's'}` +
		(skipped ? `, ${skipped} skipped` : '') +
		(plan.removeTableIds.length ? `, ${plan.removeTableIds.length} replaced` : '') +
		(plan.newPages.length ? ` → ${plan.newPages.length === 1 ? `new page "${plan.newPages[0].title}"` : `${plan.newPages.length} new pages`}` : '');
	return { ok: true, plan };
}
