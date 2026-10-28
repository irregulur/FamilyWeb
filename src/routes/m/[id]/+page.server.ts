import { error, fail, redirect } from '@sveltejs/kit';
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { cleanTakenAt, takenAtFrom } from '#lib/dates.ts';
import { occasionBySlug } from '#lib/occasions.ts';
import { db, MEDIA_DIR } from '#lib/server/db.ts';
import { mediaById, mediaForYear, neighbours, nextUndated, undatedMedia } from '#lib/server/media.ts';
import type { User } from '#lib/server/auth.ts';
import type { Actions, PageServerLoad } from './$types';

const canDelete = (user: User | null, uploadedBy: number | null) => !!user && (!!user.is_admin || user.id === uploadedBy);

export const load: PageServerLoad = ({ params, locals }) => {
	const item = mediaById(Number(params.id));
	if (!item || item.status !== 'ready') error(404);
	return { item, ...neighbours(item), canDelete: canDelete(locals.user, item.uploaded_by) };
};

export const actions: Actions = {
	/** Anyone in the family can fix the details — that's how the mystery box gets emptied. */
	save: async ({ params, request, locals }) => {
		const item = mediaById(Number(params.id));
		if (!item) error(404);
		const form = await request.formData();
		const get = (key: string) => String(form.get(key) ?? '').trim();

		const year = get('year');
		if (year && !/^\d{4}$/.test(year)) return fail(400, { message: 'The year should be four digits, like 1987.' });
		if (year && (Number(year) < 1800 || Number(year) > new Date().getFullYear()))
			return fail(400, { message: `${year} doesn't look right — check the year.` });
		const takenAt = cleanTakenAt(takenAtFrom(year, get('month'), get('day')));

		db.prepare(
			`UPDATE media SET title = ?, description = ?, taken_at = ?, occasion = ?, edited_by = ?, edited_at = datetime('now')
			 WHERE id = ?`
		).run(
			get('title').slice(0, 200) || null,
			get('description').slice(0, 2000) || null,
			takenAt,
			occasionBySlug(get('occasion'))?.slug ?? null,
			locals.user!.id,
			item.id
		);

		// From the mystery box: straight on to the next unknown one
		if (form.has('next')) {
			const next = nextUndated(item.id);
			if (next && next !== item.id) redirect(303, `/m/${next}`);
			redirect(303, '/undated');
		}
		return { saved: true };
	},

	delete: ({ params, locals }) => {
		const item = mediaById(Number(params.id));
		if (!item) error(404);
		if (!canDelete(locals.user, item.uploaded_by)) error(403, 'Only the person who added this (or the owner) can delete it.');
		db.prepare('DELETE FROM media WHERE id = ?').run(item.id);
		rmSync(join(MEDIA_DIR, String(item.id)), { recursive: true, force: true });
		const year = item.taken_at?.slice(0, 4);
		// Back to where it was, unless that page is now empty
		if (year ? mediaForYear(Number(year)).length : undatedMedia().length) redirect(303, year ? `/year/${year}` : '/undated');
		redirect(303, '/');
	}
};
