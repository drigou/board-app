import pg from 'pg';
import { env } from '$env/dynamic/private';
import type { Board, BoardContent, BoardMeta } from '$lib/types';

const pool = new pg.Pool({
	connectionString: env.DATABASE_URL ?? 'postgres://board:board@localhost:5432/board'
});

let ready: Promise<unknown> | null = null;

/** Create the schema on first use. */
function init() {
	ready ??= pool
		.query(
			`CREATE TABLE IF NOT EXISTS boards (
				id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
				name text NOT NULL,
				emoji text NOT NULL,
				content jsonb NOT NULL,
				updated_at timestamptz NOT NULL DEFAULT now()
			)`
		)
		.catch((err) => {
			ready = null;
			throw err;
		});
	return ready;
}

const META = 'id, name, emoji, updated_at';

export async function listBoards(): Promise<BoardMeta[]> {
	await init();
	const { rows } = await pool.query(`SELECT ${META} FROM boards ORDER BY updated_at DESC`);
	return rows;
}

export async function getBoard(id: string): Promise<Board | null> {
	await init();
	const { rows } = await pool.query(`SELECT ${META}, content FROM boards WHERE id = $1`, [id]);
	return rows[0] ?? null;
}

export async function createBoard(name: string, emoji: string, content: BoardContent): Promise<BoardMeta> {
	await init();
	const { rows } = await pool.query(
		`INSERT INTO boards (name, emoji, content) VALUES ($1, $2, $3) RETURNING ${META}`,
		[name, emoji, JSON.stringify(content)]
	);
	return rows[0];
}

export async function updateBoard(
	id: string,
	patch: { name?: string; emoji?: string; content?: BoardContent }
): Promise<BoardMeta | null> {
	await init();
	const { rows } = await pool.query(
		`UPDATE boards SET
			name = COALESCE($2, name),
			emoji = COALESCE($3, emoji),
			content = COALESCE($4, content),
			updated_at = now()
		 WHERE id = $1 RETURNING ${META}`,
		[id, patch.name ?? null, patch.emoji ?? null, patch.content ? JSON.stringify(patch.content) : null]
	);
	return rows[0] ?? null;
}

export async function deleteBoard(id: string): Promise<boolean> {
	await init();
	const { rowCount } = await pool.query(`DELETE FROM boards WHERE id = $1`, [id]);
	return (rowCount ?? 0) > 0;
}
