---
phase: 01-row-source-convergence
reviewed: 2026-11-13T11:20:19Z
depth: standard
files_reviewed: 3
files_reviewed_list:
  - packages/app/src/runtime/server/session-index.ts
  - packages/app/src/runtime/server/session-index.test.ts
  - packages/app/src/shell/titlebar/inbox-model.ts
findings:
  critical: 0
  warning: 5
  info: 4
  total: 9
  necessity: 1
status: issues_found
---

# Phase 01: Code Review Report

**Reviewed:** 2026-11-13T11:20:19Z
**Depth:** standard
**Files Reviewed:** 3
**Status:** issues_found

## Summary

I reviewed the plan 01-04 change (`618fbc20` → `7a61e655`, commits `6038a4ed0b`, `8bfcca7273`, `7a61e6550f`) on the three files it touches, against `01-04-PLAN.md`, `01-04-SUMMARY.md`, the prior `01-REVIEW-DISPOSITION.md` and the rules in `AGENTS.md` / `packages/app/AGENTS.md`. I re-ran the unit file on the delivered tree: **19 pass / 0 fail**, matching the SUMMARY.

**The precedence logic is correct as written.** `survivors === undefined` (no bounded page, or `boundedKnown` unset) is checked before the fetch time, so a `boundedKnown: false` caller — the Inbox — ignores `fetchedAt` entirely; a finite survivor minimum wins (`Number.isFinite`), so `fetchedAt` can neither tighten nor widen a non-empty page; only the `Infinity` sentinel falls through to `options.fetchedAt`. I traced the three production callers (`inbox-model.ts:203`, `home/sessions/index.ts:42`, `shell/commands/palette.ts:298`) and only the Projects view reaches the new floor. The known loop (`session-index.ts:49`), the `passive` recency branch (`:51-52`) and the final `!parentID && includeArchived !== false` filter (`:55-57`) are byte-identical to `diff_base`, so archived/child filtering and the Projects-only bound are unchanged. Prior **CR-01** and **CR-02** are closed by this plan.

What remains is that the new floor's *source* is weaker than the code claims. `dataUpdatedAt` is not "when the page was fetched": every `setQueryData` in this same file (`forget()`, `move()`) advances it, and it is a client wall clock compared against a server timestamp. Both defects are bounded in blast radius (they only matter while the page is empty and need another write or a skewed clock), so nothing here is a blocker — but the doc comments state an invariant the code does not hold, and the two new guarantees are pinned only at shapes production no longer uses, or not at all.

Carried-over findings that are still live on the delivered tree: the duplicated test case (prior WR-01 → WR-05 here), the `includeArchived` doc comment (prior IN-01 → IN-02), the failed-request widening (prior IN-02 → IN-03) and the all-archived fixture's premise (prior IN-05 → IN-04). Prior IN-03 (bench inventory) and IN-04 (survivor predicates) are outside this scope or unchanged; IN-04's point survives in the new necessity note below.

## Warnings

### WR-01: `fetchedAt` is the last cache write time, not the fetch time, so local writes silently tighten the new floor

**File:** `packages/app/src/shell/titlebar/inbox-model.ts:90-97, 209, 422-430` (with `packages/app/src/runtime/server/session-index.ts:43-44`)
**Issue:** `dataUpdatedAt` is advanced by `setQueryData` as well as by a fetch: `queryClient.setQueryData` dispatches a manual `success` that runs `successState(data, options.updatedAt)` → `dataUpdatedAt: dataUpdatedAt ?? Date.now()` (`@tanstack/query-core@5.91.2/build/modern/queryClient.js:93-104`, `query.js:60-68, 411-419`). This file writes the same `["inbox-sessions", <conn>]` key from `forget()` (line 91, from the `session.deleted` handler registered at `:101` by **every** `createSessionInbox` instance, including the Projects one at `projects.tsx:57`) and from `move()` (line 426 for the archive/unarchive path). So in the empty-page state this plan exists for — fresh install, or every root archived — a deletion or an Inbox archive/unarchive rewrites the cached page, moves `dataUpdatedAt` to "now", and the empty page's floor becomes "now". Every known root updated between the fetch and that write (which is exactly what the fix was added to keep) is dropped until the page refetches. The `fetchedAt` doc (`session-index.ts:9-11`) and the `entries()` comment (`inbox-model.ts:195-198`) call this "the time the page was fetched", which is false after a local write. This is not a regression against `diff_base` (the old `Infinity` dropped those rows too), but it is an incomplete fix plus a doc claim the code does not satisfy.
**Fix:** Keep the "fetch time" meaning by preserving the timestamp on local writes:
```ts
const patch = (key: readonly unknown[], update: (current: SessionInfo[] | undefined) => SessionInfo[] | undefined) =>
  queryClient.setQueryData<SessionInfo[]>(key, update, {
    updatedAt: queryClient.getQueryState(key)?.dataUpdatedAt,
  })
```
and route `forget()`/`move()` through it. Trade-off to note in the commit: preserving `updatedAt` leaves the locally patched page stale, which is arguably correct (it is no longer a server page). If the behavior is accepted instead, both doc comments must say the bound is the last page *change* time, not the fetch time.

