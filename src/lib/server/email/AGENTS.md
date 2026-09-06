# src/lib/server/email — outbound mail

Transactional and broadcast email through comail.at. Inert until
`COMAIL_API_KEY` (wrangler secret) and the `COMAIL_*` vars are set;
`emailConfigured(env)` is the switch every caller checks first.

## Files

| File | Role |
|---|---|
| `email.ts` | Transport. `EmailMessage` (`to`, `subject`, `text`, `html?`, `category?`), `SendResult` (`{ ok, messageId }` or `{ ok: false, code, detail }`), `EmailEnv`, `emailConfigured`, `sendEmail`. One HTTP call per message; never throws on a 4xx/5xx — returns the failure so callers can record it. |
| `email-template.ts` | The branded HTML shell: `brandedEmail(options)`, `escapeHtml`, `retreatFacts()`, `heroImage()`, `locationImages()`, and `broadcastHtml(subject, body)` for organizer messages. Images are absolute URLs under `/media/email-*.jpg` served from `static/`. |
| `registration-email.ts` | `confirmationEmail(registration)` — the "you're in" message assembled from `content.ts` facts and the saved registration. |
| `broadcasts.ts` | Organizer broadcasts with a durable recipient ledger: `dedupeRecipients`, `createBroadcast` (snapshots recipients at send time), `unsentRecipients`, `markRecipient`, `listBroadcasts`, `getBroadcast`, and `runBroadcast(worklist, send, mark)` which sends sequentially and stops on the first transport failure so Retry can resume. |
| `*.test.ts` | Pure coverage: template escaping and structure, confirmation content, recipient dedupe and run semantics. |

## Boundaries

- Callers are route actions only: `routes/+page.server.ts` (`register` →
  confirmation) and `routes/organizer/+page.server.ts` (`emailTest`,
  `emailBroadcast`, `emailRetry`). Components never import from here.
- `runBroadcast` takes `send` and `mark` as callbacks so the tests can run
  it without a network or a database. Keep it that way.
- Every string that lands in HTML goes through `escapeHtml`. Subject and
  body from the organizer form are untrusted input.
- Plain-text `text` is always populated alongside `html`.
- The `category` field is comail's routing hint (`'broadcast'` for bulk,
  default transactional). Don't invent new categories without checking the
  provider's list in `EmailCategory`.

## Verify

`pnpm test`. For a real send, use the organizer Email panel's test-send with
your own address in a deployed environment — there is no local mail sink.
