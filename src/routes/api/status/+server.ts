import { json } from '@sveltejs/kit';
import { db } from '#lib/server/db.ts';
import { working } from '#lib/server/process.ts';
import type { RequestHandler } from './$types';

/** GET ?ids=1,2,3 → [{ id, status, work }]. Polled while videos are being converted; `work` is null when idle. */
export const GET: RequestHandler = ({ url }) => {
	const ids = (url.searchParams.get('ids') ?? '').split(',').map(Number).filter(Number.isInteger).slice(0, 500);
	if (!ids.length) return json([]);
	const rows = db
		.prepare(`SELECT id, status FROM media WHERE id IN (${ids.map(() => '?').join(',')})`)
		.all(...ids) as { id: number; status: string }[];
	return json(rows.map((r) => ({ ...r, work: working.get(r.id) ?? null })));
};
