<script lang="ts">
	import MediaGrid from '#lib/components/MediaGrid.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head><title>The mystery box</title></svelte:head>

<section class="pt-12 pb-10 md:pt-16">
	<p class="eyebrow">Date unknown</p>
	<h1 class="mt-3 text-5xl leading-[1.05] md:text-6xl">The mystery box</h1>
	<p class="mt-4 max-w-xl text-muted">
		{#if data.items.length}
			Nobody's sure when these are from. Open one and add the year if you know it — even a guess like “early 80s” as 1982 helps.
		{:else}
			Empty! Every memory has a date. <a href="/" class="link">Back to the timeline</a>
		{/if}
	</p>
</section>

{#if data.items.length}
	<div class="border-t border-line pt-8"><MediaGrid items={data.items} /></div>
{/if}
