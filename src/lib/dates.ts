// Dates in the archive are fuzzy on purpose: 'YYYY', 'YYYY-MM' or 'YYYY-MM-DD'.

export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const TAKEN_AT = /^\d{4}(-(0[1-9]|1[0-2])(-(0[1-9]|[12]\d|3[01]))?)?$/;

/** A valid fuzzy date, or null. */
export const cleanTakenAt = (value: unknown) => (typeof value === 'string' && TAKEN_AT.test(value) ? value : null);

/** Year/month/day form fields → fuzzy date ('' when there's no valid year). */
export function takenAtFrom(year: string, month: string, day: string) {
	if (!/^\d{4}$/.test(year.trim())) return '';
	const d = month && /^\d{1,2}$/.test(day.trim()) ? day.trim().padStart(2, '0') : '';
	return cleanTakenAt([year.trim(), month, d].filter(Boolean).join('-')) ?? year.trim();
}
