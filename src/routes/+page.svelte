<script lang="ts">
	import Cassette from '#lib/components/Cassette.svelte';
	import { OCCASIONS, occasionBySlug } from '#lib/occasions.ts';
	import { count, dots, formatDuration, osdDate, stamp, tapeSpan } from '#lib/format.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const s = $derived(data.settings);
	const photos = $derived(data.totals.all_ - data.totals.videos);
	const first = $derived(data.years[0]?.year);
	const last = $derived(data.years.at(-1)?.year);
	const empty = $derived(!data.totals.all_ && !data.years.length && !data.tapes.length);

	const decades = $derived([...new Set(data.years.map((y) => Math.floor(y.year / 10) * 10))]);
	const firstOfDecade = $derived(new Set(decades.map((d) => data.years.find((y) => y.year >= d)?.year)));
	const shownOccasions = $derived(OCCASIONS.filter((o) => data.occasions[o.slug]));

	// Channel numbers for the sections that are showing: CH 01, CH 02…
	const ch = $derived.by(() => {
		let n = 0;
		const next = () => `CH ${String(++n).padStart(2, '0')}`;
		return {
			timeline: data.years.length ? next() : '',
			tapes: data.tapes.length ? next() : '',
			occasions: shownOccasions.length ? next() : '',
			mystery: data.undated ? next() : ''
		};
	});

	const f = $derived(data.featured);
	const fCaption = $derived(f ? f.title || dots(occasionBySlug(f.occasion)?.name ?? '', String(f.taken_at?.slice(0, 4) ?? '')) : '');
</script>

