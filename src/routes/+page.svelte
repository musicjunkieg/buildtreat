<script lang="ts">
	import { onMount } from 'svelte';
	import ChoiceItem from '$lib/components/ChoiceItem.svelte';
	import DatesItem from '$lib/components/DatesItem.svelte';
	import Dots from '$lib/components/Dots.svelte';
	import FeedItem from '$lib/components/FeedItem.svelte';
	import HeroItem from '$lib/components/HeroItem.svelte';
	import LocationItem from '$lib/components/LocationItem.svelte';
	import Rail from '$lib/components/Rail.svelte';
	import ReviewItem from '$lib/components/ReviewItem.svelte';
	import SignInSheet from '$lib/components/SignInSheet.svelte';
	import YouItem from '$lib/components/YouItem.svelte';
	import {
		feedItems,
		interestQuestion,
		travelQuestion,
		type FeedItemId,
		type InterestValue,
		type TravelValue
	} from '$lib/content';
	import { SurveyState } from '$lib/survey.svelte';

	let { data } = $props();

	const survey = new SurveyState();

	const signedIn = $derived(data.user !== null);
	const handle = $derived(data.user?.handle ?? null);

	let current = $state<FeedItemId>('hero');
	let sheetOpen = $state(false);
	let submitting = $state(false);
	let justSubmitted = $state(false);
	const submitted = $derived(data.existingResponse || justSubmitted);
	let submitError = $state<string | null>(null);

	let feed = $state<HTMLElement | null>(null);

	onMount(() => {
		// Server answers win over the local draft; the draft covers signed-out browsing.
		if (data.answers) {
			survey.loadDraft(data.answers);
		} else {
			survey.restoreLocal();
		}
		// First sign-in: prefill identity from the ATProto profile.
		if (data.user?.displayName && !survey.name) survey.name = data.user.displayName;

		const sections = feed?.querySelectorAll('section[id]');
		if (!sections) return;
		const observer = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (entry.isIntersecting && entry.intersectionRatio > 0.55) {
						current = entry.target.id as FeedItemId;
					}
				}
			},
			{ root: feed, threshold: [0.6] }
		);
		sections.forEach((s) => observer.observe(s));
		return () => observer.disconnect();
	});

	function jump(id: FeedItemId) {
		// Pre-auth the feed is sealed: the survey isn't browsable until sign-in.
		if (!signedIn && id !== 'hero') {
			openSignIn();
			return;
		}
		document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
	}

	function next() {
		const i = feedItems.indexOf(current);
		if (i < feedItems.length - 1) jump(feedItems[i + 1]);
	}

	function prev() {
		const i = feedItems.indexOf(current);
		if (i > 0) jump(feedItems[i - 1]);
	}

	function onkeydown(e: KeyboardEvent) {
		if (sheetOpen) return;
		if (!signedIn) return;
		const t = e.target as HTMLElement;
		if (t.closest('input, select, textarea, details, .calendar')) return;
		if (e.key === 'ArrowDown' || e.key === 'PageDown') {
			e.preventDefault();
			next();
		} else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
			e.preventDefault();
			prev();
		} else if (e.key === 'Enter' && !t.closest('button, a, [role="radio"]')) {
			// Enter advances once the current item is answered.
			if (survey.completion[current] || current === 'hero') {
				e.preventDefault();
				next();
			}
		}
	}

	function openSignIn() {
		sheetOpen = true;
	}

	async function submit() {
		if (!signedIn) {
			openSignIn();
			return;
		}
		submitting = true;
		submitError = null;
		try {
			const res = await fetch('/api/response', {
				method: 'PUT',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(survey.toDraft())
			});
			if (!res.ok) {
				const body = (await res.json().catch(() => null)) as { message?: string } | null;
				throw new Error(body?.message ?? `The server said no (${res.status})`);
			}
			justSubmitted = true;
			survey.clearLocal();
			jump('review');
		} catch (err) {
			submitError = err instanceof Error ? err.message : 'Something went wrong';
		} finally {
			submitting = false;
		}
	}
</script>

<svelte:window {onkeydown} />

<main class="feed" class:locked={!signedIn} bind:this={feed}>
	<FeedItem
		id="hero"
		media="/media/hero-portrait.png"
		mediaWide="/media/hero-landscape.png"
		eager
		labelledby="hero-title"
	>
		<HeroItem {signedIn} organizerAvatar={data.organizer.avatar} onsignin={openSignIn} oncontinue={() => jump('you')} />
	</FeedItem>

	<FeedItem id="you" media="/media/item-you.png" labelledby="you-title">
		<YouItem {survey} {signedIn} {handle} onsignin={openSignIn} onnext={() => jump('interest')} />
	</FeedItem>

	<FeedItem id="interest" media="/media/item-interest.png" labelledby="interest-title">
		<ChoiceItem
			titleId="interest-title"
			title={interestQuestion.title}
			prompt={interestQuestion.prompt}
			name="interest"
			options={interestQuestion.options}
			value={survey.interest}
			{signedIn}
			onsignin={openSignIn}
			onchange={(v) => {
				survey.interest = v as InterestValue;
				survey.saveLocal();
			}}
			onnext={() => jump('travel')}
		/>
	</FeedItem>

	<FeedItem id="travel" media="/media/item-travel.png" labelledby="travel-title">
		<ChoiceItem
			titleId="travel-title"
			title={travelQuestion.title}
			prompt={travelQuestion.prompt}
			name="travel"
			options={travelQuestion.options}
			value={survey.travel}
			{signedIn}
			onsignin={openSignIn}
			onchange={(v) => {
				survey.travel = v as TravelValue;
				survey.saveLocal();
			}}
			onnext={() => jump('dates')}
		/>
	</FeedItem>

	<FeedItem id="dates" media="/media/item-dates.png" darker labelledby="dates-title">
		<DatesItem {survey} {signedIn} onsignin={openSignIn} onnext={() => jump('location')} />
	</FeedItem>

	<FeedItem id="location" media="/media/item-location.png" darker labelledby="location-title">
		<LocationItem {survey} {signedIn} onsignin={openSignIn} onnext={() => jump('review')} />
	</FeedItem>

	<FeedItem id="review" media="/media/item-review.png" labelledby="review-title">
		<ReviewItem
			{survey}
			{signedIn}
			{handle}
			{submitting}
			{submitted}
			{submitError}
			onsignin={openSignIn}
			onsubmit={submit}
			onjump={jump}
		/>
	</FeedItem>
</main>

<Rail {current} completion={{ ...survey.completion, review: submitted }} dimmed={!signedIn} onjump={jump} />
{#if signedIn}
	<Dots {current} onjump={jump} />
{/if}
<SignInSheet bind:open={sheetOpen} error={data.authError} knownUser={data.knownUser} />

<style>
	.feed {
		height: 100dvh;
		overflow-y: auto;
		scroll-snap-type: y mandatory;
		scroll-behavior: smooth;
	}

	/* Signed-out: the hero is the whole page — nothing to peek at below. */
	.feed.locked {
		overflow: hidden;
	}

	@media (prefers-reduced-motion: reduce) {
		.feed {
			scroll-snap-type: none;
		}
	}
</style>
