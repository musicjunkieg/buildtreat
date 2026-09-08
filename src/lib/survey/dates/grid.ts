import type { DayPortion } from '$lib/content';

/** Column headers, Sunday-first — matches `CalendarMonth.leading`. */
export const weekdays = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/**
 * Everything the grid needs to paint one day cell. Computed by the
 * orchestrator (which owns the ranges and the selection state) and handed
 * down as a callback so the grid stays presentational.
 */
export interface CellState {
	selected: boolean;
	preview: boolean;
	portion: DayPortion;
	isEdge: boolean;
	active: boolean;
	/** The pending range start — labelled differently from a committed day. */
	isAnchor: boolean;
}
