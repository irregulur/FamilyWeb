<script lang="ts">
	import { page } from '$app/state';
	import Cassette from '#lib/components/Cassette.svelte';
	import { count, dots, formatDuration, formatTakenAt, osdDate } from '#lib/format.ts';
	import { occasionBySlug } from '#lib/occasions.ts';
	import { formatTime } from '#lib/tapes.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const tape = $derived(data.tape);
	const ready = $derived(tape.status === 'ready');

	let video = $state<HTMLVideoElement>();
	let now = $state(0);

	// The scene playing right now: the last one that starts before the current time.
	const playing = $derived(
		data.chapters.filter((c) => c.start != null && c.start <= now + 0.5).sort((a, b) => b.start! - a.start!)[0]?.id
	);

	function play(start: number | null) {
		if (!video || start == null) return;
		video.currentTime = start;
		video.play();
		if (innerWidth < 1024) video.scrollIntoView({ behavior: 'smooth', block: 'center' });
	}

	// Links from the timeline say where to start: /tapes/3?t=754
	function onloadedmetadata() {
		const t = Number(page.url.searchParams.get('t'));
		if (t && video) video.currentTime = t;
		if (page.url.searchParams.has('play')) video?.play().catch(() => {});
	}

	const playingChapter = $derived(data.chapters.find((c) => c.id === playing));

	const years = $derived(
		tape.first_year ? (tape.first_year === tape.last_year ? `${tape.first_year}` : `${tape.first_year}–${tape.last_year}`) : ''
	);
	const scans = $derived(
		[
			tape.sleeve_scan && { side: 'sleeve', v: tape.sleeve_scan, alt: 'The box' },
			tape.sticker_scan && { side: 'sticker', v: tape.sticker_scan, alt: 'The cassette label' }
		].filter((s) => !!s)
	);
</script>

<svelte:head><title>{tape.name}</title></svelte:head>

<div class="pt-8"><a href="/tapes" class="text-sm text-muted hover:text-ink">← The tape shelf</a></div>

<!-- Header: the cassette and what it is -->
<header class="mt-6 flex flex-col items-start gap-6 sm:flex-row sm:items-center">
	<div class="w-40 shrink-0 -rotate-1"><Cassette {tape} subtitle={years} /></div>
	<div class="min-w-0 flex-1">
		<p class="eyebrow">Tape</p>
		<h1 class="mt-2 text-4xl leading-[1.05] md:text-5xl">{tape.name}</h1>
		<p class="mono mt-3 text-muted">
			{dots(years, ready ? formatDuration(tape.duration) : '', count(data.chapters.length, 'scene'))}
		</p>
	</div>
	<a href="/tapes/{tape.id}/edit" class="btn-ghost">✎ Edit tape & labels</a>
</header>

<div class="mt-10 grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_24rem]">
	<!-- The recording -->
	<figure class="screen relative overflow-hidden rounded-md bg-black shadow-soft lg:sticky lg:top-24">
		{#if ready}
			<!-- svelte-ignore a11y_media_has_caption -->
			<video
				bind:this={video}
				bind:currentTime={now}
				{onloadedmetadata}
				src="/files/{tape.media_id}/video.mp4"
				poster="/files/{tape.media_id}/large.webp"
				controls
				preload="metadata"
				class="aspect-[4/3] w-full bg-black"
			></video>
			{#if playingChapter}
				<span class="osd date top-4 left-5 text-[13px]">{playingChapter.taken_at ? osdDate(playingChapter.taken_at) : ''}</span>
			{/if}
		{:else}
			<div class="scanlines relative flex aspect-[4/3] flex-col items-center justify-center gap-3 p-8 text-center text-white/75">
				<span class="osd top-5 left-6 text-[13px]">{tape.status === 'processing' ? 'REW ◀◀' : 'STOP ■'}</span>
				<p class="font-mono text-sm tracking-[0.3em] text-white">
					{tape.status === 'processing' ? 'GETTING READY…' : 'NO SIGNAL'}
				</p>
				<p class="max-w-sm text-sm">
					{#if tape.status === 'processing'}
						The recording is being made web-sized. A two-hour tape takes a while — check back later.
					{:else}
						Once the tape is recorded, upload it on <a href="/upload" class="underline">Add memories</a>, then pick it under
						<a href="/tapes/{tape.id}/edit" class="underline">Edit tape</a>.
					{/if}
				</p>
			</div>
		{/if}
	</figure>

	<!-- What's written on the box, as a notebook page: tap a line to jump there -->
	<section class="card p-0! overflow-hidden" aria-label="Scenes on this tape">
		<div class="flex items-baseline justify-between border-b border-line px-5 py-4">
			<h2 class="text-2xl">On this tape</h2>
			<span class="mono text-[11px]! text-muted">{count(data.chapters.length, 'scene')}</span>
		</div>
		{#if data.chapters.length}
			<ol>
				{#each data.chapters as c (c.id)}
					{@const occasion = occasionBySlug(c.occasion)}
					{@const canPlay = ready && c.start != null}
					<li class="border-b border-line last:border-0">
						<button
							class="group flex w-full items-center gap-4 px-5 py-3 text-left transition {playing === c.id ? 'bg-surface-2' : canPlay ? 'hover:bg-surface-2' : 'cursor-default'}"
							disabled={!canPlay}
							onclick={() => play(c.start)}
						>
							<span class="w-14 shrink-0 font-mono text-xs {playing === c.id ? 'text-accent' : 'text-muted'}">
								{playing === c.id ? '▶ ' : ''}{c.start != null ? formatTime(c.start) : '–'}
							</span>
							<span class="min-w-0 flex-1">
								<span class="block truncate font-serif text-xl leading-tight italic">{c.title}</span>
								{#if c.taken_at || occasion}
									<span class="block text-xs text-muted">
										{dots(c.taken_at ? formatTakenAt(c.taken_at) : '', occasion?.name ?? '')}
									</span>
								{/if}
							</span>
						</button>
					</li>
				{/each}
			</ol>
		{:else}
			<p class="px-5 py-6 text-muted">
				<a href="/tapes/{tape.id}/edit" class="link">Write down what's on this tape</a> — each line becomes a scene.
			</p>
		{/if}
	</section>
</div>

<!-- The labels as Mom wrote them -->
{#if scans.length}
	<section class="mt-20">
		<p class="eyebrow">In her handwriting</p>
		<h2 class="mt-1.5 text-4xl">The labels, as they were written</h2>
		<div class="mt-8 flex flex-wrap items-start gap-8">
			{#each scans as scan (scan.side)}
				<a
					href="/tapes/{tape.id}/scan/{scan.side}?v={scan.v}"
					target="_blank"
					class="group max-w-md"
				>
					<img src="/tapes/{tape.id}/scan/{scan.side}?v={scan.v}" alt={scan.alt} class="max-h-[32rem] w-auto rounded-[3px] shadow-soft transition group-hover:-translate-y-1" />
					<p class="mono mt-3 text-[11px]! text-muted">{scan.alt}</p>
				</a>
			{/each}
		</div>
	</section>
{:else}
	<p class="mt-16 text-sm text-muted">
		Got the box? <a href="/tapes/{tape.id}/edit" class="link">Add a scan of the labels</a> — handwriting is part of the memory.
	</p>
{/if}

<style>
	.screen .date {
		z-index: 2;
		color: var(--osd);
		text-shadow:
			0 0 8px rgb(255 140 0 / 0.55),
			1px 1px 0 rgb(0 0 0 / 0.6);
	}
</style>
