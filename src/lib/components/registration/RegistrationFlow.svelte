<script lang="ts">
	import FeedItem from '$lib/components/FeedItem.svelte';
	import AnnouncementItem from '$lib/components/registration/AnnouncementItem.svelte';
	import RegistrationForm from '$lib/components/registration/RegistrationForm.svelte';
	import RegisteredSummary from '$lib/components/registration/RegisteredSummary.svelte';
	import { registration as copy } from '$lib/content';
	import type { PageData, ActionData } from '../../../routes/$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	// Which document (if any) sits under the announcement. `editing` is the
	// user's explicit choice to open the form from a registered state.
	let editing = $state(false);
	const reg = $derived(data.registration);
	const registered = $derived(reg?.status === 'confirmed' && reg.agreedAt !== null);
	const declined = $derived(reg?.status === 'declined');
	const closedForNew = $derived(data.regClosed && !registered);

	const mode = $derived<'announce' | 'form' | 'registered'>(
		editing ? 'form' : registered ? 'registered' : 'announce'
	);

	// The ?/decline action can fail(*, { regMessage }) from either the
	// announcement or the registered-summary decline form.
	const regMessage = $derived(form && 'regMessage' in form ? (form.regMessage as string) : null);

	// A successful save closes the form; the load re-runs with the new row.
	$effect(() => {
		if (form && 'registered' in form && form.registered) editing = false;
	});
</script>

{#if mode === 'announce'}
	<main class="reg-feed">
		<FeedItem id="announce" media="/media/hero-portrait.png" mediaWide="/media/hero-landscape.png" eager labelledby="ann-title">
			<AnnouncementItem
				state={closedForNew ? 'closed' : declined ? 'declined' : 'open'}
				deadlineDisplay={data.regDeadlineDisplay}
				organizerAvatar={data.organizer.avatar}
				surveyHref="/?survey"
				surveyLabel={copy.surveyLink}
				message={regMessage}
				onconfirm={() => (editing = true)}
			/>
		</FeedItem>
	</main>
{:else if mode === 'form'}
	<RegistrationForm {data} {form} oncancel={() => (editing = false)} />
{:else}
	<RegisteredSummary
		registration={reg!}
		regClosed={data.regClosed}
		organizerAvatar={data.organizer.avatar}
		message={regMessage}
		onedit={() => (editing = true)}
	/>
{/if}

<style>
	.reg-feed {
		height: 100dvh;
		overflow: hidden;
	}
</style>
