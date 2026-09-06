# src/routes — pages, actions, endpoints

The only place client and server meet. Route files are thin: `load` gathers
data from `$lib/server`, actions validate and call one server function,
pages compose components from `$lib`. Logic that grows past a screen belongs
in a `$lib` module, not here.

## Map

| Path | Kind | What it does |
|---|---|---|
| `+layout.svelte` | layout | Fonts (Big Shoulders, Hanken Grotesk), `app.css`, favicon, the one `<main>`. |
| `+page.server.ts` | load + actions | The builder surface. `load` resolves the visitor (DID → handle/profile), allowlist status, saved response, survey gate (deadline / late pass / reopened), and registration state; sets the `abr_known` cookie (`readKnownUser`). Actions: `joinWaitlist`, `register` (parse → validate → `upsertConfirmed` → confirmation email), `decline`. |
| `+page.svelte` | page | Composes the survey feed (`lib/survey/*`, `lib/ui/*`) or, once a response exists, `lib/registration/RegistrationFlow`. Mounts `SignInSheet`. |
| `api/response/+server.ts` | PUT | Saves a survey draft. 401 without a session, 503 without D1, 400 on `ValidationError`; otherwise `upsertResponse`. |
| `api/invited/+server.ts` | GET | `?handle=` → `{ invited }`. Resolves the handle **only via `public.api.bsky.app`** — a direct `actorToDid` here would be an SSRF primitive on an unauthenticated endpoint. Keep it that way. |
| `organizer/+page.server.ts` | load + actions | Organizer console data and every organizer action (allowlist, late passes, reopen, waitlist promote, anchors, email test/broadcast/retry). Shared types and `requireOrganizer` live in `lib/server/organizer/page-data.ts`; the dev `?preview` fixture in `lib/server/organizer/preview.ts`. |
| `organizer/+page.svelte` | page | Composes the console from `lib/organizer/*` sections and panels. |
| `organizer/{responses,registrations,availability}.csv/+server.ts` | GET | Organizer-only CSV downloads via `lib/server/organizer/csv.ts`. |

`src/hooks.server.ts` runs before all of these:
`sequence(canonicalize, returnToFix, atproto.handle)` — redirect the
workers.dev host to the canonical domain, patch the OAuth `returnTo` cookie
(upstream workaround), then mount ATProto auth so `locals.did` is available.

## Rules

- **Access policy for `/organizer`:** signed out → minimal gate, no data;
  signed in but not in `ORGANIZER_DIDS` → 404 (indistinguishable from no
  route); organizer → everything. `requireOrganizer` enforces this at the
  top of `load` and every action.
- **Every action starts the same way:** auth check, `platform?.env?.DB`
  guard returning `fail(503, …)`, then parse `formData`. Match the pattern.
- **Return shapes are contracts.** Pages read `form?.message`,
  `form?.anchorDid` / `anchorOn`, `form?.anchorsCleared`, `form?.errors`.
  Adding a field is fine; renaming one means updating the page.
- **Reads that gate destructive writes fail loud** (`anchorsUnavailable`,
  `registrationsUnavailable`) rather than returning an empty array.
- **`dev`-only branches are compile-time.** `?preview` uses
  `$app/environment`'s `dev`, which is `false` in production builds, so the
  branch is eliminated — don't replace it with a runtime env check.
- **No SQL in routes.** The one exception (`toggleAnchor`'s respondent
  existence check) predates the split; prefer adding a function in
  `lib/server/organizer/admin.ts` over adding another.
- Endpoints return JSON via `json()` and never echo the request body.

## Verify

`pnpm check`, `pnpm test`, `pnpm build`. `pnpm dev` then `/`, `/organizer`
(signed out gate), `/organizer?preview` (synthetic data, dev only). Form
actions should work with JavaScript disabled — every `<form>` has a real
`action` and the page re-renders from `form` data.
