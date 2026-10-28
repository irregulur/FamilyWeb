import { fail, redirect } from '@sveltejs/kit';
import { checkLogin, startSession } from '#lib/server/auth.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => {
	if (locals.user) redirect(303, '/');
};

export const actions: Actions = {
	default: async ({ request, cookies, url }) => {
		const form = await request.formData();
		const email = String(form.get('email') ?? '').trim().toLowerCase();
		const userId = checkLogin(email, String(form.get('password') ?? ''));
		if (!userId) return fail(400, { email, error: "That email and password don't match." });
		startSession(cookies, userId, url);
		redirect(303, '/');
	}
};
