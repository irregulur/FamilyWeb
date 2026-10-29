<script lang="ts">
	import { count } from '#lib/format.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const initials = (name: string) =>
		name
			.split(' ')
			.map((w) => w[0])
			.slice(0, 2)
			.join('')
			.toUpperCase();
</script>

<svelte:head><title>People</title></svelte:head>

<section class="pt-12 pb-10 md:pt-16">
	<p class="eyebrow">Who's who</p>
	<h1 class="mt-3 text-5xl leading-[1.05] md:text-6xl">People</h1>
	<p class="mt-4 max-w-2xl text-muted">
		Everyone someone has tagged in a photo, video or scene on tape. To tag someone, open a photo or scene and tap <b>+ Tag someone</b>.
	</p>
</section>

{#if data.people.length}
	<ul class="grid grid-cols-2 gap-x-4 gap-y-8 border-t border-line pt-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
		{#each data.people as p (p.id)}
			<li>
				<a href="/people/{p.id}" class="group block text-center">
					<div class="mx-auto flex aspect-square w-full max-w-40 items-center justify-center overflow-hidden rounded-full bg-surface-2 shadow-soft">
						{#if p.cover}
							<img src="/files/{p.cover}/thumb.webp" alt="" loading="lazy" class="h-full w-full object-cover transition group-hover:scale-105" />
						{:else}
							<span class="font-serif text-4xl text-muted">{initials(p.name)}</span>
						{/if}
					</div>
					<p class="mt-3 truncate font-serif text-xl italic">{p.name}</p>
					<p class="text-xs text-muted">{count(p.count, 'memory', 'memories') || 'Not in anything yet'}</p>
				</a>
			</li>
		{/each}
	</ul>
{:else}
	<p class="border-t border-line pt-8 text-muted">Nobody's been tagged yet.</p>
{/if}
