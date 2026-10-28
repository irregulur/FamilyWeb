import { redirect } from '@sveltejs/kit';
import { randomMemory } from '#lib/server/media.ts';

/** "Play a memory": off to a random home video or scene on tape. */
export const GET = () => redirect(303, randomMemory() ?? '/');
