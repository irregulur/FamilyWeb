<script lang="ts">
	import { dots, formatDuration, formatTakenAt, stamp } from '#lib/format.ts';
	import type { Scene } from '#lib/server/tapes.ts';

	let { scenes }: { scenes: Scene[] } = $props();
</script>

<div class="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 lg:grid-cols-4 lg:gap-x-5">
	{#each scenes as s (s.id)}
		<a href={s.href} class="group block">
			<div class="tile scanlines aspect-[4/3]">
				<img src={s.thumb} alt="" loading="lazy" />
				<span class="osd top-2 left-2.5 z-[1]">▶ {(s.start != null && s.end_at != null && formatDuration(s.end_at - s.start)) || 'PLAY'}</span>
				<span class="stamp always z-[1]">{stamp(s.taken_at)}</span>
			</div>
			<p class="mt-2 truncate font-serif text-lg leading-tight italic">{s.title}</p>
			<p class="truncate text-xs text-muted">{dots(s.tape_name, s.taken_at && s.taken_at.length > 4 ? formatTakenAt(s.taken_at) : '')}</p>
		</a>
	{/each}
</div>