### WR-02: The floor compares the client's wall clock with the server's timestamp, and no comment says so

**File:** `packages/app/src/runtime/server/session-index.ts:8-12, 43-44`; `packages/app/src/shell/titlebar/inbox-model.ts:209`
**Issue:** `time.updated` is the server's `SessionTable.time_updated` (`packages/schema/src/session.ts:48`, `packages/core/src/session/info.ts:52-59`), while `dataUpdatedAt` is the renderer's `Date.now()`. Every other comparison in this merge is server-vs-server, so the change introduces a cross-domain comparison — and both doc comments present the resulting bound as sound. With a client clock ahead of the server (the registry admits LAN/remote servers, and a drifting OS clock is ordinary), a session created after the fetch has `time.updated < floor`, gets no Projects row, and only recovers when the page refetches and comes back non-empty (which is what makes the SUMMARY's "a remount or reconnect re-derives" true — not the remount itself). `01-04-PLAN.md` records this as accepted (T-01-11); the code a future maintainer reads does not.
**Fix:** Add one sentence to the `fetchedAt` doc and to the `entries()` comment: "`dataUpdatedAt` is the client wall clock while `time.updated` is the server's; the bound assumes the two agree (true for the local sidecar, approximate for a remote server)." If a hard guarantee is wanted later, take the timestamp from the server response rather than from the client.

### WR-03: The Inbox now passes `fetchedAt`, and no case pins that the merge ignores it

**File:** `packages/app/src/runtime/server/session-index.test.ts:119-125, 222-231`; `packages/app/src/shell/titlebar/inbox-model.ts:206-210`
**Issue:** `entries()` supplies `fetchedAt` unconditionally, so the real Inbox call is `{ includeArchived: true, boundedKnown: false, fetchedAt: <number> }`. Both cases that pin "the Inbox keeps a known archived row" pass the options object **without** `fetchedAt` — a shape production no longer uses. The only thing keeping the Inbox unbounded is the `survivors === undefined ? undefined : …` guard at `session-index.ts:44`; the natural simplification `survivors ?? options.fetchedAt` is equivalent for the bounded view and would silently start bounding the Inbox, dropping the known archived row at `:123` and the first-paint row at `:228`. No case would fail.
**Fix:** Pass `fetchedAt` in both `inbox` option objects (for example `fetchedAt: 400` against a known row at `updated: 100`) and keep the existing assertions. That is the shape the app now runs, and it is the guard a refactor would break.

### WR-04: The wiring line has no automated regression, and both manual checks were left unrun

**File:** `packages/app/src/shell/titlebar/inbox-model.ts:209`
**Issue:** The whole fix depends on `entries()` reading `queries[index]?.dataUpdatedAt` and handing it to the merge; nothing fails if the argument is dropped, read from another index, or shadowed by a stale value. The merge-level cases supply their own `fetchedAt`, so they cannot observe the call site (the SUMMARY concedes this: D7 `human_judgment: true`, D10 `verification: []`). The reason it is "untestable" is itself a defect that survived from `01-REVIEW` WR-02: `packages/app/e2e/utils/mock-server.ts:1201-1204` filters with `!!session.time.archived === (ctx.query.archived === "true")`, so an **omitted** `archived` already returns only active rows — the inverse of `packages/core/src/session/store.ts:160-161`, which includes both when the parameter is absent. No Projects/Inbox e2e case can therefore build the all-archived page, and `typecheck` cannot see an omitted optional parameter. Both plan-mandated manual checks (create a session in the empty-page state and see its row; open an older unlisted session and see no new row) were not executed, so the call site is unverified in **both** directions on the delivered tree.
**Fix:** Fix the mock's omission semantics to match `store.ts:160-161`, then add one case to the Projects keeper (`e2e/regression/tabs.spec.ts` or the sidebar suite): archive 50+ roots, open Projects, create a session and assert its project row appears without a remount; separately open an out-of-window session and assert no row is added. Until then, the feature's premise is manually verified only and the report should say so.

### WR-05: A test case duplicates an existing one exactly

**File:** `packages/app/src/runtime/server/session-index.test.ts:192-197` (duplicate of `:90-95`)
**Issue:** `"a known root created after a non-empty page still joins"` uses the same fixtures (`a` 300 `/repo`, `b` 200 `/repo`, `d` 400 `/other` — declared twice, identically, at `:59-63` and `:131-134`), the same call `mergeRootSessionIndex([a, b], [d], { includeArchived: false, boundedKnown: true })` and the same two assertions as `"a known root created after the index fetch still joins"`. `packages/app/AGENTS.md` requires each behaviour to have one owning test and asks which credible regression the second copy catches; there is none. Carried from `01-REVIEW` WR-01, still open on the delivered tree.
**Fix:** Delete `:192-197`. `:90-95` stays the owner of the post-fetch join contract.

## Info

### IN-01: Impossible-state guard — an empty page with no fetch time cannot occur for the only bounded caller

**File:** `packages/app/src/runtime/server/session-index.ts:44` (with `packages/app/src/runtime/server/session-index.test.ts:145-153`)
**Category:** necessity
**Issue:** `options.fetchedAt` is consulted only when `boundedKnown` is set, a page exists, and no page row survives. The only caller that sets `boundedKnown` derives the page from `queries[index]?.data` (`inbox-model.ts:200`) and the time from `queries[index]?.dataUpdatedAt` (`:209`) for the same `index`, so any non-`undefined` page arrives with a `Date.now()`-based number (`query.js:411-419`; `dataUpdatedAt` is `0` only while `data` is `undefined`). "Page exists, fetch time absent" is unreachable at the call site, so the fallback's "no time bound" fail-open never fires in this stack. The case that pins it (`:147-153`) does not observe the contract its name claims either: its fixture is `created: 2, updated: 2`, not a session created after a fetch, and its comment ("The verifier's required call: … so a session this process created after the fetch still gets a row") describes an assertion the case cannot make. What actually pins the precedence of interest is `:234-242`.
**Fix:** Keep the fallback (the plan's required call needs it) but say in the doc that it is a contract guarantee for callers that supply no time rather than a path this app takes, rename the case to what it proves ("an empty page with no fetch time applies no time bound"), and drop the process vocabulary ("the verifier's required call") from the source comment.

### IN-02: `includeArchived`'s doc comment still states the opposite of the only caller

**File:** `packages/app/src/runtime/server/session-index.ts:4`
**Issue:** "Views that list archived sessions opt in; the Projects rows leave it unset." The Projects view passes `includeArchived: false` (`inbox-model.ts:207`) and must, otherwise SRC-01 regresses; the default (`undefined`) **keeps** archived rows. A caller who follows this comment re-introduces archived project rows. Carried from `01-REVIEW` IN-01; this plan rewrote the surrounding doc block without fixing it.
**Fix:** "Omit to keep archived rows (Home, the palette); pass `false` to drop them (Projects)."

### IN-03: A failed page request still widens the window to every known root, and the new floor does not apply

**File:** `packages/app/src/shell/titlebar/inbox-model.ts:200-211` (with `:134-136, 300`)
**Issue:** `retry: false` plus no focus refetch means a failed `inbox-sessions` request leaves `active === undefined`, so `indexed` is `undefined` and the merge takes the no-page branch: every known root joins, regardless of `fetchedAt`. That is now the widest state in the function, and `isError` is already read for the settle machine at `:300`. Carried from `01-REVIEW` IN-02.
**Fix:** Prefer `retry: 1`. Note that treating a failed page as `[]` is not sufficient by itself: with no data, `dataUpdatedAt` is `0`, so the empty-page floor would degrade to "no bound" and fail open — the fix needs the attempt time (for example `errorUpdatedAt`) or the retry.

### IN-04: The all-archived fixture guards a page shape the request cannot produce, and its parity case cannot fail

**File:** `packages/app/src/runtime/server/session-index.test.ts:136-143, 169-190`
**Issue:** The comment at `:136-137` still describes the pre-01-03 world ("Archiving bumps `time.updated`, so the 50 newest rows are all archived … the slots are spent before the archived rows are dropped"). With `archived: false` on the request (`inbox-model.ts:132`) the server never returns those rows, so `expect(page).toEqual([])` is guaranteed by the fixture rather than observed; the reachable empty page is plain `[]`, which `:157-167` already covers. `fetchedAt: 1_001_000` is the fixture's archive timestamp, not a plausible fetch time. The parity case at `:183-190` then compares two key lists that are empty by construction, so it cannot detect the restart divergence it names. Carried from `01-REVIEW` IN-05.
**Fix:** Reword to "an empty parsed page, built here from an all-archived page, stands in for a server with no active roots", and make the parity case include a post-fetch session (`updated` above `fetchedAt`) in `known`, asserting it appears in both merges.

---

_Reviewed: 2026-11-13T11:20:19Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: standard_
