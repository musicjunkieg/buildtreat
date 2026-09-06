# src/lib/server/organizer — organizer authorization and data

Server-only support for `/organizer`: who counts as an organizer, the
allowlist and its gates, and the page-data shaping that keeps the console
components free of `$lib/server` imports.

## Files

| File | Migration | Owns |
|---|---|---|
| `admin.ts` | `0002_organizer`, `0004_anchors` | `isOrganizer(env.ORGANIZER_DIDS, did)`; `getAllResponses` → `OrganizerResponse[]`; allowlist CRUD (`listAllowlist`, `addAllowlistHandles` (bulk paste, returns `{ added, skipped }`), `removeAllowlistHandle`); survey reopen flag (`isReopened`/`setReopened`); late passes (`listLatePasses`, `grantLatePass`, `revokeLatePass`, `hasLatePass`); anchors (`listAnchors`, `setAnchor`, `clearAllAnchors`); `surveyGate(db, deadlineRaw, who)` → `SurveyGate`, whether this visitor may still answer (deadline, late pass, reopen flag). |
| `page-data.ts` | — | `OrganizerPageData` (the `load` return type), `EMPTY` (signed-out shape), `RegistrationView` + `toRegistrationView` (precomputes `travel`/`registered` server-side because the client can't import those helpers), `requireOrganizer(locals, platform)` (404 for non-organizers), `broadcastMessage(run)`. |
| `preview.ts` | — | `previewData()` — deterministic synthetic dataset for the dev-only `?preview` state. Only reachable when `dev` is true at build time. |
| `csv.ts` | — | RFC 4180 output with a formula-injection guard (`toCsv` prefixes cells starting with `= + - @` or tab): `responsesCsv`, `registrationsCsv`, `availabilityCsv`. Used by the three `routes/organizer/*.csv` endpoints. |
| `csv.test.ts` | — | Escaping and formula-guard coverage. |

## Boundaries

- **404, not 403.** A signed-in non-organizer must not learn the route
  exists. `requireOrganizer` throws `error(404)`; keep every organizer
  action and endpoint behind it.
- **Handles are normalized on write** (`@` stripped, lowercased) and the
  allowlist is compared on the normalized form everywhere.
- **Anchors are DIDs of respondents.** `setAnchor` assumes the caller has
  verified the DID exists in `responses` (the route action does this).
- **Preview data never touches D1** and must stay behind the compile-time
  `dev` check in the route. Don't add a runtime env flag for it.
- **CSV cells that start with `= + - @` or a tab get a leading apostrophe.** Any new
  column of user-entered text goes through `toCsv`, not a hand-built join.
- Changing `OrganizerPageData` means changing `EMPTY`, `previewData()`, and
  the components that consume the field — svelte-check will point at each.

## Verify

`pnpm test` covers `csv.test.ts`. For `admin.ts` and the gates, `pnpm dev`
with a local D1, sign in as a DID in `ORGANIZER_DIDS`, and exercise the
console; then sign in as a non-organizer and confirm `/organizer` is a 404.
