import { error } from '@sveltejs/kit';
import { occasionBySlug } from '#lib/occasions.ts';
import { mediaForOccasion } from '#lib/server/media.ts';
import { scenesForOccasion } from '#lib/server/tapes.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params }) => {
	const occasion = occasionBySlug(params.slug);
	if (!occasion) error(404);
	const items = mediaForOccasion(params.slug);
	const scenes = scenesForOccasion(params.slug);
	// Christmas 1986, Christmas 1987, ... — one section per year, the undated ones last
	const yearOf = (taken_at: string | null) => taken_at?.slice(0, 4) ?? 'Date unknown';
	const years = [...new Set([...items, ...scenes].map((m) => yearOf(m.taken_at)))].sort();
	const byYear = years.map((year) => ({
		year,
		items: items.filter((m) => yearOf(m.taken_at) === year),
		scenes: scenes.filter((s) => yearOf(s.taken_at) === year)
	}));
	return { occasion, byYear, count: items.length, scenes: scenes.length };
};
