# src/lib/server/messaging — outbound email and Bluesky DMs

Transactional email and organizer broadcasts. Email goes through comail.at;
broadcasts can instead go out as Bluesky DMs through the chat service. Each
channel is inert until its secrets are set — `emailConfigured(env)`
(`COMAIL_API_KEY` + the `COMAIL_*` / `EMAIL_FROM` vars) and
`dmConfigured(env)` (`BSKY_DM_HANDLE` + `BSKY_DM_APP_PASSWORD`) are the
switches every caller checks first.

## Files

| File | Role |
|---|---|
| `email.ts` | Email transport. `EmailMessage` (`to`, `subject`, `text`, `html?`, `category?`), `SendResult` (`{ ok, messageId }` or `{ ok: false, code, detail, retryable }`), `EmailEnv`, `emailConfigured`, `sendEmail`. One HTTP call per message; never throws on a 4xx/5xx — returns the failure so callers can record it. comail rejects a display-name From, so `EMAIL_FROM` is a bare address. |
| `bsky-dm.ts` | DM transport. `dmConfigured`, `createDmSession(env)` (app-password sign-in; the password must have DM access), `resolveHandle`, `sendDm(session, did, text)` → the same `SendResult` shape as email, `linkFacets(text)` so links are tappable. Re-exports `DM_MAX_GRAPHEMES` / `graphemeCount` from `lib/organizer/dm-text.ts`, which the compose UI shares. |
| `email-template.ts` | The branded HTML shell: `brandedEmail(options)`, `escapeHtml`, `retreatFacts()`, `heroImage()`, `locationImages()`, and `broadcastHtml(subject, body)` — light markdown (headings, lists, bold/italic, links) for organizer messages. Images are absolute URLs under `/media/email-*.jpg` served from `static/`. |
| `registration-email.ts` | `confirmationEmail(registration)` — the "you're in" message assembled from `content.ts` facts and the saved registration. |
| `audiences.ts` | **Pure** — who a broadcast reaches. `CHANNELS`/`Channel`, `AUDIENCES`/`Audience` + `audienceLabels`, `audienceMembers`, `audienceRecipients(audience, …, channel)` (email drops blank and shared addresses; DM keeps every DID), `audienceCounts`, `broadcastPeople` (everyone the "also include" picker can add, tagged with the audiences that already reach them), `mergeRecipients` (audience + extras), `dedupeRecipients`. |
| `broadcasts.ts` | D1 ledger + send loop: `createBroadcast` (snapshots recipients at send time), `unsentRecipients`, `markRecipient`, `listBroadcasts`, `getBroadcast`, and `runBroadcast(worklist, send, mark)` which sends sequentially and stops on the first retryable failure so Retry can resume. Re-exports `audiences.ts`, so callers import broadcast types from one place. Migrations `0005`, `0007` (audience), `0009` (channel + handle). |
| `*.test.ts` | Pure coverage: template escaping and markdown, confirmation content, DM facets and session handling, audience membership, recipient merge/dedupe, run semantics. |

## Boundaries

- Callers are route actions only: `routes/+page.server.ts` (`register` →
  confirmation) and the organizer's `lib/server/organizer/broadcast-actions.ts`
  (`emailTest`, `emailBroadcast`, `dmTest`, `dmBroadcast`, `retryBroadcast`).
  Components never import values from here; `import type` of
  `Audience`/`BroadcastView`/… is fine.
- `runBroadcast` takes `send` and `mark` as callbacks so the tests can run
  it without a network or a database. Keep it that way.
- A DM broadcast signs in **before** snapshotting recipients, so a bad app
  password fails fast instead of leaving a broadcast with every row pending.
- Every string that lands in HTML goes through `escapeHtml`. Subject and
  body from the organizer form are untrusted input.
- Plain-text `text` is always populated alongside `html`.
- The `category` field is comail's routing hint (`'broadcast'` for bulk,
  default transactional). Don't invent new categories without checking the
  provider's list in `EmailCategory`.
- The exact venue never goes on the public site; emails to list members and
  registrants may name it.

## Verify

`pnpm test`. For a real send, use the organizer panel's test send (email
address or Bluesky handle) in a deployed environment — there is no local mail
sink or chat sandbox.
