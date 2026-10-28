<script lang="ts">
	import { ACCEPT, kindOf } from '#lib/filetypes.ts';
	import { OCCASIONS, guessOccasion } from '#lib/occasions.ts';
	import { count } from '#lib/format.ts';
	import { takenAtFrom } from '#lib/dates.ts';
	import DateFields from '#lib/components/DateFields.svelte';

	type Item = {
		key: number;
		file: File;
		kind: 'photo' | 'video';
		preview: string | null;
		token: string;
		progress: number; // 0–1
		state: 'waiting' | 'uploading' | 'processing' | 'ready' | 'failed';
		error?: string;
		id?: number;
	};

	const CHUNK = 32 * 1024 * 1024; // stays well under Cloudflare's 100 MB request limit

	let items = $state<Item[]>([]);
	let year = $state('');
	let month = $state('');
	let day = $state('');
	let occasion = $state('');
	let title = $state('');
	let useFileDate = $state(false);
	let dragging = $state(false);
	let busy = $state(false);
	let picker: HTMLInputElement;
	let nextKey = 0;

	const takenAt = $derived(takenAtFrom(year, month, day));
	const waiting = $derived(items.filter((i) => i.state === 'waiting' || i.state === 'failed'));
	const done = $derived(items.filter((i) => i.state === 'ready'));

	// randomUUID needs https; this also works on plain http at home.
	const newToken = () =>
		Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('');

	function add(files: Iterable<File>) {
		for (const file of files) {
			const kind = kindOf(file.name);
			if (!kind || !file.size) continue;
			items.push({
				key: nextKey++,
				file,
				kind,
				preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : null,
				token: newToken(),
				progress: 0,
				state: 'waiting'
			});
		}
	}

	function remove(item: Item) {
		if (item.preview) URL.revokeObjectURL(item.preview);
		items = items.filter((i) => i !== item);
	}

	function suggestOccasion() {
		if (!occasion && takenAt.length === 10) occasion = guessOccasion(takenAt) ?? '';
	}

	/** One chunk via XHR (fetch can't report upload progress). Resolves with any HTTP status, rejects on network failure. */
	function putChunk(url: string, blob: Blob, onprogress: (loaded: number) => void) {
		return new Promise<{ status: number; data: { received?: number; message?: string } }>((resolve, reject) => {
			const xhr = new XMLHttpRequest();
			xhr.open('PUT', url);
			xhr.setRequestHeader('content-type', 'application/octet-stream');
			xhr.upload.onprogress = (e) => onprogress(e.loaded);
			xhr.onload = () => {
				let data = {};
				try {
					data = JSON.parse(xhr.responseText);
				} catch {}
				resolve({ status: xhr.status, data });
			};
			xhr.onerror = () => reject(new Error('network'));
			xhr.send(blob);
		});
	}

	async function uploadOne(item: Item) {
		if (item.id) {
			// It uploaded but couldn't be converted: send it again as a new upload.
			item.token = newToken();
			item.id = undefined;
		}
		item.state = 'uploading';
		item.error = undefined;
		const { file, token } = item;
		const base = `/api/upload/${token}`;
		let offset = 0;
		let failures = 0;

		try {
			while (offset < file.size) {
				const url = `${base}?offset=${offset}&name=${encodeURIComponent(file.name)}`;
				const r = await putChunk(url, file.slice(offset, offset + CHUNK), (loaded) => {
					item.progress = (offset + loaded) / file.size;
				}).catch(() => null);

				if (r && (r.status === 200 || r.status === 409)) {
					offset = r.data.received ?? 0; // 409 = resume from where the server actually is
					failures = 0;
				} else if (r && r.status < 500) {
					throw new Error(r.status === 401 ? 'You were logged out — log in and try again.' : (r.data.message ?? `Upload refused (${r.status})`));
				} else if (++failures > 6) {
					throw new Error('The connection keeps dropping. Press "Try again" later — it will continue where it stopped.');
				} else {
					await new Promise((ok) => setTimeout(ok, 2000 * failures));
				}
			}

			const res = await fetch(base, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ name: file.name, size: file.size, taken_at: takenAt, occasion, title, useFileDate })
			});
			if (!res.ok) throw new Error((await res.json().catch(() => null))?.message ?? 'Upload failed');
			item.id = (await res.json()).id;
			item.progress = 1;
			item.state = 'processing';
		} catch (e) {
			item.state = 'failed';
			item.error = (e as Error).message;
		}
	}

	async function start() {
		busy = true;
		for (const item of items) {
			if (item.state === 'waiting' || item.state === 'failed') await uploadOne(item);
		}
		busy = false;
	}

	// While anything is being converted, check every few seconds whether it's ready.
	$effect(() => {
		const pending = items.filter((i) => i.state === 'processing').map((i) => i.id);
		if (!pending.length) return;
		const timer = setInterval(async () => {
			const rows: { id: number; status: string }[] = await fetch(`/api/status?ids=${pending}`).then((r) => r.json()).catch(() => []);
			for (const row of rows) {
				const item = items.find((i) => i.id === row.id);
				if (!item || row.status === 'processing') continue;
				item.state = row.status === 'ready' ? 'ready' : 'failed';
				if (row.status === 'failed') item.error = "Couldn't read this file — is it damaged?";
			}
		}, 3000);
		return () => clearInterval(timer);
	});

	function onbeforeunload(e: BeforeUnloadEvent) {
		if (busy) e.preventDefault();
	}

	const LABEL: Record<Item['state'], string> = {
		waiting: 'Ready to upload',
		uploading: 'Uploading…',
		processing: 'Preparing…',
		ready: 'Added ✓',
		failed: 'Failed'
	};

	const size = (b: number) =>
		b >= 1e9 ? `${(b / 1e9).toFixed(1)} GB` : b >= 1e6 ? `${Math.round(b / 1e6)} MB` : `${Math.max(1, Math.round(b / 1e3))} KB`;
