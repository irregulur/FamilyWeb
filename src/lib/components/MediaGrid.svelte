<script lang="ts">
	import { formatDuration, formatTakenAt, stamp } from '#lib/format.ts';
	import type { MediaItem } from '#lib/server/media.ts';

	let { items }: { items: MediaItem[] } = $props();
</script>

<div class="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 lg:grid-cols-4 lg:gap-x-5">
	{#each items as item (item.id)}
		<a href="/m/{item.id}" class="group block">
			<div class="tile aspect-[4/3]">
				<img src="/files/{item.id}/thumb.webp" alt={item.title ?? ''} loading="lazy" />
				{#if item.kind === 'video'}<span class="osd top-2 left-2.5">▶ {formatDuration(item.duration)}</span>{/if}
				<span class="stamp">{stamp(item.taken_at)}</span>
			</div>
			{#if item.title}
				<p class="mt-2 truncate font-serif text-lg leading-tight italic">{item.title}</p>
			{:else}
				<p class="mt-2 truncate text-sm text-muted">{formatTakenAt(item.taken_at)}</p>
			{/if}
		</a>
	{/each}
</div>
