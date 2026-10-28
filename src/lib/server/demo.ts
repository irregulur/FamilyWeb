// Sample photos and videos so the site can be tried out before real memories go in.
// Every sample row has demo = 1, so "remove samples" can never touch real uploads.
import { spawn } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { db, MEDIA_DIR } from './db.ts';
import { enqueue } from './process.ts';
import { tapeDir } from './tapes.ts';

const FFMPEG = process.env.FFMPEG ?? 'ffmpeg';

const TITLES: Record<string, string[]> = {
	christmas: ['Christmas morning', 'Opening presents', "Christmas at Nana's", 'Decorating the tree', 'Christmas dinner'],
	'new-year': ["New Year's Eve", 'Fireworks at midnight'],
	easter: ['Easter egg hunt', 'Easter Sunday'],
	birthday: ["Sarah's 5th birthday", 'Dad turns 40', 'Birthday cake!', "Tom's 10th", "Grandma's 70th"],
	wedding: ["Uncle Pete's wedding", 'The wedding party'],
	'holiday-trip': ['Summer at the lake', 'Road trip', 'Camping in the mountains', 'Beach holiday', 'The view from the top'],
	halloween: ['Trick or treat', 'Halloween costumes'],
	everyday: ['Sunday afternoon', 'In the garden', 'First day of school', 'The old car', "Grandpa's workshop", 'Snow day', 'The new house', 'Feeding the ducks']
};
const STORIES = [
	'Nobody remembers who took this one.',
	'The year it snowed for a whole week.',
	'Grandpa insisted on taking the photo himself.',
	'You can just see the old dog in the corner.'
];

const pick = <T>(list: T[]) => list[Math.floor(Math.random() * list.length)];
const int = (min: number, max: number) => min + Math.floor(Math.random() * (max - min + 1));
const pad = (n: number) => String(n).padStart(2, '0');

type Plan = { kind: 'photo' | 'video'; taken_at: string | null; occasion: string | null; title: string | null; description: string | null };

function makePlan(): Plan[] {
	const plan: Plan[] = [];
	const years = new Set<number>();
	while (years.size < 18) years.add(int(1972, 2008));

	for (const y of [...years].sort()) {
		for (let i = int(2, 6); i > 0; i--) {
			const occasion = pick(Object.keys(TITLES));
			const date = {
				christmas: `${y}-12-${pick(['24', '25', '26'])}`,
				'new-year': `${y}-12-31`,
				easter: `${y}-04`,
				birthday: `${y}-${pad(int(1, 12))}-${pad(int(1, 28))}`,
				wedding: `${y}-06-${pad(int(1, 30))}`,
				'holiday-trip': `${y}-${pick(['07', '08'])}`,
				halloween: `${y}-10-31`,
				everyday: pick([`${y}`, `${y}-${pad(int(1, 12))}`])
			}[occasion]!;
			plan.push({
				kind: plan.length % 9 === 4 ? 'video' : 'photo', // about 1 in 9
				taken_at: date,
				occasion: occasion === 'everyday' && Math.random() < 0.5 ? null : occasion,
				title: Math.random() < 0.75 ? pick(TITLES[occasion]) : null,
				description: Math.random() < 0.2 ? pick(STORIES) : null
			});
		}
	}
	// A few for the mystery box
	for (let i = 0; i < 7; i++) plan.push({ kind: 'photo', taken_at: null, occasion: null, title: null, description: null });
	return plan;
}

/** Faded colour for the 70s/80s, sepia for the oldest, a little grain on everything. */
function ageLook(takenAt: string | null) {
	const year = takenAt ? Number(takenAt.slice(0, 4)) : 1975;
	const look =
		year < 1978
			? 'colorchannelmixer=.393:.769:.189:0:.349:.686:.168:0:.272:.534:.131,eq=contrast=0.9'
			: year < 1995
				? 'curves=preset=vintage,eq=saturation=0.85'
				: 'eq=saturation=0.95';
	return `${look},noise=alls=10:allf=t,vignette=PI/5`;
}

