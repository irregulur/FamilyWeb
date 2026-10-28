<script lang="ts">
	import AuthCard from '#lib/components/AuthCard.svelte';
	import SignupFields from '#lib/components/SignupFields.svelte';
	import type { PageProps } from './$types';

	let { form }: PageProps = $props();
</script>

<AuthCard title="Welcome" subtitle="Let's start the family archive" error={form?.error}>
	<SignupFields {form} button="Create my account" />
</AuthCard>
