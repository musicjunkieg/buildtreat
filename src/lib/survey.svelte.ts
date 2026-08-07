import {
	feedItems,
	locationQuestion,
	locations,
	NO_PREFERENCE,
	type AvailabilityRange,
	type FeedItemId,
	type InterestValue,
	type TravelValue
} from '$lib/content';
import { normalizeRanges } from '$lib/dates';

const DRAFT_KEY = 'abr-survey-draft-v1';

export interface SurveyDraft {
	name: string;
	email: string;
	homeLocation: string;
	interest: InterestValue | null;
	travel: TravelValue | null;
	ranges: AvailabilityRange[];
	ranking: string[]; // location ids, index = rank-1, max 3
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class SurveyState {
	name = $state('');
	email = $state('');
	homeLocation = $state('');
	interest = $state<InterestValue | null>(null);
	travel = $state<TravelValue | null>(null);
	ranges = $state<AvailabilityRange[]>([]);
	ranking = $state<string[]>([]);

	emailValid = $derived(this.email === '' || EMAIL_RE.test(this.email));

	youComplete = $derived(this.name.trim() !== '' && EMAIL_RE.test(this.email) && this.homeLocation.trim() !== '');
	interestComplete = $derived(this.interest !== null);
	travelComplete = $derived(this.travel !== null);
	datesComplete = $derived(this.ranges.length > 0);
	locationComplete = $derived(this.ranking.length > 0);

	completion: Record<FeedItemId, boolean> = $derived({
		hero: true,
		you: this.youComplete,
		interest: this.interestComplete,
		travel: this.travelComplete,
		dates: this.datesComplete,
		location: this.locationComplete,
		review: false
	});

	answeredCount = $derived(
		[this.youComplete, this.interestComplete, this.travelComplete, this.datesComplete, this.locationComplete].filter(
			Boolean
		).length
	);

	/** "No" respondents only need identity + interest; everyone else the full set. */
	readyToSubmit = $derived(
		this.interest === 'no'
			? this.youComplete && this.interestComplete
			: this.youComplete && this.interestComplete && this.travelComplete && this.datesComplete && this.locationComplete
	);

	addRange(range: AvailabilityRange) {
		this.ranges = normalizeRanges([...this.ranges, range]);
	}

	removeRange(index: number) {
		this.ranges = this.ranges.filter((_, i) => i !== index);
	}

	updateRange(index: number, patch: Partial<AvailabilityRange>) {
		this.ranges = this.ranges.map((r, i) => (i === index ? { ...r, ...patch } : r));
	}

	noPreference = $derived(this.ranking.includes(NO_PREFERENCE));

	toggleRank(id: string) {
		// "No preference" is exclusive: it clears any ranking, and ranking a
		// real place clears it.
		if (id === NO_PREFERENCE) {
			this.ranking = this.noPreference ? [] : [NO_PREFERENCE];
			return;
		}
		const real = this.ranking.filter((r) => r !== NO_PREFERENCE);
		if (real.includes(id)) {
			this.ranking = real.filter((r) => r !== id);
		} else if (real.length < locationQuestion.maxRank) {
			this.ranking = [...real, id];
		} else {
			this.ranking = real;
		}
	}

	rankOf(id: string): number | null {
		const i = this.ranking.indexOf(id);
		return i === -1 ? null : i + 1;
	}

	toDraft(): SurveyDraft {
		return {
			name: this.name,
			email: this.email,
			homeLocation: this.homeLocation,
			interest: this.interest,
			travel: this.travel,
			ranges: this.ranges,
			ranking: this.ranking
		};
	}

	loadDraft(d: Partial<SurveyDraft>) {
		if (typeof d.name === 'string') this.name = d.name;
		if (typeof d.email === 'string') this.email = d.email;
		if (typeof d.homeLocation === 'string') this.homeLocation = d.homeLocation;
		if (d.interest === 'yes' || d.interest === 'no' || d.interest === 'maybe') this.interest = d.interest;
		if (d.travel === 'yes' || d.travel === 'no' || d.travel === 'partial') this.travel = d.travel;
		if (Array.isArray(d.ranges)) this.ranges = normalizeRanges(d.ranges.filter(isRange));
		if (Array.isArray(d.ranking)) {
			// Untrusted storage: only real location ids (or the sentinel) count,
			// so junk can't fake locationComplete past server validation.
			const known = new Set<string>(locations.map((l) => l.id));
			const arr = [
				...new Set(d.ranking.filter((x): x is string => typeof x === 'string' && (x === NO_PREFERENCE || known.has(x))))
			];
			this.ranking = arr.includes(NO_PREFERENCE) ? [NO_PREFERENCE] : arr.slice(0, 3);
		}
	}

	saveLocal() {
		try {
			localStorage.setItem(DRAFT_KEY, JSON.stringify(this.toDraft()));
		} catch {
			// Private browsing / quota — drafts are a convenience, not a requirement.
		}
	}

	restoreLocal() {
		try {
			const raw = localStorage.getItem(DRAFT_KEY);
			if (raw) this.loadDraft(JSON.parse(raw));
		} catch {
			// Corrupt draft — start clean rather than crash. clearLocal guards
			// its own storage access: if storage itself is denied, removeItem
			// here would rethrow and abort the caller's onMount.
			this.clearLocal();
		}
	}

	clearLocal() {
		try {
			localStorage.removeItem(DRAFT_KEY);
		} catch {
			// ignore
		}
	}
}

function isRange(r: unknown): r is AvailabilityRange {
	if (typeof r !== 'object' || r === null) return false;
	const x = r as Record<string, unknown>;
	const portion = (p: unknown) => p === 'full' || p === 'first_half' || p === 'second_half';
	return (
		typeof x.start === 'string' &&
		typeof x.end === 'string' &&
		/^\d{4}-\d{2}-\d{2}$/.test(x.start) &&
		/^\d{4}-\d{2}-\d{2}$/.test(x.end) &&
		x.start <= x.end &&
		portion(x.startPortion) &&
		portion(x.endPortion)
	);
}

export { feedItems };
