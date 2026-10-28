<script lang="ts">
	import { bandColor, inkColor } from '#lib/tapes.ts';

	// An 8mm cassette, drawn. The label is the real scan if there is one, otherwise the name "handwritten".
	// Size it with a width class on the parent; everything inside scales with it.
	let {
		tape,
		subtitle = ''
	}: {
		tape: { id: number; name: string; sticker_scan: number | null };
		subtitle?: string;
	} = $props();

	const uid = $props.id();
</script>

<div class="cassette relative aspect-[190/125] w-full [container-type:inline-size]">
	<svg viewBox="0 0 190 125" class="absolute inset-0 h-full w-full" aria-hidden="true">
		<defs>
			<linearGradient id="{uid}-body" x1="0" y1="0" x2="0" y2="1">
				<stop offset="0" stop-color="#3b3734" />
				<stop offset="1" stop-color="#1b1918" />
			</linearGradient>
			<radialGradient id="{uid}-tape">
				<stop offset="0.45" stop-color="#2a1a10" />
				<stop offset="1" stop-color="#4b3020" />
			</radialGradient>
		</defs>
		<!-- shell -->
		<rect width="190" height="125" rx="7" fill="url(#{uid}-body)" />
		<rect x="2" y="1.5" width="186" height="2.5" rx="1.25" fill="#fff" opacity="0.1" />
		<rect x="9.5" y="8.5" width="171" height="63" rx="2.5" fill="#000" opacity="0.35" />
		<!-- grip ridges -->
		{#each [0, 1, 2, 3, 4, 5] as i (i)}
			<rect x={15 + i * 4.5} y="82" width="1.6" height="30" rx="0.8" fill="#000" opacity="0.35" />
			<rect x={152 + i * 4.5} y="82" width="1.6" height="30" rx="0.8" fill="#000" opacity="0.35" />
		{/each}
		<!-- window with the two reels -->
		<rect x="48" y="79" width="94" height="34" rx="5" fill="#0b0a0a" stroke="#4a4541" stroke-width="0.8" />
		{#each [{ x: 73, r: 14 }, { x: 117, r: 9 }] as reel (reel.x)}
			<circle cx={reel.x} cy="96" r={reel.r} fill="url(#{uid}-tape)" />
			<circle cx={reel.x} cy="96" r="5.5" fill="#e8e4dc" />
			<circle cx={reel.x} cy="96" r="2.4" fill="#0b0a0a" />
			{#each [0, 60, 120, 180, 240, 300] as a (a)}
				<rect x={reel.x - 0.6} y="92" width="1.2" height="1.8" fill="#0b0a0a" transform="rotate({a} {reel.x} 96)" />
			{/each}
		{/each}
		<path d="M54 79 L72 79 L60 113 L48 113 L48 88 Z" fill="#fff" opacity="0.06" />
		<!-- screws and the format, embossed -->
		<circle cx="8" cy="117" r="2.2" fill="#56514c" />
		<circle cx="182" cy="117" r="2.2" fill="#56514c" />
		<text x="95" y="121.5" text-anchor="middle" font-size="5" font-weight="700" letter-spacing="1.2" fill="#77716b" font-family="system-ui, sans-serif">8mm</text>
	</svg>

	<!-- the sticker -->
	<div
		class="absolute top-[8.4%] left-[5.8%] h-[48%] w-[88.4%] overflow-hidden rounded-[2px] shadow-[inset_0_0_0_1px_rgb(0_0_0/0.06)]"
		style:background-color="#fbf7ec"
	>
		{#if tape.sticker_scan}
			<img src="/tapes/{tape.id}/scan/sticker?v={tape.sticker_scan}" alt="Label: {tape.name}" class="h-full w-full object-cover" loading="lazy" />
		{:else}
			<div class="h-[11%] w-full" style:background-color={bandColor(tape.id)}></div>
			<div class="ruled flex h-[89%] flex-col justify-center px-[6%] font-serif leading-[1.05] italic" style:color={inkColor(tape.id)}>
				<div style:rotate="{(((tape.id * 7) % 5) - 2) * 0.5}deg">
					<p class="line-clamp-2 text-[9cqw]">{tape.name}</p>
					{#if subtitle}<p class="truncate text-[6.5cqw] opacity-75">{subtitle}</p>{/if}
				</div>
			</div>
		{/if}
	</div>
</div>

<style>
	.cassette {
		filter: drop-shadow(0 10px 14px rgb(30 20 10 / 0.3));
	}
	.ruled {
		background-image: linear-gradient(transparent calc(100% - 1px), rgb(110 140 190 / 0.3) calc(100% - 1px));
		background-size: 100% 22%;
	}
</style>
