<script lang="ts">
	import { enhance } from '$app/forms';
	import { count, dots } from '#lib/format.ts';
	import MediaGrid from '#lib/components/MediaGrid.svelte';
	import SceneGrid from '#lib/components/SceneGrid.svelte';
	import { page } from '$app/state';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const isOwner = $derived(!!page.data.user?.is_admin);
</script>

<svelte:head><title>{data.person.name}</title></svelte:head>

<div class="pt-8"><a href="/people" class="text-sm text-muted hover:text-ink">← People</a></div>

<section class="pt-6 pb-10">
	<p class="eyebrow">Memories with</p>
	<h1 class="mt-3 text-5xl leading-[1.05] md:text-6xl">{data.person.name}</h1>
	<p class="mt-4 text-muted">
		{dots(count(data.items.length, 'photo or video', 'photos and videos'), count(data.scenes.length, 'scene on tape', 'scenes on tape')) ||
			'Not tagged in anything yet.'}
	</p>
</section>

{#if data.scenes.length}
	<section class="border-t border-line py-8">
		<p class="eyebrow mb-1.5">On tape</p>
		<h2 class="mb-6 text-3xl">Home movies</h2>
		<SceneGrid scenes={data.scenes} />
	</section>
{/if}

{#if data.items.length}
	<section class="border-t border-line py-8">
		<p class="eyebrow mb-1.5">Photos & videos</p>
		<h2 class="mb-6 text-3xl">Through the years</h2>
		<MediaGrid items={data.items} />
	</section>
{/if}

{#if isOwner}
	<details class="mt-16 border-t border-line pt-6 text-sm">
		<summary class="cursor-pointer text-muted hover:text-ink">Rename, merge or remove {data.person.name}</summary>
		<div class="mt-5 grid max-w-3xl gap-6 md:grid-cols-2">
			<form method="POST" action="?/rename" use:enhance class="space-y-2">
				<label class="block">
					<span class="label">Name</span>
					<input class="field" name="name" value={data.person.name} maxlength="80" required />
				</label>
				<button class="btn-ghost h-9!">Rename</button>
			</form>
			{#if data.others.length}
				<form method="POST" action="?/merge" class="space-y-2" onsubmit={(e) => confirm(`Move everything ${data.person.name} is tagged in to the person you picked, and remove ${data.person.name}?`) || e.preventDefault()}>
					<label class="block">
						<span class="label">Same person as…</span>
						<select class="field" name="into" required>
							<option value="">Pick someone</option>
							{#each data.others as p (p.id)}<option value={p.id}>{p.name}</option>{/each}
						</select>
					</label>
					<button class="btn-ghost h-9!">Merge</button>
				</form>
			{/if}
		</div>
		{#if form?.message}<p class="notice mt-4">{form.message}</p>{/if}
		<form method="POST" action="?/delete" class="mt-6" onsubmit={(e) => confirm(`Remove ${data.person.name}? Their photos stay, just without the tag.`) || e.preventDefault()}>
			<button class="text-muted hover:text-red-700">Remove {data.person.name} from the site</button>
		</form>
	</details>
{/if}