function ffmpeg(args: string[]) {
	return new Promise<void>((resolve, reject) => {
		const p = spawn(FFMPEG, ['-y', '-v', 'error', ...args], { stdio: 'ignore' });
		p.on('error', reject);
		p.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}`))));
	});
}

/** A random real-world photo from picsum.photos; a plain gradient if the server is offline. */
async function sourcePhoto(seed: string, portrait: boolean, dest: string) {
	const [w, h] = portrait ? [1200, 1600] : [1600, 1200];
	try {
		const res = await fetch(`https://picsum.photos/seed/${seed}/${w}/${h}`, { signal: AbortSignal.timeout(20_000) });
		if (!res.ok) throw new Error(String(res.status));
		writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
	} catch {
		await ffmpeg(['-f', 'lavfi', '-i', `gradients=s=${w}x${h}:seed=${int(1, 1e6)}`, '-frames:v', '1', dest]);
	}
}

async function makeOne(item: Plan, userId: number) {
	if (cancelled) return;
	const seed = `familyweb-${Date.now()}-${Math.random().toString(36).slice(2)}`;
	const tmp = join(MEDIA_DIR, `.demo-${seed}.jpg`);
	await sourcePhoto(seed, item.kind === 'photo' && Math.random() < 0.3, tmp);
	if (cancelled) return rmSync(tmp, { force: true });

	const id = Number(
		db
			.prepare(
				`INSERT INTO media (kind, original_name, title, description, taken_at, occasion, uploaded_by, demo)
				 VALUES (?, ?, ?, ?, ?, ?, ?, 1)`
			)
			.run(item.kind, `sample.${item.kind === 'photo' ? 'jpg' : 'mp4'}`, item.title, item.description, item.taken_at, item.occasion, userId)
			.lastInsertRowid
	);
	const dir = join(MEDIA_DIR, String(id));
	mkdirSync(dir, { recursive: true });
	try {
		if (item.kind === 'photo') {
			await ffmpeg(['-i', tmp, '-vf', ageLook(item.taken_at), '-q:v', '3', join(dir, 'original.jpg')]);
		} else {
			// A slow zoom across the photo with tape hiss: looks enough like a home video for a demo.
			const seconds = int(6, 12);
			await ffmpeg([
				'-loop', '1', '-i', tmp, '-f', 'lavfi', '-i', 'anoisesrc=c=pink:a=0.015',
				'-vf', `scale=1600:1200,zoompan=z='min(zoom+0.0008,1.25)':d=${seconds * 25}:s=768x576:fps=25,${ageLook(item.taken_at)}`,
				'-t', String(seconds), '-c:v', 'libx264', '-preset', 'veryfast', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest',
				join(dir, 'original.mp4')
			]);
		}
		enqueue(id); // the normal upload pipeline makes the thumbnails and web video
	} catch (e) {
		console.error('Making a sample failed:', e);
		db.prepare('DELETE FROM media WHERE id = ?').run(id);
		rmSync(dir, { recursive: true, force: true });
	} finally {
		rmSync(tmp, { force: true });
	}
}

// Sample tapes: names and lines as they might be written on the box. The last one isn't "digitized".
const SAMPLE_TAPES = [
	{
		name: "Xmas '86 & summer '87",
		lines: [["Xmas '86 at Nana's", '1986-12-25', 'christmas'], ["Sarah's 1st bday!", '1987-03-14', 'birthday'], ['Lake — summer 87', '1987-07', 'holiday-trip'], ['Snow day', '1987-12', null]]
	},
	{
		name: 'Tape 2 — 1989',
		lines: [['Easter egg hunt', '1989-03-26', 'easter'], ["Uncle Pete's wedding", '1989-06-17', 'wedding'], ['Halloween — Tom the ghost', '1989-10-31', 'halloween'], ['Christmas morning', '1989-12-25', 'christmas']]
	},
	{
		name: "Grandma's 70th / beach '91",
		lines: [["Grandma's 70th", '1991-05', 'birthday'], ['Beach week', '1991-08', 'holiday-trip'], ["Xmas '91", '1991-12', 'christmas']],
		notDigitized: true
	}
] as const;
const SCENE_SECONDS = 12;

