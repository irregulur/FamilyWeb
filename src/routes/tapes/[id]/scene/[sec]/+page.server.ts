import { error, redirect } from '@sveltejs/kit';
import { peopleIn } from '#lib/server/people.ts';
import { clipAt, tapeById } from '#lib/server/tapes.ts';
import { sceneHref } from '#lib/tapes.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params, url }) => {
	const tape = tapeById(Number(params.id));
	const second = Number(params.sec);
	if (!tape || !Number.isInteger(second)) error(404, 'That tape isn’t on the shelf.');
	if (tape.status !== 'ready') redirect(307, `/tapes/${tape.id}`);
	const at = clipAt(tape, second);
	if (!at) redirect(307, `/tapes/${tape.id}`);
	// The scene's start was moved since this link was made: go to the scene playing at that point now
	if (Math.floor(at.clip.start) !== second) redirect(307, sceneHref(at.clip) + url.search);
	return { tape, ...at, people: peopleIn('chapter', at.clip.id) };
};
