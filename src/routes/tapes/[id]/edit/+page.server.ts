import { error, fail, redirect } from '@sveltejs/kit';
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { cleanTakenAt, takenAtFrom } from '#lib/dates.ts';
import { occasionBySlug } from '#lib/occasions.ts';
import { db } from '#lib/server/db.ts';
import { findScenes, working } from '#lib/server/process.ts';
import { chaptersFor, deleteTape, recordingChoices, removeScan, saveScan, tapeById, tapeDir } from '#lib/server/tapes.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params, locals }) => {
	const tape = tapeById(Number(params.id));
	if (!tape) error(404, 'That tape isn’t on the shelf.');
	return {
		tape,
		chapters: chaptersFor(tape.id),
		recordings: recordingChoices(tape.id),
		// Where the camera stopped and started in the recording: offered as places a scene might start
		cuts: cutsOf(tape.media_id)?.filter((t) => !tape.duration || t < tape.duration - 5), // not the blue screen at the very end
		skipped: listOf((db.prepare('SELECT skipped FROM tapes WHERE id = ?').get(tape.id) as { skipped: string | null }).skipped),
		work: (tape.media_id && working.get(tape.media_id)) || null,
		canDelete: !!locals.user?.is_admin || locals.user?.id === tape.created_by
	};
};

function cutsOf(mediaId: number | null) {
	const row = mediaId ? (db.prepare('SELECT cuts FROM media WHERE id = ?').get(mediaId) as { cuts: string | null } | undefined) : undefined;
	return row?.cuts ? listOf(row.cuts) : null;
}

/** A JSON list of times, as sent by the page or kept in the database; anything else is dropped. */
function listOf(json: unknown) {
	try {
		const list = JSON.parse(String(json ?? '[]'));
		return Array.isArray(list) ? [...new Set(list.filter((t): t is number => typeof t === 'number' && Number.isFinite(t) && t >= 0))].sort((a, b) => a - b).slice(0, 2000) : [];
	} catch {
		return [];
	}
}

type Line = { id?: unknown; ends?: unknown; title?: unknown; year?: unknown; month?: unknown; day?: unknown; occasion?: unknown; start?: unknown };
const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

export const actions: Actions = {
	/** Anyone in the family can fill in a tape, like photo details. */
	save: async ({ params, request }) => {
		const tape = tapeById(Number(params.id));
		if (!tape) error(404);
		const form = await request.formData();

		const name = String(form.get('name') ?? '').trim().slice(0, 120);
		if (!name) return fail(400, { message: 'Give the tape a name — even just “Tape 3”.' });

		let lines: Line[];
		try {
			lines = JSON.parse(String(form.get('chapters') ?? '[]'));
			if (!Array.isArray(lines)) throw new Error();
		} catch {
			return fail(400, { message: 'Something went wrong with the scene list. Try again?' });
		}
		const time = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null);
		const chapters = lines
			.slice(0, 300)
			.map((l) => ({
				id: typeof l.id === 'number' ? l.id : null,
				title: text(l.title).slice(0, 200),
				taken_at: cleanTakenAt(takenAtFrom(text(l.year), text(l.month), text(l.day))),
				occasion: occasionBySlug(text(l.occasion))?.slug ?? null,
				start: time(l.start),
				ends: time(l.ends)
			}))
			.filter((c) => c.title);
		if (chapters.some((c) => c.ends != null && (c.start == null || c.ends <= c.start)))
			return fail(400, { message: 'A scene ends before it starts — check the times marked in red.' });
		// A start with no end: it ends where the next scene starts (or the tape ends), written in so it can be changed later
		const starts = chapters.flatMap((c) => (c.start != null ? [c.start] : [])).sort((a, b) => a - b);
		for (const c of chapters)
			if (c.start != null && c.ends == null) c.ends = starts.find((s) => s > c.start!) ?? tape.duration ?? null;

		// The recording: a video from the archive that no other tape uses
		const recording = Number(form.get('recording')) || null;
		if (recording && !recordingChoices(tape.id).some((r) => r.id === recording))
			return fail(400, { message: 'That video is already another tape’s recording.' });

		for (const side of ['sticker', 'sleeve'] as const) {
			const file = form.get(side);
			if (file instanceof File && file.size) {
				try {
					await saveScan(tape.id, side, file);
				} catch (e) {
					console.error(e);
					return fail(400, { message: `Couldn't read the ${side === 'sticker' ? 'cassette label' : 'box'} scan. A JPG or PNG works best.` });
				}
			} else if (form.has(`remove_${side}`)) {
				removeScan(tape.id, side);
			}
		}

		db.exec('BEGIN');
		try {
			// The places a scene might start (found, and any added by hand) and the ones looked at and skipped, for this recording
			const same = recording != null && recording === tape.media_id;
			db.prepare('UPDATE tapes SET name = ?, media_id = ? WHERE id = ?').run(name, recording, tape.id);
			if (!same) db.prepare('UPDATE tapes SET skipped = NULL WHERE id = ?').run(tape.id);
			else if (form.has('skipped')) db.prepare('UPDATE tapes SET skipped = ? WHERE id = ?').run(JSON.stringify(listOf(form.get('skipped'))), tape.id);
			if (same && form.has('cuts')) db.prepare('UPDATE media SET cuts = ? WHERE id = ?').run(JSON.stringify(listOf(form.get('cuts'))), recording);
			// Scenes keep their id when changed, so the people tagged in them stay
			const existing = new Set(chaptersFor(tape.id).map((c) => c.id));
			const kept = chapters.filter((c) => c.id != null && existing.has(c.id)).map((c) => c.id!);
			db.prepare(`DELETE FROM chapters WHERE tape_id = ? AND id NOT IN (${kept.map(() => '?').join(',')})`).run(tape.id, ...kept);
			const update = db.prepare('UPDATE chapters SET position = ?, title = ?, start = ?, ends = ?, taken_at = ?, occasion = ? WHERE id = ?');
			const insert = db.prepare('INSERT INTO chapters (tape_id, position, title, start, ends, taken_at, occasion) VALUES (?, ?, ?, ?, ?, ?, ?)');
			chapters.forEach((c, i) =>
				c.id != null && existing.has(c.id)
					? update.run(i, c.title, c.start, c.ends, c.taken_at, c.occasion, c.id)
					: insert.run(tape.id, i, c.title, c.start, c.ends, c.taken_at, c.occasion)
			);
			db.exec('COMMIT');
		} catch (e) {
			db.exec('ROLLBACK');
			throw e;
		}
		// Scene pictures came from the old recording
		if (recording !== tape.media_id) rmSync(join(tapeDir(tape.id), 'frames'), { recursive: true, force: true });

		redirect(303, `/tapes/${tape.id}`);
	},

	/** For recordings made before the site looked for scenes by itself. */
	findScenes: ({ params }) => {
		const tape = tapeById(Number(params.id));
		if (!tape?.media_id || !findScenes(tape.media_id)) return fail(400, { sceneMessage: 'The recording is busy right now — try again in a while.' });
		return { finding: true };
	},

	delete: ({ params, locals }) => {
		const tape = tapeById(Number(params.id));
		if (!tape) error(404);
		if (!locals.user?.is_admin && locals.user?.id !== tape.created_by) error(403, 'Only the person who added this tape (or the owner) can delete it.');
		deleteTape(tape);
		redirect(303, '/tapes');
	}
};
