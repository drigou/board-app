import { json, error } from '@sveltejs/kit';
import { deleteBoard, getBoard, updateBoard } from '$lib/server/db';

const UUID = /^[0-9a-f-]{36}$/i;

function checkId(id: string) {
	if (!UUID.test(id)) error(404, 'Board not found');
}

export async function GET({ params }) {
	checkId(params.id);
	const board = await getBoard(params.id);
	if (!board) error(404, 'Board not found');
	return json(board);
}

export async function PATCH({ params, request }) {
	checkId(params.id);
	const body = await request.json().catch(() => null);
	if (!body || typeof body !== 'object') error(400, 'Invalid body');
	const patch: Parameters<typeof updateBoard>[1] = {};
	if (typeof body.name === 'string' && body.name.trim()) patch.name = body.name.trim().slice(0, 200);
	if (typeof body.emoji === 'string' && body.emoji) patch.emoji = body.emoji;
	if (body.content && typeof body.content === 'object' && Array.isArray(body.content.pages)) {
		patch.content = body.content;
	}
	const board = await updateBoard(params.id, patch);
	if (!board) error(404, 'Board not found');
	return json(board);
}

export async function DELETE({ params }) {
	checkId(params.id);
	if (!(await deleteBoard(params.id))) error(404, 'Board not found');
	return new Response(null, { status: 204 });
}
