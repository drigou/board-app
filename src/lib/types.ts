export type KeyKind = '' | 'PK' | 'FK' | 'PK+FK';
export type Cardinality = 'one' | 'zero-or-one' | 'one-or-many' | 'zero-or-many';

export interface Row {
	id: string;
	key: KeyKind;
	name: string;
	type: string;
}

export interface PageDoc {
	id: string;
	title: string;
	x: number;
	y: number;
}

export interface TableDoc {
	id: string;
	pageId: string;
	/** Position relative to the page's top-left corner. */
	x: number;
	y: number;
	title: string;
	rows: Row[];
}

export interface RelationDoc {
	id: string;
	sourceTable: string;
	sourceHandle: string;
	targetTable: string;
	targetHandle: string;
	sourceCard: Cardinality;
	targetCard: Cardinality;
}

export interface BoardContent {
	version: 1;
	pages: PageDoc[];
	tables: TableDoc[];
	relations: RelationDoc[];
}

export interface BoardMeta {
	id: string;
	name: string;
	emoji: string;
	updated_at: string;
}

export interface Board extends BoardMeta {
	content: BoardContent;
}

export const emptyContent = (): BoardContent => ({ version: 1, pages: [], tables: [], relations: [] });

export const EMOJIS = [
	'📋', '🗂️', '📊', '🧩', '🏗️', '🗄️', '💾', '🔑', '🔗', '🧱',
	'🚀', '💡', '⭐', '🔥', '🌱', '🌍', '🏦', '🛒', '📦', '🚚',
	'👥', '🏥', '🎓', '🎮', '🎵', '📷', '⚙️', '🧪', '📈', '❤️'
];
