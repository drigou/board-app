import { json, error } from '@sveltejs/kit';
import { createBoard, listBoards } from '$lib/server/db';
import { EMOJIS, emptyContent } from '$lib/types';

export async function GET() {
	return json(await listBoards());
}

export async function POST({ request }) {
	const body = await request.json().catch(() => ({}));
	const name = typeof body.name === 'string' && body.name.trim() ? body.name.trim() : 'Untitled board';
	const emoji = typeof body.emoji === 'string' && body.emoji ? body.emoji : EMOJIS[0];
	if (name.length > 200) error(400, 'Name too long');
	const content = emptyContent();
	content.pages.push({ id: crypto.randomUUID(), title: 'Page 1', x: 0, y: 0 });
	return json(await createBoard(name, emoji, content), { status: 201 });
}
