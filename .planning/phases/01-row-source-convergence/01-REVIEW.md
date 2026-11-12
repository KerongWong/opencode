---
phase: 01-row-source-convergence
reviewed: 2026-11-12T17:18:30Z
depth: standard
files_reviewed: 5
files_reviewed_list:
  - packages/app/perf/session-index.bench.ts
  - packages/app/perf/session-index.ts
  - packages/app/src/runtime/server/session-index.test.ts
  - packages/app/src/runtime/server/session-index.ts
  - packages/app/src/shell/titlebar/inbox-model.ts
findings:
  critical: 2
  warning: 2
  info: 5
  total: 9
  necessity: 1
status: issues_found
---

# Phase 01: Code Review Report

**Reviewed:** 2026-11-12T17:18:30Z
**Depth:** standard
**Files Reviewed:** 5
**Status:** issues_found

## Summary

I reviewed the page-or-`undefined` merge contract, the survivor-only floor, the `archived: false` page request and the five new cases against `01-03-PLAN.md`, `01-03-SUMMARY.md`, `01-VERIFICATION.md` and the hard constraints in `AGENTS.md` / `packages/app/AGENTS.md`. The core mechanism is right: `undefined` now means "no page" and any array bounds, the floor is reduced only over rows the final filter can keep, and the `passive` branch and final filter are byte-identical to the pre-plan file, so truths 3, 7 and SRC-01 do not regress. I re-ran the unit tests (`25 pass / 0 fail` across `session-index.test.ts` and `home/sessions/index.test.ts`), `bunx oxlint` on the five files, `bun run typecheck:e2e` (no diagnostics in `perf/` or the three source files) and `bun script/lint-changed.ts db7df8d999`.

Two things block the change as delivered. First, the `Number.POSITIVE_INFINITY` floor is the wrong sentinel for an empty fetched page: it drops *every* known root, including a session created **after** the fetch, and nothing in the tree refetches `inbox-sessions` on `session.created` — so a fresh install (or the all-archived state this phase targets) shows "No sessions yet" in Projects while the session the person just created is open in the pane. Second, `bun run lint:changed HEAD^1` — the `Lint changed files` CI job — fails on the delivered tree, because two edited files still carry `anti-slop(require-readable-spacing)` warnings that IN-03 descoped.

The two warnings are a duplicated test case and the fact that the phase's central behaviour (`archived: false`) has no automated regression at all: the e2e mock server treats an omitted `archived` parameter as `archived=false`, which is the inverse of the real store, so no e2e test can observe either the old bug or the fix.

## Critical Issues

### CR-01: An empty fetched page drops sessions created after the fetch, and nothing refetches them

**File:** `packages/app/src/runtime/server/session-index.ts:25-38` (with `packages/app/src/shell/titlebar/inbox-model.ts:134-137, 198-205`)
**Issue:** When the fetched page has no surviving root, the floor is `Number.POSITIVE_INFINITY`, so the skip at line 38 (`info.time.updated < floor`) drops **every** known root — including a session created or updated after the fetch, which is inside any window by definition. This is reachable in two ordinary states:

1. **Fresh install.** `session.list({ limit: 50, order: "desc", parentID: null, archived: false })` returns `{ data: [] }`; `parseHomeSessionIndex([])` is `[]`; `active` is `[]` (a fetched page, not `undefined`), so the floor is `Infinity`. The person creates their first session (`titlebar.tsx:469` is available while `SidebarProjects` is mounted); it lands in `data.session.known()`, but the merge drops it and Projects renders `"sidebar.projects.empty"` → **"No sessions yet"** (`packages/app/src/runtime/i18n/en.ts:819`) while that session is open in the main pane.
2. **The all-archived state this plan exists for.** Same floor, same drop.

Nothing recovers while the sidebar stays mounted. The plan's rationale ("until the page refetches (30s stale time, `refetchOnMount`, window focus)") does not hold: `staleTime: 30_000` (`inbox-model.ts:135`) never triggers a refetch by itself, `refetchOnWindowFocus` is `false` globally (`app.tsx:32`), and no handler invalidates `["inbox-sessions", conn]` on `session.created` — the only invalidation points are `rename-session.ts:24`, `recent-sessions.tsx:680` (archive) and `delete` paths. `retry: false` (`inbox-model.ts:134`) means even a transient failure sticks until a remount or reconnect. Before this change the known-only fallback showed the new session; this is therefore a regression against `origin/dev`, not only the accepted "old sessions stay hidden" trade-off.