async function makeSampleTape(sample: (typeof SAMPLE_TAPES)[number], userId: number) {
	if (cancelled) return;
	const tapeId = Number(db.prepare('INSERT INTO tapes (name, created_by, demo) VALUES (?, ?, 1)').run(sample.name, userId).lastInsertRowid);
	const insert = db.prepare('INSERT INTO chapters (tape_id, position, title, start, taken_at, occasion) VALUES (?, ?, ?, ?, ?, ?)');
	sample.lines.forEach(([title, date, occasion], i) =>
		insert.run(tapeId, i, title, 'notDigitized' in sample ? null : i * SCENE_SECONDS, date, occasion)
	);
	if ('notDigitized' in sample) return;

	// The "recording": one slow-zoom clip per line, joined like scenes on a real tape
	const id = Number(
		db
			.prepare("INSERT INTO media (kind, original_name, uploaded_by, demo) VALUES ('video', 'sample-tape.mp4', ?, 1)")
			.run(userId).lastInsertRowid
	);
	db.prepare('UPDATE tapes SET media_id = ? WHERE id = ?').run(id, tapeId);
	const dir = join(MEDIA_DIR, String(id));
	mkdirSync(dir, { recursive: true });
	try {
		const parts: string[] = [];
		for (const [i, [, date]] of sample.lines.entries()) {
			const photo = join(dir, `scene${i}.jpg`);
			await sourcePhoto(`familyweb-tape-${Date.now()}-${i}-${Math.random().toString(36).slice(2)}`, false, photo);
			parts.push(join(dir, `scene${i}.mp4`));
			await ffmpeg([
				'-loop', '1', '-i', photo, '-f', 'lavfi', '-i', 'anoisesrc=c=pink:a=0.02',
				'-vf', `scale=1600:1200,zoompan=z='min(zoom+0.0006,1.2)':d=${SCENE_SECONDS * 25}:s=768x576:fps=25,${ageLook(date)}`,
				'-t', String(SCENE_SECONDS), '-c:v', 'libx264', '-preset', 'veryfast', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest',
				parts[i]
			]);
			if (cancelled) throw new Error('cancelled');
		}
		writeFileSync(join(dir, 'scenes.txt'), parts.map((p) => `file '${p}'`).join('\n'));
		await ffmpeg(['-f', 'concat', '-safe', '0', '-i', join(dir, 'scenes.txt'), '-c', 'copy', join(dir, 'original.mp4')]);
		for (const f of [...parts, ...parts.map((p) => p.replace('.mp4', '.jpg')), join(dir, 'scenes.txt')]) rmSync(f, { force: true });
		enqueue(id);
	} catch (e) {
		if (!cancelled) console.error('Making a sample tape failed:', e);
		db.prepare('DELETE FROM media WHERE id = ?').run(id);
		rmSync(dir, { recursive: true, force: true });
	}
}

let running = false;
let cancelled = false;

export const demoCount = () => (db.prepare('SELECT count(*) AS n FROM media WHERE demo = 1').get() as { n: number }).n;
export const addingDemo = () => running;

/** Starts adding ~80 samples in the background; they appear on the timeline as each one is ready. */
export function addDemo(userId: number) {
	if (running) return;
	running = true;
	cancelled = false;
	const plan = makePlan();
	const workers = Array.from({ length: 4 }, async () => {
		for (let item = plan.shift(); item; item = plan.shift()) await makeOne(item, userId);
	});
	const tapes = SAMPLE_TAPES.map((t) => makeSampleTape(t, userId));
	Promise.all([...workers, ...tapes]).finally(() => (running = false));
}

export function removeDemo() {
	cancelled = true;
	const tapes = db.prepare('SELECT id FROM tapes WHERE demo = 1').all() as { id: number }[];
	db.prepare('DELETE FROM tapes WHERE demo = 1').run();
	for (const { id } of tapes) rmSync(tapeDir(id), { recursive: true, force: true });
	const rows = db.prepare('SELECT id FROM media WHERE demo = 1').all() as { id: number }[];
	db.prepare('DELETE FROM media WHERE demo = 1').run();
	for (const { id } of rows) rmSync(join(MEDIA_DIR, String(id)), { recursive: true, force: true });
	return rows.length;
}
