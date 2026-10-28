<script lang="ts">
	import { MONTHS } from '#lib/dates.ts';

	// Named inputs, so this works inside a plain <form> as well as with bind:.
	let {
		year = $bindable(''),
		month = $bindable(''),
		day = $bindable(''),
		onchange
	}: { year?: string; month?: string; day?: string; onchange?: () => void } = $props();
</script>

<div class="grid grid-cols-[5.5rem_1fr_4rem] gap-2">
	<input class="field" name="year" bind:value={year} oninput={onchange} inputmode="numeric" maxlength="4" placeholder="Year" aria-label="Year" />
	<select class="field" name="month" bind:value={month} onchange={onchange} disabled={!/^\d{4}$/.test(year)} aria-label="Month">
		<option value="">Month</option>
		{#each MONTHS as name, i (name)}<option value={String(i + 1).padStart(2, '0')}>{name}</option>{/each}
	</select>
	<input class="field" name="day" bind:value={day} oninput={onchange} disabled={!month} inputmode="numeric" maxlength="2" placeholder="Day" aria-label="Day" />
</div>
