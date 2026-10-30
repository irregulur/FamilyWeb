<script lang="ts">
	import { bandColor, inkColor } from '#lib/tapes.ts';

	// An 8mm / Hi8 cassette in its clear case, drawn after the real ones. The label is the real scan if there is one,
	// otherwise the name "handwritten". Size it with a width class on the parent; everything inside scales with it.
	let {
		tape,
		subtitle = ''
	}: {
		tape: { id: number; name: string; sticker_scan: number | null };
		subtitle?: string;
	} = $props();

	const uid = $props.id();

	// Two kinds on the shelf, like a real family's mix: black Hi8 and grey metal 8mm
	const looks = {
		hi8: { top: '#262524', bottom: '#0e0e0d', lip: '#151514', line: '#2e2d2b', print: '#e9e6df', kind: 'Hi8', lipText: 'Hi8' },
		metal: { top: '#6a6b64', bottom: '#4a4b45', lip: '#55564f', line: '#3d3e39', print: '#d9dbe0', kind: '8mm', lipText: 'Metal' }
	};
	const look = $derived(tape.id % 2 ? looks.hi8 : looks.metal);
	const reels = [
		{ x: 54, pack: 33, fill: 'pack-dark' }, // the tape still to play
		{ x: 132, pack: 27, fill: 'pack-shine' } // the tape already played, catching the light
	];
</script>

