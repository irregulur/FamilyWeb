import { error } from '@sveltejs/kit';
import { readFileSync } from 'node:fs';
import { frameAt, tapeById } from '#lib/server/tapes.ts';
import type { RequestHandler } from './$types';

// A still from a tape at a given second: the picture for a scene.
export const GET: RequestHandler = async ({ params }) => {
	const tape = tapeById(Number(params.id));
	const second = Number(params.sec);
	if (!tape || tape.status !== 'ready' || !Number.isInteger(second) || second < 0) error(404);
	try {
		const file = readFileSync(await frameAt(tape, second));
		return new Response(file, { headers: { 'content-type': 'image/webp', 'cache-control': 'private, max-age=31536000, immutable' } });
	} catch (e) {
		console.error(`Frame ${second}s of tape ${tape.id} failed:`, e);
		error(404);
	}
};
