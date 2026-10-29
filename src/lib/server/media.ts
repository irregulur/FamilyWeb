import { db } from './db.ts';
import { sceneYears } from './tapes.ts';

export type MediaItem = {
	id: number;
	kind: 'photo' | 'video';
	title: string | null;
	taken_at: string | null;
	occasion: string | null;
	duration: number | null;
};

export const COLS = 'id, kind, title, taken_at, occasion, duration';
// Ready, and not a whole tape's recording (those show up as scenes on the tape page instead)
export const READY = "status = 'ready' AND id NOT IN (SELECT media_id FROM tapes WHERE media_id IS NOT NULL)";

/** A picture on the timeline: a photo, a video or a scene on tape. */
export type StripItem = { href: string; src: string; taken_at: string | null; duration: number | null; scene: boolean };

const STRIP = 5;

/** Years that have photos, videos or scenes on tape, with counts and a few random pictures each (in date order). */
export function timelineYears() {
	const rows = db
		.prepare(
			`SELECT year, count(*) AS count, sum(kind = 'video') AS videos FROM media
			 WHERE ${READY} AND year IS NOT NULL GROUP BY year`
		)
		.all() as { year: number; count: number; videos: number }[];
	const covers = randomCovers('year', STRIP);
	const tapes = sceneYears();
	const years = new Map(rows.map((r) => [r.year, r]));
	for (const y of tapes.keys()) if (!years.has(y)) years.set(y, { year: y, count: 0, videos: 0 });

	return [...years.values()]
		.sort((a, b) => a.year - b.year)
		.map((y) => {
			const onTape = tapes.get(y.year);
			const pictures: StripItem[] = (covers.get(y.year) ?? []).map((m) => ({
				href: `/m/${m.id}`,
				src: `/files/${m.id}/thumb.webp`,
				taken_at: m.taken_at,
				duration: m.kind === 'video' ? m.duration : null,
				scene: false
			}));
			// Mix in up to two scenes from tapes, so tapes show up on the timeline too
			const scenes = onTape?.items ?? [];
			const strip = [...scenes.slice(0, 2), ...pictures, ...scenes.slice(2)].slice(0, STRIP);
			strip.sort((a, b) => (a.taken_at ?? '').localeCompare(b.taken_at ?? ''));
			return { ...y, scenes: onTape?.scenes ?? 0, strip };
		});
}

/** Every year with something in it, oldest first (for the ← / → links between years). */
export const allYears = () => timelineYears().map((y) => y.year);

export function occasionCounts() {
	const rows = db
		.prepare(
			`SELECT occasion, count(*) AS count FROM media WHERE ${READY} AND occasion IS NOT NULL GROUP BY occasion`
		)
		.all() as { occasion: string; count: number }[];
	const covers = randomCovers('occasion', 1);
	return new Map(rows.map((r) => [r.occasion, { count: r.count, cover: covers.get(r.occasion)?.[0]?.id }]));
}

export function totals() {
	return db.prepare(`SELECT count(*) AS all_, coalesce(sum(kind = 'video'), 0) AS videos FROM media WHERE ${READY}`).get() as {
		all_: number;
		videos: number;
	};
}

export function undatedCount() {
	return (db.prepare(`SELECT count(*) AS n FROM media WHERE ${READY} AND year IS NULL`).get() as { n: number }).n;
}

export function mediaForYear(year: number) {
	return db
		.prepare(`SELECT ${COLS} FROM media WHERE ${READY} AND year = ? ORDER BY taken_at, id`)
		.all(year) as MediaItem[];
}

export function mediaForOccasion(slug: string) {
	return db
		.prepare(`SELECT ${COLS} FROM media WHERE ${READY} AND occasion = ? ORDER BY taken_at, id`)
		.all(slug) as MediaItem[];
}

export function undatedMedia() {
	return db
		.prepare(`SELECT ${COLS} FROM media WHERE ${READY} AND year IS NULL ORDER BY id`)
		.all() as MediaItem[];
}

