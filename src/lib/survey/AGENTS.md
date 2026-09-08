# src/lib/survey — the availability survey

The original surface of the app: a vertical snap feed asking invited builders
when and where they could do a retreat. Rendered by `routes/+page.svelte`
until the visitor has a saved response, after which the registration flow
takes over the same feed.

## Files

| File | Role |
|---|---|
| `survey.svelte.ts` | `SurveyState` — a runes class holding every answer (`name`, `email`, `homeLocation`, `interest`, `travel`, `ranges`, `ranking`) plus derived completion (`youComplete` … `completion`, `answeredCount`, `canSubmit`). Range mutations (`addRange`/`removeRange`/`updateRange`) normalize via `dates.normalizeRanges`. Draft persistence: `toDraft`/`loadDraft`, `saveLocal`/`restoreLocal`/`clearLocal` against `localStorage['abr-survey-draft-v1']`. |
| `HeroItem.svelte` | Opening item — the invitation and the "start" gesture. |
| `YouItem.svelte` | Name, email, home location. Email validity comes from `SurveyState.emailValid`. |
| `ChoiceItem.svelte` | Generic single-select item used for both the interest and travel questions (`interestQuestion`, `travelQuestion` from content). |
| `dates/` | The availability calendar — see `dates/AGENTS.md`. |
| `LocationItem.svelte` | Rank up to three of the `locations` list, or `NO_PREFERENCE`. |
| `ReviewItem.svelte` | Summary + submit. Deadline / late-pass / reopened gating messages are rendered here from page data. |

## Boundaries

- Items receive the `SurveyState` instance (or the slice they need) as a
  prop and mutate it directly — that is the intended pattern for this
  class, not a leak. Do not copy answers into component-local state.
- Feed order and item titles live in `content.ts` (`feedItems`,
  `itemTitles`). Adding an item means adding it there, adding a
  `completion` entry in `SurveyState`, and rendering it in
  `routes/+page.svelte`.
- Submission goes through `PUT /api/response` (`routes/api/response`),
  which re-validates with `server/db.validateDraft`. Client-side checks are
  for UX; the server is the gate.
- The survey closes on `DEADLINE` (env). Whether a visitor may still edit is
  decided server-side (`deadlineStatus`, late passes, reopened flag) and
  delivered as page data — never infer it from the clock in the browser.

## Verify

`pnpm check`, `pnpm test`. Drive the feed with a keyboard: every item must be
reachable and completable without a pointer. `/` in dev with no saved response
shows the survey; clear `abr-survey-draft-v1` in localStorage to reset the
draft.
