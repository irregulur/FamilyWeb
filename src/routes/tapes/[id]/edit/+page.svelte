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
		stopAt = null;
		player.currentTime = t;
		const box = player.getBoundingClientRect();
		if (box.top < 0 || box.bottom > innerHeight) player.scrollIntoView({ behavior: 'smooth', block: 'center' });
	}

	/** Plays from `from` and pauses at `to`. */
	function play(from: number, to: number | null) {
		look(from);
		stopAt = to;
		player?.play();
	}
	let stopAt: number | null = null;
	let now = $state(0);
	function ontimeupdate() {
		if (player && stopAt != null && player.currentTime >= stopAt) {
			player.pause();
			stopAt = null;
		}
	}

	function jump(r: Row) {
		const t = parseTime(r.time);
		if (t != null) play(t, endOf(r));
	}

	// ── The recording in stretches between camera stops, to turn into scenes one after another ──
	// Only for the recording the tape has now (not one just picked above).
	const reviewing = $derived(recording === String(data.tape.media_id) && video?.status === 'ready' && !!data.cuts && !!data.tape.duration);
	let added = $state<number[]>([]); // cuts put in by hand, where the camera stopped but nothing was found
	let joined = $state<number[]>([]); // cuts taken out with "Join with next"
	let skipped = $state<number[]>([...initial.skipped]);
	let drafts = $state<Record<number, string>>({});
	const allCuts = $derived([...new Set([...(data.cuts ?? []), ...added])].sort((a, b) => a - b));
	const near = (a: number, b: number) => Math.abs(a - b) < 1.5;

	type Stretch = { from: number; to: number; parts: number };
	const stretches = $derived.by(() => {
		const end = data.tape.duration ?? 0;
		const cuts = allCuts.filter((t) => t < end - 1);
		const out: Stretch[] = [];
		cuts.forEach((t, i) => {
			const to = cuts[i + 1] ?? end;
			const last = out.at(-1);
			if (last && joined.some((j) => near(j, t))) {
				last.to = to;
				last.parts++;
			} else out.push({ from: t, to, parts: 1 });
		});
		return out;
	});

	/** Where a line's scene stops: its end, or else the next start, or the tape's end. */
	function endOf(r: Row) {
		const start = parseTime(r.time);
		if (start == null) return null;
		const next = rows.map((o) => parseTime(o.time)).filter((t): t is number => t != null && t > start);
		return parseTime(r.end) ?? (next.length ? Math.min(...next) : (data.tape.duration ?? null));
	}
	/** The line that already covers most of a stretch. */
	const lineFor = (s: Stretch) =>
		rows.find((r) => {
			const from = parseTime(r.time);
			const to = endOf(r);
			return from != null && to != null && Math.min(to, s.to) - Math.max(from, s.from) >= (s.to - s.from) / 2;
		});

	type Item = { kind: 'todo' | 'skipped'; s: Stretch } | { kind: 'saved'; s: Stretch; row: Row };
	const items = $derived.by(() => {
		const out: Item[] = [];
		for (const s of stretches) {
			const row = lineFor(s);
			const last = out.at(-1);
			if (row && last?.kind === 'saved' && last.row === row) last.s = { ...last.s, to: s.to, parts: last.s.parts + s.parts };
			else if (row) out.push({ kind: 'saved', s, row });
			else out.push({ kind: skipped.some((t) => near(t, s.from)) ? 'skipped' : 'todo', s });
		}
		return out;
	});
	const todo = $derived(items.filter((i) => i.kind === 'todo').length);

	/** Saves a stretch as a scene: onto the label line with that name if there is one, else a new line in time order. */
	async function keep(s: Stretch) {
		const title = (drafts[s.from] ?? '').trim();
		const same = title && rows.find((r) => parseTime(r.time) == null && r.title.trim().toLowerCase() === title.toLowerCase());
		const empty = rows.find((r) => !r.title.trim() && !r.time.trim());
		const row = same || empty || blank();
		if (!same) row.title = title || `Scene at ${formatTime(s.from)}`;
		row.time = formatTime(Math.ceil(s.from));
		row.end = formatTime(s.to);
		if (!same && !empty) {
			// Usually filmed the same day as the scene before it
			const before = rows.filter((r) => (parseTime(r.time) ?? Infinity) < s.from).at(-1);
			if (before) [row.year, row.month, row.day] = [before.year, before.month, before.day];
			const after = rows.findIndex((r) => (parseTime(r.time) ?? -1) > s.from);
			rows.splice(after < 0 ? rows.length : after, 0, row);
		}
		readLine(rows.find((r) => r.key === row.key)!);
		// Scenes in the order they're on the tape; label lines not found yet stay after them
		rows.sort((a, b) => (parseTime(a.time) ?? 1e9) - (parseTime(b.time) ?? 1e9));
		delete drafts[s.from];
		// On to the next one
		await tick();
		const next = items.find((i) => i.kind === 'todo' && i.s.from > s.from);
		document.querySelector<HTMLInputElement>(`[data-stretch="${next?.s.from}"] input`)?.focus({ preventScroll: true });
		document.querySelector(`[data-stretch="${next?.s.from}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
	}

	const joinNext = (s: Stretch) => joined.push(s.to);
	const unjoin = (s: Stretch) => (joined = joined.filter((j) => j <= s.from || j >= s.to));
	const skip = (s: Stretch) => skipped.push(s.from);
	const unskip = (s: Stretch) => (skipped = skipped.filter((t) => !near(t, s.from)));
	/** The scene before goes on to the end of this stretch too. */
	const addTo = (row: Row, s: Stretch) => (row.end = formatTime(s.to));
	/** A camera stop that wasn't found: split the stretch where the player is. */
	const splitHere = () => added.push(Math.round(now * 10) / 10);
	const canSplit = (s: Stretch) => now > s.from + 1 && now < s.to - 1;
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
			{#if video?.status === 'ready'}Then go through the tape below, or play it and press <b>⏱</b> where a scene starts and ends.{/if}
		</p>

		<div class="mt-5 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
			{#if video?.status === 'ready'}
				<!-- svelte-ignore a11y_media_has_caption -->
				<video
					bind:this={player}
					bind:currentTime={now}
					{ontimeupdate}
					src="/files/{video.id}/video.mp4?v={video.processed_at ?? 0}"
					controls
					preload="metadata"
					class="aspect-[4/3] w-full rounded bg-black shadow-lg lg:sticky lg:top-24 lg:order-last"
				></video>
			{/if}

			<div>
				{#if video?.status === 'ready' && recording === String(data.tape.media_id)}
					<div class="mb-8 border-b border-line pb-6">
						<h3 class="text-2xl">Go through the tape</h3>
						{#if work}
							<p class="mt-1 text-sm text-accent">{workText(work)}…</p>
						{:else if reviewing}
							<p class="mt-1 text-sm text-muted">
								The tape in stretches, cut where the camera was stopped. For each: <b>▶</b> to watch it, then <b>Keep</b> it as a scene (give it a
								name, or pick a line from the label), <b>Join</b> it with the next stretch when it's still the same memory, or <b>Skip</b> it.
								Nothing is saved until you press <b>Save tape</b>.
							</p>
							<p class="mono mt-3 text-sm">{todo ? `${todo} of ${items.length} still to look at` : 'All looked at ✓'}</p>
							<datalist id="label-lines">
								{#each rows.filter((r) => r.title.trim() && parseTime(r.time) == null) as r (r.key)}<option value={r.title}></option>{/each}
							</datalist>
							<ol class="mt-3 space-y-2">
								{#each items as item, i (item.s.from)}
									{@const st = item.s}
									{@const next = items[i + 1]}
									<li data-stretch={st.from}>
										{#if item.kind === 'saved'}
											<div class="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-surface-2/60 px-3 py-2 text-sm">
												<span class="text-accent">✓</span>
												<span class="min-w-0 flex-1 truncate font-serif text-base italic">{item.row.title || 'Untitled scene'}</span>
												<span class="font-mono text-xs text-muted">{formatTime(st.from)}–{formatTime(st.to)}</span>
												<button type="button" class="text-muted hover:text-ink" onclick={() => play(st.from, st.to)} title="Watch it">▶</button>
												{#if next?.kind === 'todo'}
													<button type="button" class="link text-xs" onclick={() => addTo(item.row, next.s)} title="The next stretch is still this memory">+ the next stretch too</button>
												{/if}
											</div>
										{:else if item.kind === 'skipped'}
											<div class="flex items-center gap-3 px-3 py-1 text-xs text-muted">
												<span class="font-mono">{formatTime(st.from)}–{formatTime(st.to)}</span> skipped
												<button type="button" class="link" onclick={() => unskip(st)}>undo</button>
											</div>
										{:else}
											<div class="rounded-lg border border-line bg-bg p-3">
												<div class="flex items-center gap-3">
													<button type="button" class="tile aspect-[4/3] w-24 shrink-0" onclick={() => play(st.from, st.to)} title="Watch this stretch">
														<img src={sceneThumb({ tape_id: data.tape.id, start: Math.ceil(st.from), media_id: data.tape.media_id, version: data.tape.version })} alt="" loading="lazy" />
														<span class="absolute inset-0 grid place-items-center text-2xl text-white drop-shadow">▶</span>
													</button>
													{#if st.to - st.from > 4}
														<button type="button" class="tile hidden aspect-[4/3] w-16 shrink-0 opacity-80 sm:block" onclick={() => look(st.to - 1)} title="How it ends">
															<img src={sceneThumb({ tape_id: data.tape.id, start: Math.floor(st.to - 1), media_id: data.tape.media_id, version: data.tape.version })} alt="" loading="lazy" />
														</button>
													{/if}
													<div class="min-w-0 flex-1">
														<p class="font-mono text-sm">{formatTime(st.from)} – {formatTime(st.to)}</p>
														<p class="text-xs text-muted">
															{formatDuration(st.to - st.from)}{#if st.parts > 1} · {st.parts} stretches joined <button type="button" class="link" onclick={() => unjoin(st)}>split again</button>{/if}
														</p>
														{#if canSplit(st)}
															<button type="button" class="link mt-1 text-xs" onclick={splitHere} title="The camera stopped here but it wasn't found">✂ Cut at {formatTime(now)}</button>
														{/if}
													</div>
												</div>
												<div class="mt-2 flex flex-wrap items-center gap-2">
													<input
														class="field min-w-40 flex-1 text-sm!"
														bind:value={drafts[st.from]}
														list="label-lines"
														placeholder="What is it? e.g. Easter egg hunt"
														aria-label="Name for {formatTime(st.from)}"
														onkeydown={(e) => {
															if (e.key === 'Enter') {
																e.preventDefault();
																keep(st);
															}
														}}
													/>
													<button type="button" class="btn h-9! px-4! text-sm!" onclick={() => keep(st)}>✓ Keep</button>
													{#if next}
														<button type="button" class="btn-ghost h-9! px-3! text-sm!" onclick={() => joinNext(st)} title="The next stretch is still the same memory">⤓ Join with next</button>
													{/if}
													<button type="button" class="h-9 px-2 text-sm text-muted hover:text-red-700" onclick={() => skip(st)} title="Not worth keeping (blank, a mistake…)">✗ Skip</button>
												</div>
											</div>
										{/if}
									</li>
								{/each}
							</ol>
							<p class="mt-4 text-sm text-muted">
								Stretches look wrong? <button form="find-scenes" class="link">Look through the tape again</button>
							</p>
						{:else}
							<p class="mt-1 text-sm text-muted">
								The site can look through the recording for where the camera was stopped and started, and cut it into stretches you can keep as
								scenes one after another. A two-hour tape takes several minutes.
							</p>
							<button form="find-scenes" class="btn-ghost mt-3">Find the scenes</button>
						{/if}
						{#if form && 'sceneMessage' in form}<p class="mt-2 text-sm text-red-700 dark:text-red-400">{form.sceneMessage}</p>{/if}
					</div>
				{/if}
				{#if reviewing}<h3 class="mb-3 text-2xl">The scenes</h3>{/if}
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
											placeholder="end"
											aria-label="Ends at"
											title="Where it stops. Left empty, it ends where the next scene starts."
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
		<input type="hidden" name="chapters" value={chaptersJson} />
		{#if reviewing}
			<input type="hidden" name="cuts" value={JSON.stringify(allCuts)} />
			<input type="hidden" name="skipped" value={JSON.stringify(skipped)} />
		{/if}
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

