# Taking the Atmospheric Builders' Retreat survey live

The runbook from "PR merged" to "invite link in people's DMs." Steps marked
🤖 are ones Claude can run for you; steps marked 👤 need your account or your
decision.

## 0. Prerequisites

- 👤 A Cloudflare account (free tier is fine — Workers, KV, and D1 all fit).
- 👤 `pnpm exec wrangler login` once, in a terminal (opens a browser OAuth flow).
- 👤 Merge [PR #1](https://github.com/musicjunkieg/buildtreat/pull/1).

## 1. Provision Cloudflare resources 🤖

Create the three KV namespaces and the D1 database, then paste the IDs
wrangler prints into `wrangler.jsonc` (replacing the `TBD_*` placeholders):

```sh
pnpm exec wrangler kv namespace create OAUTH_SESSIONS
pnpm exec wrangler kv namespace create OAUTH_STATES
pnpm exec wrangler kv namespace create PROFILE_CACHE
pnpm exec wrangler d1 create buildtreat
```

Apply the schema to the remote database:

```sh
pnpm exec wrangler d1 migrations apply buildtreat --remote
```

## 2. Decide the public URL 👤

Two options:

- **workers.dev** (zero setup): the app deploys to
  `https://buildtreat.<your-subdomain>.workers.dev`.
- **Custom domain** (nicer for invites): add a domain/route in the Cloudflare
  dashboard after the first deploy.

⚠️ The ATProto OAuth `client_id` **is** this URL — PDSes fetch
`<ORIGIN>/oauth-client-metadata.json` and require exact equality. Pick the
final URL before inviting anyone; changing it later means redeploying with a
new `ORIGIN` and everyone signs in again (no data is lost — responses key on
DID).

Set it in `wrangler.jsonc`:

```jsonc
"vars": { "ORIGIN": "https://your-final-url.example" }
```

## 3. Production secrets 🤖 (values generated fresh, never reuse dev .env)

```sh
# COOKIE_SECRET — any strong random string
openssl rand -base64 32 | pnpm exec wrangler secret put COOKIE_SECRET

# CLIENT_ASSERTION_KEY — an ES256 JWK; generate a fresh pair with the
# library's own tool into a scratch file, then upload:
cd "$(mktemp -d)" && npx atproto-oauth setup   # writes a scratch .env
# copy the CLIENT_ASSERTION_KEY value it printed, then:
pnpm exec wrangler secret put CLIENT_ASSERTION_KEY
```

## 4. Deploy 🤖

```sh
pnpm build
pnpm exec wrangler deploy
```

## 5. Populate the allowlist 👤 decides, 🤖 runs

**Until this table has rows, anyone with the link who can sign in with
ATProto may submit.** Add the invited handles (matching is case-insensitive;
DIDs get recorded automatically on first login so later handle changes don't
lock anyone out):

```sh
pnpm exec wrangler d1 execute buildtreat --remote --command \
  "INSERT INTO allowlist (handle) VALUES ('alice.bsky.social'), ('bob.example.com');"
```

Give Claude the list of handles and this becomes one command.

## 6. The deadline — needs your date, then a small code change 👤→🤖

Respondents can currently edit answers indefinitely; **no respond-by date is
displayed or enforced yet** (deliberately unbuilt because the date was
undecided). When you pick the date, tell Claude — the change is: a
`DEADLINE` var in `wrangler.jsonc`, the date surfaced in the hero/review
copy, and the response API rejecting writes after it (with the warm "survey
closed" state from the design brief).

## 7. Smoke test 👤

On the deployed URL, on your phone:

1. Sign in with your real handle (`chaosgreml.in`) — the consent screen
   should read "wants to uniquely identify you" and nothing more.
2. Answer all seven items; submit; reload — answers should come back
   prefilled from D1.
3. Try a second account that is NOT on the allowlist — it should get the
   polite invite-only refusal on submit.

## 8. Read the responses 🤖

There is no organizer dashboard yet (deliberately out of scope). Until one
exists, Claude can query D1 directly, e.g.:

```sh
pnpm exec wrangler d1 execute buildtreat --remote --command \
  "SELECT handle, name, interest, travel, location_ranking FROM responses;"
pnpm exec wrangler d1 execute buildtreat --remote --command \
  "SELECT did, start_date, end_date, start_portion, end_portion FROM availability_ranges ORDER BY start_date;"
```

When responses start arriving, ask Claude for the organizer view (an
availability heatmap over the Sept 1 – Nov 15 window is the natural shape).

## Loose ends, non-blocking

- `static/media/CREDITS.md` ships with the site (two location photos are
  CC BY-SA and require attribution) — it deploys automatically; keep it.
- The Coachella Valley photo is daylight where the other four are dusk —
  swappable on request.
- Generated atmosphere backgrounds are labeled synthetic in CREDITS.md;
  replace with real venue photography once the location is booked.
