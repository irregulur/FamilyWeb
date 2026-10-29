// Who's in what. Anyone in the family can tag people; renaming, merging and deleting a person is for the owner.
import { db } from './db.ts';
import { READY, COLS, type MediaItem } from './media.ts';
import { scenesWhere } from './tapes.ts';

export type Person = { id: number; name: string };
export type Tagged = 'media' | 'chapter';

const byName = 'ORDER BY p.name COLLATE NOCASE';

export const allPeople = () => db.prepare(`SELECT p.id, p.name FROM people p ${byName}`).all() as Person[];

export const personById = (id: number) => db.prepare('SELECT id, name FROM people WHERE id = ?').get(id) as Person | undefined;

/** Everyone with how many things they're in, and a picture of them, for the people page. */
export function peopleList() {
	return db
		.prepare(
			`SELECT p.id, p.name,
			        (SELECT count(*) FROM media_people t JOIN media m ON m.id = t.media_id AND m.status = 'ready' WHERE t.person_id = p.id)
			      + (SELECT count(*) FROM chapter_people WHERE person_id = p.id) AS count,
			        (SELECT m.id FROM media_people t JOIN media m ON m.id = t.media_id AND m.status = 'ready'
			         WHERE t.person_id = p.id ORDER BY m.kind = 'photo' DESC, m.taken_at DESC LIMIT 1) AS cover
			 FROM people p ${byName}`
		)
		.all() as (Person & { count: number; cover: number | null })[];
}

/** The person with this name, made if there's nobody called that yet (names are matched ignoring capitals). */
export function personNamed(name: string, userId: number) {
	const clean = name.trim().replace(/\s+/g, ' ').slice(0, 80);
	if (!clean) return null;
	db.prepare('INSERT INTO people (name, created_by) VALUES (?, ?) ON CONFLICT (name) DO NOTHING').run(clean, userId);
	return db.prepare('SELECT id, name FROM people WHERE name = ?').get(clean) as Person;
}

export const peopleIn = (kind: Tagged, id: number) =>
	db.prepare(`SELECT p.id, p.name FROM people p JOIN ${kind}_people t ON t.person_id = p.id WHERE t.${kind}_id = ? ${byName}`).all(id) as Person[];

export function tag(kind: Tagged, id: number, personId: number, userId: number) {
	db.prepare(`INSERT OR IGNORE INTO ${kind}_people (${kind}_id, person_id, added_by) VALUES (?, ?, ?)`).run(id, personId, userId);
}

export function untag(kind: Tagged, id: number, personId: number) {
	db.prepare(`DELETE FROM ${kind}_people WHERE ${kind}_id = ? AND person_id = ?`).run(id, personId);
}

/** A person's collection: their photos and videos, and the scenes on tape they're in. */
export function collectionOf(personId: number) {
	return {
		items: db
			.prepare(
				`SELECT ${COLS} FROM media WHERE ${READY} AND id IN (SELECT media_id FROM media_people WHERE person_id = ?)
				 ORDER BY taken_at IS NULL, taken_at, id`
			)
			.all(personId) as MediaItem[],
		scenes: scenesWhere('id IN (SELECT chapter_id FROM chapter_people WHERE person_id = ?)', personId)
	};
}

/** Returns false if someone else already has that name (then merge them instead). */
export function renamePerson(id: number, name: string) {
	const clean = name.trim().replace(/\s+/g, ' ').slice(0, 80);
	if (!clean) return false;
	const other = db.prepare('SELECT id FROM people WHERE name = ? AND id != ?').get(clean, id);
	if (other) return false;
	db.prepare('UPDATE people SET name = ? WHERE id = ?').run(clean, id);
	return true;
}

/** Two entries for the same person ("Nana" and "Grandma Rose"): everything tagged `from` goes to `into`. */
export function mergePeople(from: number, into: number) {
	if (from === into) return;
	db.exec('BEGIN');
	try {
		for (const kind of ['media', 'chapter'] as const)
			db.prepare(`INSERT OR IGNORE INTO ${kind}_people (${kind}_id, person_id, added_by) SELECT ${kind}_id, ?, added_by FROM ${kind}_people WHERE person_id = ?`).run(into, from);
		db.prepare('DELETE FROM people WHERE id = ?').run(from);
		db.exec('COMMIT');
	} catch (e) {
		db.exec('ROLLBACK');
		throw e;
	}
}

export const deletePerson = (id: number) => db.prepare('DELETE FROM people WHERE id = ?').run(id);
