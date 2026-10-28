<script lang="ts">
	import { enhance } from '$app/forms';
	import DateFields from '#lib/components/DateFields.svelte';
	import { takenAtFrom } from '#lib/dates.ts';
	import { OCCASIONS, guessOccasion } from '#lib/occasions.ts';

	type Props = {
		item: { title: string | null; description: string | null; taken_at: string | null; occasion: string | null };
		error?: string;
		onclose: () => void;
	};
	let { item, error, onclose }: Props = $props();

	// The parent re-creates this component for each photo, so starting from the props once is what we want.
	const start = (() => ({ ...item, date: item.taken_at?.split('-') ?? [] }))();
	let year = $state(start.date[0] ?? '');
	let month = $state(start.date[1] ?? '');
	let day = $state(start.date[2] ?? '');
	let occasion = $state(start.occasion ?? '');
	let saving = $state(false);
	const undated = !start.taken_at;

	function suggestOccasion() {
		const date = takenAtFrom(year, month, day);
		if (!occasion && date.length === 10) occasion = guessOccasion(date) ?? '';
	}
</script>

<form
	method="POST"
	action="?/save"
	class="card"
	use:enhance={() => {
		saving = true;
		return async ({ result, update }) => {
			await update({ reset: false });
			saving = false;
			if (result.type === 'success') onclose();
		};
	}}
>
	<h2 class="text-3xl">{undated ? 'Do you know when this was?' : 'Edit details'}</h2>
	<p class="mt-1 text-sm text-muted">
		{undated ? 'Even just the year helps — it moves it out of the mystery box and onto the timeline.' : 'Fix anything that’s wrong. Everyone in the family can do this.'}
	</p>

	<fieldset disabled={saving} class="mt-5 grid gap-5 md:grid-cols-2">
		<div>
			<span class="label">When</span>
			<DateFields bind:year bind:month bind:day onchange={suggestOccasion} />
		</div>
		<label class="block">
			<span class="label">Occasion</span>
			<select class="field" name="occasion" bind:value={occasion}>
				<option value="">— none —</option>
				{#each OCCASIONS as o (o.slug)}<option value={o.slug}>{o.name}</option>{/each}
			</select>
		</label>
		<label class="block md:col-span-2">
			<span class="label">Title</span>
			<input class="field" name="title" value={start.title ?? ''} maxlength="200" placeholder="e.g. Sarah's 5th birthday" />
		</label>
		<label class="block md:col-span-2">
			<span class="label">The story <span class="font-normal">(optional)</span></span>
			<textarea class="field min-h-24" name="description" maxlength="2000" placeholder="Who's in it? Where was it? What happened next?">{start.description ?? ''}</textarea>
		</label>
	</fieldset>

	{#if error}<p class="notice mt-4">{error}</p>{/if}

	<div class="mt-5 flex flex-wrap items-center gap-3">
		<button class="btn" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
		{#if undated}
			<button class="btn-ghost" name="next" value="1" disabled={saving}>Save, then the next mystery →</button>
		{:else}
			<button type="button" class="text-sm text-muted hover:text-ink" onclick={onclose}>Cancel</button>
		{/if}
	</div>
</form>
