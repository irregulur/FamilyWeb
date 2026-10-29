<script lang="ts">
	// "Who's in this?": names as chips. Tap a name to tag them, or write a new one.
	// With `media` or `chapter` it saves right away; without, it only fills `people` (the upload page sends them along).
	type Person = { id: number; name: string };
	let {
		people = $bindable([]),
		media,
		chapter,
		title = 'Who’s in this?'
	}: { people?: Person[]; media?: number[]; chapter?: number; title?: string } = $props();

	const saves = $derived(!!media?.length || chapter != null);
	let open = $state(false);
	let everyone = $state<Person[] | null>(null);
	let query = $state('');
	let problem = $state('');

	const q = $derived(query.trim().toLowerCase());
	const others = $derived((everyone ?? []).filter((p) => !people.some((t) => t.id === p.id) && p.name.toLowerCase().includes(q)));
	const exact = $derived((everyone ?? []).find((p) => p.name.toLowerCase() === q));
	const byName = (a: Person, b: Person) => a.name.localeCompare(b.name);

	async function post(url: string, body: object) {
		const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
		if (!r.ok) throw new Error(await r.text());
		return r.json();
	}
	const tags = (person: Person, remove = false) => saves && post('/api/people/tags', { person: person.id, media, chapter, remove });

	async function show() {
		open = !open;
		if (open) everyone ??= await fetch('/api/people').then((r) => r.json()).catch(() => []);
	}

	async function add(person: Person) {
		problem = '';
		try {
			await tags(person);
			if (!people.some((t) => t.id === person.id)) people = [...people, person].sort(byName);
			query = '';
		} catch {
			problem = 'That didn’t save. Try again?';
		}
	}

	async function addNew() {
		if (!q) return;
		if (exact) return add(exact);
		try {
			const person: Person = await post('/api/people', { name: query });
			everyone = [...(everyone ?? []), person].sort(byName);
			await add(person);
		} catch {
			problem = 'That didn’t save. Try again?';
		}
	}

	async function remove(person: Person) {
		problem = '';
		try {
			await tags(person, true);
			people = people.filter((t) => t.id !== person.id);
		} catch {
			problem = 'That didn’t save. Try again?';
		}
	}
</script>

<div>
	<div class="flex flex-wrap items-center gap-2">
		<span class="label mb-0! mr-1">{title}</span>
		{#each people as p (p.id)}
			<span class="inline-flex items-center rounded-full border border-line bg-surface text-sm">
				{#if saves}<a href="/people/{p.id}" class="py-1 pl-3 hover:underline">{p.name}</a>{:else}<span class="py-1 pl-3">{p.name}</span>{/if}
				<button type="button" class="px-2 py-1 text-muted hover:text-red-700" onclick={() => remove(p)} aria-label="Untag {p.name}">×</button>
			</span>
		{/each}
		<button type="button" class="rounded-full border border-dashed border-line px-3 py-1 text-sm text-muted hover:border-ink hover:text-ink" onclick={show}>
			{open ? 'Done' : people.length ? '+ Someone else' : '+ Tag someone'}
		</button>
	</div>

	{#if open}
		<div class="mt-3 rounded-lg border border-line bg-bg p-3">
			<input
				class="field"
				bind:value={query}
				placeholder="Find or add a name…"
				aria-label="Name"
				onkeydown={(e) => {
					if (e.key === 'Enter') {
						e.preventDefault();
						addNew();
					}
				}}
			/>
			<div class="mt-3 flex max-h-48 flex-wrap gap-2 overflow-y-auto">
				{#each others as p (p.id)}
					<button type="button" class="rounded-full bg-surface-2 px-3 py-1 text-sm hover:bg-ink hover:text-bg" onclick={() => add(p)}>{p.name}</button>
				{/each}
				{#if q && !exact}
					<button type="button" class="rounded-full border border-ink px-3 py-1 text-sm" onclick={addNew}>+ Add “{query.trim()}”</button>
				{:else if everyone && !everyone.length}
					<span class="text-sm text-muted">Nobody yet — write the first name above.</span>
				{/if}
			</div>
		</div>
	{/if}
	{#if problem}<p class="mt-2 text-sm text-red-700 dark:text-red-400">{problem}</p>{/if}
</div>