<!-- Hero: the big screen, playing something from the archive -->
<section class="grid items-center gap-8 pt-7 pb-14 md:grid-cols-[1.1fr_1fr] md:gap-16 md:pt-16 md:pb-20">
	<a href={f ? `/m/${f.id}` : '/upload'} class="viewfinder group relative block aspect-[4/3] overflow-hidden rounded-md bg-black shadow-soft">
		{#if f}
			<img src="/files/{f.id}/large.webp" alt={fCaption} class="h-full w-full object-cover" />
			<span class="osd top-5 left-6 text-[13px] md:text-[15px]">{f.kind === 'video' ? 'PLAY ▶' : 'STILL'}</span>
			{#if f.kind === 'video' && f.duration}<span class="osd top-5 right-6 text-[13px] md:text-[15px]">SP&nbsp;&nbsp;{formatDuration(f.duration)}</span>{/if}
			<span class="osd date bottom-5 left-6 text-[13px] md:text-[15px]">{osdDate(f.taken_at)}</span>
			{#if fCaption}
				<span class="caption absolute inset-x-0 bottom-0 z-[2] px-6 pt-16 pb-12 font-serif text-xl text-white italic opacity-0 transition duration-300 group-hover:opacity-100">
					{fCaption}
				</span>
			{/if}
		{:else}
			<span class="osd top-5 left-6 text-[15px]">STOP ■</span>
			<span class="osd top-5 right-6 text-[15px]">--:--:--</span>
			<span class="absolute inset-0 grid place-items-center font-mono text-sm tracking-[0.3em] text-white/70">NO TAPE</span>
		{/if}
	</a>

	<div>
		<p class="eyebrow">{first ? `Home movies & photographs · ${first === last ? first : `${first} — ${last}`}` : 'Home movies & photographs'}</p>
		<h1 class="mt-4 mb-5 text-[clamp(38px,5vw,66px)] leading-[1.02]">
			{s.headline}{#if s.headline_italic}<br /><em class="text-muted">{s.headline_italic}</em>{/if}
		</h1>
		<p class="mb-8 max-w-[30em] text-lg text-muted">{s.intro}</p>
		<div class="flex flex-wrap gap-3">
			{#if empty}
				<a href="/upload" class="btn">＋ Add the first memories</a>
				<a href="/tapes" class="btn-ghost">Start the tape shelf</a>
			{:else}
				<a href="/random" class="btn" data-sveltekit-preload-data="off">▶&nbsp; Play a memory</a>
				<a href="/tapes" class="btn-ghost">The tape shelf</a>
			{/if}
		</div>
		{#if !empty}
			<div class="mt-11 flex flex-wrap gap-x-10 gap-y-4 border-t border-line pt-5">
				{#each [[photos, 'photograph', 'photographs'], [data.totals.videos, 'home video', 'home videos'], [data.tapes.length, 'tape', 'tapes'], [data.christmases, 'Christmas', 'Christmases']] as const as [n, one, many] (one)}
					{#if n}
						<div><b class="block font-serif text-[34px] leading-tight font-normal">{n.toLocaleString('en')}</b><span class="text-muted">{n === 1 ? one : many}</span></div>
					{/if}
				{/each}
			</div>
		{/if}
	</div>
</section>

<!-- Timeline -->
{#if data.years.length}
	<div class="mt-8 mb-7 flex flex-wrap items-end justify-between gap-5 md:mt-16">
		<div>
			<p class="eyebrow mb-1.5">{ch.timeline}</p>
			<h2 class="text-3xl md:text-[38px]">Through the years</h2>
		</div>
		{#if decades.length > 1}
			<nav class="flex gap-1 rounded-full border border-line p-1">
				{#each decades as d (d)}
					<a href="#d{d}" class="rounded-full px-4 py-1.5 font-mono text-[13px] text-muted transition hover:bg-ink hover:text-bg">’{String(d).slice(2)}s</a>
				{/each}
			</nav>
		{/if}
	</div>

	{#each data.years as y (y.year)}
		{@const more = y.count + y.scenes - y.strip.length}
		<section
			id={firstOfDecade.has(y.year) ? `d${Math.floor(y.year / 10) * 10}` : undefined}
			class="grid scroll-mt-24 gap-3.5 border-t border-line py-6 md:grid-cols-[180px_1fr] md:gap-7 md:py-7"
		>
			<a href="/year/{y.year}" class="group flex items-baseline gap-3.5 md:block">
				<h3 class="text-[40px] leading-[0.95] transition group-hover:text-gold md:text-[50px]">{y.year}</h3>
				<p class="text-sm leading-relaxed text-muted md:mt-2.5">
					{dots(count(y.count - y.videos, 'photo'), count(y.videos, 'video'))}
					{#if y.scenes}<span class="text-pine max-md:before:content-['_·_'] md:block">{count(y.scenes, 'scene on tape', 'scenes on tape')}</span>{/if}
				</p>
			</a>
			<div class="grid grid-cols-3 gap-1.5 md:grid-cols-6 md:gap-3">
				{#each y.strip as item, i (item.href + i)}
					<a href={item.href} class="tile aspect-[4/3] {item.scene ? 'scanlines' : ''} {i > 4 ? 'max-md:hidden' : ''}">
						<img src={item.src} alt="" loading="lazy" />
						{#if item.scene}<span class="osd top-1.5 left-2 z-[1]">▶ TAPE</span>
						{:else if item.duration}<span class="osd top-1.5 left-2">▶ {formatDuration(item.duration)}</span>{/if}
						<span class="stamp z-[1]">{stamp(item.taken_at)}</span>
					</a>
				{/each}
				{#if more > 0}
					<a href="/year/{y.year}" class="grid aspect-[4/3] place-items-center rounded-[3px] border border-line text-center font-serif text-xl leading-tight text-muted italic transition hover:border-ink hover:text-ink">
						{more} more
					</a>
				{/if}
			</div>
		</section>
	{/each}
{/if}

<!-- Tapes -->
{#if data.tapes.length}
	<div id="tapes" class="mt-20 mb-7 flex flex-wrap items-end justify-between gap-5 md:mt-24">
		<div>
			<p class="eyebrow mb-1.5">{ch.tapes}</p>
			<h2 class="text-3xl md:text-[38px]">The tape shelf</h2>
		</div>
		<a href="/tapes" class="text-sm text-muted hover:text-ink">{data.digitized} of {count(data.tapes.length, 'tape')} digitized →</a>
	</div>
	<div class="grid grid-cols-2 gap-x-5 gap-y-8 md:grid-cols-4 md:gap-6">
		{#each data.tapes.slice(0, 4) as tape (tape.id)}
			<a href="/tapes/{tape.id}" class="group block">
				<div class="transition duration-500 group-hover:-translate-y-1 group-hover:-rotate-1">
					<Cassette {tape} subtitle={tape.first_year ? String(tape.first_year) : ''} />
				</div>
				<p class="mt-4 font-serif text-[22px] leading-tight">{tape.name}</p>
				<p class="mono mt-0.5 text-[11px]! text-muted">
					{dots(
						tapeSpan(tape),
						tape.status === 'ready' ? formatDuration(tape.duration) : tape.media_id ? 'getting ready' : 'not digitized yet'
					)}
				</p>
			</a>
		{/each}
	</div>
{/if}

<!-- Occasions -->
{#if shownOccasions.length}
	<div id="occasions" class="mt-20 mb-7 scroll-mt-24 md:mt-24">
		<p class="eyebrow mb-1.5">{ch.occasions}</p>
		<h2 class="text-3xl md:text-[38px]">The days we celebrated</h2>
	</div>
	<div class="grid grid-cols-2 gap-2.5 md:grid-cols-4 md:gap-4">
		{#each shownOccasions as o (o.slug)}
			{@const info = data.occasions[o.slug]}
			<a href="/occasion/{o.slug}" class="group relative flex h-32 flex-col justify-end overflow-hidden rounded px-4 py-4 text-white md:h-40 md:px-5">
				{#if info.cover}
					<img src="/files/{info.cover}/thumb.webp" alt="" loading="lazy" class="absolute inset-0 h-full w-full object-cover saturate-[0.8] sepia-[0.2] transition duration-700 group-hover:scale-105" />
				{/if}
				<div class="absolute inset-0" style:background="linear-gradient(transparent 20%, color-mix(in srgb, {o.color} 85%, black))"></div>
				<p class="relative font-serif text-2xl leading-none md:text-[26px]">{o.name}</p>
				<p class="mono relative mt-1 text-[11px]! opacity-85">{count(info.count, 'memory', 'memories')}</p>
			</a>
		{/each}
	</div>
{/if}

<!-- Mystery box -->
{#if data.undated}
	<a href="/undated" class="group mt-20 flex flex-wrap items-end justify-between gap-4 border-y border-line py-8 md:mt-24">
		<div>
			<p class="eyebrow mb-1.5">{ch.mystery}</p>
			<h2 class="text-4xl transition group-hover:text-gold md:text-[44px]">The mystery box</h2>
			<p class="mt-2 text-muted">{count(data.undated, 'memory', 'memories')} with no date yet — do you know when they're from?</p>
		</div>
		<span class="text-sm text-muted group-hover:text-ink">Take a look →</span>
	</a>
{/if}

<!-- The dedication: the heart of the gift -->
{#if s.dedication}
	<section class="mx-auto mt-28 max-w-[680px] text-center">
		<p class="eyebrow">For the family</p>
		<blockquote class="mt-4 mb-3.5 font-serif text-[30px] leading-tight italic md:text-[38px]">“{s.dedication}”</blockquote>
		{#if s.dedication_from}<p class="text-muted">— {s.dedication_from}</p>{/if}
	</section>
{/if}

<style>
	/* Soft vignette and scan lines over the big screen */
	.viewfinder img {
		filter: sepia(0.18) saturate(0.85) contrast(1.04) brightness(0.95);
	}
	.viewfinder::before {
		content: '';
		position: absolute;
		inset: 0;
		z-index: 1;
		pointer-events: none;
		background:
			repeating-linear-gradient(to bottom, rgb(255 255 255 / 0.04) 0 1px, transparent 1px 3px),
			radial-gradient(ellipse at center, transparent 55%, rgb(0 0 0 / 0.45));
	}
	.viewfinder .osd {
		z-index: 2;
	}
	.viewfinder .date {
		color: var(--osd);
		text-shadow:
			0 0 8px rgb(255 140 0 / 0.55),
			1px 1px 0 rgb(0 0 0 / 0.6);
	}
	.caption {
		background: linear-gradient(transparent, rgb(0 0 0 / 0.55));
	}
</style>
