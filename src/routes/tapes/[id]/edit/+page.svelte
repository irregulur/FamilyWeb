<script lang="ts">
	import { tick } from 'svelte';
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { page } from '$app/state';
	import Cassette from '#lib/components/Cassette.svelte';
	import DateFields from '#lib/components/DateFields.svelte';
	import { formatDuration, workText } from '#lib/format.ts';
	import { OCCASIONS } from '#lib/occasions.ts';
	import { formatTime, guessFromLine, parseTime, sceneThumb } from '#lib/tapes.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	type Row = { key: number; id: number | null; title: string; year: string; month: string; day: string; occasion: string; time: string; end: string };
	let nextKey = 0;
	const blank = (): Row => ({ key: nextKey++, id: null, title: '', year: '', month: '', day: '', occasion: '', time: '', end: '' });

	// Starting values for the form, taken once (saving reloads the page).
	const initial = (() => ({ ...data }))();
	let name = $state(initial.tape.name);
	let recording = $state(String(initial.tape.media_id ?? ''));
	let rows = $state<Row[]>(
		initial.chapters.length
			? initial.chapters.map((c) => {
					const [year = '', month = '', day = ''] = c.taken_at?.split('-') ?? [];
					return {
						key: nextKey++,
						id: c.id,
						title: c.title,
						year,
						month,
						day,
						occasion: c.occasion ?? '',
						time: c.start != null ? formatTime(c.start) : '',
						end: c.ends != null ? formatTime(c.ends) : ''
					};
				})
			: [blank()]
	);
	let saving = $state(false);

	// Scans: what's there now, or a preview of the file just picked
	let picked = $state<Record<string, string>>({});
	let removed = $state<Record<string, boolean>>({});
	const scanSlots = [
		{ side: 'sticker', title: 'Label on the cassette', v: initial.tape.sticker_scan },
		{ side: 'sleeve', title: 'The box or sleeve', v: initial.tape.sleeve_scan }
	] as const;

	const video = $derived(data.recordings.find((r) => String(r.id) === recording));
	let player = $state<HTMLVideoElement>();

	const bad = (time: string) => !!time.trim() && parseTime(time) == null;
	// Ends set by hand have to come after the start
	const backwards = (r: Row) => parseTime(r.end) != null && (parseTime(r.time) == null || parseTime(r.end)! <= parseTime(r.time)!);
	const badTime = (r: Row) => bad(r.time) || bad(r.end) || backwards(r);
	const chaptersJson = $derived(
		JSON.stringify(
			rows.map((r) => ({ id: r.id, title: r.title, year: r.year, month: r.month, day: r.day, occasion: r.occasion, start: parseTime(r.time), ends: parseTime(r.end) }))
		)
	);

	/** "Xmas '88" fills in the year and occasion, unless they're already set. */
	function readLine(r: Row) {
		const guess = guessFromLine(r.title);
		if (!r.year && guess.year) r.year = guess.year;
		if (!r.occasion && guess.occasion) r.occasion = guess.occasion;
	}

	async function addRow(after = rows.length - 1) {
		const row = blank();
		rows.splice(after + 1, 0, row);
		await tick();
		document.querySelector<HTMLInputElement>(`[data-row="${row.key}"] input`)?.focus();
	}

	function markNow(r: Row, field: 'time' | 'end' = 'time') {
		if (player) r[field] = formatTime(player.currentTime);
	}

	// Suggested scene starts: only for the recording the tape has now (not one just picked above)
	const cuts = $derived(recording === String(data.tape.media_id) && video?.status === 'ready' ? data.cuts : null);
	const used = (t: number) => rows.some((r) => Math.abs((parseTime(r.time) ?? -9) - t) < 2);

	// While the server looks for them, show how far it is, and the pictures once it's done
	let work = $derived(data.work);
	$effect(() => {
		if (!work || !data.tape.media_id) return;
		const timer = setInterval(async () => {
			const [row] = await fetch(`/api/status?ids=${data.tape.media_id}`).then((r) => r.json()).catch(() => [undefined]);
			if (row?.work) work = row.work;
			else if (row) invalidateAll();
		}, 4000);
		return () => clearInterval(timer);
	});

	/** Shows that moment in the player, paused, so ⏱ now on a line picks it. */
	function look(t: number) {
		if (!player) return;
		player.pause();
		player.currentTime = t;
		const box = player.getBoundingClientRect();
		if (box.top < 0 || box.bottom > innerHeight) player.scrollIntoView({ behavior: 'smooth', block: 'center' });
	}

	/** A new line starting at `t`, among the others in time order. */
	async function addAt(t: number) {
		const only = rows.length === 1 && !rows[0].title && !rows[0].time ? rows[0] : null;
		const row = only ?? blank();
		row.time = formatTime(t);
		if (!only) {
			const after = rows.findIndex((r) => (parseTime(r.time) ?? -1) > t);
			rows.splice(after < 0 ? rows.length : after, 0, row);
		}
		look(t);
		await tick();
		document.querySelector<HTMLInputElement>(`[data-row="${row.key}"] input`)?.focus();
	}

	function jump(r: Row) {
		const t = parseTime(r.time);
		if (player && t != null) {
			player.currentTime = t;
			player.play();
		}
	}