<div class="cassette relative aspect-[200/140] w-full [container-type:inline-size]">
	<svg viewBox="0 0 200 140" class="absolute inset-0 h-full w-full" aria-hidden="true">
		<defs>
			<linearGradient id="{uid}-body" x1="0" y1="0" x2="0" y2="1">
				<stop offset="0" stop-color={look.top} />
				<stop offset="1" stop-color={look.bottom} />
			</linearGradient>
			<radialGradient id="{uid}-pack-dark">
				<stop offset="0.3" stop-color="#1c1917" />
				<stop offset="0.9" stop-color="#2b2724" />
				<stop offset="0.97" stop-color="#4a443e" />
				<stop offset="1" stop-color="#1a1816" />
			</radialGradient>
			<linearGradient id="{uid}-pack-shine" x1="0" y1="0" x2="1" y2="1">
				<stop offset="0" stop-color="#cfcfcd" />
				<stop offset="0.45" stop-color="#7d7c79" />
				<stop offset="0.6" stop-color="#b9b8b5" />
				<stop offset="1" stop-color="#55534f" />
			</linearGradient>
			<linearGradient id="{uid}-glare" x1="0" y1="0" x2="1" y2="1">
				<stop offset="0.3" stop-color="#fff" stop-opacity="0" />
				<stop offset="0.42" stop-color="#fff" stop-opacity="0.16" />
				<stop offset="0.5" stop-color="#fff" stop-opacity="0" />
			</linearGradient>
			<clipPath id="{uid}-window"><rect x="17" y="80" width="166" height="28" rx="2" /></clipPath>
		</defs>

		<!-- the clear case -->
		<rect x="0.5" y="0.5" width="199" height="139" rx="4" fill="#fff" fill-opacity="0.18" stroke="#000" stroke-opacity="0.18" />
		<rect x="2" y="2" width="196" height="136" rx="3" fill="none" stroke="#fff" stroke-opacity="0.5" stroke-width="0.8" />
		{#each [44, 156] as x (x)}
			<rect x={x - 6} y="0" width="12" height="4.5" rx="1" fill="#fff" fill-opacity="0.35" stroke="#000" stroke-opacity="0.12" stroke-width="0.5" />
		{/each}

		<g transform="translate(7 12)">
			<!-- shell -->
			<rect width="186" height="118" rx="3" fill="url(#{uid}-body)" />
			<rect x="1" y="0.8" width="184" height="1.6" rx="0.8" fill="#fff" opacity="0.12" />
			<!-- the recess the label sits in -->
			<rect x="15.5" y="3.5" width="155" height="49" rx="1.5" fill="#000" opacity="0.3" />
			<circle cx="93" cy="2.6" r="1.1" fill="#000" opacity="0.35" />

			<!-- printed format and length -->
			<text x="20" y="62" font-family="system-ui, sans-serif" font-size="9" font-weight="700" fill={look.print}>
				{look.kind}<tspan font-family="Georgia, serif" font-weight="400" font-size="9.5" dx="1.5">MP</tspan>
			</text>
			<text x="20" y="66.3" font-family="system-ui, sans-serif" font-size="2.9" fill={look.print} opacity="0.75">8mm Video Cassette</text>
			<text x="166" y="62.5" text-anchor="end" font-family="system-ui, sans-serif" font-size="9" fill={look.print}>120</text>
			<text x="166" y="66.3" text-anchor="end" font-family="system-ui, sans-serif" font-size="2.9" fill={look.print} opacity="0.75">video {look.kind}</text>

			<!-- the window with the two reels -->
			<g transform="translate(-7 -12)">
				<rect x="17" y="80" width="166" height="28" rx="2" fill="#060606" />
				<g clip-path="url(#{uid}-window)">
					{#each reels as reel (reel.x)}
						<circle cx={reel.x + 7} cy="94" r={reel.pack} fill="url(#{uid}-{reel.fill})" />
						<circle cx={reel.x + 7} cy="94" r="11" fill="#0c0c0c" />
						<!-- the hub: white, with orange catches and the key hole -->
						<circle cx={reel.x + 7} cy="94" r="9.5" fill="#ebe8e2" />
						<circle cx={reel.x + 7} cy="94" r="8.6" fill="none" stroke="#d2581d" stroke-width="1.6" stroke-dasharray="3 10.5" />
						<circle cx={reel.x + 7} cy="94" r="4.2" fill="#d6d2ca" />
						<rect x={reel.x + 5.7} y="88" width="2.6" height="8" rx="1.2" fill="#3b3936" />
						{#each [0, 120, 240] as a (a)}
							<circle cx={reel.x + 7} cy="100" r="1.1" fill="#bdb8af" transform="rotate({a} {reel.x + 7} 94)" />
						{/each}
					{/each}
					<!-- the tape running across between them -->
					<rect x="17" y="106.4" width="166" height="1.6" fill="#1b1714" />
				</g>
				<rect x="17" y="80" width="166" height="28" rx="2" fill="url(#{uid}-glare)" />
				<rect x="17" y="80" width="166" height="28" rx="2" fill="none" stroke="#000" stroke-opacity="0.6" stroke-width="0.8" />
			</g>

			<!-- the front lip, in three panels -->
			<rect x="0" y="97" width="186" height="21" rx="1.5" fill={look.lip} />
			<rect x="0" y="97" width="186" height="0.8" fill="#fff" opacity="0.1" />
			<line x1="44" y1="98" x2="44" y2="118" stroke={look.line} stroke-width="0.8" />
			<line x1="132" y1="98" x2="132" y2="118" stroke={look.line} stroke-width="0.8" />
			<text x="88" y="112" text-anchor="middle" font-family="Georgia, serif" font-size="8.5" fill={look.print} opacity="0.9">{look.lipText}</text>
			<text x="163" y="112" text-anchor="end" font-family="Georgia, serif" font-size="8" fill={look.print} opacity="0.9">120</text>
			<rect x="165.5" y="105.6" width="5.6" height="6.4" rx="0.6" fill="none" stroke={look.print} stroke-opacity="0.8" stroke-width="0.6" />
			<text x="168.3" y="111" text-anchor="middle" font-family="system-ui, sans-serif" font-size="5" font-weight="700" fill={look.print} opacity="0.85">8</text>
		</g>

		<!-- light across the case -->
		<path d="M128 0 L146 0 L66 140 L48 140 Z" fill="#fff" opacity="0.06" />
	</svg>

	<!-- the sticker -->
	<div
		class="absolute top-[13.2%] left-[12.2%] h-[32.1%] w-[75.6%] overflow-hidden rounded-[1.5px] shadow-[0_0.5px_1px_rgb(0_0_0/0.4)]"
		style:background-color="#fbf7ec"
	>
		{#if tape.sticker_scan}
			<img src="/tapes/{tape.id}/scan/sticker?v={tape.sticker_scan}" alt="Label: {tape.name}" class="h-full w-full object-cover" loading="lazy" />
		{:else}
			<div class="h-[13%] w-full" style:background-color={bandColor(tape.id)}></div>
			<div class="ruled flex h-[87%] flex-col justify-center px-[5%] font-serif leading-[1.05] italic" style:color={inkColor(tape.id)}>
				<div style:rotate="{(((tape.id * 7) % 5) - 2) * 0.5}deg">
					<p class="{subtitle ? 'line-clamp-1' : 'line-clamp-2'} text-[7.5cqw]">{tape.name}</p>
					{#if subtitle}<p class="truncate text-[5cqw] opacity-75">{subtitle}</p>{/if}
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
		background-size: 100% 30%;
	}
</style>
