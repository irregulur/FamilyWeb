// The "browse by occasion" categories. Edit freely — order here is the order on the home page.
// `color` is the accent used for that occasion's cards and page header.
export const OCCASIONS = [
	{ slug: 'christmas', name: 'Christmas', color: '#7a1f2b' },
	{ slug: 'new-year', name: "New Year's", color: '#a87c34' },
	{ slug: 'easter', name: 'Easter', color: '#6d7f4f' },
	{ slug: 'birthday', name: 'Birthdays', color: '#a5536e' },
	{ slug: 'wedding', name: 'Weddings', color: '#86735a' },
	{ slug: 'holiday-trip', name: 'Trips & Holidays', color: '#2f5d62' },
	{ slug: 'halloween', name: 'Halloween', color: '#a8562b' },
	{ slug: 'everyday', name: 'Everyday Life', color: '#4f5b6b' }
] as const;

export type Occasion = (typeof OCCASIONS)[number];

export const occasionBySlug = (slug: string | null | undefined) =>
	OCCASIONS.find((o) => o.slug === slug);

/** Suggests an occasion from a full date (YYYY-MM-DD), for pre-filling the upload form. */
export function guessOccasion(date: string) {
	const md = date.slice(5);
	if (md >= '12-20' && md <= '12-26') return 'christmas';
	if (md === '12-31' || md === '01-01') return 'new-year';
	if (md === '10-31') return 'halloween';
	return null;
}
