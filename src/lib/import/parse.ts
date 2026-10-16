import type { Cardinality, KeyKind } from '$lib/types';

/** Normalized import data (see static/board-import.schema.json for the file format). */
export interface ImportColumn {
	name: string;
	type: string;
	key: KeyKind;
}
export interface ImportTable {
	name: string;
	x?: number;
	y?: number;
	color?: string;
	width?: number;
	nameWidth?: number;
	columns: ImportColumn[];
}
export interface ColumnRef {
	table: string;
	column: string;
}
export interface ImportRelation {
	from: ColumnRef;
	to: ColumnRef;
	fromCard: Cardinality;
	toCard: Cardinality;
}
export interface ImportPage {
	title: string;
	size?: { width: number; height: number };
	x?: number;
	y?: number;
	tables: ImportTable[];
	relations: ImportRelation[];
}

export type ParseResult = { ok: true; pages: ImportPage[] } | { ok: false; errors: string[] };

const PAPER: Record<string, [number, number]> = {
	A4: [1123, 794],
	A3: [1587, 1123],
	A2: [2245, 1587],
	A1: [3179, 2245]
};

const CARDS: Record<string, Cardinality> = {
	one: 'one',
	'zero-or-one': 'zero-or-one',
	'one-or-many': 'one-or-many',
	'zero-or-many': 'zero-or-many',
	'1': 'one',
	'0..1': 'zero-or-one',
	'1..*': 'one-or-many',
	'0..*': 'zero-or-many'
};

const KEYS: KeyKind[] = ['', 'PK', 'FK', 'PK+FK'];

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const show = (v: unknown) => JSON.stringify(v);

