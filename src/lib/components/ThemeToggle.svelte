<script lang="ts">
	import { onMount } from 'svelte';

	// app.html already picked light/dark before the page drew; this just flips it and remembers.
	let dark = $state(false);
	onMount(() => (dark = document.documentElement.dataset.theme === 'dark'));

	function toggle() {
		dark = !dark;
		const theme = dark ? 'dark' : 'light';
		document.documentElement.dataset.theme = theme;
		localStorage.setItem('theme', theme);
	}
</script>

<button
	type="button"
	onclick={toggle}
	class="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-line text-muted transition hover:border-ink hover:text-ink"
	title={dark ? 'Switch to light' : 'Switch to dark'}
	aria-label={dark ? 'Switch to light' : 'Switch to dark'}
>
	{#if dark}
		<svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
			<circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
		</svg>
	{:else}
		<svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round">
			<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" />
		</svg>
	{/if}
</button>
