# lib/ui — feed chrome and primitives

Presentation-only building blocks shared by the survey and registration
feeds. Nothing here knows about D1, auth, or which question it's rendering.

| File | Role |
|---|---|
| `Icon.svelte` | Inline SVG set; exports the `IconName` union. Add glyphs here, never as `<img>`. |
| `FeedItem.svelte` | One full-bleed item in the vertical feed: photo ground, scrim, snippet slot. |
| `QuestionScaffold.svelte` | Kicker + question + body slot + `NextChip`; the frame every survey question sits in. |
| `NextChip.svelte` | The "next" affordance at the bottom of a question. |
| `Rail.svelte` | Left-hand vertical rail (desktop): item titles + active marker, driven by `feedItems` order. |
| `Dots.svelte` | Mobile progress dots for the same feed order. |

## Boundaries

- Props in, callbacks out. These components don't import `SurveyState` or
  route data; the item components in `lib/survey/` and `lib/registration/`
  do the wiring.
- Feed order and titles come from `feedItems` / `itemTitles` in
  `lib/content.ts`; `Rail` and `Dots` must stay in sync with it
  automatically — don't hardcode item lists.
- Styling follows DESIGN.md: photo ground under a scrim, white ink at
  opacity steps, no cards. The five global classes (`.kicker`, `.display`,
  `.pill`, `.ledger`, `.visually-hidden`) live in `src/app.css`; everything
  else is scoped here.
- Motion respects `prefers-reduced-motion`. CSS transitions are covered by
  the global reset in `app.css`; anything using Svelte `transition:` (which
  compiles to WAAPI) must guard itself.

## Verify

`pnpm check` for types and unused-selector warnings; eyeball `/` at desktop
and mobile widths (`scripts/shot.mjs`) when touching layout.
