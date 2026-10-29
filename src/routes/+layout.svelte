<script lang="ts">
	import './layout.css';
	import { page } from '$app/state';
	import favicon from '#lib/assets/favicon.svg';
	import ThemeToggle from '#lib/components/ThemeToggle.svelte';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();

	const links = $derived([
		{ href: '/', name: 'Timeline' },
		{ href: '/tapes', name: 'Tapes' },
		{ href: '/people', name: 'People' },
		{ href: '/#occasions', name: 'Occasions' },
		...(data.user?.is_admin ? [{ href: '/family', name: 'Family' }] : [])
	]);
	const current = (href: string) =>
		href === '/' ? page.url.pathname === '/' || page.url.pathname.startsWith('/year') : href !== '/#occasions' && page.url.pathname.startsWith(href);
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>{data.siteName}</title>
</svelte:head>

{#if data.samples}
	<p class="border-b border-line bg-surface-2 px-6 py-2 text-center text-xs text-muted">
		You're looking at {data.samples} sample photos and videos, not real family ones.
		{#if data.user?.is_admin}<a href="/family#samples" class="text-ink underline underline-offset-2">Remove them</a> when you're ready.{/if}
	</p>
{/if}

{#if data.user}
	<header class="sticky top-0 z-30 border-b border-line bg-bg/85 backdrop-blur-md">
		<div class="mx-auto flex h-16 max-w-6xl items-center gap-3 px-5 md:h-[68px] md:gap-8 md:px-7">
			<a href="/" class="flex min-w-0 items-center gap-2.5 font-serif text-[20px] leading-none whitespace-nowrap md:text-[24px]">
				<span class="h-[7px] w-[7px] shrink-0 rounded-full bg-[#d23a2a]" aria-hidden="true"></span>
				{data.siteName}
			</a>
			<nav class="hidden gap-6 text-sm md:flex">
				{#each links as l (l.href)}
					<a href={l.href} class="border-b py-1 transition {current(l.href) ? 'border-ink text-ink' : 'border-transparent text-muted hover:text-ink'}">{l.name}</a>
				{/each}
			</nav>
			<div class="flex-1"></div>
			<ThemeToggle />
			<a href="/upload" class="btn h-10! px-4! md:px-5!" aria-label="Add memories">
				<span aria-hidden="true">＋</span><span class="hidden sm:inline">Add memories</span>
			</a>
			<form method="POST" action="/logout" class="hidden md:block">
				<button class="text-sm text-muted hover:text-ink">Log out</button>
			</form>
		</div>
		<!-- On phones: the links get their own row -->
		<nav class="flex gap-5 overflow-x-auto px-5 pb-2.5 text-sm md:hidden">
			{#each links as l (l.href)}
				<a href={l.href} class="whitespace-nowrap {current(l.href) ? 'text-ink' : 'text-muted'}">{l.name}</a>
			{/each}
			<form method="POST" action="/logout" class="ml-auto"><button class="whitespace-nowrap text-muted">Log out</button></form>
		</nav>
	</header>
{/if}

<main class="mx-auto max-w-6xl px-5 pb-24 md:px-7">
	{@render children()}
</main>

{#if data.user}
	<footer class="mx-auto max-w-6xl px-5 md:px-7">
		<div class="flex flex-col justify-between gap-1 border-t border-line pt-7 pb-11 text-[13px] text-muted sm:flex-row">
			<span>{data.siteName} · private to the family</span>
			<span class="mono">Be kind, rewind</span>
		</div>
	</footer>
{/if}
