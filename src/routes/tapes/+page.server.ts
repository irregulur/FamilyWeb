import { redirect } from '@sveltejs/kit';
import { db } from '#lib/server/db.ts';
import { allTapes, digitizedCount } from '#lib/server/tapes.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = () => ({ tapes: allTapes(), digitized: digitizedCount() });

export const actions: Actions = {
	/** A new tape on the shelf; you name it and add its labels on the next page. */
	create: ({ locals }) => {
		const n = (db.prepare('SELECT count(*) AS n FROM tapes').get() as { n: number }).n;
		const id = db.prepare('INSERT INTO tapes (name, created_by) VALUES (?, ?)').run(`Tape ${n + 1}`, locals.user!.id).lastInsertRowid;
		redirect(303, `/tapes/${id}/edit?new`);
	}
};
