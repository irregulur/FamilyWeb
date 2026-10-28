<script lang="ts">
	import AuthCard from '#lib/components/AuthCard.svelte';
	import SignupFields from '#lib/components/SignupFields.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
</script>

<AuthCard
	title="You're invited"
	subtitle={data.note ? `Hi ${data.note}!` : 'Join the family archive'}
	error={form?.error}
>
	<SignupFields {form} button="Join" />
</AuthCard>
