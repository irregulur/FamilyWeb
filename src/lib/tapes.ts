// Small helpers for tapes, shared by the browser and the server.

/** '1:02:03', '62:03' or '75' → seconds; null if it isn't a time. */
export function parseTime(text: string) {
	const parts = text.trim().split(':');
	if (!parts[0] || parts.length > 3 || parts.some((p) => !/^\d+$/.test(p))) return null;
	return parts.reduce((total, p) => total * 60 + Number(p), 0);
}

/** 3723 → '1:02:03', 75 → '1:15', 0 → '0:00' */
export function formatTime(seconds: number) {
	const s = Math.floor(seconds);
	const h = Math.floor(s / 3600);
	const m = String(Math.floor((s % 3600) / 60)).padStart(h ? 2 : 1, '0');
	return `${h ? `${h}:` : ''}${m}:${String(s % 60).padStart(2, '0')}`;
}

/** A picture for a scene: the frame where it starts, or the tape's cover if nobody has found the start yet. */
export const sceneThumb = (c: { tape_id: number; start: number | null; media_id: number | null; version?: number | null }) =>
	c.start != null
		? `/tapes/${c.tape_id}/frame/${Math.floor(c.start)}?r=${c.media_id}-${c.version ?? 0}`
		: `/files/${c.media_id}/thumb.webp?v=${c.version ?? 0}`;

/** A scene plays on its own page, from where it starts to where the next one starts. Until its start is found, the whole tape. */
export const sceneHref = (c: { tape_id: number; start: number | null }) =>
	c.start != null ? `/tapes/${c.tape_id}/scene/${Math.floor(c.start)}` : `/tapes/${c.tape_id}`;

const OCCASION_WORDS: [RegExp, string][] = [
	[/x-?mas|christmas|santa/i, 'christmas'],
	[/new year|nye/i, 'new-year'],
	[/easter/i, 'easter'],
	[/b-?day|birthday|turns \d/i, 'birthday'],
	[/wedding/i, 'wedding'],
	[/halloween|trick or treat/i, 'halloween'],
	[/holiday|vacation|trip|camping|beach|lake|disney/i, 'holiday-trip']
];

/** Reads what Mom wrote: "Xmas '88 at Nana's" → { year: '1988', occasion: 'christmas' } */
export function guessFromLine(line: string) {
	const full = line.match(/\b(19[2-9]\d|20[0-4]\d)\b/)?.[1];
	const short = line.match(/['‘’`](\d{2})\b/)?.[1];
	const year = full ?? (short ? String(Number(short) > 40 ? 1900 + Number(short) : 2000 + Number(short)) : '');
	const occasion = OCCASION_WORDS.find(([re]) => re.test(line))?.[1] ?? '';
	return { year, occasion };
}

/** The coloured band on a cassette label, so tapes look like different brands on the shelf. */
const BANDS = ['#7a1f2b', '#2f5d62', '#a87c34', '#5b4a7a', '#47566b', '#8f4f1f'];
export const bandColor = (id: number) => BANDS[id % BANDS.length];

/** Ballpoint blue most of the time, sometimes black felt-tip. */
export const inkColor = (id: number) => (id % 3 === 2 ? '#1f1b18' : '#26408b');
