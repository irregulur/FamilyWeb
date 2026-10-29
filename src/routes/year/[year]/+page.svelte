<script lang="ts">
	import { count, dots } from '#lib/format.ts';
	import MediaGrid from '#lib/components/MediaGrid.svelte';
	import SceneGrid from '#lib/components/SceneGrid.svelte';
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
		<SceneGrid scenes={data.scenes} />
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
