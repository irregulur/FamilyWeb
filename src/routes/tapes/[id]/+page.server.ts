import { error } from '@sveltejs/kit';
import { working } from '#lib/server/process.ts';
import { chaptersFor, tapeById } from '#lib/server/tapes.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params }) => {
	const tape = tapeById(Number(params.id));
	if (!tape) error(404, 'That tape isn’t on the shelf.');
	return { tape, chapters: chaptersFor(tape.id), work: (tape.media_id && working.get(tape.media_id)) || null };
};
