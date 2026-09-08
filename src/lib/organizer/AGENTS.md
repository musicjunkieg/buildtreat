# src/lib/organizer — the organizer console (client side)

Components and pure math for `/organizer`. Everything here is
browser-importable: props in, callbacks out, no `$lib/server` values. Data
arrives already shaped from `routes/organizer/+page.server.ts` (types in
`lib/server/organizer/page-data.ts`, imported as `import type`).

## Files

| File | Role | Props |
|---|---|---|
| `aggregate.ts` | Pure half-day-slot math over responses: `slotSet`, `dayLoads`, `windowSlots`, `fullOverlap`, `windowFitCount`, `windowRoster`, `bestWindows`, `locationTallies`. A "slot" is one half of one day; a range with `first_half`/`second_half` portions maps to a subset of slots. | — |
| `OrganizerGate.svelte` | Signed-out state: minimal handle field + sign-in. Self-contained. | none |
| `OrganizerRail.svelte` | Left rail: response stats, location tally bars, late-pass management, reopen toggle, deadline line. | `responses` (all), `filtered` (for the tally), `latePasses`, `reopened`, `deadlinePassed`, `deadlineLine`, `preview` |
| `AvailabilitySection.svelte` | Heatmap + best windows + roster drawer. Renders the all/yes toggle but the page owns `filter` (prop + `onfilter` callback, **not** `bind:` — a component binding wraps the page's SSR in a settle loop that drops its `<title>`) so the rail's tally follows it. Anchors derive from **all** responses regardless of filter. | `responses`, `anchors`, `anchorBusy`, `anchorsLocked`, `onclear`, `filter`, `onfilter` |
| `Heatmap.svelte` | Day-load strip. | `loads`, `total`, `overlap?` |
| `ResponsesTable.svelte` | Every respondent, avatars, and the anchor toggle. | `responses`, `avatars`, `anchors`, `ontoggleanchor(did)`, `anchorsLocked?` |
| `AllowlistSection.svelte` | Add/remove invited handles (form actions). | `allowlist` |
| `WaitlistSection.svelte` | Waitlist entries + Promote (form action). | `waitlist` |
| `RegistrationsPanel.svelte` | Dec 4–7 registrations ledger, counts, no-response list, error state. | `registrations`, `counts`, `missing`, `deadlineDisplay`, `closed`, `unavailable?` |
| `EmailPanel.svelte` | Test send, broadcast compose, broadcast history + Retry. | `configured`, `broadcasts`, `respondentCount` |
| `*.test.ts` | `aggregate` has no test yet; add one if you touch the slot math. | — |

## Boundaries

- **Anchor state lives in the page.** `routes/organizer/+page.svelte` owns
  `anchors` + `anchorBusy` and the optimistic `toggleAnchor`/`clearAnchors`
  because two components (AvailabilitySection, ResponsesTable) share it.
  Don't move it into either one.
- **Mutations are SvelteKit form actions** (`?/addHandles`, `?/grantPass`,
  `?/emailBroadcast`, …) with `use:enhance`. The two exceptions are the
  anchor toggles, which post with `fetch` + `deserialize` for optimistic UI.
  Every form must still work without JavaScript.
- **Failure states are explicit props** (`anchorsLocked`, `unavailable`).
  When a server read fails the page passes these; components must disable
  the corresponding mutation, not render an empty list.
- **Section styling is per-component.** Each section carries its own copy
  of `.section-head`/`.section-title`/`.section-sub`/`.section-empty` and a
  bare `section {}` rule. That's deliberate — Svelte scoped styles don't
  cross component boundaries and we don't want a global sheet for it.
- `preview` (dev `?preview`) short-circuits network calls in the page; the
  components don't know about it beyond the rail's on-surface label.

## Verify

`pnpm check` (unused-selector warnings here mean a style block landed in the
wrong component), `pnpm test`, then `pnpm dev` and `/organizer?preview` at
desktop and ~390px widths: rail collapses under the 900px query, heatmap and
windows render, roster drawer opens, anchors toggle and clear.
