import { error } from '@sveltejs/kit';
import { occasionBySlug } from '#lib/occasions.ts';
import { mediaForOccasion } from '#lib/server/media.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params }) => {
	const occasion = occasionBySlug(params.slug);
	if (!occasion) error(404);
	const items = mediaForOccasion(params.slug);
	// Christmas 1986, Christmas 1987, ... — one section per year
	const byYear = Object.entries(
		Object.groupBy(items, (m) => m.taken_at?.slice(0, 4) ?? 'Date unknown')
	).map(([year, items]) => ({ year, items: items ?? [] }));
	return { occasion, byYear, count: items.length };
};
