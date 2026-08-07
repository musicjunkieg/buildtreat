# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

SvelteKit, deployed to Cloudflare. (Confirmed by Bryan 2026-08-04 — overrides the usual Railway default for this project.)

## Users

- **Respondents:** ATProto builders who already expressed interest in the retreat by responding to Bryan's Bluesky post. They arrive warm and excited, not skeptical — the survey confirms the retreat is real and gathers their details. They sign in with their ATProto identity and fill out one survey, on whatever device they have handy.
- **Organizers:** Bluesky organizes the retreat in partnership with Bryan. Bryan runs the survey and needs the collected responses to pick a retreat date window and location and to plan travel assistance.

## Product Purpose

buildtreat ("build" + "retreat") is a bespoke, single-purpose survey tool for planning an ATProto builders' retreat in Southern California. It exists because no existing survey tool has the date tooling Bryan wants. Success = every invited builder can complete the survey easily, and Bryan gets clean, complete data to choose dates, location, and travel-assistance budget.

## Positioning

The differentiating mechanism is date-range availability collection with edge-day granularity: respondents mark availability across multi-day date ranges, **including first-half vs. second-half-of-day availability on the first and last days of each range** — the arrival/departure nuance that generic tools (Doodle, When2meet, Google Forms) cannot express.

## Operating Context

- One retreat, one survey, one operational owner (Bryan, with Bluesky as organizing partner). This is a one-off, not a platform; simplicity beats generality.
- Respondents authenticate via **ATProto login** (Bluesky-style handle sign-in), which fits the audience and gives verified identity per response.
- The retreat: **3 nights / two full days**, in **Southern California**, sometime between **September 1 and November 15**. Lodging and food are covered by the organizers; respondents cover (or get help with) their own travel.

## Capabilities and Constraints

The survey collects, per respondent (Bryan's prepared question set, provided 2026-08-04):

1. **Name**
2. **Email**
3. **Location** (where the respondent is based)
4. **Interest:** "Are you interested in attending a 3-night, two full day atproto builders' retreat in Southern California sometime between September 1 – November 15?" — options: Yes / No / Maybe
5. **Travel affordability:** "We will be covering the cost of lodging and food. Are you able to afford your travel to the location?" — options: Yes / I could afford some but would need some financial assistance / I can not afford the travel
6. **Date availability:** a calendar covering Sept 1 – Nov 15 where respondents enter one or more date ranges (typed or mouse-selected); selected dates are colored in. On the **first and last day of each range**, respondents can indicate availability for only the **first half or second half of the day**.
7. **Location preference:** a **top-three ranking** of: Palm Springs, Coachella Valley, Joshua Tree, San Diego, Los Angeles metro (if possible).

Undecided / not yet provided (do not invent):

- Organizer-side results view (how Bryan reads the data) — scope not yet discussed

## Brand Commitments

- **The retreat is named "the Atmospheric Builders' Retreat"** (settled 2026-08-04; an earlier "taproot" mention was a typo for "atproto"). "buildtreat" is only the project codename and must not appear in the product surface.
- **The sign-in action is worded "Sign in with Atmosphere"** — the community's name for the ATProto ecosystem — never "Sign in with ATProto".
- **Organized by Bluesky, in partnership with Bryan** (updated 2026-08-05; supersedes the narrower "sponsored by" framing). The survey is the first artifact that names Bluesky's role publicly to the invitees, and the credit belongs to the whole retreat — not just the lodging-and-food line. Bluesky's backing explains why lodging and food are covered.
- **Tone: interested, not booked.** Respondents raised their hands; they have not committed. Confirmation copy acknowledges their interest without presuming attendance ("You said you were in" is too forward).
- **Organizer credit is minimal:** at most a small mention of Bryan as organizer ("organized by @chaosgreml.in" — his real handle, confirmed 2026-08-04). No personal branding beyond that.
- No logo, palette, or other visual constraints exist yet.

## Evidence on Hand

Bryan provided his full prepared survey content on 2026-08-04; it is recorded verbatim-in-substance under Capabilities and Constraints (question set, answer options, the Sept 1 – Nov 15 window, and the five-option SoCal location list). Question copy may be lightly edited for polish, but the substance — options, window, locations, half-day mechanics — is fixed product truth. No visual assets, logo, or brand materials exist. As of 2026-08-04 the repo contains only project-template scaffolding; there is no product code yet.

## Product Principles

1. **Respect the respondent's five minutes.** One survey, filled once — every question earns its place, and the date grid must be faster than typing availability into a text box.
2. **The date tooling is the product.** Edge-day (morning/evening) granularity on date ranges is the reason this exists; never flatten it to whole-day availability.
3. **Real content only.** Dates, locations, and question wording come from Bryan's prepared materials, not placeholders.
4. **One-off scale.** No multi-survey admin, no organizer accounts, no generality that serves a future that isn't planned.
5. **Meet the audience where they live.** ATProto identity is native to these users; sign-in should feel like a feature, not a gate.

## Accessibility & Inclusion

No product-specific standard was established. The survey itself asks about travel-assistance needs, so the form must present affordability questions plainly and without stigma.
