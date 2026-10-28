<script lang="ts">
	let { form, button }: { form?: { name?: string; email?: string } | null; button: string } =
		$props();
</script>

<form method="POST" class="space-y-4">
	<label class="block">
		<span class="label">Your name</span>
		<input class="field" name="name" value={form?.name ?? ''} required autocomplete="name" />
	</label>
	<label class="block">
		<span class="label">Email</span>
		<input class="field" name="email" type="email" value={form?.email ?? ''} required autocomplete="email" />
	</label>
	<label class="block">
		<span class="label">Password</span>
		<input class="field" name="password" type="password" minlength="8" required autocomplete="new-password" />
	</label>
	<button class="btn w-full">{button}</button>
</form>
