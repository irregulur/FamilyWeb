import { error } from '@sveltejs/kit';
import { allYears, mediaForYear } from '#lib/server/media.ts';
import { scenesForYear } from '#lib/server/tapes.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params }) => {
	const year = Number(params.year);
	const items = Number.isInteger(year) ? mediaForYear(year) : [];
	const scenes = Number.isInteger(year) ? scenesForYear(year) : [];
	if (!items.length && !scenes.length) error(404, `Nothing from ${params.year} yet.`);

	const years = allYears();
	return {
		year,
		items,
		scenes,
		prev: years.findLast((y) => y < year) ?? null,
		next: years.find((y) => y > year) ?? null
	};
};