**Fix:** Make a post-fetch creation invalidate the window (cheap, and it re-derives a real floor because the new session is the newest active root):

```ts
// inbox-model.ts, inside the existing event effect (lines 99-121), next to the session.deleted handler
onCleanup(
  item.ctx.data.on("session.created", (event) => {
    if (event.data.parentID) return
    void queryClient.invalidateQueries({ queryKey: ["inbox-sessions", item.conn], exact: true })
  }),
)
```

If you prefer to fix it in the merge rather than with a request, pass the page's fetch time and use it instead of `Infinity` when no page row survives, so `time.updated >= fetchedAt` keeps post-fetch work in the window. Either way, add a case pinning it: `mergeRootSessionIndex([], [session("new", { time: { created: 2, updated: 2 } })], { includeArchived: false, boundedKnown: true })` must keep `new` — today it returns `[]`.

### CR-02: `Lint changed files` (CI) fails on the delivered tree

**File:** `packages/app/src/runtime/server/session-index.ts:35`, `packages/app/src/runtime/server/session-index.test.ts:99`
**Issue:** `script/lint-changed.ts` fails on *any* oxlint diagnostic, warn-level included (`script/lint-changed.ts:56-60`), and `.github/workflows/check.yml:39-43` runs it on every pull request. Reproduced on the current tree:

```
$ bun script/lint-changed.ts db7df8d999
packages/app/src/runtime/server/session-index.ts:35:3  anti-slop(require-readable-spacing)  Expected blank line before this statement.
packages/app/src/runtime/server/session-index.test.ts:99:5  anti-slop(require-readable-spacing)  Expected blank line before this statement.
lint:changed: 2 problem(s) in 2 of 3 changed files since db7df8d999
exit=1
```

`session-index.ts:35` is inside this plan's changed hunk (the `rows` line was rewritten), and the test file is edited by this plan. `01-03-PLAN.md` explicitly deferred IN-03 ("lint spacing") as out of scope, but both files are edited by the phase, so the deferral turns a pre-existing warning into a merge gate the branch cannot pass. Root `bun run lint` still exits 0, which is why the SUMMARY's "2 warnings, 0 errors" reading missed it.

**Fix:** Add the two blank lines:

```ts
      : undefined

  const rows = new Map((indexed ?? []).map((info) => [info.id, info]))
```

```ts
    const indexed = session("a", { title: "indexed", time: { created: 1, updated: 300, idle: 5 } })

    const known = session("a", {
```

## Warnings

### WR-01: A new test case duplicates an existing one exactly

**File:** `packages/app/src/runtime/server/session-index.test.ts:163-168`
**Issue:** `"a known root created after a non-empty page still joins"` is byte-for-byte the same contract as `"a known root created after the index fetch still joins"` at `:90-95` — same fixtures (`a` 300 `/repo`, `b` 200 `/repo`, `d` 400 `/other`), same call `mergeRootSessionIndex([a, b], [d], { includeArchived: false, boundedKnown: true })`, same `["a", "b", "d"]` and `["srv\u0000/repo", "srv\u0000/other"]` assertions. It fails the third test-admission question in `packages/app/AGENTS.md` ("why does no existing test already catch that regression") and the "One contract, one owner" rule, and `01-03-SUMMARY.md` claims duplicate coverage was deduplicated for the other two Task-1 behaviours — this one was not.
**Fix:** Delete `:163-168`. The `bounded known window` copy at `:90-95` stays the owner of the post-fetch join contract.

### WR-02: The phase's central behaviour has no automated regression, and the e2e mock cannot observe it

**File:** `packages/app/src/shell/titlebar/inbox-model.ts:132`
**Issue:** `archived: false` is the entire fix for CR-01/the old REVIEW CR-01, and nothing can fail if a later refactor drops it. The plan records this as `human_judgment: true` (SUMMARY D7), but the reason it is untestable is itself a defect: `packages/app/e2e/utils/mock-server.ts:1201-1204` filters with `!!session.time.archived === (ctx.query.archived === "true")`, so an **omitted** `archived` already returns only active rows — the inverse of `packages/core/src/session/store.ts:160-161`, which includes both when the parameter is absent. Consequence: every existing Projects/Inbox e2e case passes with or without the new parameter, and the all-archived page head this plan defends against cannot be built in e2e at all. `typecheck:tsc` cannot catch an omitted optional parameter either.
**Fix:** Fix the mock to honour omission (no parameter → both archive states, matching `store.ts:160-161`), then add one case to the Projects keeper: archive 50+ roots, open Projects, assert the in-window active projects are listed and an out-of-window session opened afterwards adds no row. Until then, keep the manual check in `WINDOWS.md` and say in the SUMMARY that the fix's premise is manually verified only.

