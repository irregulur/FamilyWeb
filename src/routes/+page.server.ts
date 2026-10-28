import { christmasCount, featured, occasionCounts, timelineYears, totals, undatedCount } from '#lib/server/media.ts';
import { getSettings } from '#lib/server/settings.ts';
import { allTapes, digitizedCount } from '#lib/server/tapes.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => ({
	years: timelineYears(),
	occasions: Object.fromEntries(occasionCounts()),
	undated: undatedCount(),
	totals: totals(),
	tapes: allTapes(),
	digitized: digitizedCount(),
	christmases: christmasCount(),
	featured: featured(),
	settings: getSettings()
});
