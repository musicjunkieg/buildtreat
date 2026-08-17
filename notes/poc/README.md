# PoC: authenticated open redirect in `@svelte-atproto/oauth`

Companion to `notes/upstream-oauth-issue.md`. This directory proves the
`returnTo` validation flaw two ways: a zero-dependency unit reproduction
(`is-safe-return-to.poc.mjs`) and the end-to-end steps below.

**Severity: Low (CVSS 3.1 ~4, tentative — phishing/trust-abuse grade;
vector `AV:N/AC:H/PR:N/UI:R/S:C/C:L/I:N/A:N`, where `AC:H` reflects the
cookie-persistence precondition below).** Read
"Reachability" before writing the report — it is the crux of an honest
disclosure.

---

## The vulnerability

`isSafeReturnTo` (`src/server/api.ts:13-22`) and the identical inline check
in the callback (`src/server/handlers.ts:52`) both gate the post-login
redirect target with a prefix test only:

```ts
decoded.startsWith('/') && !decoded.startsWith('//')
```

This admits `/\evil.example` and its `%5C`-encoded form. Browsers normalize
backslashes to forward slashes while parsing a `Location` header, so the
callback's `redirect(303, decoded)` sends the just-authenticated user to
`https://evil.example`.

## Reachability — READ THIS (the two bugs mask each other)

In the **shipped default flow the redirect is currently unreachable**,
because the separate cookie bug defuses it:

1. `startLogin` queues the `oauth_return_to` cookie via
   `event.cookies.set()` (`api.ts:50`).
2. The `login` handler exits with `return json(result)` (`handlers.ts:79`),
   returned straight from the handle hook (`handle.ts:15-17`) — bypassing
   SvelteKit's `resolve()`, so the cookie jar is never serialized and the
   cookie never reaches the browser.
3. At the callback, `cookies.get(COOKIE_RETURN_TO)` is therefore
   `undefined`, and control falls through to the safe `redirect(303, '/')`
   (`handlers.ts:57`). The dangerous `redirect(303, decoded)` at
   `handlers.ts:53` is dead code.

The open redirect becomes **live** in exactly two situations:

- **After the cookie bug is fixed.** Making the cookie persist — the
  obvious fix — activates the redirect. **The report must state that the
  cookie fix and the validator fix have to ship together, or fixing the
  cookie introduces a working open redirect.** This is the single most
  important sentence to include.
- **For any consumer that persists the cookie itself.** (buildtreat does,
  via its `returnToFix` hook — but buildtreat is NOT vulnerable, because
  its `safeReturnTo` rejects backslashes and resolves against origin. That
  hardened validator is the suggested patch.)

Because the default build isn't exploitable as-is, expect a reviewer to
score down for "non-default configuration." Frame it accurately: a
**latent** open redirect that the pending cookie fix will activate.

## Unit reproduction (runnable, no server)

```sh
node notes/poc/is-safe-return-to.poc.mjs
```

Reproduces `isSafeReturnTo` verbatim, feeds it four backslash payloads,
and models the callback's `decodeURIComponent` + the browser's backslash
normalization to show where each lands. Expected output: all four payloads
accepted by the library, rejected by the fixed validator, resolving
cross-origin to `https://evil.example`; the `/organizer` control accepted
by both. Exit 0 = reproduced.

## End-to-end reproduction (demonstrates the live path)

Because the cookie bug masks the default flow, plant the cookie directly to
simulate the post-fix state (or a cookie-persisting consumer), then drive
the callback.

1. Scaffold a minimal SvelteKit app wired with `@svelte-atproto/oauth` per
   its README (any handle; no real ATProto login needed to reach the
   returnTo branch — though a full login makes the strongest report).
2. Obtain a valid `oauth_return_to` cookie value for the target. Two ways:
   - **Post-fix / consumer-side:** if the cookie persistence works in your
     setup, start login with `returnTo=/\evil.example` and let the app set
     the cookie normally.
   - **Isolated:** set it directly to exercise the callback branch:
     ```sh
     curl -is 'https://TARGET/oauth/callback?code=<VALID_CODE>&state=<VALID_STATE>' \
       -H 'Cookie: oauth_return_to=%2F%5Cevil.example'
     ```
     `<VALID_CODE>` and `<VALID_STATE>` must be values the callback accepts:
     obtain them from a real ATProto login, or from a mocked/stubbed token
     exchange that returns a `code`/`state` pair the callback validates. The
     `code` is single-use and consumed on first callback (see the note
     below), so capture a fresh pair immediately before running this.
3. Capture the response header:
   ```http
   HTTP/1.1 303 See Other
   Location: /\evil.example
   ```
4. In a real browser, the address bar resolves that `Location` to
   `https://evil.example` — the authenticated open redirect. A screen
   recording or the raw header + resolved address bar side by side is the
   whole PoC.

Note: the OAuth `code` is single-use and consumed before the redirect
fires, and default `Referrer-Policy: strict-origin-when-cross-origin`
strips the query string on the cross-origin hop — so this is a
**phishing/trust-abuse** open redirect, not a reliable token-theft
primitive. Do not claim token exfiltration you cannot demonstrate; the
honest Low framing lands better with a maintainer.

## The fix (bundle both)

- **Validator** (`api.ts:isSafeReturnTo` + the duplicate at
  `handlers.ts:52`): reject `\`, and resolve the decoded value against the
  request origin — `new URL(decoded, origin).origin !== origin` → reject.
  Reference implementation: buildtreat `src/hooks.server.ts` `safeReturnTo`,
  mirrored in the unit PoC.
- **Cookie** (`handlers.ts:79` `login` returns `json`): attach the
  `Set-Cookie` header to that response, or exit by throwing (as the
  callback does) so SvelteKit flushes the jar — see
  `notes/upstream-oauth-issue.md` for the three options.

Ship them in one advisory: fixing the cookie without the validator is a
regression, not a fix.
