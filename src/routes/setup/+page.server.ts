import { fail, redirect } from '@sveltejs/kit';
import { createUser, readSignup, startSession, userCount } from '#lib/server/auth.ts';
import type { Actions, PageServerLoad } from './$types';

// First-run page: creates the owner (admin) account. Disappears once anyone exists.
export const load: PageServerLoad = () => {
	if (userCount() > 0) redirect(303, '/login');
};

export const actions: Actions = {
	default: async ({ request, cookies, url }) => {
		if (userCount() > 0) redirect(303, '/login');
		const s = readSignup(await request.formData());
		if ('error' in s) return fail(400, s);
		startSession(cookies, createUser(s.name, s.email, s.password, true), url);
		redirect(303, '/');
	}
};