/** Parse and validate import JSON. Collects all errors instead of stopping at the first one. */
export function parseImport(text: string): ParseResult {
	let data: unknown;
	try {
		data = JSON.parse(text);
	} catch (e) {
		return { ok: false, errors: [`Not valid JSON: ${(e as Error).message}`] };
	}

	const errors: string[] = [];

	function allowOnly(o: Obj, path: string, keys: string[]) {
		for (const k of Object.keys(o)) {
			if (!keys.includes(k)) errors.push(`${path}: unknown property "${k}" (allowed: ${keys.join(', ')})`);
		}
	}

	function str(o: Obj, key: string, path: string, required: boolean): string | undefined {
		const v = o[key];
		if (v === undefined) {
			if (required) errors.push(`${path}: "${key}" is required`);
			return undefined;
		}
		if (typeof v !== 'string' || (required && !v.trim())) {
			errors.push(`${path}.${key}: must be a ${required ? 'non-empty ' : ''}string, got ${show(v)}`);
			return undefined;
		}
		return v.trim();
	}

	function num(o: Obj, key: string, path: string): number | undefined {
		const v = o[key];
		if (v === undefined) return undefined;
		if (typeof v !== 'number' || !Number.isFinite(v)) {
			errors.push(`${path}.${key}: must be a number, got ${show(v)}`);
			return undefined;
		}
		return v;
	}

	function arr(o: Obj, key: string, path: string, required: boolean): unknown[] {
		const v = o[key];
		if (v === undefined) {
			if (required) errors.push(`${path}: "${key}" is required`);
			return [];
		}
		if (!Array.isArray(v)) {
			errors.push(`${path}.${key}: must be an array`);
			return [];
		}
		return v;
	}

	function ref(v: unknown, path: string): ColumnRef | undefined {
		if (typeof v !== 'string' || !v.includes('.')) {
			errors.push(`${path}: must be "table.column", got ${show(v)}`);
			return undefined;
		}
		const dot = v.lastIndexOf('.');
		const table = v.slice(0, dot).trim();
		const column = v.slice(dot + 1).trim();
		if (!table || !column) {
			errors.push(`${path}: must be "table.column", got ${show(v)}`);
			return undefined;
		}
		return { table, column };
	}

	function card(o: Obj, key: string, path: string, fallback: Cardinality): Cardinality {
		const v = o[key];
		if (v === undefined) return fallback;
		const c = typeof v === 'string' ? CARDS[v.trim()] : undefined;
		if (!c) errors.push(`${path}.${key}: must be one of one, zero-or-one, one-or-many, zero-or-many (or 1, 0..1, 1..*, 0..*); got ${show(v)}`);
		return c ?? fallback;
	}

	function size(v: unknown, path: string): ImportPage['size'] {
		if (v === undefined) return undefined;
		if (typeof v === 'string') {
			const m = /^(A[1-4])\s+(landscape|portrait)$/i.exec(v.trim());
			if (m) {
				const [w, h] = PAPER[m[1].toUpperCase()];
				return m[2].toLowerCase() === 'landscape' ? { width: w, height: h } : { width: h, height: w };
			}
		} else if (isObj(v) && typeof v.width === 'number' && typeof v.height === 'number') {
			if (v.width >= 300 && v.height >= 200) return { width: v.width, height: v.height };
		}
		errors.push(`${path}: must be e.g. "A4 landscape", "A3 portrait" or { "width": ≥300, "height": ≥200 }`);
		return undefined;
	}

	function column(v: unknown, path: string): ImportColumn | undefined {
		if (!isObj(v)) {
			errors.push(`${path}: must be an object`);
			return undefined;
		}
		allowOnly(v, path, ['name', 'type', 'key', 'pk', 'fk']);
		// Column names may be empty (rows that haven't been named yet), but must be present.
		const name = str(v, 'name', path, false);
		if (v.name === undefined) errors.push(`${path}: "name" is required`);
		const type = str(v, 'type', path, false) ?? '';
		let key: KeyKind = '';
		if (v.key !== undefined) {
			const k = typeof v.key === 'string' ? v.key.trim().toUpperCase().replace(/\s/g, '') : v.key;
			if (KEYS.includes(k as KeyKind)) key = k as KeyKind;
			else errors.push(`${path}.key: must be "", "PK", "FK" or "PK+FK", got ${show(v.key)}`);
		}
		for (const flag of ['pk', 'fk'] as const) {
			if (v[flag] !== undefined && typeof v[flag] !== 'boolean') errors.push(`${path}.${flag}: must be true or false`);
		}
		if (v.pk === true || v.fk === true) {
			const pk = v.pk === true || key.includes('PK');
			const fk = v.fk === true || key.includes('FK');
			key = pk && fk ? 'PK+FK' : pk ? 'PK' : 'FK';
		}
		return name !== undefined ? { name, type, key } : undefined;
	}

	function table(v: unknown, path: string): ImportTable | undefined {
		if (!isObj(v)) {
			errors.push(`${path}: must be an object`);
			return undefined;
		}
		allowOnly(v, path, ['name', 'x', 'y', 'color', 'width', 'nameWidth', 'columns']);
		const name = str(v, 'name', path, true);
		const x = num(v, 'x', path);
		const y = num(v, 'y', path);
		let color = str(v, 'color', path, false);
		if (color !== undefined && !/^#[0-9a-f]{6}$/i.test(color)) {
			errors.push(`${path}.color: must look like "#dbeafe", got ${show(v.color)}`);
			color = undefined;
		}
		let width = num(v, 'width', path);
		if (width !== undefined && width < 200) {
			errors.push(`${path}.width: must be at least 200`);
			width = undefined;
		}
		let nameWidth = num(v, 'nameWidth', path);
		if (nameWidth !== undefined && (nameWidth < 0.1 || nameWidth > 0.9)) {
			errors.push(`${path}.nameWidth: must be between 0.1 and 0.9`);
			nameWidth = undefined;
		}
		if ((x === undefined) !== (y === undefined)) errors.push(`${path}: give both "x" and "y", or neither`);
		const columns = arr(v, 'columns', path, true)
			.map((c, i) => column(c, `${path}.columns[${i}]`))
			.filter((c): c is ImportColumn => !!c);
		return name ? { name, x, y, color: color?.toLowerCase(), width, nameWidth, columns } : undefined;
	}

	function relation(v: unknown, path: string): ImportRelation | undefined {
		if (!isObj(v)) {
			errors.push(`${path}: must be an object`);
			return undefined;
		}
		allowOnly(v, path, ['from', 'to', 'fromCardinality', 'toCardinality']);
		if (v.from === undefined) errors.push(`${path}: "from" is required`);
		if (v.to === undefined) errors.push(`${path}: "to" is required`);
		const from = v.from === undefined ? undefined : ref(v.from, `${path}.from`);
		const to = v.to === undefined ? undefined : ref(v.to, `${path}.to`);
		const fromCard = card(v, 'fromCardinality', path, 'zero-or-many');
		const toCard = card(v, 'toCardinality', path, 'one');
		return from && to ? { from, to, fromCard, toCard } : undefined;
	}

	function page(v: unknown, path: string): ImportPage | undefined {
		if (!isObj(v)) {
			errors.push(`${path || 'root'}: must be an object`);
			return undefined;
		}
		const p = path || 'root';
		allowOnly(v, p, ['$schema', 'page', 'size', 'x', 'y', 'tables', 'relations']);
		const title = str(v, 'page', p, false) || 'Imported';
		const tables = arr(v, 'tables', p, true)
			.map((t, i) => table(t, `${path ? path + '.' : ''}tables[${i}]`))
			.filter((t): t is ImportTable => !!t);
		const seen = new Set<string>();
		for (const t of tables) {
			if (seen.has(t.name)) errors.push(`${p}: table name "${t.name}" is used twice on this page`);
			seen.add(t.name);
		}
		const relations = arr(v, 'relations', p, false)
			.map((r, i) => relation(r, `${path ? path + '.' : ''}relations[${i}]`))
			.filter((r): r is ImportRelation => !!r);
		return {
			title,
			size: size(v.size, `${p}.size`),
			x: num(v, 'x', p),
			y: num(v, 'y', p),
			tables,
			relations
		};
	}

	let pages: ImportPage[] = [];
	if (isObj(data) && 'pages' in data) {
		allowOnly(data, 'root', ['$schema', 'pages']);
		const list = arr(data, 'pages', 'root', true);
		if (!list.length) errors.push('root.pages: needs at least one page');
		pages = list.map((p, i) => page(p, `pages[${i}]`)).filter((p): p is ImportPage => !!p);
	} else if (isObj(data) && 'tables' in data) {
		const p = page(data, '');
		if (p) pages = [p];
	} else {
		errors.push('Expected an object with "tables" (one page) or "pages" (several pages).');
	}

	return errors.length ? { ok: false, errors } : { ok: true, pages };
}
