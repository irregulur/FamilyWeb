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
	 ALTER TABLE media ADD COLUMN edited_at TEXT;`,
	// How much was cut off the start of a video (to keep its tape's scene times right when it's re-made),
	// and when its web copy was last made (so browsers fetch a re-made one instead of their saved copy).
	`ALTER TABLE media ADD COLUMN trim_start REAL;
	 ALTER TABLE media ADD COLUMN processed_at INTEGER;`,
	// Where the picture changes completely in a long video (the camera stopped and started): JSON list of seconds.
	// Offered as places a scene might start when filling in a tape. NULL = not looked for yet.
	`ALTER TABLE media ADD COLUMN cuts TEXT;`,
	// Where a scene stops, when it isn't simply where the next one starts (to skip blue screen or a mistake). NULL = the next one.
	`ALTER TABLE chapters ADD COLUMN ends REAL;`
];
const { user_version } = db.prepare('PRAGMA user_version').get() as { user_version: number };
for (let v = user_version; v < MIGRATIONS.length; v++) {
	db.exec(`BEGIN; ${MIGRATIONS[v]} PRAGMA user_version = ${v + 1}; COMMIT;`);
}
