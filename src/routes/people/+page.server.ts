import { peopleList } from '#lib/server/people.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => ({ people: peopleList() });
