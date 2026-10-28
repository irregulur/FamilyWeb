<script lang="ts">
	import AuthCard from '#lib/components/AuthCard.svelte';
	import type { PageProps } from './$types';

	let { form }: PageProps = $props();
</script>

<AuthCard title="Welcome back" subtitle="Come on in" error={form?.error}>
	<form method="POST" class="space-y-4">
		<label class="block">
			<span class="label">Email</span>
			<input class="field" name="email" type="email" value={form?.email ?? ''} required autocomplete="email" />
		</label>
		<label class="block">
			<span class="label">Password</span>
			<input class="field" name="password" type="password" required autocomplete="current-password" />
		</label>
		<button class="btn w-full">Log in</button>
	</form>
</AuthCard>
