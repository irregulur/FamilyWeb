import { error, fail, redirect } from '@sveltejs/kit';
import { allPeople, collectionOf, deletePerson, mergePeople, personById, renamePerson } from '#lib/server/people.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params, locals }) => {
	const person = personById(Number(params.id));
	if (!person) error(404, 'Nobody by that number.');
	return {
		person,
		...collectionOf(person.id),
		// Renaming, merging and removing people is for the owner
		others: locals.user?.is_admin ? allPeople().filter((p) => p.id !== person.id) : []
	};
};

const ownerOnly = (isAdmin: boolean | number | undefined) => {
	if (!isAdmin) error(403, 'Only the owner can change people.');
};

export const actions: Actions = {
	rename: async ({ params, request, locals }) => {
		ownerOnly(locals.user?.is_admin);
		const name = String((await request.formData()).get('name') ?? '');
		if (!renamePerson(Number(params.id), name))
			return fail(400, { message: 'Someone already has that name. If it’s the same person, merge them instead.' });
		return { saved: true };
	},
	merge: async ({ params, request, locals }) => {
		ownerOnly(locals.user?.is_admin);
		const into = personById(Number((await request.formData()).get('into')));
		if (!into) return fail(400, { message: 'Pick who to merge with.' });
		mergePeople(Number(params.id), into.id);
		redirect(303, `/people/${into.id}`);
	},
	delete: ({ params, locals }) => {
		ownerOnly(locals.user?.is_admin);
		deletePerson(Number(params.id));
		redirect(303, '/people');
	}
};
