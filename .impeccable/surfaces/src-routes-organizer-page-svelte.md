---
version: 1
slug: "src-routes-organizer-page-svelte"
primary_target: "src/routes/organizer/+page.svelte"
related_targets: ["src/routes/organizer/+page.server.ts","src/lib/server/organizer.ts"]
---

# Surface: organizer backend (/organizer)

Scope: the organizer-only admin surface — response reading, availability heatmap, allowlist management, deadline overrides, CSV export. Visitor mode: Operate.

Audience & job: Bryan (organizer, @chaosgreml.in) and optionally a Bluesky partner, on desktop mid-planning. Job: answer "who's in, when can they come, where should it be", manage who may respond, handle stragglers, export for Bluesky.

Access: reuse Sign in with Atmosphere OAuth; `ORGANIZER_DIDS` env var (comma-separated DIDs) gates the route. Signed-out visitors get a minimal sign-in prompt; signed-in non-organizers get a polite not-found. The respondent surface is untouched.

Chosen direction: the Dusk Feed world at Operate density — solid #0b0908 ground (no photography, no scrim), grain tile kept, one white ink at the established opacity steps, Big Shoulders condensed caps only for the rail title and section headers, Hanken Grotesk for all data/labels/controls, hairline ledger structure, white pill for real actions, normal document scroll (no snap feed).

Approved comp (north star): `.impeccable/mocks/org-b.png` (sidecar approved:true) — "Command rail". Fixed left rail (~25%, vertical hairline): stacked ATMOSPHERIC / ORGANIZER. title, big-numeral stat stack (responses / yes / maybe / need travel help) in hairline rows, LOCATIONS ranked tally ledger with thin bars, REOPEN SURVEY + LATE PASSES toggle rows, Export CSV pill docked at rail bottom. Content area: "WHEN CAN THEY COME" header + Sept 1 – Nov 15 subline, three month grids of intensity cells, BEST WINDOW highlighted hairline row, wide responses table (avatar, handle, name, city, interest, travel, ranges, updated) under small-caps column headers.

Memorable moment: the aggregate heatmap — the survey's split-day mechanic visible in aggregate. Cell intensity = white opacity ∝ respondents available; edge half-days render as split cells (top/bottom halves at different intensities), the same gradient language as the respondent calendar.

## Implementation-fidelity inventory (region → medium)

| Region | Medium |
|---|---|
| Ground + grain | CSS + existing /media/grain.png tile at 0.07 overlay |
| Rail title, headers | HTML text, Big Shoulders (self-hosted, already shipped) |
| Stat stack, ledgers, tally bars | HTML/CSS (bars = 1px-height white divs at opacity) |
| Heatmap month grids | rendered HTML/CSS — day cells, rounded 6px, white at computed alpha; split cells via linear-gradient like DatesItem |
| Best-window rows | HTML ledger rows |
| Responses table | semantic HTML table, hairline rows |
| Avatars | real ATProto profile images at runtime; neutral circle fallback (existing pattern) |
| Toggles | HTML/CSS switch in pill language (999px track, round knob) |
| Export pill, buttons | existing .pill atom |
| Icons | existing 1.75-stroke Icon.svelte set |

Compositional commitments from the comp: rail is fixed/sticky on desktop; one vertical hairline divides rail from content; stat numerals large (Hanken, tabular), labels small tracked caps; heatmap dominates the content top; table runs full remaining width. No cards, no boxes, no shadows, no second color.

Extensions the comp doesn't show (built in the same grammar): ALLOWLIST section below the table — chips of current handles (with pinned-DID + responded marks), paste-textarea add form, per-chip remove; loud empty-state warning when the list is empty (current live policy admits everyone). Late-pass management expands under the LATE PASSES rail row (grant by handle, revoke). Best windows: top three ranked rows, first brightest. Second export file: responses.csv + availability.csv.

Do-not-literalize: all names/numbers/dates in the comp are synthetic; "May 24" timestamps placeholder; no engagement-count-style decoration; the comp's single best-window row becomes a three-row ledger.

States: zero responses (empty state points at allowlist), 1–~80 respondents, allowlist empty vs populated, deadline open / passed / reopened; heatmap filter all vs yes-only respondents. Mobile: rail collapses to a top summary block, single column, heatmap months stack, table rows collapse to two-line entries.

Data: new D1 tables `settings` (reopen flag) and `late_passes`; respondent deadline logic honors reopen + per-DID/handle late passes. CSV via /organizer/responses.csv and /organizer/availability.csv (organizer-gated).

Unresolved (do not invent): none blocking; window-scoring math, CSV column order, sort defaults are builder's choice (per Bryan).
