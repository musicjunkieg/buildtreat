---
version: 1
slug: "src-routes-page-svelte"
primary_target: "src/routes/+page.svelte"
related_targets: ["src/routes/+layout.svelte","src/routes/+page.server.ts"]
---

# Surface: buildtreat survey (root route)

Scope: the product's only respondent-facing surface — invitation + 7-item survey. Visitor mode: Persuade opening into Operate-disciplined form.

Audience & job: ATProto builders who already said yes to Bryan's Bluesky post; they arrive warm and excited via personal invite link, mostly on phones. Job: confirm the retreat is real (first public naming: sponsored by Bluesky; lodging & food covered), then collect a complete response in ~5 min.

Action/task: sign in with Atmosphere (ATProto OAuth) → answer 7 questions → submit. Editable until deadline. Allowlisted handles only.

Proof/content: real verified photography of the five SoCal candidate locations (Palm Springs, Coachella Valley, Joshua Tree, San Diego, LA metro); retreat facts verbatim from PRODUCT.md. No invented facts.

Chosen direction: Full-Bleed Feed world (catalog: pop-culture-shelf-vertical-video-feed-surface; seed 9380440b, user-chosen challenger). One item owns the entire viewport; hard vertical snap between complete states, next item preloaded. Media edge-to-edge under soft bottom scrim; white glyphs the only interface color; small "organized by @<bryan>" author line low-left; right rail = action glyphs + jump-map with completion marks; progress = item dots, never a progress bar. Inputs live in the caption zone. No centered cards, no gray ground.

Memorable moment: the calendar item — the Sept 1–Nov 15 calendar IS the media, filling the viewport; multi-range selection pools with color; first/last day of each range carries a first-half/second-half-of-day toggle; typed entry as accessible alternative.

Feed sequence: 1 hero (acknowledgment energy (interested, not booked), Bluesky sponsorship news, retreat named "the Atmospheric Builders' Retreat", Sign in with Atmosphere) · 2 identity (prefilled from ATProto profile) · 3 interest Y/N/Maybe · 4 travel affordability (verbatim wording) · 5 calendar · 6 location top-3 ranking over full-bleed photos · 7 review + submit.

States: signed-out · not-on-allowlist (polite) · returning (prefilled, update semantics) · deadline passed (closed, warm) · success · error/offline retry. Ranges: 0–10 date ranges (typical 1–4). Portrait mobile first; desktop carries the same grammar.

Constraints: SvelteKit on Cloudflare; ATProto OAuth; server-side allowlist + response storage; semantic form under the grammar (labeled controls, keyboard-completable, reduced-motion collapses snap to plain scroll; contrast via scrim).

Unresolved (do not invent): respond-by deadline date; allowlist of handles; final location-photo approval.

Naming: the retreat is "the Atmospheric Builders' Retreat" (pairs with the "Sign in with Atmosphere" CTA). "buildtreat" is the repo codename only and never appears on-surface.

## Approved comp (north star)

`.impeccable/mocks/hero-h.png` (sidecar approved:true). "Rooted Ledger": kicker top-left → breathing photo (~30%) → acknowledgment line → stacked ATMOSPHERIC / BUILDERS' RETREAT display (terminal period) → four hairline-ruled fact rows → full-width white pill CTA → author line → right glyph rail (4 outline glyphs, no counts) → 7 progress dots bottom-center.

## Design system read from the comp

- Ground: full-bleed photograph edge-to-edge; scrim gradient from ~45% height to near-black at bottom; subtle film grain over everything.
- Palette: pure white UI on photographic dusk (pink-orange sky, amber interior light, deep near-black base). No second UI color anywhere.
- Type ramp: (1) kicker — small caps, ~0.2em tracking, ~11px; (2) acknowledgment — neutral humanist sans, sentence case, ~20px; (3) display — ultra-condensed tall grotesque caps, tight leading, two stacked lines filling width; (4) ledger rows — small caps, tracked, ~12–13px; (5) button label — semibold sans, black on white; (6) author line ~13px.
- Components: fully-rounded pill button (the only container); 1px hairline rules at ~35% white; 1.5–2px outline glyph rail; avatar circle; 8px dots (active solid, inactive 35%).
- Corner language: pill = fully round; everything else uncontained. No cards, borders, or shadows — legibility comes from the scrim.
- Elevation: flat. Motion native to the form: hard vertical snap, one soft settle per item (authored in build phase 2).

## Asset inventory (region → medium)

| Region | Medium |
|---|---|
| Hero courtyard dusk photo | raster, generated (regenerate clean from comp ref, no UI text; portrait + landscape). Synthetic atmosphere, on Bryan's replacement list for a real venue photo |
| Scrim gradient | CSS |
| Film grain | tiling raster tile or SVG turbulence |
| Display/kicker/ledger/acknowledgment type | HTML text + webfont (concession: closest obtainable condensed grotesque) |
| Hairline rules, dots | CSS |
| Primary action (full-width white pill "Sign in with Atmosphere") | HTML/CSS button; no physical treatment in comp; butterfly = real Bluesky logo SVG (factual sponsorship mark) |
| Rail glyphs (heart/comment/send/bookmark) | authored inline SVG; repurposed as jump-map/actions; NEVER render fake engagement counts |
| Avatars | real ATProto profile images at runtime (organizer + respondent); neutral circle fallback |
| Item 2–4, 7 backgrounds | generated atmosphere in same world (synthetic, replaceable) |
| Item 5 calendar | rendered UI (HTML/CSS/SVG) over quiet ground — the calendar IS the media |
| Item 6 location photos ×5 | REAL sourced photography only (evidence rule), needs Bryan approval — open |

