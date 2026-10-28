import { existsSync, mkdirSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { extOf } from '#lib/filetypes.ts';
import { sceneThumb } from '#lib/tapes.ts';
import { db, MEDIA_DIR, TAPES_DIR } from './db.ts';
import type { StripItem } from './media.ts';
import { ffmpeg, THUMB_FILTER } from './process.ts';

export type Tape = {
	id: number;
	name: string;
	media_id: number | null;
	sticker_scan: number | null;
	sleeve_scan: number | null;
	created_by: number | null;
	status: 'processing' | 'ready' | 'failed' | null; // of the recording; null = not digitized yet
	duration: number | null;
	first_year: number | null;
	last_year: number | null;
	scenes: number;
};

export type Chapter = {
	id: number;
	tape_id: number;
	position: number;
	title: string;
	start: number | null;
	taken_at: string | null;
	occasion: string | null;
};

const TAPE = `
	SELECT t.id, t.name, t.media_id, t.sticker_scan, t.sleeve_scan, t.created_by, m.status, m.duration,
	       (SELECT min(year) FROM chapters WHERE tape_id = t.id) AS first_year,
	       (SELECT max(year) FROM chapters WHERE tape_id = t.id) AS last_year,
	       (SELECT count(*) FROM chapters WHERE tape_id = t.id) AS scenes
	FROM tapes t LEFT JOIN media m ON m.id = t.media_id`;

/** In the order they'd sit on a shelf: oldest first, then the ones nobody has dated. */
export const allTapes = () => db.prepare(`${TAPE} ORDER BY first_year IS NULL, first_year, t.id`).all() as Tape[];

export const tapeById = (id: number) => db.prepare(`${TAPE} WHERE t.id = ?`).get(id) as Tape | undefined;

export const chaptersFor = (tapeId: number) =>
	db.prepare('SELECT * FROM chapters WHERE tape_id = ? ORDER BY position').all(tapeId) as Chapter[];

export const digitizedCount = () =>
	(db.prepare("SELECT count(*) AS n FROM tapes t JOIN media m ON m.id = t.media_id AND m.status = 'ready'").get() as { n: number }).n;

// Scenes you can actually watch: their tape's recording is ready.
const WATCHABLE = `FROM chapters c JOIN tapes t ON t.id = c.tape_id JOIN media m ON m.id = t.media_id AND m.status = 'ready'`;

export type Scene = Chapter & { tape_name: string; media_id: number; thumb: string };

/** Scenes on tape from one year, for the year page. */
export function scenesForYear(year: number) {
	const rows = db
		.prepare(`SELECT c.*, t.name AS tape_name, t.media_id ${WATCHABLE} WHERE c.year = ? ORDER BY c.taken_at, c.tape_id, c.position`)
		.all(year) as Omit<Scene, 'thumb'>[];
	return rows.map((r) => ({ ...r, thumb: sceneThumb(r) }));
}

/** Per year: how many scenes are on tape, and a couple of them as pictures for the timeline. */
export function sceneYears() {
	const rows = db
		.prepare(`SELECT c.year, c.tape_id, c.start, c.taken_at, t.media_id ${WATCHABLE} WHERE c.year IS NOT NULL ORDER BY random()`)
		.all() as { year: number; tape_id: number; start: number | null; taken_at: string | null; media_id: number }[];
	const years = new Map<number, { scenes: number; items: StripItem[] }>();
	for (const r of rows) {
		const y = years.get(r.year) ?? { scenes: 0, items: [] };
		y.scenes++;
		if (y.items.length < 3)
			y.items.push({
				href: `/tapes/${r.tape_id}${r.start != null ? `?t=${Math.floor(r.start)}` : ''}`,
				src: sceneThumb(r),
				taken_at: r.taken_at,
				duration: null,
				scene: true
			});
		years.set(r.year, y);
	}
	return years;
}

/** Videos that could be a tape's recording: not already used by another tape. */
export function recordingChoices(tapeId: number) {
	return db
		.prepare(
			`SELECT id, original_name, duration, status, created_at FROM media
			 WHERE kind = 'video' AND status != 'failed'
			   AND id NOT IN (SELECT media_id FROM tapes WHERE media_id IS NOT NULL AND id != ?)
			 ORDER BY duration IS NULL, duration DESC, id DESC`
		)
		.all(tapeId) as { id: number; original_name: string; duration: number | null; status: string; created_at: string }[];
}

export const tapeDir = (id: number) => join(TAPES_DIR, String(id));

/** Keeps the scan exactly as uploaded, plus a web-sized copy the site shows. */
export async function saveScan(tapeId: number, side: 'sticker' | 'sleeve', file: File) {
	const dir = tapeDir(tapeId);
	mkdirSync(dir, { recursive: true });
	const original = join(dir, `${side}-original.${extOf(file.name) || 'jpg'}`);
	for (const old of readdirSync(dir)) if (old.startsWith(`${side}-original.`)) rmSync(join(dir, old));
	writeFileSync(original, Buffer.from(await file.arrayBuffer()));
	const tmp = join(dir, `${side}.tmp.webp`);
	await ffmpeg('-i', original, '-frames:v', '1', '-vf', "scale='min(2400,iw)':'min(2400,ih)':force_original_aspect_ratio=decrease", '-c:v', 'libwebp', '-quality', '88', tmp);
	renameSync(tmp, join(dir, `${side}.webp`));
	db.prepare(`UPDATE tapes SET ${side}_scan = ? WHERE id = ?`).run(Date.now(), tapeId);
}

export function removeScan(tapeId: number, side: 'sticker' | 'sleeve') {
	const dir = tapeDir(tapeId);
	if (existsSync(dir)) for (const f of readdirSync(dir)) if (f.startsWith(`${side}.`) || f.startsWith(`${side}-original.`)) rmSync(join(dir, f));
	db.prepare(`UPDATE tapes SET ${side}_scan = NULL WHERE id = ?`).run(tapeId);
}

/** A still from the recording at `second`, made the first time someone asks for it. */
export async function frameAt(tape: Tape, second: number) {
	const out = join(tapeDir(tape.id), 'frames', `${second}.webp`);
	if (existsSync(out)) return out;
	mkdirSync(join(tapeDir(tape.id), 'frames'), { recursive: true });
	const tmp = `${out}.${process.pid}-${Math.random().toString(36).slice(2)}.tmp.webp`;
	// A couple of seconds in, past the camera's first wobbly frames
	const at = Math.max(0, Math.min(second + 2, (tape.duration ?? second + 2) - 1));
	await ffmpeg('-ss', String(at), '-i', join(MEDIA_DIR, String(tape.media_id), 'video.mp4'), '-frames:v', '1', '-vf', THUMB_FILTER, '-c:v', 'libwebp', '-quality', '78', tmp);
	renameSync(tmp, out);
	return out;
}

/** Removes the tape, its scans and its recording. */
export function deleteTape(tape: Tape) {
	db.prepare('DELETE FROM tapes WHERE id = ?').run(tape.id);
	rmSync(tapeDir(tape.id), { recursive: true, force: true });
	if (tape.media_id) {
		db.prepare('DELETE FROM media WHERE id = ?').run(tape.media_id);
		rmSync(join(MEDIA_DIR, String(tape.media_id)), { recursive: true, force: true });
	}
}
