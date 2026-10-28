<script lang="ts">
	import Cassette from '#lib/components/Cassette.svelte';
	import { count, dots, formatDuration } from '#lib/format.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const years = (t: { first_year: number | null; last_year: number | null }) =>
		t.first_year ? (t.first_year === t.last_year ? `${t.first_year}` : `${t.first_year}–${String(t.last_year).slice(2)}`) : '';
</script>

<svelte:head><title>The tape shelf</title></svelte:head>

<section class="flex flex-wrap items-end justify-between gap-6 pt-12 pb-12 md:pt-16">
	<div>
		<p class="eyebrow">Home movies</p>
		<h1 class="mt-3 text-5xl leading-[1.05] md:text-6xl">The tape shelf</h1>
		{#if data.tapes.length}
			<p class="mt-4 text-muted">
				{data.digitized === data.tapes.length
					? `All ${count(data.tapes.length, 'tape')} digitized.`
					: `${data.digitized} of ${count(data.tapes.length, 'tape')} digitized so far.`}
				Each line on a label is a scene you can jump straight to.
			</p>
		{/if}
	</div>
	{#if data.tapes.length}
		<form method="POST" action="?/create"><button class="btn">＋ Add a tape</button></form>
	{/if}
</section>

{#if !data.tapes.length}
	<section class="card mx-auto max-w-lg p-10! text-center">
		<p class="font-serif text-3xl">The shelf is empty.</p>
		<p class="mt-3 text-muted">
			Add a tape, scan its labels, and type in what's written on them. Each line becomes a scene you can jump straight to —
			and it shows up on the timeline in its year.
		</p>
		<form method="POST" action="?/create" class="mt-7"><button class="btn">Add the first tape</button></form>
	</section>
{:else}
	<div class="grid grid-cols-2 gap-x-5 gap-y-12 border-t border-line pt-10 sm:grid-cols-3 lg:grid-cols-4 lg:gap-x-8">
		{#each data.tapes as tape (tape.id)}
			{@const digitized = tape.status === 'ready'}
			<a href="/tapes/{tape.id}" class="group block">
				<div class="transition duration-500 group-hover:-translate-y-1 group-hover:-rotate-1 {digitized ? '' : 'opacity-50 grayscale-[0.7]'}">
					<Cassette {tape} subtitle={years(tape)} />
				</div>
				<p class="mt-4 font-serif text-[22px] leading-tight">{tape.name}</p>
				<p class="mono mt-1 text-[11px]! text-muted">
					{dots(
						years(tape),
						digitized ? formatDuration(tape.duration) : '',
						count(tape.scenes, 'scene')
					)}
				</p>
				{#if !digitized}
					<p class="mono mt-0.5 text-[11px]! text-accent">{tape.status === 'processing' ? 'Getting ready…' : 'Not digitized yet'}</p>
				{/if}
			</a>
		{/each}
	</div>
{/if}
