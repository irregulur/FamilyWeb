<script lang="ts">
	import { page } from '$app/state';
	import { dots, formatDuration, formatTakenAt, osdDate } from '#lib/format.ts';
	import People from '#lib/components/People.svelte';
	import { occasionBySlug } from '#lib/occasions.ts';
	import { formatTime, sceneHref, sceneThumb } from '#lib/tapes.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const tape = $derived(data.tape);
	const clip = $derived(data.clip);
	const occasion = $derived(occasionBySlug(clip.occasion));

	let video = $state<HTMLVideoElement>();
	let now = $state(0);
	// Plays the scene and stops where the next one starts. Press play again to carry on into the rest of the tape.
	let stopAtEnd = true;
	let finished = $state(false);
	// Going to the next scene keeps this page, so start fresh
	$effect.pre(() => {
		void clip.id;
		stopAtEnd = true;
		finished = false;
	});

	function onloadedmetadata() {
		if (!video) return;
		video.currentTime = clip.start;
		if (page.url.searchParams.has('play')) video.play().catch(() => {});
	}
	function ontimeupdate() {
		if (video && stopAtEnd && now >= clip.end - 0.15) {
			video.pause();
			stopAtEnd = false;
			finished = true;
		}
	}
	function onseeked() {
		if (now < clip.end - 0.5) stopAtEnd = true;
	}
	function from(t: number) {
		if (!video) return;
		video.currentTime = t;
		video.play();
	}
</script>

<svelte:head><title>{clip.title}</title></svelte:head>

<div class="pt-8"><a href="/tapes/{tape.id}" class="text-sm text-muted hover:text-ink">← {tape.name}</a></div>

<header class="mt-6">
	<p class="eyebrow">A scene on tape</p>
	<h1 class="mt-2 text-4xl leading-[1.05] md:text-5xl">{clip.title}</h1>
	<p class="mono mt-3 text-muted">
		{dots(clip.taken_at ? formatTakenAt(clip.taken_at) : '', formatDuration(clip.end - clip.start))}
		{#if occasion}· <a href="/occasion/{occasion.slug}" class="hover:text-ink">{occasion.name}</a>{/if}
	</p>
	<div class="mt-5">
		{#key clip.id}<People people={data.people} chapter={clip.id} />{/key}
	</div>
</header>

<div class="mt-8 grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_18rem]">
	<div>
		<figure class="screen relative overflow-hidden rounded-md bg-black shadow-soft">
			{#key clip.id}
			<!-- svelte-ignore a11y_media_has_caption -->
			<video
				bind:this={video}
				bind:currentTime={now}
				{onloadedmetadata}
				{ontimeupdate}
				{onseeked}
				onplay={() => (finished = false)}
				src="/files/{tape.media_id}/video.mp4?v={tape.version ?? 0}#t={clip.start}"
				poster={sceneThumb({ ...clip, media_id: tape.media_id, version: tape.version })}
				controls
				preload="metadata"
				class="aspect-[4/3] w-full bg-black"
			></video>
			{/key}
			{#if clip.taken_at}<span class="osd date top-4 left-5 text-[13px]">{osdDate(clip.taken_at)}</span>{/if}
			{#if finished}
				<div class="absolute inset-x-0 bottom-14 z-[3] flex flex-wrap items-center justify-center gap-3 px-4">
					{#if data.next}
						<a href={sceneHref(data.next) + '?play'} class="btn">Next: {data.next.title} →</a>
					{/if}
					<button class="btn-ghost bg-bg!" onclick={() => from(clip.start)}>↺ Again</button>
				</div>
			{/if}
		</figure>

		<!-- Where you are in this scene (the player's own bar is the whole tape) -->
		<label class="mt-3 flex items-center gap-3 font-mono text-xs text-muted">
			<span class="w-12 text-right">{formatTime(Math.max(0, Math.min(now, clip.end) - clip.start))}</span>
			<input
				type="range"
				class="flex-1 accent-current"
				min={clip.start}
				max={clip.end}
				step="0.5"
				value={Math.min(Math.max(now, clip.start), clip.end)}
				oninput={(e) => video && (video.currentTime = Number(e.currentTarget.value))}
				aria-label="Where in this scene"
			/>
			<span class="w-12">{formatTime(clip.end - clip.start)}</span>
		</label>
		{#if now > clip.end + 1}
			<p class="mt-2 text-sm text-muted">You’re watching on past this scene, into the rest of the tape.</p>
		{/if}
	</div>

	<aside class="space-y-3 text-sm">
		<a href="/tapes/{tape.id}?t={Math.floor(clip.start)}&play" class="btn-ghost w-full">Watch the whole tape from here</a>
		<a href="{sceneHref(clip)}/download" class="btn-ghost w-full" download>⬇ Save this scene as a video</a>
		<a href="/tapes/{tape.id}/edit#scene-{clip.id}" class="btn-ghost w-full">✎ Change this scene’s start or end</a>
		<nav class="grid grid-cols-2 gap-3 pt-4">
			{#each [{ c: data.prev, label: '← Before' }, { c: data.next, label: 'After →' }] as { c, label } (label)}
				{#if c}
					<a href={sceneHref(c)} class="group block">
						<div class="tile scanlines aspect-[4/3]"><img src={sceneThumb({ ...c, media_id: tape.media_id, version: tape.version })} alt="" loading="lazy" /></div>
						<p class="mono mt-1.5 text-[11px]! text-muted">{label}</p>
						<p class="truncate font-serif text-base leading-tight italic">{c.title}</p>
					</a>
				{:else}
					<span></span>
				{/if}
			{/each}
		</nav>
	</aside>
</div>

<style>
	.screen .date {
		z-index: 2;
		color: var(--osd);
		text-shadow:
			0 0 8px rgb(255 140 0 / 0.55),
			1px 1px 0 rgb(0 0 0 / 0.6);
	}
</style>
