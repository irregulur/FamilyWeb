<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { workText, type Work } from '#lib/format.ts';
	import type { PageProps } from './$types';
	import type { Node } from './+page.server.ts';

	let { data, form }: PageProps = $props();

	// While videos are being made, check how far every few seconds (cheaper than reloading the whole page)
	let work = $derived(Object.fromEntries(data.videos.map((v) => [v.id, v.work])) as Record<number, Work | null>);
	$effect(() => {
		const ids = Object.keys(work).filter((id) => work[Number(id)]);
		if (!ids.length) return;
		const timer = setInterval(async () => {
			const rows: { id: number; work: Work | null }[] | null = await fetch(`/api/status?ids=${ids}`).then((r) => r.json()).catch(() => null);
			if (!rows) return;
			if (rows.some((r) => !r.work)) invalidateAll();
			else work = { ...work, ...Object.fromEntries(rows.map((r) => [r.id, r.work])) };
		}, 4000);
		return () => clearInterval(timer);
	});

	const SHOWN = 100; // per folder; the rest are summed up in one line
	const NAMES: Record<string, string> = {
		media: 'Photos & videos',
		tapes: 'Tape label scans & scene stills',
		uploads: 'Unfinished uploads',
		frames: 'Scene stills',
		'video.mp4': 'web video',
		'large.webp': 'preview picture',
		'thumb.webp': 'thumbnail'
	};
	const describe = (name: string) => NAMES[name] ?? (name.startsWith('original.') ? 'original upload' : name.startsWith('family.db') ? 'database' : '');

	function size(bytes: number) {
		const units = ['B', 'KB', 'MB', 'GB', 'TB'];
		let i = 0;
		while (bytes >= 1024 && i < units.length - 1) [bytes, i] = [bytes / 1024, i + 1];
		return `${bytes.toFixed(i && bytes < 10 ? 1 : 0)} ${units[i]}`;
	}
	const used = $derived(data.disk.total - data.disk.free);
</script>

<svelte:head><title>Storage</title></svelte:head>

<section class="pt-12 pb-10 md:pt-16">
	<p class="eyebrow"><a href="/family" class="hover:text-ink">The family</a> · Storage</p>
	<h1 class="mt-3 text-5xl leading-[1.05] md:text-6xl">What's taking up space</h1>
	<p class="mt-4 text-muted">
		The archive uses <strong class="text-ink">{size(data.root.size)}</strong> in {data.root.files} files.
		The disk it's on has {size(data.disk.free)} free of {size(data.disk.total)}.
	</p>
	<div class="mt-4 h-2 max-w-xl overflow-hidden rounded-full bg-surface-2">
		<div class="h-full bg-gold" style="width: {(used / data.disk.total) * 100}%"></div>
	</div>
</section>

{#snippet row(n: Node, total: number)}
	<span class="flex items-baseline gap-3">
		<span class="min-w-0 flex-1 truncate">
			{#if n.href}<a href={n.href} class="link">{n.label}</a>{:else}{n.label ?? NAMES[n.name] ?? n.name}{/if}
			{#if describe(n.name) && !NAMES[n.name]}<span class="text-muted"> — {describe(n.name)}</span>{/if}
			{#if n.label}<span class="font-mono text-xs text-muted"> {n.name}</span>{/if}
		</span>
		<span class="hidden w-24 shrink-0 sm:block"><span class="block h-1.5 rounded-full bg-gold" style="width: {Math.max(2, (n.size / total) * 100)}%"></span></span>
		<span class="w-20 shrink-0 text-right font-mono text-sm">{size(n.size)}</span>
	</span>
{/snippet}

{#snippet tree(n: Node, total: number)}
	<ul class="ml-4 border-l border-line pl-3">
		{#each n.children!.slice(0, SHOWN) as c (c.name)}
			<li class="py-1">
				{#if c.children?.length}
					<details>
						<summary class="cursor-pointer">{@render row(c, total)}</summary>
						{@render tree(c, total)}
					</details>
				{:else}
					<div class="pl-4">{@render row(c, total)}</div>
				{/if}
			</li>
		{/each}
		{#if n.children!.length > SHOWN}
			{@const rest = n.children!.slice(SHOWN)}
			<li class="py-1 pl-4 text-sm text-muted">…and {rest.length} smaller ones, {size(rest.reduce((s, c) => s + c.size, 0))} together</li>
		{/if}
	</ul>
{/snippet}

{#if data.videos.length}
	<section class="card mb-6">
		<h2 class="text-3xl">Videos</h2>
		<p class="mt-1 max-w-2xl text-sm text-muted">
			<b>Re-make</b> makes the web copy again from the original upload — for when the original was fixed by hand. The current copy
			stays watchable until the new one is done. Big tape captures are deleted once their web copy exists, so those can’t be re-made.
		</p>
		{#if form?.message}<p class="mt-2 text-sm text-red-700 dark:text-red-400">{form.message}</p>{/if}
		<ul class="mt-3 divide-y divide-line">
			{#each data.videos as v (v.id)}
				<li class="flex flex-wrap items-center gap-x-4 gap-y-1 py-2.5">
					<a href={v.href} class="link min-w-0 flex-1 truncate">{v.name}</a>
					<span class="font-mono text-xs text-muted">
						web {v.web != null ? size(v.web) : '–'} · original {v.original != null ? size(v.original) : 'deleted'}
					</span>
					{#if work[v.id]}
						<span class="w-full text-right text-sm text-accent sm:w-72">{workText(work[v.id]!)}</span>
					{:else if v.original != null}
						<form method="POST" action="?/remake" use:enhance class="sm:w-72 sm:text-right">
							<input type="hidden" name="id" value={v.id} />
							<button class="btn-ghost h-8! px-3! text-xs!">Re-make</button>
						</form>
					{:else}
						<span class="sm:w-72"></span>
					{/if}
				</li>
			{/each}
		</ul>
	</section>
{/if}

<section class="grid gap-6 lg:grid-cols-2">
	<div class="card">
		<h2 class="text-3xl">Folders</h2>
		<p class="mt-1 text-sm text-muted">Biggest first. Click a folder to open it.</p>
		<div class="mt-4 -ml-4">{@render tree(data.root, data.root.size || 1)}</div>
	</div>

	<div class="card">
		<h2 class="text-3xl">Biggest files</h2>
		<ol class="mt-3 divide-y divide-line">
			{#each data.biggest as f (f.path)}
				<li class="flex items-baseline gap-3 py-2">
					<span class="min-w-0 flex-1">
						{#if f.href}<a href={f.href} class="link block truncate">{f.label}</a>{/if}
						<span class="block truncate font-mono text-xs text-muted">{f.path}{describe(f.path.split('/').pop()!) ? ` — ${describe(f.path.split('/').pop()!)}` : ''}</span>
					</span>
					<span class="shrink-0 font-mono text-sm">{size(f.size)}</span>
				</li>
			{/each}
		</ol>
	</div>
</section>