</script>

<svelte:head><title>Edit {data.tape.name}</title></svelte:head>

<div class="pt-6"><a href="/tapes/{data.tape.id}" class="text-sm text-muted hover:text-ink">← Back to the tape</a></div>

<p class="eyebrow mt-8">The tape shelf</p>
<h1 class="mt-3 text-4xl leading-[1.05] md:text-5xl">{page.url.searchParams.has('new') ? 'A new tape' : 'Edit tape'}</h1>
{#if page.url.searchParams.has('new')}
	<p class="mt-2 max-w-2xl text-muted">Start with the name and the label scans. The rest can be filled in any time — by anyone in the family.</p>
{/if}

<form
	method="POST"
	action="?/save"
	enctype="multipart/form-data"
	class="mt-8 space-y-8"
	onsubmit={(e) => (rows.some(badTime) ? e.preventDefault() : (saving = true))}
>
	<!-- Name, with the cassette updating as you type -->
	<section class="card grid items-center gap-6 md:grid-cols-[1fr_14rem]">
		<label class="block">
			<span class="label">Name</span>
			<input class="field font-serif text-2xl! italic" name="name" bind:value={name} maxlength="120" required />
			<span class="mt-1 block text-sm text-muted">What's on the spine or the sticker, e.g. “Tape 3 — Christmas ’88”.</span>
		</label>
		<div class="mx-auto w-56 -rotate-2">
			<Cassette tape={{ ...data.tape, name: name || ' ', sticker_scan: removed.sticker ? null : data.tape.sticker_scan }} />
		</div>
	</section>

	<!-- Scans -->
	<section class="card">
		<h2 class="text-3xl">The labels</h2>
		<p class="mt-1 text-sm text-muted">Scan or photograph them — the handwriting is part of the memory. Phone photos are fine.</p>
		<div class="mt-5 grid gap-6 sm:grid-cols-2">
			{#each scanSlots as slot (slot.side)}
				{@const src = picked[slot.side] ?? (slot.v && !removed[slot.side] ? `/tapes/${data.tape.id}/scan/${slot.side}?v=${slot.v}` : '')}
				<div>
					<span class="label">{slot.title}</span>
					<label
						class="relative flex h-52 cursor-pointer items-center justify-center overflow-hidden rounded-lg border-2 border-dashed border-line bg-surface text-center text-sm text-muted transition hover:border-gold"
					>
						{#if src}
							<img {src} alt="" class="h-full w-full object-contain" />
						{:else}
							<span>Choose a scan or photo<br /><span class="text-xs">JPG or PNG</span></span>
						{/if}
						<input
							type="file"
							name={slot.side}
							accept="image/jpeg,image/png,image/webp,image/tiff,image/bmp"
							class="sr-only"
							onchange={(e) => {
								const file = e.currentTarget.files?.[0];
								if (file) picked[slot.side] = URL.createObjectURL(file);
							}}
						/>
					</label>
					{#if slot.v && !picked[slot.side]}
						<label class="mt-2 flex items-center gap-2 text-sm text-muted">
							<input type="checkbox" name="remove_{slot.side}" bind:checked={removed[slot.side]} /> Remove this scan
						</label>
					{/if}
				</div>
			{/each}
		</div>
	</section>

	<!-- Recording -->
	<section class="card">
		<h2 class="text-3xl">The recording</h2>
		<label class="mt-4 block max-w-xl">
			<span class="label">Which video is this tape?</span>
			<select class="field" name="recording" bind:value={recording}>
				<option value="">Not digitized yet</option>
				{#each data.recordings as r (r.id)}
					<option value={String(r.id)}>
						{r.original_name}{r.duration ? ` (${formatDuration(r.duration)})` : ''}, added {new Date(r.created_at + 'Z').toLocaleDateString()}{r.status === 'processing' ? ' — still shrinking' : ''}
					</option>
				{/each}
			</select>
			<span class="mt-1 block text-sm text-muted">
				Upload the recorded tape on <a href="/upload" class="underline">Add memories</a> first, then pick it here. It moves from the
				photo pages onto this tape.
			</span>
		</label>
	</section>

	<!-- Scenes -->
	<section class="card">
		<h2 class="text-3xl">What's on it</h2>
		<p class="mt-1 max-w-2xl text-sm text-muted">
			One line per thing written on the label — “Xmas ’88 at Nana’s” fills in the year and occasion by itself.
			{#if video?.status === 'ready'}Then play the tape and press <b>⏱</b> when each scene starts.{/if}
		</p>

		<div class="mt-5 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
			{#if video?.status === 'ready'}
				<!-- svelte-ignore a11y_media_has_caption -->
				<video
					bind:this={player}
					src="/files/{video.id}/video.mp4?v={video.processed_at ?? 0}"
					controls
					preload="metadata"
					class="aspect-[4/3] w-full rounded bg-black shadow-lg lg:sticky lg:top-4 lg:order-last"
				></video>
			{/if}

			<div>
				<ol class="space-y-3">
					{#each rows as r, i (r.key)}
						<li data-row={r.key} id={r.id ? `scene-${r.id}` : undefined} class="scroll-mt-24 target:ring-2 target:ring-gold space-y-2 rounded-lg border border-line bg-bg p-3">
							<div class="flex gap-2">
								<input
									class="field font-serif text-xl! leading-none italic"
									bind:value={r.title}
									onchange={() => readLine(r)}
									onkeydown={(e) => {
										if (e.key === 'Enter') {
											e.preventDefault();
											readLine(r);
											addRow(i);
										}
									}}
									placeholder={i ? 'Next line…' : 'e.g. Xmas ’88 at Nana’s'}
									aria-label="Scene {i + 1}"
								/>
								<button type="button" class="px-2 text-xl text-muted hover:text-red-700" onclick={() => rows.splice(i, 1)} aria-label="Remove line {i + 1}">×</button>
							</div>
							<div class="flex flex-wrap items-center gap-2">
								<div class="w-72 max-w-full"><DateFields bind:year={r.year} bind:month={r.month} bind:day={r.day} /></div>
								<select class="field w-36!" bind:value={r.occasion} aria-label="Occasion">
									<option value="">Occasion…</option>
									{#each OCCASIONS as o (o.slug)}<option value={o.slug}>{o.name}</option>{/each}
								</select>
								<span class="flex items-center gap-2">
									<input class="field w-22! font-mono text-sm {bad(r.time) ? 'border-red-700!' : ''}" bind:value={r.time} placeholder="0:00:00" aria-label="Starts at" title="Where it starts on the tape" />
									{#if player}
										<button type="button" class="rounded-full border border-line bg-surface px-3 py-1.5 text-sm whitespace-nowrap hover:border-ink" onclick={() => markNow(r)} title="Starts where the video is now">⏱ now</button>
										{#if parseTime(r.time) != null}
											<button type="button" class="rounded-full px-2 py-1.5 text-sm text-muted hover:bg-surface-2" onclick={() => jump(r)} title="Play from here">▶</button>
										{/if}
									{/if}
								</span>
								{#if parseTime(r.time) != null || r.end}
									<span class="flex items-center gap-2 text-sm text-muted">
										until
										<input
											class="field w-26! font-mono text-sm {bad(r.end) || backwards(r) ? 'border-red-700!' : ''}"
											bind:value={r.end}
											placeholder="next scene"
											aria-label="Ends at"
											title="Where it stops. Leave empty to run until the next scene starts."
										/>
										{#if player}
											<button type="button" class="rounded-full border border-line bg-surface px-3 py-1.5 text-sm whitespace-nowrap hover:border-ink" onclick={() => markNow(r, 'end')} title="Ends where the video is now">⏱ now</button>
										{/if}
									</span>
								{/if}
								{#if bad(r.time) || bad(r.end)}<span class="text-sm text-red-700 dark:text-red-400">Write the time like 1:05:30</span>
								{:else if backwards(r)}<span class="text-sm text-red-700 dark:text-red-400">The end has to come after the start</span>{/if}
							</div>
						</li>
					{/each}
				</ol>
				<button type="button" class="link mt-3 text-sm" onclick={() => addRow()}>+ Add a line</button>
			</div>
		</div>
		{#if video?.status === 'ready' && recording === String(data.tape.media_id)}
			<div class="mt-8 border-t border-line pt-6">
				<h3 class="text-2xl">Where the camera stopped and started</h3>
				{#if work}
					<p class="mt-1 text-sm text-accent">{workText(work)}…</p>
				{:else if cuts}
					<p class="mt-1 max-w-2xl text-sm text-muted">
						{cuts.length} places where the picture changes completely — usually where a new scene starts. Click a picture to see it in the
						player, then press <b>⏱ now</b> on the line it belongs to, or <b>+ New</b> to start a new line there.
					</p>
					<ol class="mt-4 grid grid-cols-3 gap-x-2 gap-y-3 sm:grid-cols-4 md:grid-cols-6 xl:grid-cols-8">
						{#each cuts as t (t)}
							<li class={used(t) ? 'opacity-50' : ''}>
								<button type="button" class="tile block aspect-[4/3] w-full" onclick={() => look(t)} title="Show in the player">
									<img src={sceneThumb({ tape_id: data.tape.id, start: t, media_id: data.tape.media_id, version: data.tape.version })} alt="" loading="lazy" />
								</button>
								<div class="mt-1 flex items-center justify-between font-mono text-xs text-muted">
									{formatTime(t)}
									{#if used(t)}<span title="A line starts here">✓</span>{:else}<button type="button" class="hover:text-ink" onclick={() => addAt(t)}>+ New</button>{/if}
								</div>
							</li>
						{/each}
					</ol>
				{:else}
					<p class="mt-1 max-w-2xl text-sm text-muted">
						The site can look through the recording for the places where the picture changes completely, and show them here as pictures to
						pick scene starts from. A two-hour tape takes several minutes.
					</p>
					<button form="find-scenes" class="btn-ghost mt-3">Find the scenes</button>
					{#if form && 'sceneMessage' in form}<p class="mt-2 text-sm text-red-700 dark:text-red-400">{form.sceneMessage}</p>{/if}
				{/if}
			</div>
		{/if}
		<input type="hidden" name="chapters" value={chaptersJson} />
	</section>

	{#if form?.message}<p class="notice">{form.message}</p>{/if}

	<div class="flex items-center gap-4">
		<button class="btn" disabled={saving}>{saving ? 'Saving…' : 'Save tape'}</button>
		<a href="/tapes/{data.tape.id}" class="text-sm text-muted hover:text-ink">Cancel</a>
	</div>
</form>

<form id="find-scenes" method="POST" action="?/findScenes" use:enhance class="hidden"></form>

{#if data.canDelete}
	<form
		method="POST"
		action="?/delete"
		class="mt-16 border-t border-line pt-6 text-sm text-muted"
		onsubmit={(e) => confirm('Delete this tape, its scans and its recording for everyone? This can’t be undone.') || e.preventDefault()}
	>
		<button class="hover:text-red-700">Delete this tape</button>
	</form>
{/if}

