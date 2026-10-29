import { error, fail } from '@sveltejs/kit';
import { readdirSync, statfsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { DATA_DIR, db } from '#lib/server/db.ts';
import { reprocess, working } from '#lib/server/process.ts';
import type { Actions, PageServerLoad } from './$types';

export type Node = { name: string; label?: string; href?: string; size: number; files: number; children?: Node[] };

function walk(path: string, name: string): Node {
	const st = statSync(path, { throwIfNoEntry: false });
	if (!st) return { name, size: 0, files: 0 };
	if (!st.isDirectory()) return { name, size: st.size, files: 1 };
	const children = readdirSync(path).map((n) => walk(join(path, n), n)).sort((a, b) => b.size - a.size);
	return {
		name,
		size: children.reduce((s, c) => s + c.size, 0),
		files: children.reduce((s, c) => s + c.files, 0),
		children
	};
}

export const load: PageServerLoad = ({ locals }) => {
	if (!locals.user?.is_admin) error(403, 'Only the archive owner can see storage.');

	const root = walk(DATA_DIR, 'Everything');
	const media = new Map(
		(db.prepare('SELECT id, kind, title, original_name FROM media').all() as { id: number; kind: string; title: string | null; original_name: string }[]).map(
			(m) => [String(m.id), m]
		)
	);
	const tapes = db.prepare('SELECT id, name, media_id FROM tapes').all() as { id: number; name: string; media_id: number | null }[];
	const tapeOfMedia = new Map(tapes.map((t) => [String(t.media_id), t]));
	const tapeById = new Map(tapes.map((t) => [String(t.id), t]));

	// Put names on the numbered folders
	for (const top of root.children ?? []) {
		for (const c of top.children ?? []) {
			if (top.name === 'media') {
				const m = media.get(c.name);
				const tape = tapeOfMedia.get(c.name);
				if (tape) [c.label, c.href] = [`Tape: ${tape.name}`, `/tapes/${tape.id}`];
				else if (m) [c.label, c.href] = [`${m.kind === 'video' ? 'Video' : 'Photo'}: ${m.title || m.original_name}`, `/m/${m.id}`];
			} else if (top.name === 'tapes') {
				const t = tapeById.get(c.name);
				if (t) [c.label, c.href] = [`Tape: ${t.name} (label scans, scene stills)`, `/tapes/${t.id}`];
			}
		}
	}

	// The biggest single files, wherever they are
	const biggest: { path: string; label?: string; href?: string; size: number }[] = [];
	const collect = (n: Node, path: string, parent?: Node) => {
		if (!n.children) biggest.push({ path, label: parent?.label, href: parent?.href, size: n.size });
		else for (const c of n.children) collect(c, path ? `${path}/${c.name}` : c.name, n);
	};
	collect(root, '');
	biggest.sort((a, b) => b.size - a.size);

	// Every video, with what its web copy and original take, and whether it can be made again
	const mediaDir = root.children?.find((c) => c.name === 'media');
	const videos = [...media.values()]
		.filter((m) => m.kind === 'video')
		.map((m) => {
			const files = mediaDir?.children?.find((c) => c.name === String(m.id))?.children ?? [];
			const tape = tapeOfMedia.get(String(m.id));
			return {
				id: m.id,
				name: tape ? `Tape: ${tape.name}` : m.title || m.original_name,
				href: tape ? `/tapes/${tape.id}` : `/m/${m.id}`,
				web: files.find((f) => f.name === 'video.mp4')?.size ?? null,
				original: files.find((f) => f.name.startsWith('original.'))?.size ?? null,
				work: working.get(m.id) ?? null
			};
		})
		.sort((a, b) => (b.web ?? 0) + (b.original ?? 0) - (a.web ?? 0) - (a.original ?? 0));

	const fs = statfsSync(DATA_DIR);
	return {
		root,
		videos,
		biggest: biggest.slice(0, 25),
		disk: { total: fs.blocks * fs.bsize, free: fs.bavail * fs.bsize }
	};
};

export const actions: Actions = {
	remake: async ({ request, locals }) => {
		if (!locals.user?.is_admin) error(403);
		const id = Number((await request.formData()).get('id'));
		if (!reprocess(id)) return fail(400, { message: 'That video can’t be re-made: its original upload is gone, or it’s already being made.' });
		return { remade: id };
	}
};
