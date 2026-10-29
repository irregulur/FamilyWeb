import { error, json } from '@sveltejs/kit';
import { allPeople, personNamed } from '#lib/server/people.ts';
import type { RequestHandler } from './$types';

/** Everyone who can be tagged. */
export const GET: RequestHandler = () => json(allPeople());

/** POST { name } → the person called that, added if they're new. */
export const POST: RequestHandler = async ({ request, locals }) => {
	const { name } = await request.json().catch(() => ({}));
	const person = typeof name === 'string' ? personNamed(name, locals.user!.id) : null;
	if (!person) error(400, 'Write a name first.');
	return json(person);
};
