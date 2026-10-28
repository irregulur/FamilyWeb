import { error } from '@sveltejs/kit';
import { createInvite } from '#lib/server/auth.ts';
import { db } from '#lib/server/db.ts';
import { addDemo, addingDemo, removeDemo } from '#lib/server/demo.ts';
import { DEFAULTS, getSettings, saveSettings } from '#lib/server/settings.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => {
	if (!locals.user?.is_admin) error(403, 'Only the archive owner can manage family members.');
	const members = db
		.prepare(
			`SELECT u.name, u.email, u.is_admin, coalesce(sum(m.demo = 0), 0) AS uploads
			 FROM users u LEFT JOIN media m ON m.uploaded_by = u.id GROUP BY u.id ORDER BY u.created_at`
		)
		.all() as { name: string; email: string; is_admin: number; uploads: number }[];
	return { members, addingSamples: addingDemo(), settings: getSettings(), defaults: DEFAULTS };
};

export const actions: Actions = {
	invite: async ({ request, locals, url }) => {
		if (!locals.user?.is_admin) error(403);
		const note = String((await request.formData()).get('note') ?? '').trim();
		const code = createInvite(note, locals.user.id);
		return { link: `${url.origin}/invite/${code}`, note };
	},
	frontPage: async ({ request, locals }) => {
		if (!locals.user?.is_admin) error(403);
		const form = await request.formData();
		saveSettings(Object.fromEntries(Object.keys(DEFAULTS).map((k) => [k, String(form.get(k) ?? '').slice(0, 600)])));
		return { frontPageSaved: true };
	},
	addSamples: ({ locals }) => {
		if (!locals.user?.is_admin) error(403);
		addDemo(locals.user.id);
		return { samplesStarted: true };
	},
	removeSamples: ({ locals }) => {
		if (!locals.user?.is_admin) error(403);
		return { samplesRemoved: removeDemo() };
	}
};
