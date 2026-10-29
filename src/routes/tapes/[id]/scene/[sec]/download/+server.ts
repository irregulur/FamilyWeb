import { error } from '@sveltejs/kit';
import { createReadStream, fstatSync, openSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { MEDIA_DIR, UPLOAD_DIR } from '#lib/server/db.ts';
import { ffmpeg } from '#lib/server/process.ts';
import { clipAt, tapeById } from '#lib/server/tapes.ts';
import type { RequestHandler } from './$types';

// Just this scene as its own video file, to keep or send on. Copied out of the tape's web video, so it's quick.
export const GET: RequestHandler = async ({ params }) => {
	const tape = tapeById(Number(params.id));
	const at = tape?.status === 'ready' ? clipAt(tape, Number(params.sec)) : null;
	if (!tape || !at) error(404);
	const { clip } = at;

	const tmp = join(UPLOAD_DIR, `scene-${tape.id}-${clip.id}-${Date.now()}.mp4`);
	try {
		await ffmpeg(
			'-ss', String(clip.start), '-to', String(clip.end), '-i', join(MEDIA_DIR, String(tape.media_id), 'video.mp4'),
			'-c', 'copy', '-avoid_negative_ts', 'make_zero', '-movflags', '+faststart', tmp
		);
		const fd = openSync(tmp, 'r');
		const size = fstatSync(fd).size;
		rmSync(tmp); // gone from the folder now; the open file is read and then freed
		const name = `${clip.title} (${tape.name})`.replace(/[/\\:*?"<>|]/g, '-').slice(0, 150);
		return new Response(Readable.toWeb(createReadStream('', { fd })) as ReadableStream, {
			headers: {
				'content-type': 'video/mp4',
				'content-length': String(size),
				'content-disposition': `attachment; filename="scene.mp4"; filename*=UTF-8''${encodeURIComponent(name)}.mp4`
			}
		});
	} catch (e) {
		rmSync(tmp, { force: true });
		console.error(`Cutting scene ${clip.id} out of tape ${tape.id} failed:`, e);
		error(500, 'Couldn’t make that scene into a file. Try again?');
	}
};