## Info

### IN-01: `includeArchived`'s doc comment states the opposite of the only caller

**File:** `packages/app/src/runtime/server/session-index.ts:4`
**Issue:** "Views that list archived sessions opt in; the Projects rows leave it unset." The Projects row source passes `includeArchived: false` (`inbox-model.ts:204`) and must, otherwise SRC-01 regresses; the default (`undefined`) *keeps* archived rows. A future caller who follows this comment omits the option and re-introduces archived project rows. Carried over from `01-01` (IN-01) and descoped by the plan, but it now describes the one call site the phase depends on.
**Fix:** "Omit to keep archived rows (Home, the palette); pass `false` to drop them (Projects)."

### IN-02: A failed page request is indistinguishable from "no page", so one error widens the window

**File:** `packages/app/src/shell/titlebar/inbox-model.ts:198-205` (with `:134-135`)
**Issue:** With `retry: false` and no focus refetch, a failed `inbox-sessions` request leaves `active === undefined`, so the merge falls back to every known root — the exact widening truths 5/the 01-02 prohibition forbid — and stays there until a remount, reconnect or unrelated invalidation. `isError` is already read for the settle machine (`:294`), so the difference between "not fetched yet" and "fetch failed" is available. This matches the plan's "offline" case, hence Info, but the state persists far longer than an offline blip.
**Fix:** Either `retry: 1` on the query, or treat a failed page like an existing empty page (`active ?? []` when `isError`) so the window never widens from an error.

### IN-03: The new benchmark is missing from the bench inventory

**File:** `packages/app/perf/session-index.bench.ts:1-14`
**Issue:** `packages/app/perf/README.md:8-20` lists every `packages/app/perf` bench file and every case; `session-index.bench.ts` appears in neither that table nor the "Other packages keep their benchmarks next to their code" table (`:37-43`). It is also the first *script* case in `packages/app/perf`, which the README currently documents only for core/ui. Nobody running `--check` over the documented set will know it exists.
**Fix:** Add a row: `session-index.bench.ts` · "merge the session index" · a 50-row index page against a 5,000-session known list.

### IN-04: Impossible-state guard — the floor's survivor predicates never fire for the only bounded caller

**File:** `packages/app/src/runtime/server/session-index.ts:25-33`
**Category:** necessity
**Issue:** The reduce skips `info.parentID` rows and, under `includeArchived: false`, archived rows, "so an archived or child row in the page cannot lower it". The only caller that sets `boundedKnown: true` (`inbox-model.ts:201-205`) hands over the page already filtered twice: the request passes `parentID: null` and `archived: false` (`inbox-model.ts:132`; `packages/core/src/session/store.ts:156-161`), and `parseHomeSessionIndex` drops `parentID` and `time.archived` rows again (`home/sessions/index.ts:37-39`). The other two call sites pass arrays with no options (`home/sessions/index.ts:42`, `shell/commands/palette.ts:298`), so no floor is computed. Every skip in this predicate is therefore dead today; the REVIEW WR-01 fix it implements guards a page shape the stack cannot produce.
**Fix:** Keep it — it is the documented contract of a shared pure helper, and a "windowed" view over the archived page (`archivedQueries` is *not* parsed) would need it. Remove nothing; instead make the comment say it is a contract guarantee ("a caller that passes an unparsed page cannot widen the window") rather than a live path, so the next reader does not treat the mixed-page test at `session-index.test.ts:172-190` as evidence of a reachable state.

### IN-05: The all-archived fixture's comment describes a request that can no longer happen

**File:** `packages/app/src/runtime/server/session-index.test.ts:135-142`
**Issue:** "Archiving bumps `time.updated`, so the 50 newest rows are all archived and the parsed page is empty: the slots are spent before the archived rows are dropped." That was the pre-fix production state; with `archived: false` on the request the page can no longer contain those rows, so the fixture now guards the defense-in-depth path (a cached page written before the upgrade, or a server that ignores the parameter) rather than the reported bug. The test itself is still valuable — the parsed-empty-page state is reachable via a server with no active roots — but the comment makes it look obsolete.
**Fix:** Reword to "an empty parsed page, built here from an all-archived page, is the state a server with no active roots returns", and add the CR-01 case beside it so the empty page's post-fetch behaviour is pinned.

---

_Reviewed: 2026-11-12T17:18:30Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: standard_
