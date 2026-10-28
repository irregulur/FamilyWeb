<script lang="ts">
	import { count } from '#lib/format.ts';
	import MediaGrid from '#lib/components/MediaGrid.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head><title>{data.occasion.name}</title></svelte:head>

<section class="pt-12 pb-10 md:pt-16">
	<p class="eyebrow flex items-center gap-2"><span class="h-2 w-2 rounded-full" style:background={data.occasion.color}></span> The days we celebrated</p>
	<h1 class="mt-3 text-5xl leading-[1.05] md:text-6xl">{data.occasion.name}</h1>
	<p class="mt-4 text-muted">{count(data.count, 'memory', 'memories')}, through the years</p>
</section>

{#each data.byYear as group (group.year)}
	<section class="grid gap-4 border-t border-line py-8 md:grid-cols-[180px_1fr] md:gap-7">
		<h2 class="text-4xl md:text-5xl"><a href="/year/{group.year}" class="hover:text-gold">{group.year}</a></h2>
		<MediaGrid items={group.items} />
	</section>
{:else}
	<p class="text-muted">Nothing here yet.</p>
{/each}
