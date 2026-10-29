-- Runs on every start; everything is IF NOT EXISTS so it is safe to re-run.

CREATE TABLE IF NOT EXISTS users (
	id            INTEGER PRIMARY KEY,
	name          TEXT NOT NULL,
	email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
	password_hash TEXT NOT NULL,
	is_admin      INTEGER NOT NULL DEFAULT 0,
	created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- id is the sha256 of the cookie token, so a leaked database can't be used to log in.
CREATE TABLE IF NOT EXISTS sessions (
	id         TEXT PRIMARY KEY,
	user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	expires_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS invites (
	code       TEXT PRIMARY KEY,
	note       TEXT,                                -- e.g. "Aunt Linda"
	created_by INTEGER REFERENCES users(id),
	used_by    INTEGER REFERENCES users(id),
	expires_at INTEGER NOT NULL
);

-- Files live in DATA_DIR/media/<id>/: original.<ext>, thumb.webp, large.webp, video.mp4 (videos only)
CREATE TABLE IF NOT EXISTS media (
	id            INTEGER PRIMARY KEY,
	kind          TEXT NOT NULL CHECK (kind IN ('photo', 'video')),
	original_name TEXT NOT NULL,
	title         TEXT,
	description   TEXT,
	-- Old photos often only have a year: 'YYYY', 'YYYY-MM' or 'YYYY-MM-DD'. NULL = unknown.
	taken_at      TEXT,
	year          INTEGER GENERATED ALWAYS AS (CAST(substr(taken_at, 1, 4) AS INTEGER)) VIRTUAL,
	occasion      TEXT,                             -- slug from src/lib/occasions.ts
	duration      REAL,                             -- seconds, videos only
	status        TEXT NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'ready', 'failed')),
	uploaded_by   INTEGER REFERENCES users(id),
	created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS media_year ON media(year);
CREATE INDEX IF NOT EXISTS media_occasion ON media(occasion);

-- A videotape. Its digitized recording is an ordinary video in `media` (kept out of the photo grids);
-- scans of the handwritten labels live in DATA_DIR/tapes/<id>/ as sticker.webp and sleeve.webp.
CREATE TABLE IF NOT EXISTS tapes (
	id           INTEGER PRIMARY KEY,
	name         TEXT NOT NULL,
	media_id     INTEGER REFERENCES media(id) ON DELETE SET NULL,
	sticker_scan INTEGER,                           -- when the cassette label scan was added (ms); NULL = none
	sleeve_scan  INTEGER,                           -- same, for the box/sleeve
	demo         INTEGER NOT NULL DEFAULT 0,
	created_by   INTEGER REFERENCES users(id),
	created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

-- One line of what's written on the label = one scene on the tape.
CREATE TABLE IF NOT EXISTS chapters (
	id       INTEGER PRIMARY KEY,
	tape_id  INTEGER NOT NULL REFERENCES tapes(id) ON DELETE CASCADE,
	position INTEGER NOT NULL,
	title    TEXT NOT NULL,
	start    REAL,                                  -- seconds into the recording; NULL = not found yet
	taken_at TEXT,
	year     INTEGER GENERATED ALWAYS AS (CAST(substr(taken_at, 1, 4) AS INTEGER)) VIRTUAL,
	occasion TEXT
);

CREATE INDEX IF NOT EXISTS chapters_tape ON chapters(tape_id);
CREATE INDEX IF NOT EXISTS chapters_year ON chapters(year);

-- Words on the front page (family name, headline, dedication), editable on the Family page.
CREATE TABLE IF NOT EXISTS settings (
	key   TEXT PRIMARY KEY,
	value TEXT NOT NULL
);

-- Who's in a photo, video or scene on tape. Anyone in the family can tag; each person gets their own page.
CREATE TABLE IF NOT EXISTS people (
	id         INTEGER PRIMARY KEY,
	name       TEXT NOT NULL UNIQUE COLLATE NOCASE,
	created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
	created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS media_people (
	media_id  INTEGER NOT NULL REFERENCES media(id) ON DELETE CASCADE,
	person_id INTEGER NOT NULL REFERENCES people(id) ON DELETE CASCADE,
	added_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
	PRIMARY KEY (media_id, person_id)
);
CREATE INDEX IF NOT EXISTS media_people_person ON media_people(person_id);

CREATE TABLE IF NOT EXISTS chapter_people (
	chapter_id INTEGER NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
	person_id  INTEGER NOT NULL REFERENCES people(id) ON DELETE CASCADE,
	added_by   INTEGER REFERENCES users(id) ON DELETE SET NULL,
	PRIMARY KEY (chapter_id, person_id)
);
CREATE INDEX IF NOT EXISTS chapter_people_person ON chapter_people(person_id);