export function mediaById(id: number) {
	return db
		.prepare(
			`SELECT ${COLS.replace(/(\w+)/g, 'm.$1')}, m.description, m.original_name, m.status, m.uploaded_by, u.name AS uploader,
			        m.edited_at, e.name AS editor
			 FROM media m LEFT JOIN users u ON u.id = m.uploaded_by LEFT JOIN users e ON e.id = m.edited_by WHERE m.id = ?`
		)
		.get(id) as
		| (MediaItem & {
				description: string | null;
				original_name: string;
				status: string;
				uploaded_by: number | null;
				uploader: string | null;
				edited_at: string | null;
				editor: string | null;
		  })
		| undefined;
}

/** Another photo nobody has dated yet (for "save and see the next one"). */
export function nextUndated(afterId: number) {
	const row = db
		.prepare(`SELECT id FROM media WHERE ${READY} AND year IS NULL ORDER BY id > ? DESC, id LIMIT 1`)
		.get(afterId) as { id: number } | undefined;
	return row?.id ?? null;
}

/** Previous/next item in the same year (or the undated pile), for arrow-key browsing. */
export function neighbours(item: MediaItem) {
	const year = item.taken_at ? Number(item.taken_at.slice(0, 4)) : null;
	const where = `${READY} AND year IS ?`;
	const key = [item.taken_at ?? '', item.id];
	const prev = db
		.prepare(
			`SELECT id FROM media WHERE ${where} AND (coalesce(taken_at, ''), id) < (?, ?)
			 ORDER BY coalesce(taken_at, '') DESC, id DESC LIMIT 1`
		)
		.get(year, ...key) as { id: number } | undefined;
	const next = db
		.prepare(
			`SELECT id FROM media WHERE ${where} AND (coalesce(taken_at, ''), id) > (?, ?)
			 ORDER BY coalesce(taken_at, ''), id LIMIT 1`
		)
		.get(year, ...key) as { id: number } | undefined;
	return { prev: prev?.id ?? null, next: next?.id ?? null };
}

type Cover = { id: number; key: string | number; kind: 'photo' | 'video'; taken_at: string | null; duration: number | null };

function randomCovers(column: 'year' | 'occasion', perGroup: number) {
	const rows = db
		.prepare(
			`SELECT id, key, kind, taken_at, duration FROM (
				SELECT id, kind, taken_at, duration, ${column} AS key, row_number() OVER (PARTITION BY ${column} ORDER BY random()) AS n
				FROM media WHERE ${READY} AND ${column} IS NOT NULL
			) WHERE n <= ?`
		)
		.all(perGroup) as Cover[];
	const map = new Map<string | number, Cover[]>();
	for (const r of rows) map.set(r.key, [...(map.get(r.key) ?? []), r]);
	return map;
}

/** One random dated photo or video for the big screen on the home page. */
export function featured() {
	return db
		.prepare(`SELECT ${COLS} FROM media WHERE ${READY} AND year IS NOT NULL ORDER BY random() LIMIT 1`)
		.get() as MediaItem | undefined;
}

/** How many different years have Christmas in them (photos or scenes on tape). */
export function christmasCount() {
	return (
		db
			.prepare(
				`SELECT count(*) AS n FROM (
					SELECT year FROM media WHERE ${READY} AND occasion = 'christmas' AND year IS NOT NULL
					UNION SELECT year FROM chapters WHERE occasion = 'christmas' AND year IS NOT NULL)`
			)
			.get() as { n: number }
	).n;
}

/** Somewhere to go for "Play a memory": a home video or a scene on a tape, else any photo. */
export function randomMemory() {
	const row = db
		.prepare(
			`SELECT href FROM (
				SELECT '/m/' || id AS href FROM media WHERE ${READY} AND kind = 'video'
				UNION ALL
				SELECT '/tapes/' || c.tape_id || '/scene/' || CAST(c.start AS INTEGER) || '?play' FROM chapters c
				  JOIN tapes t ON t.id = c.tape_id JOIN media m ON m.id = t.media_id AND m.status = 'ready' WHERE c.start IS NOT NULL
			) ORDER BY random() LIMIT 1`
		)
		.get() as { href: string } | undefined;
	return row?.href ?? (db.prepare(`SELECT '/m/' || id AS href FROM media WHERE ${READY} ORDER BY random() LIMIT 1`).get() as { href: string } | undefined)?.href;
}
