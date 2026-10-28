<script lang="ts">
	import { count, dots, formatTakenAt, stamp } from '#lib/format.ts';
	import MediaGrid from '#lib/components/MediaGrid.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head><title>{data.year}</title></svelte:head>

<section class="flex flex-wrap items-end justify-between gap-6 pt-12 pb-10 md:pt-16">
	<div>
		<p class="eyebrow">The year</p>
		<h1 class="mt-2 text-[80px] leading-[0.9] md:text-[112px]">{data.year}</h1>
		<p class="mt-4 text-muted">
			{dots(count(data.items.length, 'memory', 'memories'), count(data.scenes.length, 'scene on tape', 'scenes on tape'))}
		</p>
	</div>
	<nav class="flex gap-2 font-mono text-sm">
		{#if data.prev}<a href="/year/{data.prev}" class="btn-ghost h-10!">← {data.prev}</a>{/if}
		{#if data.next}<a href="/year/{data.next}" class="btn-ghost h-10!">{data.next} →</a>{/if}
	</nav>
</section>

{#if data.scenes.length}
	<section class="border-t border-line py-8">
		<p class="eyebrow mb-1.5">On tape</p>
		<h2 class="mb-6 text-3xl">Home movies from {data.year}</h2>
		<div class="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 lg:grid-cols-4 lg:gap-x-5">
			{#each data.scenes as s (s.id)}
				<a href="/tapes/{s.tape_id}{s.start != null ? `?t=${Math.floor(s.start)}` : ''}" class="group block">
					<div class="tile scanlines aspect-[4/3]">
						<img src={s.thumb} alt="" loading="lazy" />
						<span class="osd top-2 left-2.5 z-[1]">PLAY ▶</span>
						<span class="stamp always z-[1]">{stamp(s.taken_at)}</span>
					</div>
					<p class="mt-2 truncate font-serif text-lg leading-tight italic">{s.title}</p>
					<p class="truncate text-xs text-muted">{dots(s.tape_name, s.taken_at && s.taken_at.length > 4 ? formatTakenAt(s.taken_at) : '')}</p>
				</a>
			{/each}
		</div>
	</section>
{/if}

{#if data.items.length}
	<section class="border-t border-line py-8">
		{#if data.scenes.length}
			<p class="eyebrow mb-1.5">Photos & videos</p>
			<h2 class="mb-6 text-3xl">The rest of {data.year}</h2>
		{/if}
		<MediaGrid items={data.items} />
	</section>
{/if}
