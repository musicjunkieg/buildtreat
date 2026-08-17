# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [Unreleased]

### Security
- Patch transitive dependency CVEs via pnpm overrides: nanoid 3.3.18, undici 7.29.0, cookie 0.7.2 (#88)

### Added
- Organizer scenario planner: anchors persist in D1 (survive reload, shared across organizers) + window roster — select a top-5 window to see who can and can't make it by name, anchored people marked (#90)
- Chainlink-export union merge driver for valid exports (malformed JSON stays a human-resolved conflict) + port to project-template (#78)
- Waitlist signup for uninvited visitors — sign in, leave an email, organizer can promote from the responses view (#75)
- Organizer: anchor-people scenario mode — toggle respondents, highlight full-overlap dates in the heatmap, badge top-5 windows that fit all anchors (#54)
- Calendar picker: bits-ui-style range selection — click-start/click-end fill and smoother touch — keeping multi-range, half-day, and the existing visuals (#50)
- Organizer backend: allowlist, responses table, availability heatmap, CSV export (#48)
- Review: answers-updated confirmation + sign-out at end (#41)
- Location question: add no-preference option (#40)
- Linkify DM @chaosgreml.in mentions via aturi.to profile waypoint (#38)
- Pre-flight allowlist check on handle submit, before OAuth (#37)
- Write at.marque.dns zone record for Bryan's domain (#33)
- Deadline: Aug 15 2026 23:59:59 PT — display + enforcement (#31)

### Fixed
- Best-windows ranking: drop the departure-morning requirement and de-cluster the top list (#56)
- Anchor overlap rings legible on bright heatmap cells — punched double-ring fix (#69)
- Heatmap aria-label half-day wording; scenario bar no longer hides when the filter empties dated responses (#65)
- OAuth returnTo cookie never set — organizer sign-in landed on the survey instead of the requested page (#49)
- Review findings: pre-pin allowlist DIDs, fail-open gates, log swallowed errors (#42)
- Gate allowlist at sign-in, not just submit (#36)
- OAuth login on the deployed Worker: SSR now resolves workerd package builds, fixing the 500 on sign-in (#19)

### Changed
- CodeRabbit round 5: 3 fixes, 4 reasoned skips (#45)
- CodeRabbit round 4: 10 findings across both overlapping reviews (#44)
- Address CodeRabbit review on PR #3 until approval (#43)
- Add tyler.fun to allowlist (#39)
- Cut over to buildersretre.at: ORIGIN, redirect, verify (#35)
- Load allowlist: 16 invitee handles + organizer (#32)
- Rebuild and deploy Bryan's manual tweaks (#30)
- Desktop (16-inch MBP) reviewer snapshots (#29)
- Copy reviewer pack into project folder (#28)
- Reviewer snapshot pack: high-res captures of all seven items (#27)
- Bluesky-organized attribution + logout affordance (#26)
- Post-smoke-test notes from Bryan (#20)
- Favicon: numeric globe in world style (#25)
- Handle typeahead (typeahead.waow.tech) + welcome-back cookie (#24)
- Location field: ZIP/city lookup (#23)
- Next affordance + Enter-to-advance per item (#22)
- Lock feed pre-auth: hero only, dimmed rail, unlock on sign-in (#21)
- Provision Cloudflare and deploy the survey to workers.dev (#18)
- Write LAUNCH.md runbook for taking the survey live (#17)
- Verify local Playwright screenshots after sandbox hole (#16)
- Commit impeccable install (skill, agents, hooks) to repo (#15)
- Complete DESIGN.md type ramp so hook matches shipped sizes (resume) (#14)
- Complete DESIGN.md type ramp so hook matches shipped sizes (#13)
- Build buildtreat survey (Full-Bleed Feed) (#5)
- Finish: detector, reviewer, documenter, DESIGN.md (#12)
- ATProto auth + allowlist + response storage (#11)
- Availability calendar (focal item) (#10)
- Survey items 1-4 + 6-7 (hero, identity, interest, travel, ranking, review) (#9)
- Feed shell: snap paging, rail, item dots (#8)
- SvelteKit + Cloudflare scaffold (#7)
- North-star comps + approval (#6)
- Verify OPENAI_API_KEY wiring for impeccable image generation (#4)
- Shape the buildtreat survey surface: discovery, visual world, design brief (#3)
- Fold Bryan's prepared survey content into PRODUCT.md (#2)
- Run /impeccable init: capture product context in PRODUCT.md (#1)
