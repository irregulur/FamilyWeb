// Turns an uploaded original into what the site shows: thumb.webp, large.webp and (videos) video.mp4.
import { spawn } from 'node:child_process';
import { readdirSync, renameSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { db, MEDIA_DIR } from './db.ts';

const FFMPEG = process.env.FFMPEG ?? 'ffmpeg';
const FFPROBE = process.env.FFPROBE ?? 'ffprobe';

// Square pixels (PAL tapes are stored stretched), short side at most 1080, deinterlace only if the tape is interlaced.
const VIDEO_FILTER =
	"bwdif=mode=send_frame:deint=interlaced,scale='trunc(min(1,1080/min(iw*sar,ih))*iw*sar/2)*2':'trunc(min(1,1080/min(iw*sar,ih))*ih/2)*2',setsar=1";
// Old tapes are full of noise, and noise is what makes files big. A light clean-up roughly halves
// the size of a digitized tape without making it look smoothed over. Only for SD (tape-sized) videos.
const TAPE_DENOISE = 'hqdn3d=2:1.5:6:4.5';
// How much blue screen to keep before and after the picture on a captured tape.
const BLUE_SECONDS = 3;
const LARGE_FILTER = "scale='min(2048,iw)':'min(2048,ih)':force_original_aspect_ratio=decrease";
export const THUMB_FILTER = "scale='if(gt(iw,ih),-2,min(480,iw))':'if(gt(iw,ih),min(480,ih),-2)'"; // short side 480

function runRaw(cmd: string, args: string[]) {
	return new Promise<Buffer>((resolve, reject) => {
		const p = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
		const out: Buffer[] = [];
		let err = '';
		p.stdout.on('data', (d: Buffer) => out.push(d));
		p.stderr.on('data', (d) => (err = (err + d).slice(-2000)));
		p.on('error', reject);
		p.on('close', (code) => (code === 0 ? resolve(Buffer.concat(out)) : reject(new Error(`${cmd} exited ${code}: ${err}`))));
	});
}
const run = async (cmd: string, args: string[]) => (await runRaw(cmd, args)).toString();

async function probe(path: string) {
	const out = await run(FFPROBE, [
		'-v', 'error', '-read_intervals', '%+#1',
		'-show_entries', 'format=duration:format_tags=creation_time:frame_tags:stream=height',
		'-of', 'json', path
	]);
	return JSON.parse(out) as {
		format?: { duration?: string; tags?: { creation_time?: string } };
		frames?: { tags?: Record<string, string> }[];
		streams?: { height?: number }[];
	};
}

/** The date the camera saved in the file (photo EXIF or video metadata), as YYYY-MM-DD. */
export async function dateFromFile(path: string) {
	try {
		const info = await probe(path);
		const tags = info.frames?.[0]?.tags ?? {};
		const raw =
			Object.entries(tags).find(([k]) => k.endsWith('DateTimeOriginal'))?.[1] ?? info.format?.tags?.creation_time;
		const m = raw?.match(/^(\d{4})[:-](\d{2})[:-](\d{2})/);
		if (!m || Number(m[1]) < 1850 || Number(m[2]) < 1) return null;
		return `${m[1]}-${m[2]}-${m[3]}`;
	} catch {
		return null;
	}
}

/**
 * Where to cut a captured tape: the capture card's blue "no signal" screen (or black) at the start and end
 * is cut down to a few seconds — just enough to feel like putting the tape in. Looks at a tiny 8×6 picture
 * every quarter second.
 * Returns null if there's nothing worth cutting.
 */
export async function pictureRange(path: string, duration: number) {
	const [W, H, PER_SECOND] = [8, 6, 4];
	const raw = await runRaw(FFMPEG, [
		'-v', 'error', '-i', path, '-an', '-sn', '-dn',
		'-vf', `fps=${PER_SECOND},scale=${W}:${H}:flags=area,format=rgb24`, '-f', 'rawvideo', '-'
	]);
	const size = W * H * 3;
	const samples = Math.floor(raw.length / size);
	const empty = (i: number) => {
		const px = raw.subarray(i * size, (i + 1) * size);
		let [r, g, b] = [0, 0, 0];
		for (let j = 0; j < size; j += 3) [r, g, b] = [r + px[j], g + px[j + 1], b + px[j + 2]];
		[r, g, b] = [r, g, b].map((v) => v / (W * H));
		let spread = 0; // how different the pixels are from the average: ~0 for a flat screen
		for (let j = 0; j < size; j += 3)
			spread = Math.max(spread, Math.abs(px[j] - r), Math.abs(px[j + 1] - g), Math.abs(px[j + 2] - b));
		const blue = b > 100 && b > r + 60 && b > g + 60 && spread < 40;
		const black = r < 24 && g < 24 && b < 24;
		return blue || black;
	};
	let first = 0;
	while (first < samples && empty(first)) first++;
	let last = samples - 1;
	while (last > first && empty(last)) last--;
	if (first >= samples) return null; // all blue: leave it alone rather than cut everything

	const start = Math.max(0, first / PER_SECOND - BLUE_SECONDS);
	const end = Math.min(duration, (last + 1) / PER_SECOND + BLUE_SECONDS);
	return start >= 1 || duration - end >= 1 ? { start, end } : null;
}

/** Runs ffmpeg quietly; rejects with its last error lines. */
export const ffmpeg = (...args: string[]) => run(FFMPEG, ['-y', '-v', 'error', ...args]);

async function processOne(id: number) {
	try {
		const row = db.prepare('SELECT kind FROM media WHERE id = ?').get(id) as { kind: string } | undefined;
		if (!row) return; // deleted while waiting
		const dir = join(MEDIA_DIR, String(id));
		const original = join(dir, readdirSync(dir).find((f) => f.startsWith('original.'))!);

		let still = original;
		let seek: string[] = []; // -ss on a still image makes ffmpeg output nothing
		let duration: number | null = null;
		let sd = false;
		if (row.kind === 'video') {
			const info = await probe(original);
			duration = Number(info.format?.duration) || null;
			sd = (info.streams?.find((s) => s.height)?.height ?? 1080) <= 576;
			// Cut the blue "no signal" screen off the ends of a captured tape
			const range = duration ? await pictureRange(original, duration) : null;
			const trim = range ? ['-ss', String(range.start), '-to', String(range.end)] : [];
			if (range) duration = range.end - range.start;

			const tmp = join(dir, 'video.tmp.mp4');
			await ffmpeg(
				...trim, '-i', original, '-vf', sd ? `${VIDEO_FILTER},${TAPE_DENOISE}` : VIDEO_FILTER,
				'-c:v', 'libx264', '-crf', '23', '-preset', 'medium', '-pix_fmt', 'yuv420p',
				'-c:a', 'aac', '-b:a', '128k', '-ac', '2', '-movflags', '+faststart', tmp
			);
			renameSync(tmp, join(dir, 'video.mp4'));
			still = join(dir, 'video.mp4');
			seek = ['-ss', String(duration ? Math.min(duration * 0.1, 30 + BLUE_SECONDS) : 0)]; // skip the blue/black start
		}

		await ffmpeg(...seek, '-i', still, '-frames:v', '1', '-vf', LARGE_FILTER, '-c:v', 'libwebp', '-quality', '82', join(dir, 'large.webp'));
		await ffmpeg('-i', join(dir, 'large.webp'), '-vf', THUMB_FILTER, '-c:v', 'libwebp', '-quality', '78', join(dir, 'thumb.webp'));
		db.prepare("UPDATE media SET status = 'ready', duration = ? WHERE id = ?").run(duration, id);
		// A raw tape capture (tape-sized but over 1 GB, usually ~15 GB) isn't needed once the web copy exists:
		// let it go to save space on the NAS. Download then gives the web copy instead.
		if (sd && statSync(original).size > 1e9) rmSync(original, { force: true });
	} catch (e) {
		console.error(`Processing media ${id} failed:`, e);
		db.prepare("UPDATE media SET status = 'failed' WHERE id = ?").run(id);
	}
}

// One file at a time, so a 2-hour tape doesn't starve the server.
let queue = Promise.resolve();
export function enqueue(id: number) {
	queue = queue.then(() => processOne(id));
}

/** After a restart, pick up anything that was still being processed. */
export function resumeProcessing() {
	const rows = db.prepare("SELECT id FROM media WHERE status = 'processing' ORDER BY id").all() as { id: number }[];
	for (const r of rows) enqueue(r.id);
}
