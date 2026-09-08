# src/lib/survey/dates — the availability calendar

The most interaction-dense piece of the survey: a multi-month grid where a
builder marks the date ranges they could travel. Supports tap-anchor /
tap-complete, mouse drag, full keyboard navigation, and a typed fallback.
Split into an orchestrator plus presentational parts; keep it that way.

## Files

| File | Role |
|---|---|
| `DatesItem.svelte` | **Orchestrator.** Same props and import path as before the split (`survey`, `signedIn`, `onsignin`, `onnext`). Owns every mutation of `survey.ranges` (`commitRange` is the only writer), the selection state (`anchor`, `hovered`, drag start/end, `editing`), `focusDate` for the roving tabindex, `suppressClick`, and the `aria-live` message. Computes `cellState(day)` for the grid. |
| `CalendarGrid.svelte` | Months and day cells. Purely presentational: takes `locked`, `liveMessage`, `focusDate`, a `cellState` callback, and handler callbacks (`onactivate`, `onpointerdown`, `onpointerenter`, `onfocus`, `onkey`, `onhoverchange`). Exports `focusDay(day)` so the parent can move DOM focus to a cell it doesn't render. Calls `windowMonths()` itself. |
| `RangeEditor.svelte` | Edits one committed range: start/end portion pickers (`full` / `first_half` / `second_half`) and delete. Props: `range`, `onsetportion(edge, portion)`, `ondelete()`. |
| `TypedRangeForm.svelte` | No-pointer entry: typed start/end with validation and window clamping. Props: `hasRanges`, `onadd(start, end)` (already ordered and clamped). |
| `grid.ts` | `CellState` interface (selected / preview / portion / isEdge / active / isAnchor) and the `weekdays` header array. |

## Boundaries

- Children never touch `survey`. They report intent through callbacks; the
  orchestrator decides. If you need a new gesture, add a callback prop to the
  grid and handle it in `DatesItem`.
- The `{#if anchor} … {:else if editingRange} … {:else}` chain in
  `DatesItem` is the state machine for the panel under the grid. Add states
  there, not inside children.
- Focus order matters: `moveFocus()` sets `focusDate` and then calls
  `grid.focusDay()` synchronously, so DOM focus lands before the tabindex
  re-render. Don't reorder those two lines.
- Dates are naive ISO strings compared lexically (`'2026-12-04' < '2026-12-07'`).
  All helpers come from `$lib/dates`; no `Date` arithmetic here.
- Drag is mouse-only (`pointerType === 'mouse'`); touch taps and scrolls.
  The window `pointerup` listener and the `suppressClick` flag prevent the
  trailing synthetic click from re-anchoring.

## Verify

`pnpm check`, `pnpm build`. Then in the browser, on `/` signed in (or with
`signedIn` forced in dev): tap two days, drag across a week, arrow-key
through the grid and press Enter twice, Escape a pending anchor, add a range
via the typed form, change a portion in the editor, delete a range. The
live region should announce each step.
