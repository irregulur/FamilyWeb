import { error } from '@sveltejs/kit';
import { createReadStream, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { MEDIA_DIR } from '#lib/server/db.ts';
import { mediaById } from '#lib/server/media.ts';
import type { RequestHandler } from './$types';

const TYPES: Record<string, string> = {
	'thumb.webp': 'image/webp',
	'large.webp': 'image/webp',
	'video.mp4': 'video/mp4'
};

// Serves a media file. Supports Range requests so videos can seek without downloading everything.
// Only reachable when logged in (hooks.server.ts guards every non-public path).
export const GET: RequestHandler = ({ params, request }) => {
	const id = Number(params.id);
	const item = mediaById(id);
	if (!item) error(404);

	const dir = join(MEDIA_DIR, String(id));
	let path: string;
	const headers: Record<string, string> = { 'cache-control': 'private, max-age=31536000, immutable' };

	if (params.file === 'original') {
		// Digitized tapes don't keep their huge raw capture; they download the web copy instead
		const name = readdirSync(dir).find((f) => f.startsWith('original.')) ?? (item.kind === 'video' ? 'video.mp4' : undefined);
		if (!name) error(404);
		path = join(dir, name);
		const filename = name === 'video.mp4' ? item.original_name.replace(/\.[^.]+$/, '') + '.mp4' : item.original_name;
		headers['content-type'] = 'application/octet-stream';
		headers['content-disposition'] = `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`;
	} else if (TYPES[params.file]) {
		path = join(dir, params.file);
		headers['content-type'] = TYPES[params.file];
	} else {
		error(404);
	}

	let size: number;
	try {
		size = statSync(path).size;
	} catch {
		error(404);
	}

	headers['accept-ranges'] = 'bytes';
	const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get('range') ?? '');
	if (range && (range[1] || range[2])) {
		// "bytes=500-" (from 500), "bytes=-500" (last 500), "bytes=500-999"
		const start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]));
		const end = range[1] && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
		if (start > end || start >= size) {
			return new Response(null, { status: 416, headers: { 'content-range': `bytes */${size}` } });
		}
		headers['content-range'] = `bytes ${start}-${end}/${size}`;
		headers['content-length'] = String(end - start + 1);
		return new Response(stream(path, start, end), { status: 206, headers });
	}

	headers['content-length'] = String(size);
	return new Response(stream(path), { headers });
};

const stream = (path: string, start?: number, end?: number) =>
	Readable.toWeb(createReadStream(path, { start, end })) as ReadableStream;
