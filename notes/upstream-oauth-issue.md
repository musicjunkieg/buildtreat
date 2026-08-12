# Upstream write-up kit: `@svelte-atproto/oauth` returnTo cookie bug

Companion artifact: **"Anatomy of a Vanishing Cookie"** —
https://claude.ai/code/artifact/cfe54d95-1b12-45a7-a48f-e761cf6718fa
(source preserved at `notes/vanishing-cookie.html`). Everything below is
condensed from that trace; line numbers verified against 0.3.x `dist` and
`@sveltejs/kit` 2.50.2.

---

> **Real-source line references** (a maintainer PR edits these, not the
> `dist` the artifact cites): open redirect — `src/server/api.ts:21`
> (`isSafeReturnTo`) and the duplicate at `src/server/handlers.ts:52`.
> Vanishing cookie — `src/server/api.ts:50` (queue),
> `src/server/handlers.ts:79` (`return json`), `src/server/handle.ts:15-17`
> (the side door). Runnable PoC + e2e steps: `notes/poc/`.
>
> **Critical interaction** (found by reading the real source): the two bugs
> mask each other — the cookie bug makes the open redirect unreachable in
> the default flow, so **the cookie fix and the validator fix MUST ship
> together**, or fixing the cookie activates a live open redirect. Details
> in `notes/poc/README.md` → "Reachability".

> **Three separate reports, three separate targets.** (1) The cookie bug →
> public issue/PR on the library (below). (2) The open redirect → PRIVATE
> security disclosure to the library maintainer (see next section). (3) The
> SvelteKit silent-cookie-drop footgun that made the library's mistake
> invisible → a comment on the existing upstream thread sveltejs/kit#15138,
> drafted in `notes/sveltekit-cookie-footgun.md`. Keep them separate; they
> go to different people and move at different speeds.

## ⚠️ Before anything else: split the two bugs

You found TWO bugs. They must not travel together:

1. **The cookie bug** (functional) → public GitHub issue + PR. Below.
2. **The open redirect** (`isSafeReturnTo` accepts `/\evil.example`;
   browsers normalize backslashes in `Location`) → this is a **security
   vulnerability**. Do NOT put it in a public issue. Report it privately
   first: GitHub "Report a vulnerability" (Security tab → private
   advisory) if the repo has it enabled, otherwise email the maintainer.
   Give them the buildtreat fix (`safeReturnTo` in `src/hooks.server.ts`:
   reject `\`, resolve the decoded value against origin) as a suggested
   patch. Public disclosure only after they ship or after a reasonable
   window.

---

## Issue draft (title + body, ready to adapt)

**Title:** `startLogin`'s `oauth_return_to` cookie never reaches the
browser — handle-hook responses bypass SvelteKit's cookie serialization

**Body:**

> **What happens:** `POST /oauth/login` with a `returnTo` value signs the
> user in, but after the OAuth callback they always land on `/` instead of
> the requested path.
>
> **Why:** `startLogin` queues the cookie with
> `getRequestEvent().cookies.set(COOKIE_RETURN_TO, …)`
> (`dist/server/index.mjs:228`). But SvelteKit's `event.cookies.set()`
> writes to an internal per-request jar, and the jar is only serialized to
> `Set-Cookie` headers in exactly two places in `respond.js`:
>
> - responses that come out of `resolve()` (line ~478), and
> - responses SvelteKit itself builds from a **thrown** `redirect()`/error
>   (line ~421).
>
> The login handler does neither — it **returns** `json(await
> api.startLogin(body))` (`index.mjs:331`) straight from the handle hook
> (`index.mjs:351`, `if (intercepted) return await intercepted`), so the
> response goes to the client byte-for-byte with no `Set-Cookie`. The
> callback then finds no cookie and takes the `redirect(303, "/")`
> fallback (`index.mjs:308-314`).
>
> **Why it's easy to miss:** the session cookies set in the callback DO
> work — because the callback exits by *throwing* `redirect(303, …)`,
> which routes through SvelteKit's catch-and-build path where the jar IS
> flushed. Same `cookies.set()` API, different exit path, opposite result.
>
> **Repro (minimal):** fresh SvelteKit app + this library, then:
> `curl -si -X POST localhost:5173/oauth/login -H 'content-type: application/json' -d '{"handle":"someone.bsky.social","returnTo":"/somewhere"}'`
> → response contains `{ url }` but no `Set-Cookie: oauth_return_to=…`
> header.
>
> **Fix options** (any one works; happy to PR):
> 1. Build the `Set-Cookie` header directly on the `json()` response in
>    the login handler (smallest diff; what we do app-side today).
> 2. Exit the login handler by throwing (matches the callback's working
>    path) — awkward for a JSON endpoint but consistent with existing
>    behavior.
> 3. Ship the intercepted paths as real routes/`+server.ts` endpoints
>    instead of returning from the handle hook — then `cookies.set()`
>    just works, and every future cookie is safe by construction.
>
> **Workaround for anyone else hitting this:** a `handle` hook sequenced
> *before* the library's that re-reads `returnTo` from a clone of the
> request body and appends the `Set-Cookie` header onto the returned
> response. (Reference implementation: buildtreat `src/hooks.server.ts`,
> `returnToFix`.)

---

## Tips for the upstream PR

- **Pick fix #1 or #3.** #1 is the surgical patch reviewers merge fast;
  #3 is the architectural fix — offer it in the issue, let the maintainer
  choose before you write code. Don't ship both in one PR.
- **Patch source, not dist.** The trace cites `dist/server/index.mjs`
  because that's what ships; the PR edits `src/server/api.ts` /
  `handlers.ts` (or wherever `startLogin`/`login` live upstream).
- **Mind the encoding round-trip.** The callback runs
  `decodeURIComponent(cookieValue)` (`index.mjs:311`), so whatever writes
  the header must store the value `encodeURIComponent`-ed. Mirror the
  existing cookie attributes exactly (`Path=/; HttpOnly; SameSite=Lax;
  Secure` outside dev; `Max-Age=600`).
- **One test that would have caught it:** call the login handler, assert
  the response carries a `Set-Cookie` starting `oauth_return_to=` when
  `returnTo` is valid, and none when it's absent/unsafe. A second test:
  full login→callback round-trip lands on `returnTo`, not `/`.
- **Don't touch `isSafeReturnTo` in this PR.** That's the private
  security report (see top). Mixing them forces the security fix into
  public review before disclosure.
- **PR body = issue's "why" compressed**, plus: what changed, the test,
  and "no behavior change for calls without returnTo". Link the issue
  (`Fixes #NN`). Check the repo for a changeset/CHANGELOG convention and
  follow it; note the semver level (patch — bugfix, no API change).
- **Tone note:** the maintainer has never heard of you. The issue's job
  is to be checkable in five minutes: every claim carries a file:line,
  the repro is copy-paste, and the fix menu means the response can be
  "yes, option 1" instead of a design discussion.

---

## Where everything lives

| Thing | Location |
| --- | --- |
| Full ELI5 trace | artifact (URL above) + `notes/vanishing-cookie.html` |
| App-side workaround + hardened validator | `src/hooks.server.ts` (`returnToFix`, `safeReturnTo`) |
| Library evidence | `node_modules/@svelte-atproto/oauth/dist/server/index.mjs` — 228 (set), 331 (return json), 351 (side door), 308–314 (fallback); `isSafeReturnTo` 213–222 |
| Kit evidence | `node_modules/@sveltejs/kit/src/runtime/server/respond.js` — ~421 (thrown-redirect flush), ~478 (resolve flush) |
