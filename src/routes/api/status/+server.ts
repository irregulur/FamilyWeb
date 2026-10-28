import { json } from '@sveltejs/kit';
import { db } from '#lib/server/db.ts';
import type { RequestHandler } from './$types';

/** GET ?ids=1,2,3 → [{ id, status }]. The upload page polls this while videos are being converted. */
export const GET: RequestHandler = ({ url }) => {
	const ids = (url.searchParams.get('ids') ?? '').split(',').map(Number).filter(Number.isInteger).slice(0, 500);
	if (!ids.length) return json([]);
	const rows = db
		.prepare(`SELECT id, status FROM media WHERE id IN (${ids.map(() => '?').join(',')})`)
		.all(...ids);
	return json(rows);
};
