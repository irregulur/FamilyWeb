import { demoCount } from '#lib/server/demo.ts';
import { getSettings, siteName } from '#lib/server/settings.ts';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ locals }) => ({
	user: locals.user,
	samples: locals.user ? demoCount() : 0,
	siteName: siteName(getSettings())
});
