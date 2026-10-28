<script lang="ts">
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	let copied = $state(false);
</script>

<svelte:head><title>The family</title></svelte:head>

<section class="pt-12 pb-10 md:pt-16">
	<p class="eyebrow">Members & settings</p>
	<h1 class="mt-3 text-5xl leading-[1.05] md:text-6xl">The family</h1>
	<p class="mt-4 text-muted">Everyone who can see and add memories.</p>
</section>

<section class="grid gap-6 md:grid-cols-2">
	<div class="card">
		<h2 class="text-3xl">Invite someone</h2>
		<p class="mt-1 text-sm text-muted">Makes a one-time link (valid 30 days). Send it by text or email — they pick their own password.</p>
		<form method="POST" action="?/invite" class="mt-5 flex gap-2">
			<input class="field" name="note" placeholder="Who is it for? e.g. Grandma" />
			<button class="btn shrink-0">Create link</button>
		</form>

		{#if form?.link}
			<div class="mt-4 rounded-lg border border-line bg-surface-2 p-4">
				<p class="text-sm text-muted">Link{form.note ? ` for ${form.note}` : ''}:</p>
				<p class="mt-1 font-mono text-sm break-all">{form.link}</p>
				<button class="link mt-3 text-sm" onclick={() => navigator.clipboard.writeText(form.link).then(() => (copied = true))}>
					{copied ? 'Copied!' : 'Copy link'}
				</button>
			</div>
		{/if}
	</div>

	<div class="card">
		<h2 class="text-3xl">Members</h2>
		<ul class="mt-3 divide-y divide-line">
			{#each data.members as m (m.email)}
				<li class="flex items-center justify-between gap-4 py-3">
					<div class="min-w-0">
						<p class="font-medium">{m.name} {#if m.is_admin}<span class="mono text-[10px]! text-gold">· owner</span>{/if}</p>
						<p class="truncate text-sm text-muted">{m.email}</p>
					</div>
					<span class="shrink-0 font-mono text-xs text-muted">{m.uploads} uploads</span>
				</li>
			{/each}
		</ul>
	</div>
</section>

<!-- The words on the front page -->
<section id="front-page" class="card mt-6 scroll-mt-24">
	<h2 class="text-3xl">The front page</h2>
	<p class="mt-1 text-sm text-muted">Make it yours. Leave a box empty to go back to the standard text.</p>
	<form method="POST" action="?/frontPage" class="mt-6 grid gap-5 md:grid-cols-2">
		<label class="block">
			<span class="label">Family name</span>
			<input class="field" name="family_name" value={data.settings.family_name} placeholder="e.g. Smith → “The Smith Family”" />
		</label>
		<div class="hidden md:block"></div>
		<label class="block">
			<span class="label">Headline</span>
			<input class="field" name="headline" value={data.settings.headline} placeholder={data.defaults.headline} />
		</label>
		<label class="block">
			<span class="label">…second line, in italics</span>
			<input class="field font-serif text-lg italic" name="headline_italic" value={data.settings.headline_italic} placeholder={data.defaults.headline_italic} />
		</label>
		<label class="block md:col-span-2">
			<span class="label">A few words underneath</span>
			<textarea class="field" name="intro" rows="2" placeholder={data.defaults.intro}>{data.settings.intro}</textarea>
		</label>
		<label class="block md:col-span-2">
			<span class="label">A dedication, at the bottom of the front page <span class="font-normal">(optional)</span></span>
			<textarea class="field font-serif text-lg italic" name="dedication" rows="2" placeholder="For Mom, who kept every tape, and labelled every one."
				>{data.settings.dedication}</textarea
			>
		</label>
		<label class="block">
			<span class="label">From</span>
			<input class="field" name="dedication_from" value={data.settings.dedication_from} placeholder="e.g. Christmas 2025, with love" />
		</label>
		<div class="flex items-end gap-4 md:col-span-2">
			<button class="btn">Save</button>
			{#if form?.frontPageSaved}<p class="success">Saved — <a href="/" class="link">have a look</a>.</p>{/if}
		</div>
	</form>
</section>

<section id="samples" class="card mt-6 scroll-mt-24">
	<h2 class="text-3xl">Sample photos</h2>
	{#if data.samples}
		<p class="mt-1 text-sm text-muted">
			{data.samples} sample memories are mixed into the timeline{data.addingSamples ? ', and more are still being made' : ''}.
			Removing them only removes samples; anything your family uploaded stays.
		</p>
		<form method="POST" action="?/removeSamples" class="mt-5">
			<button class="btn">Remove all samples</button>
		</form>
	{:else}
		<p class="mt-1 max-w-2xl text-sm text-muted">
			Want to see how the site looks before adding your own? This adds about 80 made-up photos and short videos, plus three tapes on the tape shelf, across
			the 70s, 80s, 90s and 2000s. They're marked as samples, so one click removes them all again.
		</p>
		{#if form?.samplesRemoved}<p class="success mt-2">Removed {form.samplesRemoved} samples.</p>{/if}
		<form method="POST" action="?/addSamples" class="mt-5">
			<button class="btn" disabled={data.addingSamples}>{data.addingSamples ? 'Still removing the last ones…' : 'Add sample photos'}</button>
		</form>
	{/if}
	{#if form?.samplesStarted}
		<p class="mt-3 text-sm text-muted">Started! They appear on the <a href="/" class="link">timeline</a> over the next minute or two.</p>
	{/if}
</section>
