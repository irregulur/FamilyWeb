import { error, json } from '@sveltejs/kit';
import { db } from '#lib/server/db.ts';
import { personById, tag, untag } from '#lib/server/people.ts';
import type { RequestHandler } from './$types';

/** POST { person, media: [ids] } or { person, chapter: id }, with remove: true to take the tag off. */
export const POST: RequestHandler = async ({ request, locals }) => {
	const body = await request.json().catch(() => ({}));
	const person = personById(Number(body.person));
	if (!person) error(404, 'That person isn’t here any more.');
	const kind = body.chapter != null ? 'chapter' : 'media';
	const ids = (kind === 'chapter' ? [body.chapter] : [body.media].flat()).map(Number).filter(Number.isInteger).slice(0, 1000);
	const table = kind === 'chapter' ? 'chapters' : 'media';
	for (const id of ids) {
		if (!db.prepare(`SELECT 1 FROM ${table} WHERE id = ?`).get(id)) continue; // deleted meanwhile
		if (body.remove) untag(kind, id, person.id);
		else tag(kind, id, person.id, locals.user!.id);
	}
	return json({ ok: true });
};
