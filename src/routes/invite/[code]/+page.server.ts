import { error, fail, redirect } from '@sveltejs/kit';
import { createUser, openInvite, readSignup, startSession, useInvite } from '#lib/server/auth.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params }) => {
	const invite = openInvite(params.code);
	if (!invite) error(404, 'This invite link has already been used or has expired. Ask for a new one!');
	return { note: invite.note };
};

export const actions: Actions = {
	default: async ({ request, cookies, url, params }) => {
		if (!openInvite(params.code)) error(404, 'This invite link has already been used or has expired.');
		const s = readSignup(await request.formData());
		if ('error' in s) return fail(400, s);
		const userId = createUser(s.name, s.email, s.password);
		useInvite(params.code, userId);
		startSession(cookies, userId, url);
		redirect(303, '/');
	}
};
