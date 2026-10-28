<script lang="ts">
	import type { Snippet } from 'svelte';

	let { title, subtitle, error, children }: {
		title: string;
		subtitle?: string;
		error?: string;
		children: Snippet;
	} = $props();
</script>

<div class="flex min-h-[90vh] flex-col items-center justify-center py-12">
	<p class="mono mb-6 flex items-center gap-2 text-muted">
		<span class="h-[7px] w-[7px] rounded-full bg-[#d23a2a]"></span> Home movies & photographs
	</p>
	<div class="card w-full max-w-md p-8!">
		<h1 class="text-4xl leading-tight">{title}</h1>
		{#if subtitle}<p class="mt-1 text-muted">{subtitle}</p>{/if}
		{#if error}<p class="notice mt-5">{error}</p>{/if}
		<div class="mt-6">{@render children()}</div>
	</div>
	<p class="mono mt-8 text-[11px]! text-muted">Be kind, rewind</p>
</div>
