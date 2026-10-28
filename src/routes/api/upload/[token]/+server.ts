// Uploads arrive in chunks (PUT), then get finished with their details (POST).
// Chunks keep each request small enough for Cloudflare Tunnel (100 MB limit) and let a
// dropped phone connection carry on where it stopped instead of starting over.
import { error, json } from '@sveltejs/kit';
import { createWriteStream, existsSync, mkdirSync, renameSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { cleanTakenAt } from '#lib/dates.ts';
import { extOf, kindOf } from '#lib/filetypes.ts';
import { guessOccasion, occasionBySlug } from '#lib/occasions.ts';
import { db, MEDIA_DIR, UPLOAD_DIR } from '#lib/server/db.ts';
import { dateFromFile, enqueue } from '#lib/server/process.ts';
import type { RequestHandler } from './$types';

function partFile(userId: number, token: string) {
	if (!/^[a-f0-9]{32}$/.test(token)) error(400, 'Bad upload id');
	return join(UPLOAD_DIR, `${userId}-${token}.part`);
}
const sizeOf = (path: string) => (existsSync(path) ? statSync(path).size : 0);

/** PUT ?offset=N&name=… with a chunk of the file as the body. */
export const PUT: RequestHandler = async ({ params, url, request, locals }) => {
	const path = partFile(locals.user!.id, params.token);
	if (!kindOf(url.searchParams.get('name') ?? '')) error(415, "That kind of file isn't supported.");

	// The client and server disagree on how much arrived (e.g. after a dropped connection): tell it where to resume.
	const received = sizeOf(path);
	if (Number(url.searchParams.get('offset')) !== received) return json({ received }, { status: 409 });

	if (request.body) {
		await pipeline(Readable.fromWeb(request.body as import('node:stream/web').ReadableStream), createWriteStream(path, { flags: 'a' }));
	}
	return json({ received: sizeOf(path) });
};

/** POST { name, size, taken_at?, occasion?, title?, useFileDate? } once every chunk is in. */
export const POST: RequestHandler = async ({ params, request, locals }) => {
	const user = locals.user!;
	const path = partFile(user.id, params.token);
	const body = await request.json();

	const name = String(body.name ?? '');
	const kind = kindOf(name);
	if (!kind) error(415, "That kind of file isn't supported.");
	if (!existsSync(path) || sizeOf(path) !== Number(body.size)) error(400, 'The upload is incomplete.');

	const takenAt = cleanTakenAt(body.taken_at) ?? (body.useFileDate ? await dateFromFile(path) : null);
	const occasion =
		occasionBySlug(body.occasion)?.slug ?? (takenAt?.length === 10 ? guessOccasion(takenAt) : null);
	const title = String(body.title ?? '').trim().slice(0, 200) || null;

	const id = Number(
		db
			.prepare('INSERT INTO media (kind, original_name, title, taken_at, occasion, uploaded_by) VALUES (?, ?, ?, ?, ?, ?)')
			.run(kind, name, title, takenAt, occasion, user.id).lastInsertRowid
	);
	const dir = join(MEDIA_DIR, String(id));
	mkdirSync(dir, { recursive: true });
	renameSync(path, join(dir, `original.${extOf(name)}`));
	enqueue(id);

	return json({ id });
};