</script>

<svelte:window
	{onbeforeunload}
	ondragover={(e) => {
		e.preventDefault();
		dragging = true;
	}}
	ondragleave={(e) => {
		if (!e.relatedTarget) dragging = false;
	}}
	ondrop={(e) => {
		e.preventDefault();
		dragging = false;
		if (e.dataTransfer) add(e.dataTransfer.files);
	}}
/>
<svelte:head><title>Add memories</title></svelte:head>

<section class="pt-10 pb-10 text-center">
	<p class="eyebrow">Photos, scans & home videos</p>
	<h1 class="mt-3 text-5xl leading-[1.05] md:text-6xl">Add memories</h1>
</section>

<!-- Phone order: pick files, set details, watch progress. Desktop: details in a side column. -->
<div class="grid gap-x-10 gap-y-8 lg:grid-cols-[1fr_22rem] lg:grid-rows-[auto_1fr]">
	<div>
		<button
			type="button"
			onclick={() => picker.click()}
			class="flex w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-14 text-center transition
				{dragging ? 'border-gold bg-gold/10' : 'border-line bg-surface hover:border-gold'}"
		>
			<svg viewBox="0 0 24 24" class="h-10 w-10 text-gold" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
				<rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="9" cy="10" r="2" /><path d="m21 16-5-5-8 8" />
			</svg>
			<p class="mt-3 font-serif text-3xl">Drop photos and videos here</p>
			<p class="mt-1 text-sm text-muted">or tap to choose them · big videos are fine</p>
		</button>
		<input bind:this={picker} type="file" multiple accept={ACCEPT} class="hidden" onchange={(e) => { add(e.currentTarget.files ?? []); e.currentTarget.value = ''; }} />
	</div>

	<!-- Files -->
	<div class="order-last lg:order-none lg:col-start-1 lg:row-start-2">
		{#if items.length}
			<div class="flex items-baseline justify-between">
				<h2 class="text-3xl">
					{count(items.filter((i) => i.kind === 'photo').length, 'photo')}
					{items.some((i) => i.kind === 'photo') && items.some((i) => i.kind === 'video') ? '·' : ''}
					{count(items.filter((i) => i.kind === 'video').length, 'video')}
				</h2>
				{#if done.length && !busy}
					<button class="text-sm text-muted hover:text-ink" onclick={() => done.forEach(remove)}>Clear finished</button>
				{/if}
			</div>

			<ul class="mt-4 grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4">
				{#each items as item (item.key)}
					<li class="relative">
						<div class="relative flex aspect-square items-center justify-center overflow-hidden rounded-[3px] bg-surface-2">
							{#if item.preview}
								<img src={item.preview} alt="" class="h-full w-full object-cover" onerror={() => (item.preview = null)} />
							{:else}
								<span class="text-4xl text-muted">{item.kind === 'video' ? '🎞' : '🖼'}</span>
							{/if}
							{#if item.state === 'ready'}
								<a href="/m/{item.id}" class="absolute inset-0 flex items-center justify-center bg-black/30 text-sm font-medium text-white opacity-0 transition hover:opacity-100">View</a>
							{/if}
						</div>
						<p class="mt-2 truncate text-xs" title={item.file.name}>{item.file.name}</p>
						<div class="mt-1 h-1 overflow-hidden rounded-full bg-surface-2">
							<div
								class="h-full rounded-full transition-all {item.state === 'failed' ? 'bg-red-700' : item.state === 'ready' ? 'bg-pine' : 'bg-gold'}
									{item.state === 'processing' ? 'animate-pulse' : ''}"
								style:width="{item.progress * 100}%"
							></div>
						</div>
						<p class="mt-1 text-xs {item.state === 'failed' ? 'text-red-700 dark:text-red-400' : 'text-muted'}">
							{LABEL[item.state]}{item.state === 'uploading' ? ` ${Math.floor(item.progress * 100)}%` : ''}
							{#if item.state === 'waiting'}· {size(item.file.size)}{/if}
						</p>
						{#if item.error}<p class="mt-1 text-xs text-red-700 dark:text-red-400">{item.error}</p>{/if}
						{#if item.state === 'waiting' || (item.state === 'failed' && !busy)}
							<button class="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-ink text-xs text-bg shadow" aria-label="Remove" onclick={() => remove(item)}>✕</button>
						{/if}
					</li>
				{/each}
			</ul>
		{/if}
	</div>

	<!-- Details for this batch -->
	<aside class="card h-fit lg:sticky lg:top-24 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-start">
		<fieldset disabled={busy} class="space-y-5">
		<div>
			<h2 class="text-3xl">When are these from?</h2>
			<p class="mt-1 text-sm text-muted">Just the year is fine. Not sure? Leave it empty and they'll go in the mystery box.</p>
		</div>

		<DateFields bind:year bind:month bind:day onchange={suggestOccasion} />

		<label class="flex items-start gap-2 text-sm text-muted">
			<input type="checkbox" bind:checked={useFileDate} disabled={!!takenAt} class="mt-1 accent-[var(--accent)]" />
			<span>If I leave the date empty, use the date the camera saved in each file. <em>Good for phone photos — not for scans, which carry the scan date.</em></span>
		</label>

		<label class="block">
			<span class="label">Occasion</span>
			<select class="field" bind:value={occasion}>
				<option value="">— none —</option>
				{#each OCCASIONS as o (o.slug)}<option value={o.slug}>{o.name}</option>{/each}
			</select>
		</label>

		<label class="block">
			<span class="label">Title <span class="font-normal">(optional)</span></span>
			<input class="field" bind:value={title} maxlength="200" placeholder="e.g. Sarah's 5th birthday" />
		</label>

		</fieldset>

		<p class="mt-5 text-xs text-muted">These details go on everything in this batch. Different events? Upload them separately.</p>

		<button class="btn mt-4 w-full" disabled={busy || !waiting.length} onclick={start}>
			{busy ? 'Uploading… keep this page open' : waiting.length ? `Upload ${count(waiting.length, 'memory', 'memories')}` : items.length ? 'All sent ✓' : 'Choose some files first'}
		</button>
	</aside>
</div>
