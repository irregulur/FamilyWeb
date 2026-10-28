// Shared bits for the design mock-ups: dark mode toggle + fake data. Not used by the real site.

// Dark mode: follows the device, the button overrides it (remembered in this browser).
const root = document.documentElement;
const saved = localStorage.getItem('theme');
if (saved) root.dataset.theme = saved;
const isDark = () => (root.dataset.theme ?? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')) === 'dark';
window.toggleTheme = () => {
	root.dataset.theme = isDark() ? 'light' : 'dark';
	localStorage.setItem('theme', root.dataset.theme);
	document.querySelectorAll('[data-theme-icon]').forEach((b) => (b.textContent = isDark() ? '☀' : '☾'));
};
addEventListener('DOMContentLoaded', () =>
	document.querySelectorAll('[data-theme-icon]').forEach((b) => (b.textContent = isDark() ? '☀' : '☾'))
);

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const rnd = (seed) => {
	let s = seed;
	return () => ((s = (s * 9301 + 49297) % 233280) / 233280);
};

window.photo = (seed, w = 480, h = 360) => `https://picsum.photos/seed/fam${seed}/${w}/${h}`;

/** Years with a handful of photos each, like the real timeline. */
window.YEARS = [1986, 1989, 1991, 1992, 1993, 1994, 1996, 1997, 1999, 2002].map((year) => {
	const r = rnd(year);
	const count = 4 + Math.floor(r() * 40);
	return {
		year,
		count,
		videos: Math.floor(r() * 4),
		scenes: year >= 1991 && year <= 1997 ? 2 + Math.floor(r() * 5) : 0,
		items: Array.from({ length: 8 }, (_, i) => {
			const m = Math.floor(r() * 12);
			return { seed: year * 10 + i, video: r() < 0.15, date: `${MONTHS[m]} ${1 + Math.floor(r() * 28)} '${String(year).slice(2)}`,
				stamp: `'${String(year).slice(2)} ${String(m + 1).padStart(2, ' ')} ${String(1 + Math.floor(r() * 28)).padStart(2, ' ')}` };
		})
	};
});

window.TAPES = [
	{ name: "Xmas '92 & Sarah's 5th", years: '1992–93', len: '1:58', color: '#2f5d62', done: true },
	{ name: 'Tape 4 — summer 1994', years: '1994', len: '2:01', color: '#7a1f2b', done: true },
	{ name: "Grandma's 70th / beach '96", years: '1996', len: '', color: '#b8893b', done: false },
	{ name: 'Florida 1997', years: '1997', len: '', color: '#5b4a7a', done: false }
];

window.OCCASIONS = [
	['Christmas', '#d93a2b', 214],
	['Birthdays', '#e0559b', 162],
	['Trips & Holidays', '#1f9e9a', 131],
	['Easter', '#5aa443', 48],
	['Halloween', '#f07b16', 37],
	['Weddings', '#a67c3d', 29],
	["New Year's", '#d9a400', 21],
	['Everyday Life', '#4f6d8f', 302]
];
