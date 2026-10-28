import { error, fail, redirect } from '@sveltejs/kit';
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { cleanTakenAt, takenAtFrom } from '#lib/dates.ts';
import { occasionBySlug } from '#lib/occasions.ts';
import { db } from '#lib/server/db.ts';
import { chaptersFor, deleteTape, recordingChoices, removeScan, saveScan, tapeById, tapeDir } from '#lib/server/tapes.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params, locals }) => {
	const tape = tapeById(Number(params.id));
	if (!tape) error(404, 'That tape isn’t on the shelf.');
	return {
		tape,
		chapters: chaptersFor(tape.id),
		recordings: recordingChoices(tape.id),
		canDelete: !!locals.user?.is_admin || locals.user?.id === tape.created_by
	};
};

type Line = { title?: unknown; year?: unknown; month?: unknown; day?: unknown; occasion?: unknown; start?: unknown };
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
		const chapters = lines
			.slice(0, 300)
			.map((l) => ({
				title: text(l.title).slice(0, 200),
				taken_at: cleanTakenAt(takenAtFrom(text(l.year), text(l.month), text(l.day))),
				occasion: occasionBySlug(text(l.occasion))?.slug ?? null,
				start: typeof l.start === 'number' && Number.isFinite(l.start) && l.start >= 0 ? l.start : null
			}))
			.filter((c) => c.title);

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
			db.prepare('UPDATE tapes SET name = ?, media_id = ? WHERE id = ?').run(name, recording, tape.id);
			db.prepare('DELETE FROM chapters WHERE tape_id = ?').run(tape.id);
			const insert = db.prepare('INSERT INTO chapters (tape_id, position, title, start, taken_at, occasion) VALUES (?, ?, ?, ?, ?, ?)');
			chapters.forEach((c, i) => insert.run(tape.id, i, c.title, c.start, c.taken_at, c.occasion));
			db.exec('COMMIT');
		} catch (e) {
			db.exec('ROLLBACK');
			throw e;
		}
		// Scene pictures came from the old recording
		if (recording !== tape.media_id) rmSync(join(tapeDir(tape.id), 'frames'), { recursive: true, force: true });

		redirect(303, `/tapes/${tape.id}`);
	},

	delete: ({ params, locals }) => {
		const tape = tapeById(Number(params.id));
		if (!tape) error(404);
		if (!locals.user?.is_admin && locals.user?.id !== tape.created_by) error(403, 'Only the person who added this tape (or the owner) can delete it.');
		deleteTape(tape);
		redirect(303, '/tapes');
	}
};
