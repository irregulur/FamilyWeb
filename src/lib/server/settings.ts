import { db } from './db.ts';

/** The words on the site that the family can change (Family page → Front page). */
export const DEFAULTS = {
	family_name: process.env.FAMILY_NAME ?? '',
	headline: 'Do you remember',
	headline_italic: 'when we were small?',
	intro: 'Every Christmas morning, birthday cake and long summer drive we managed to catch on tape — together again in one place.',
	dedication: '',
	dedication_from: ''
};
export type Settings = typeof DEFAULTS;
export type SettingKey = keyof Settings;

export function getSettings(): Settings {
	const rows = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[];
	const saved = Object.fromEntries(rows.map((r) => [r.key, r.value]));
	return Object.fromEntries(
		Object.entries(DEFAULTS).map(([k, v]) => [k, saved[k] ?? v])
	) as Settings;
}

/** Saves the given keys; an empty value goes back to the default. */
export function saveSettings(values: Partial<Settings>) {
	const set = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value');
	const reset = db.prepare('DELETE FROM settings WHERE key = ?');
	for (const [k, v] of Object.entries(values)) {
		if (!(k in DEFAULTS)) continue;
		const value = (v ?? '').trim();
		if (value && value !== DEFAULTS[k as SettingKey]) set.run(k, value);
		else reset.run(k);
	}
}

/** "Smith" (or "Smith Family") → "The Smith Family"; nothing set → "Our Family". */
export function siteName(s: Settings) {
	const name = s.family_name.replace(/\s*family$/i, '').replace(/^the\s+/i, '').trim();
	return !name || /^our$/i.test(name) ? 'Our Family' : `The ${name} Family`;
}
