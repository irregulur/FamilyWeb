const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/**
 * The stretch of time a tape covers, from its first and last dated scene ('1991-01', '1991-04' → 'January–April 1991').
 * Months are left out where a year has no scene dated to the month.
 */
export function tapeSpan(t: { first_taken: string | null; last_taken: string | null }) {
	if (!t.first_taken || !t.last_taken) return '';
	const [y1, m1] = t.first_taken.split('-').map(Number);
	const [y2, m2] = t.last_taken.split('-').map(Number);
	const month = (m: number) => m >= 1 && m <= 12; // 0 or 13: that end of the tape is only dated to the year
	if (y1 === y2) {
		if (!month(m1) || !month(m2)) return `${y1}`;
		return m1 === m2 ? `${MONTH_NAMES[m1 - 1]} ${y1}` : `${MONTH_NAMES[m1 - 1]}–${MONTH_NAMES[m2 - 1]} ${y1}`;
	}
	if (!month(m1) && !month(m2)) return `${y1}–${y2}`;
	return `${month(m1) ? `${MONTHS[m1 - 1]} ` : ''}${y1} – ${month(m2) ? `${MONTHS[m2 - 1]} ` : ''}${y2}`;
}

/** '1987' → '1987', '1987-12' → 'Dec 1987', '1987-12-25' → '25 Dec 1987', null → 'Date unknown' */
export function formatTakenAt(taken: string | null) {
	if (!taken) return 'Date unknown';
	const [y, m, d] = taken.split('-');
	if (!m) return y;
	return `${d ? `${Number(d)} ` : ''}${MONTHS[Number(m) - 1]} ${y}`;
}

export function formatDuration(seconds: number | null) {
	if (!seconds) return '';
	const s = Math.round(seconds);
	const h = Math.floor(s / 3600);
	const mm = String(Math.floor((s % 3600) / 60)).padStart(h ? 2 : 1, '0');
	return `${h ? `${h}:` : ''}${mm}:${String(s % 60).padStart(2, '0')}`;
}

/** 1 → '1 photo', 3 → '3 photos', 0 → '' */
export const count = (n: number, one: string, many = `${one}s`) => (n ? `${n} ${n === 1 ? one : many}` : '');

/** Joins non-empty parts with ' · ' */
export const dots = (...parts: string[]) => parts.filter(Boolean).join(' · ');

/** The 90s film-camera date stamp: '1994-12-25' → "'94 12 25", '1994-07' → "'94  7" */
export function stamp(taken: string | null) {
	if (!taken) return '';
	const [y, m, d] = taken.split('-');
	return [`'${y.slice(2)}`, ...[m, d].filter(Boolean).map((n) => String(Number(n)).padStart(2, ' '))].join(' ');
}

/** A camcorder's on-screen date: '1994-12-25' → 'DEC.25 1994', '1994-12' → 'DEC 1994' */
export function osdDate(taken: string | null) {
	if (!taken) return '';
	const [y, m, d] = taken.split('-');
	if (!m) return y;
	return `${MONTHS[Number(m) - 1].toUpperCase()}${d ? `.${Number(d)}` : ''} ${y}`;
}

/** What the server is doing with an upload right now. */
export type Work = { step: string; percent: number | null };
export const workText = (w: Work) => `${w.step}${w.percent != null ? ` — ${w.percent}%` : ''}`;
