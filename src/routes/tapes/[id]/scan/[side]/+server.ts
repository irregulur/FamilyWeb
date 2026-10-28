import { error } from '@sveltejs/kit';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tapeDir } from '#lib/server/tapes.ts';
import type { RequestHandler } from './$types';

// A label scan (?v= in the link changes whenever a new scan is uploaded, so it can be cached for good).
export const GET: RequestHandler = ({ params }) => {
	if (params.side !== 'sticker' && params.side !== 'sleeve') error(404);
	try {
		const file = readFileSync(join(tapeDir(Number(params.id)), `${params.side}.webp`));
		return new Response(file, { headers: { 'content-type': 'image/webp', 'cache-control': 'private, max-age=31536000, immutable' } });
	} catch {
		error(404);
	}
};
