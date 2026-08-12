# SvelteKit contribution kit: silent cookie drop when `handle` returns a Response

**This is NOT a new issue — it's a contribution to an existing one.** The
footgun is already filed as **[sveltejs/kit#15138](https://github.com/sveltejs/kit/issues/15138)**
("Use `Response` from third-parties without dropping `set-cookie` header",
open, label `needs-decision`, opened 2026-01-08 by the SvelteKit team). Do
not open a duplicate. Post the comment below on #15138.

Companion threads to reference, not file against:
- **[#11712](https://github.com/sveltejs/kit/issues/11712)** — open request to
  expose the internal `add_cookies_to_headers` helper as `cookies.write`.
  This is the "explicit escape hatch" half of the design.
- **[#8316](https://github.com/sveltejs/kit/issues/8316)** — earlier prior art
  for "set a cookie and redirect from `handle`."
- **[#11813](https://github.com/sveltejs/kit/issues/11813)** — adjacent:
  `event.cookies.set` throws while `event.setHeaders` doesn't, once a
  response exists.

## What we add that #15138 doesn't already have

The existing thread is motivated by DX friction (better-auth needs a
`sveltekitCookies()` workaround plugin; you can't set-cookie-and-redirect
from `handle`). Three things strengthen it toward a decision:

1. **A concrete in-the-wild breakage, not just friction.** A *published*
   ATProto OAuth library (`@svelte-atproto/oauth`) silently loses its
   `oauth_return_to` cookie for exactly this reason: it intercepts
   `/oauth/login` inside `handle` and `return json(...)`, so
   `event.cookies.set()` in its `startLogin` never reaches the browser.
   Users who ask to return to `/organizer` after login land on `/`.
2. **A security dimension the thread hasn't raised.** The silent no-op is
   worse than a DX papercut because it hides *auth-relevant* state. In this
   library the same `cookies.set()` API works in every handler that exits by
   *throwing* `redirect()` (the callback's session cookies ship fine) and
   fails only in the one that *returns* a Response (login) — so the author
   never noticed their own returnTo was dead code. Silent failures on a
   cookie primitive are precisely where auth bugs hide. (The library also
   has an unrelated open-redirect in its returnTo validator; SvelteKit is
   not at fault for that — but the silent cookie behavior is what kept the
   broken path invisible.)
3. **The docs currently imply the opposite.** The `@sveltejs/kit` Cookies
   API says `cookies.set` *"will add a `set-cookie` header to the
   response"* — unconditionally, no caveat that `resolve()` must run. That
   is independently a documentation bug regardless of how #15138 is decided.

## The mechanism (confirmed against `main`)

`event.cookies.set()` writes to a per-request jar. `add_cookies_to_headers()`
in `packages/kit/src/runtime/server/respond.js` flushes that jar in exactly
two places:

- the `if (e instanceof Redirect)` / error catch — responses SvelteKit
  builds from a **thrown** `redirect()`/`error()`; and
- inside the `resolve(event).then(response => …)` continuation — whatever
  `resolve()` produces.

A `Response` returned directly by the top-level `hooks.handle` passes
through **neither**. (Line numbers drift between versions — cite the two
call sites by name, not by number.)

## The proposal: decouple the cheap wins from the API decision

The thread is stuck on `needs-decision` because the *API shape* is the
bikesheddable part. Two fixes need no such decision and could land now:

- **Docs correction (tiny PR, ship immediately).** Amend the `cookies.set`
  description to state that the `set-cookie` header is applied only when the
  response is produced by `resolve()` or a thrown `redirect`/`error`, and
  that a `Response` returned directly from `handle` must carry cookies
  itself. Fixes the actively-misleading sentence independent of everything
  else.
- **Dev-mode warning (additive, zero breaking change).** When `handle`
  returns a `Response` and the cookie jar is non-empty (i.e. queued cookies
  are about to be silently dropped), emit a dev warning naming the fix:
  return `resolve(event)`, throw a redirect, or apply the cookies to your
  Response. This converts the silent footgun into a loud one without
  touching the API contract.

Then the actual API decision #15138 is already weighing, framed as
complementary rather than either/or:

- **Auto-honor (the ergonomic default, #15138's own proposal):** flush the
  jar onto whatever `handle` returns. Design notes to include so it reads as
  considered, not naive:
  - *exactly-once* — today's flush lives inside the `resolve()` continuation;
    a blanket end-of-`handle` flush must not double-apply on the `resolve()`
    path (duplicate `Set-Cookie`). Cleanest form is a single outermost flush
    plus the existing thrown-path flush.
  - *immutable headers* — the hooks docs already note a returned Response can
    have immutable headers that throw `TypeError` on mutation; the flush must
    tolerate that (guard/clone), not crash.
- **Explicit escape hatch (#11712's `cookies.write(response)`):** a sanctioned
  method to apply the queued jar to an arbitrary Response, for authors who
  deliberately hand-build one and want full control. Pairs with the dev
  warning ("…or call `cookies.write(response)`").

Auto-honor removes the surprise for the unaware; the explicit method serves
the deliberate. They're not competing — shipping both is coherent.

---

## Ready-to-paste comment for #15138

> Adding a real-world data point and a security angle to this, plus a
> suggestion for unblocking it.
>
> **In the wild:** the published `@svelte-atproto/oauth` library hits this
> exactly. It serves `/oauth/login` by intercepting inside `handle` and
> returning `json(...)`, and sets an `oauth_return_to` cookie via
> `event.cookies.set()` in that path. Because the response is *returned*
> (not `resolve()`d, not thrown), the cookie is silently dropped — so
> post-login "return to where you were" is broken for every consumer, and
> the app falls back to `/`.
>
> **Why this is more than DX:** the same library's session cookies (set in
> its OAuth *callback*) work fine — because the callback exits by throwing
> `redirect()`, which does flush the jar. So identical `cookies.set()` calls
> behave oppositely depending on whether the handler throws or returns, and
> the failure is completely silent. The author never noticed their own
> returnTo was dead code. Silent no-ops on a cookie primitive are exactly
> where auth bugs hide.
>
> **Docs are actively misleading here:** the `cookies.set` API doc says it
> "will add a `set-cookie` header to the response" with no caveat. That
> sentence is wrong for the returned-Response case regardless of how this
> issue is decided — worth a standalone docs PR.
>
> **Suggestion to unblock:** the API-shape question (auto-honor a returned
> Response's `set-cookie` vs. expose `cookies.write` per #11712) is the part
> that needs a decision, but two fixes don't:
> 1. correct the `cookies.set` docs to state the flush only happens via
>    `resolve()` or a thrown redirect/error;
> 2. add a dev-mode warning when `handle` returns a Response with a
>    non-empty cookie jar.
>
> Those kill the silent failure now, independent of the API decision. When
> the API is decided, auto-honor (this issue) and an explicit
> `cookies.write(response)` (#11712) read as complementary — default
> ergonomics + an escape hatch — rather than either/or. Two design notes for
> auto-honor: flush exactly once (don't double-apply on the `resolve()`
> path), and tolerate immutable response headers (the hooks docs already
> note they can throw on mutation).

## Sources

- https://github.com/sveltejs/kit/issues/15138 (the live thread)
- https://github.com/sveltejs/kit/issues/11712 · /8316 · /11813
- `packages/kit/src/runtime/server/respond.js`, `.../cookie.js` on `main`
  (two `add_cookies_to_headers` call sites; internal helper not exported)
- Library evidence: `@svelte-atproto/oauth` `src/server/{api,handlers,handle}.ts`
  — see `notes/upstream-oauth-issue.md` and `notes/poc/`
