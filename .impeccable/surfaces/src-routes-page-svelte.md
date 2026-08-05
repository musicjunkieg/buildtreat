---
version: 1
slug: "src-routes-page-svelte"
primary_target: "src/routes/+page.svelte"
related_targets: ["src/routes/+layout.svelte"]
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
