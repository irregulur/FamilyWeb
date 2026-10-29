<script lang="ts">
	import { goto } from '$app/navigation';
	import { occasionBySlug } from '#lib/occasions.ts';
	import { formatTakenAt, stamp } from '#lib/format.ts';
	import EditDetails from '#lib/components/EditDetails.svelte';
	import People from '#lib/components/People.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const item = $derived(data.item);
	const occasion = $derived(occasionBySlug(item.occasion));
	const year = $derived(item.taken_at?.slice(0, 4));
	// Undated photos open with the date question already showing
	let editing = $state(false);
	const showEditor = $derived(editing || !item.taken_at);

	function onkeydown(e: KeyboardEvent) {
		if (e.target instanceof Element && e.target.closest('input, textarea, select')) return;
		if (e.key === 'ArrowLeft' && data.prev) goto(`/m/${data.prev}`);
		if (e.key === 'ArrowRight' && data.next) goto(`/m/${data.next}`);
	}
</script>

<svelte:window {onkeydown} />
<svelte:head><title>{item.title ?? formatTakenAt(item.taken_at)}</title></svelte:head>

<div class="flex items-center justify-between pt-8">
	<a href={year ? `/year/${year}` : '/undated'} class="text-sm text-muted hover:text-ink">← Back to {year ?? 'the mystery box'}</a>
	<div class="flex gap-2">
		<a href={data.prev ? `/m/${data.prev}` : undefined} class="btn-ghost h-9! w-9! px-0! {data.prev ? '' : 'pointer-events-none opacity-30'}" aria-label="Previous">←</a>
		<a href={data.next ? `/m/${data.next}` : undefined} class="btn-ghost h-9! w-9! px-0! {data.next ? '' : 'pointer-events-none opacity-30'}" aria-label="Next">→</a>
	</div>
</div>

<figure class="mt-5">
	<div class="relative overflow-hidden rounded-md bg-black shadow-soft">
		{#if item.kind === 'video'}
			<!-- svelte-ignore a11y_media_has_caption -->
			<video src="/files/{item.id}/video.mp4" poster="/files/{item.id}/large.webp" controls preload="metadata" class="max-h-[78vh] w-full"></video>
		{:else}
			<div class="relative mx-auto w-fit">
				<img src="/files/{item.id}/large.webp" alt={item.title ?? ''} class="max-h-[78vh] object-contain" />
				{#if item.taken_at}<span class="stamp right-4! bottom-3! text-sm!">{stamp(item.taken_at)}</span>{/if}
			</div>
		{/if}
	</div>
	<figcaption class="mt-6 grid gap-x-10 gap-y-4 md:grid-cols-[1fr_auto]">
		<div>
			<p class="eyebrow flex flex-wrap gap-x-2">
				<span>{formatTakenAt(item.taken_at)}</span>
				{#if occasion}<span>·</span><a href="/occasion/{occasion.slug}" class="hover:text-ink">{occasion.name}</a>{/if}
			</p>
			<h1 class="mt-2 text-4xl leading-tight md:text-5xl">{item.title ?? (item.kind === 'video' ? 'A home video' : 'A photograph')}</h1>
			{#if item.description}<p class="mt-3 max-w-2xl text-lg text-muted">{item.description}</p>{/if}
			<div class="mt-5">
				{#key item.id}<People people={data.people} media={[item.id]} />{/key}
			</div>
		</div>
		<div class="flex flex-col gap-1 text-sm text-muted md:items-end md:text-right">
			{#if item.uploader}<span>Added by {item.uploader}</span>{/if}
			{#if item.editor}<span>Details by {item.editor}</span>{/if}
			<div class="mt-3 flex flex-wrap gap-2 md:justify-end">
				{#if !showEditor}<button class="btn-ghost h-9!" onclick={() => (editing = true)}>✎ Edit details</button>{/if}
				<a href="/files/{item.id}/original" class="btn-ghost h-9!">Download</a>
				{#if data.canDelete}
					<form method="POST" action="?/delete" onsubmit={(e) => confirm("Delete this for everyone? This can't be undone.") || e.preventDefault()}>
						<button class="btn-ghost h-9! hover:border-red-700! hover:text-red-700">Delete</button>
					</form>
				{/if}
			</div>
		</div>
	</figcaption>
</figure>

{#if showEditor}
	<div class="mt-10">
		{#key item.id}
			<EditDetails {item} error={form?.message} onclose={() => (editing = false)} />
		{/key}
	</div>
{/if}
