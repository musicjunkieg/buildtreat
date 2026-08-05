---
name: The Atmospheric Builders' Retreat
description: Pure white UI over full-bleed desert-dusk photography — a survey that reads as a feed, not a form.
colors:
  ink: "#ffffff"
  ink-70: "rgba(255, 255, 255, 0.7)"
  ink-45: "rgba(255, 255, 255, 0.45)"
  ink-35: "rgba(255, 255, 255, 0.35)"
  ink-12: "rgba(255, 255, 255, 0.12)"
  ground: "#0b0908"
  on-pill: "#0b0908"
typography:
  display:
    fontFamily: "Big Shoulders Variable, Arial Narrow, sans-serif"
    fontSize: "clamp(3.4rem, 13.5vw, 6rem)"
    fontWeight: 700
    lineHeight: 0.92
    letterSpacing: "0.005em"
  headline:
    fontFamily: "Big Shoulders Variable, Arial Narrow, sans-serif"
    fontSize: "clamp(2.6rem, 9vw, 4.2rem)"
    fontWeight: 700
    lineHeight: 0.92
    letterSpacing: "0.005em"
  title:
    fontFamily: "Big Shoulders Variable, Arial Narrow, sans-serif"
    fontSize: "clamp(2.2rem, 7.5vw, 3.6rem)"
    fontWeight: 700
    lineHeight: 0.92
    letterSpacing: "0.005em"
  body:
    fontFamily: "Hanken Grotesk Variable, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Hanken Grotesk Variable, system-ui, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 500
    letterSpacing: "0.18em"
rounded:
  pill: "999px"
  sheet: "14px"
  card: "10px"
  day: "6px"
  focus: "2px"
spacing:
  space-1: "0.375rem"
  space-2: "0.75rem"
  space-3: "1.125rem"
  space-4: "1.75rem"
  space-5: "2.75rem"
  gutter: "clamp(1.125rem, 4.5vw, 2.5rem)"
components:
  button-pill:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.on-pill}"
    rounded: "{rounded.pill}"
    padding: "0.7rem 1.5rem"
    height: "3.25rem"
---

# Design System: The Atmospheric Builders' Retreat

