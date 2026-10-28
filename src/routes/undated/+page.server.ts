import { undatedMedia } from '#lib/server/media.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => ({ items: undatedMedia() });
