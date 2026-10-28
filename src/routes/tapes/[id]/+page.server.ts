import { error } from '@sveltejs/kit';
import { chaptersFor, tapeById } from '#lib/server/tapes.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params }) => {
	const tape = tapeById(Number(params.id));
	if (!tape) error(404, 'That tape isn’t on the shelf.');
	return { tape, chapters: chaptersFor(tape.id) };
};