<!-- Recorded post-build from the shipped code (scan mode). Ground truth is
     src/app.css and src/lib/components/*; the direction contract lives in
     src/routes/+layout.svelte (FORM: Full-Bleed Feed, seed 9380440b).
     Documenter ran inline (no subagent harness) per the degraded role. -->

## Overview

**Creative North Star: "The Dusk Feed"**

Every screen is one full-viewport photograph of Southern California at dusk, and the interface is a single voice speaking over it in pure white. The survey refuses the centered-card stepper on a gray ground: it is a feed you flick through, one item per viewport, snap-scrolled like the social product its audience lives in. The photography — real Wikimedia location shots and labeled synthetic desert-modern atmosphere — carries all of the color; the UI contributes exactly one ink.

Density is low and bottom-weighted. Each item breathes at the top (a flex spacer, `min-height: 8–12vh`) and settles its content toward the bottom edge, where a scrim gradient darkens the photograph to near-black so text never negotiates with the image. Structure is drawn, not boxed: hairline rules at 35% white separate ledger rows; the only filled container in the world is the fully-rounded white pill. A film-grain tile at 7% overlay unifies photographic sources into one material.

The world was chosen deliberately over the assigned direction (user-chosen challenger, seed `9380440b`) and its finish bar is written into the layout contract: unreviewed and undocumented is unfinished.

**Key Characteristics:**
- One UI color: white, stepped only by opacity (100 / 70 / 45 / 35 / 12).
- Full-bleed photographic grounds under a bottom-heavy scrim; text sits on guaranteed near-black.
- Ultra-condensed stacked display caps (Big Shoulders) against a quiet grotesk body (Hanken Grotesk).
- Hairline ledger rows for facts and options; the white pill as the single filled action.
- One authored motion: content settles upward 28px when an item snaps in.
- 1.75-stroke outline icon rail; the filled Bluesky butterfly is the lone deliberate outsider.

## Colors

The palette is one ink over photography: every UI tone is white at an opacity step, and everything that reads as "color" on screen is the photograph underneath.

### Primary
- **Ink** (`#ffffff`, `--ink`): the entire interface — display type, body text, pill fill, icon strokes, dots, hairlines at reduced alpha. Selection state inverts it (`::selection` is 85% white with near-black text).

### Neutral
- **Dusk Ground** (`#0b0908`, `--ground`): the page background behind and beneath every photograph, the scrim gradient's base color, the sign-in sheet surface, and the text color on the pill (`--on-pill`). A warm near-black, not neutral gray.
- **Ink 70** (`rgba(255,255,255,0.7)`, `--ink-70`): secondary text — fact labels, author line, prompts' quieter siblings, unselected option text.
- **Ink 45** (`rgba(255,255,255,0.45)`, `--ink-45`): faint strokes — avatar ring, chip borders, input underlines, placeholders.
- **Ink 35** (`rgba(255,255,255,0.35)`, `--ink-35`): the hairline (`--hairline: 1px solid`), and resting progress dots.
- **Ink 12** (`rgba(255,255,255,0.12)`, `--ink-12`): fills that must read as surface, not stroke — hovered calendar days, the unavailable half of a split day cell.

### Named Rules
**The One Ink Rule.** The interface owns exactly one color: white. Hierarchy is opacity (70/45/35/12), never a second hue. If a design needs another color, it comes from a photograph.

**The Scrim Guarantee Rule.** Text never sits on raw photography. Every feed item carries a bottom-weighted gradient from transparent to 90–98% `#0b0908` (a `darker` variant exists for dense items like the calendar); location cards carry a left-to-right equivalent. Contrast is guaranteed by the scrim, not negotiated per photo.

## Typography

**Display Font:** Big Shoulders Variable (with Arial Narrow fallback) — self-hosted via `@fontsource-variable/big-shoulders`.
**Body Font:** Hanken Grotesk Variable (with system-ui fallback) — self-hosted via `@fontsource-variable/hanken-grotesk`.

**Character:** A shouting poster voice over a calm explanatory one. Display is ultra-condensed, uppercase, stacked tight (`line-height: 0.92`); body is a warm, legible grotesk that never competes with it.

### Hierarchy
- **Display** (700, `clamp(3.4rem, 13.5vw, 6rem)` line 1 / `clamp(2.55rem, 10vw, 4.5rem)` line 2, lh 0.92, uppercase): the retreat name on the hero, stacked as two lines of different scale (`--display-l1` / `--display-l2`).
- **Headline** (700, `clamp(2.6rem, 9vw, 4.2rem)`, lh 0.92, uppercase): question titles ("ARE YOU IN?") and the review title.
- **Title** (700, `clamp(2.2rem, 7.5vw, 3.6rem)`, lh 0.92, uppercase): the denser interactive items (dates, location).
- **Acknowledgment** (400, `clamp(1rem, 1.6vw + 0.7rem, 1.375rem)`, lh 1.4, `--text-ack`): the hero's two-line human couplet — the one place body type scales up.
- **Body** (400, 1rem, lh 1.5): question prompts, capped at 38–46ch measure.
- **Fact/Ledger** (500, 0.8125rem, tracking 0.14em, uppercase; 0.75rem / 0.1em under 900px): ledger row text (`--text-fact`, `--track-fact`).
- **Label/Kicker** (500, 0.6875rem, tracking 0.18em, uppercase): the `.kicker` atom — hero eyebrow, sheet headings, field labels.
- **Author** (400–550, 0.8125rem, `--text-author`): bylines, hints, error text.

### Named Rules
**The Stacked Caps Rule.** Display type is always uppercase, always `line-height: 0.92`, and multi-line titles stack as separate spans that may differ in size. Never letter-space display caps beyond 0.005em.

**The Kicker Exception.** The uppercase kicker/eyebrow (`.kicker`) is normally banned by the craft floor, but it is KEPT in this world by explicit user decision (2026-08-04), which overrides the ban. It is a documented exception scoped to this project: use the `.kicker` atom exactly as defined; do not invent additional eyebrow variants.

## Layout

The page is a vertical feed: `main.feed` is `height: 100dvh; overflow-y: auto; scroll-snap-type: y mandatory`, and every item is a `100dvh` section with `scroll-snap-align: start; scroll-snap-stop: always` (snap disabled under `prefers-reduced-motion`). Seven items, in fixed order: hero, you, interest, travel, dates, location, review.

Within an item, content is a bottom-anchored flex column: a `.breathe` spacer (`flex: 1 1 auto; min-height: 8–12vh`) pushes everything toward the lower third, over the scrim's darkest band. Horizontal padding is `--gutter` (`clamp(1.125rem, 4.5vw, 2.5rem)`) plus a reserved `2.4rem` on the right so text clears the fixed glyph rail; top and bottom padding add `env(safe-area-inset-*)`.

At `min-width: 900px` the content column caps at `620px` and left-aligns inside a `1160px` frame (`margin-inline: max(var(--gutter), calc((100vw - 1160px) / 2)) auto`) — the photograph keeps the full viewport; only the text column narrows. Fixed chrome: the icon rail vertically centered on the right edge, seven progress dots centered at the bottom. Spacing runs on a five-step rhythm (`--space-1` 0.375rem → `--space-5` 2.75rem). The sign-in sheet is bottom-docked full-width on mobile and becomes a centered `min(26rem, …)` card at `min-width: 700px`. Hero art swaps portrait→landscape at `(min-aspect-ratio: 1/1)` via `<picture>`.

### Named Rules
**The One Viewport Rule.** One item owns the entire viewport. Nothing scrolls inside an item on the feed axis; if content grows, it earns density (the `darker` scrim), never a second screen.

## Elevation & Depth

There are no box-shadows in this system. Depth comes from photography and light: the scrim gradient layers the image into fore/background, the film-grain tile (`/media/grain.png` at `background-size: 340px; opacity: 0.07; mix-blend-mode: overlay`) sits on every item as a unifying material, and the sign-in sheet separates from the feed with a plain `rgba(11,9,8,0.55)` backdrop plus `backdrop-filter: blur(3px)` and a hairline top border. The one inset-shadow in the codebase (`box-shadow: inset 0 0 0 3px var(--ground)` on a selected radio ring) is a punched-hole trick, not elevation.

### Named Rules
**The Flat World Rule.** No drop shadows, ever. Layering is expressed with scrims, hairlines, backdrop blur, and opacity — never with a shadow vocabulary.

**The Grain Rule.** Every photographic ground carries the grain tile at exactly 0.07 overlay. It is what makes five different photo sources read as one film stock; do not omit it or change its opacity per item.

## Shapes

Two shape languages, strictly divided. Interactive things are fully round: the pill (`border-radius: 999px`, `min-height: 3.25rem`), chips, dots, avatar rings, radio rings, the rail's tick badge. Everything else is drawn with hairlines on the photograph — ledger rows bounded by `1px solid var(--ink-35)` top/bottom, underline-only inputs (`border-bottom: 1px solid var(--ink-45)`, `border-radius: 0`), no boxes, no cards for text.

The few soft rectangles that exist serve imagery and surfaces, not text: location photo cards at `10px`, calendar day cells at `6px`, the desktop sign-in sheet at `14px`, and the `2px` focus-ring radius. Split-day availability is drawn as a half-filled shape: `linear-gradient(to bottom | to top, var(--ink) 50%, var(--ink-12) 50%)` on the day cell (and on the legend swatch against transparent).

### Named Rules
**The One Container Rule.** The fully-rounded white pill is the only filled container in the interface. Text content is never boxed or carded; it sits directly on the scrimmed photograph, structured by hairlines.

## Components

### Buttons (the Pill)
- **Character:** one confident action per item; full-width, unmissable, white.
- **Shape:** fully rounded (`999px`), `min-height: 3.25rem`, padding `0.7rem 1.5rem`.
- **Fill:** solid Ink (`#ffffff`) with Dusk Ground text (`#0b0908`), weight 650, 1.0625rem; icon gap 0.6rem.
- **Hover / Active:** `scale(1.015)` / `scale(0.985)` over 0.35s `--ease-out`; **Disabled:** opacity 0.55.
- **Secondary:** there is no secondary button style. Lesser actions are text, chips, or a 1.5px-outlined ghost (edit button on review: `border: 1.5px solid var(--ink)`, transparent fill).

### Ledger rows
- The `.ledger` atom: baseline-justified label/value pairs, `padding: 0.65rem 0`, hairline top per row plus a closing bottom hairline, uppercase 0.8125rem at 0.14em tracking. Labels in Ink 70, values in Ink, right-aligned with `text-wrap: balance`. Used for hero facts and echoed by choice options.

### Choice options (radio)
- Ledger-style rows: hairline-separated, Ink 70 at rest, Ink on hover/selected. A `1.15rem` circular ring (`border: 1.75px solid currentColor`) fills solid white when selected, with `inset 0 0 0 3px var(--ground)` punching the dot. Native input is visually hidden; `:focus-visible` outlines the ring.

### Inputs / Fields
- **Style:** transparent, underline only — `border-bottom: 1px solid var(--ink-45)`, `border-radius: 0`, 1.125rem text, kicker-styled label above, placeholder in Ink 45.
- **Focus:** the underline brightens to full Ink (`border-bottom-color: var(--ink)`); no outline box.
- Global `:focus-visible` elsewhere: `2px solid var(--ink)` outline, `3px` offset, `2px` radius.

### Chips
- Pill-shaped outline chips (`border: 1px solid var(--ink-45)`, radius 999px, 0.8125rem): date-range tokens and half-day toggles. Selected state fills solid Ink with Ground text (or the half-fill gradient for split days).

### Navigation (Rail + Dots)
- **Rail:** fixed right-center column of six `2.4rem` icon stops (person, heart, plane, calendar, pin, check), Ink at 0.62 opacity, full opacity + `scale(1.12)` on hover, a `3px` white dot marker at the active stop's left, and a `0.85rem` filled tick badge when a section is answered.
- **Dots:** seven fixed bottom-center `0.5rem` dots, Ink at 0.35, active at full opacity and `scale(1.25)`. Both animate at 0.3s `--ease-out` and are clickable jump targets.

### Sign-in sheet
- Ground-colored surface with hairline top border, kicker heading, underline input, and the pill; rises over 0.45s `--ease-out` (`@keyframes rise`: `translate: 0 30%` + fade) above a blurred backdrop.

### Icons
- One system: `1.75` stroke, round caps and joins, 24-unit grid, `currentColor`, ten names (person, heart, plane, calendar, pin, check, butterfly, chevron-down, plus, x). Decorative by default (`role="presentation"`), labeled via prop when semantic.

### Motion (the one authored moment)
- When an item snaps into view (IntersectionObserver, threshold 0.4), its content settles upward from `translate: 0 28px` and 0 opacity over 0.7s `--ease-out` (`cubic-bezier(0.16, 1, 0.3, 1)`). It is gated on `html.js` so non-JS clients never see hidden content, and neutralized under `prefers-reduced-motion`. Everything else is micro-transition only (0.15–0.45s state changes).

### Named Rules
**The One Settle Rule.** The caption settle is the only authored entrance in the world. New components may transition state (opacity, transform, ≤0.45s, `--ease-out`) but never add a second choreographed entrance.

**The Butterfly Exception.** The Bluesky butterfly is a filled brand mark, deliberately outside the 1.75-stroke system — it is a wordmark, not an icon. No other filled glyph is permitted.

## Do's and Don'ts

### Do:
- **Do** put every screen on a full-bleed photographic ground with the scrim gradient and the 0.07 grain tile; text belongs in the scrim's dark band.
- **Do** express all hierarchy as white opacity steps: 1 / 0.7 / 0.45 / 0.35 / 0.12 — the existing tokens, no new alphas.
- **Do** set display type in Big Shoulders, 700, uppercase, `line-height: 0.92`, sized with the established clamps.
- **Do** structure data as hairline ledger rows (`1px solid var(--ink-35)`) and reserve the solid white pill for the single primary action per item.
- **Do** honor `prefers-reduced-motion`, `env(safe-area-inset-*)`, and the `html.js` gate on anything that starts hidden.

### Don't:
- **Don't** introduce a second UI color, a gray ramp, or tinted surfaces — photography is the only source of color.
- **Don't** use box-shadows, filled cards, or bordered boxes around text; the pill is the only filled container.
- **Don't** add icons outside the 1.75-stroke/round-join/24-grid system, and don't fill any glyph except the Bluesky butterfly.
- **Don't** author new entrance animations; the snap-in settle is the world's one moment.
- **Don't** let text sit on unscrimmed photography or shrink the gutter/rail clearance (`--gutter` + 2.4rem right).