Do-not-literalize from comp: no engagement counts; dot count = 7 exactly; photo is replaceable atmosphere, not a venue claim.

## User-directed copy deviations from the comp (Bryan, 2026-08-04)

- The WHEN fact must read as a window, not event dates: "Sometime between Sept 1 – Nov 15".
- The acknowledgment couplet must state that respondents' answers drive the outcome: second line becomes "Help us pick the dates — and the place." (replaces "Now we find the dates." / "It's happening." stays as line 1 tone).

Kicker ruling: the hero kicker ("For the builders of the Atmosphere") is KEPT by Bryan's explicit decision (2026-08-04), overriding the craft-floor kicker ban; the approved comp carries it.

---

# Registration era (2026-08-29) — the root route's new front door

Scope: the survey is closed (deadline passed Aug 15; date locked Dec 4–7, 2026). For signed-in allowlisted visitors the root route now opens on registration, not the survey. Spec: docs/superpowers/specs/2026-08-25-registration-design.md. Visitor mode: Persuade for one viewport (the date reveal), then Operate (the form).

Structure (user-pinned, Bryan 2026-08-29): "feed for the moment, free scroll for the form" — the announcement is a single feed item in the established grammar (full-bleed photo, scrim, settle); tapping I'm in lands on a freely-scrolling document on the flat grained ground, the organizer room's density brought to the respondent. Two densities, one world. Survey answers remain reachable read-only via a quiet link. Waitlist flow unchanged.

Wrongness guards (Bryan): must not feel like a legal form; must not lose the photography; must not be a long scroll on a phone; must not hide the venue-pending honesty.

## Approved comps (north star)

- Announcement: `.impeccable/mocks/reg-ann-a.png` (sidecar approved:true) — "The Date, Stacked". Kicker THE DATE IS SET top-left → breathing photo → acknowledgment couplet ("You helped pick the days. Here they are.") → stacked display DECEMBER / 4–7, 2026. (terminal period) → four hairline ledger rows (Palm Springs or Coachella Valley · Venue locks with the headcount [Ink 70] · Lodging & food covered — Bluesky · Register by Sept 7) → white pill "I'm in" → quiet underlined link "I can't make it" → author line. No glyph rail, no dots: a one-item feed.
- Form: `.impeccable/mocks/reg-form-a.png` (sidecar approved:true) — "Sectioned Ledger". 34vh photo band (same hero photo, object-position 50% 35%) whose scrim resolves into the flat ground; kicker REGISTRATION on the band; title YOU'RE IN. overlapping the band's foot; 34ch Ink-70 sub ("December 4–7, Palm Springs or the Coachella Valley. Six short sections. Travel can wait until you know."); six hairline-topped sections headed by kickers with an optional Ink-45 hint on the right (Contact · Food "Pick any" · Emergency contact · Accessibility "Optional" · Anything else "Optional" · Travel "Optional now · update anytime") → Agreements as two ring-checkbox ledger rows with an inline underlined "read it" link and an Ink-45 version tag → white pill "Register" with the hint "You can change everything later." → author line.
- Registered state: no separate comp; it is Form-A rendered as a read summary — the same six sections with values instead of inputs, an Edit affordance per section (1.5px-outlined ghost, the review item's edit button), Travel's hint reading "update as plans firm up". Derive, do not redesign.
- Unapproved alternates kept as HTML sources only (reg-ann-b, reg-form-b, reg-form-c); their PNGs are untracked.

Comps are coded (HTML/CSS in project tokens + self-hosted fonts, screenshot via scripts/shot.mjs at 393×852, DPR 2) — no image generation was available this session. Sources: `.impeccable/mocks/reg-*.html` + `reg-base.css`.

## Implementation-fidelity inventory (region → medium)

| Region | Medium |
|---|---|
| Announcement photo + scrim + grain | existing `/media/hero-portrait.png` (+ landscape swap), CSS scrim (transparent → 0.15 @38% → 0.82 @62% → 0.97), grain 0.07 overlay |
| Stacked date display | HTML text, Big Shoulders 700 at `--display-l1` / `--display-l2` |
| Ledger facts | `.ledger` atom, Ink 70 for the venue-pending row |
| I'm in / I can't make it | `.pill` + quiet link (0.8125rem, Ink 70, underline 3px offset) — both real form actions |
| Form photo band | same photo, 34vh (min 250px), CSS scrim to `--ground` at 100% |
| Section heads | kicker + hairline top (`--hairline`), optional hint in Ink 45 |
| Inputs / textareas | underline-only fields (`border-bottom: 1px solid var(--ink-45)`, focus → Ink), kicker labels in Ink 70 |
| Dietary + travel-mode chips | outline chips (`1px solid var(--ink-45)`, 999px); selected = solid Ink with Ground text; real checkboxes/radios visually hidden under them |
| Agreement rows | `.agree` ring checkboxes (1.15rem, 1.75px ring, punched-dot selected) + expandable full text via `<details>` under the row; version tag in Ink 45 |
| Register pill + hint | `.pill`, hint in Ink 70 |
| Author line | existing avatar + author atom |
| Edit affordance (registered state) | the review item's 1.5px-outlined ghost button |

Do-not-literalize: sample values (Maren Costa etc.) are fixtures; the announcement's Bluesky row is text (no butterfly in the comp — the real build may reuse the shipped butterfly SVG per the survey hero); chips wrap naturally, exact wrap points are viewport-dependent.

Unresolved (do not invent): waiver + code of conduct final text (Claude drafts, Bryan swaps); the final venue between Palm Springs and the Coachella Valley.
