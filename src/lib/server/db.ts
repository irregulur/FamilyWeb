import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import schema from './schema.sql?raw';

/** Everything the site stores (database + media files). Point this at the NAS. */
export const DATA_DIR = resolve(process.env.DATA_DIR ?? 'data');
export const MEDIA_DIR = join(DATA_DIR, 'media');
/** Half-finished uploads (*.part). Same disk as MEDIA_DIR so finished files can just be moved. */
export const UPLOAD_DIR = join(DATA_DIR, 'uploads');
/** Label scans and scene thumbnails for tapes. */
export const TAPES_DIR = join(DATA_DIR, 'tapes');

mkdirSync(MEDIA_DIR, { recursive: true });
mkdirSync(UPLOAD_DIR, { recursive: true });
mkdirSync(TAPES_DIR, { recursive: true });

export const db = new DatabaseSync(join(DATA_DIR, 'family.db'));
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
db.exec(schema);

// Changes to existing tables, applied once each, in order. Never edit or reorder old entries — only append.
// (schema.sql only creates missing tables, so a server that's been running for a year still gets these.)
const MIGRATIONS = [
	`ALTER TABLE media ADD COLUMN demo INTEGER NOT NULL DEFAULT 0;
	 ALTER TABLE media ADD COLUMN edited_by INTEGER REFERENCES users(id);
	 ALTER TABLE media ADD COLUMN edited_at TEXT;`
];
const { user_version } = db.prepare('PRAGMA user_version').get() as { user_version: number };
for (let v = user_version; v < MIGRATIONS.length; v++) {
	db.exec(`BEGIN; ${MIGRATIONS[v]} PRAGMA user_version = ${v + 1}; COMMIT;`);
}
