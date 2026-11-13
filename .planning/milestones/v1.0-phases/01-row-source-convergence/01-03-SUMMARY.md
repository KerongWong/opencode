---
phase: 01-row-source-convergence
plan: 03
subsystem: ui
tags: [solid-js, sidebar, projects, session-index, session-inbox, strobe, gap-closure]
requires:
  - phase: 01-row-source-convergence
    provides: "01-01: `includeArchived` and the archived-known/live-archive cases"
  - phase: 01-row-source-convergence
    provides: "01-02: `boundedKnown` floor, the empty-index fallback, seven bounded cases, and the strobe script case"
provides:
  - "`mergeRootSessionIndex(indexed: readonly SessionInfo[] | undefined, known, options)`: `undefined` is the known-only fallback, any array (including `[]`) bounds"
  - "Survivor-only floor: the reduce skips `parentID` rows and, under `includeArchived: false`, archived rows, seeded at `Number.POSITIVE_INFINITY`, so a page with no surviving root admits no known row"
  - "`inbox-sessions` asks the server for `archived: false`, so archived roots cannot spend the 50 index slots"
  - "`entries()` passes `undefined` only when no page has been fetched, so first paint and offline keep the known roots"
  - "Five new cases (and one renamed) pin the all-archived page, restart parity there, the mixed-page floor, the post-fetch join and the Inbox no-page row"
  - "Strobe measurement of the changed merge against `origin/dev` (exp_f14043: cpu.work −88%, verdict less)"
affects: [02, 03]
actuals:
  tokens: 2313
  tasks: 2
  commits: 4
  plan_head_before: db7df8d999bf1a7d8625a038e37a219a5f63c8b2
  plan_head_after: 6bb33d06b4582b797b5d74721b7cc3d495dff5c0
tech-stack:
  added: []
  patterns:
    - "Page-or-undefined: the row source receives the fetched page itself, and only `undefined` means 'no page', so an empty page is a fact about the server rather than a missing signal."
    - "Floor from survivors: a bound derived over the rows the final filter keeps, so a filtered-out row can never widen (or narrow) the window."
key-files:
  created: []
  modified:
    - packages/app/src/runtime/server/session-index.ts
    - packages/app/src/runtime/server/session-index.test.ts
    - packages/app/src/shell/titlebar/inbox-model.ts
key-decisions:
  - "`undefined` alone selects the known-only fallback; any fetched array bounds. TanStack Query already distinguishes 'no data' from 'an empty page', so `entries()` passes that distinction through instead of adding an option flag."
  - "The floor is reduced over the rows the final filter can keep and seeded at infinity: an emptied page yields a floor no known row can meet, and the fix also closes REVIEW WR-01."
  - "The page asks for active roots (`archived: false`), matching every other root-session list in the app, so a parsed empty page means 'no active roots' rather than 'the slots were spent on archived rows'."
  - "Deliberate trade-off kept from the plan: when the server has no active root, Projects shows no row until the page refetches instead of merging the known list; the Inbox view, Home and the palette still show the new session."
patterns-established:
  - "A row source's window is the fetched page, not a row count: emptiness is a value, and only absence is a fallback signal."
  - "A bound is derived from the rows it can keep; a filter applied after the bound cannot retroactively justify it."
requirements-completed: [SRC-02, SRC-03]
coverage:
  - id: D1
    description: "A fetched page whose 50 newest roots are all archived adds no project row (truth 5)"
    requirement: SRC-02
    verification:
      - kind: unit
        ref: "packages/app/src/runtime/server/session-index.test.ts#fetched page > a fetched page the archive filter empties adds no project row"
        status: pass
    human_judgment: false
  - id: D2
    description: "That archived-page state yields the same project rows with and without the old known session (truth 6, restart parity)"
    requirement: SRC-02
    verification:
      - kind: unit
        ref: "packages/app/src/runtime/server/session-index.test.ts#fetched page > the archived-page state shows the same project rows after a restart"
        status: pass
    human_judgment: false
  - id: D3
    description: "An archived or child row in the fetched page cannot lower the floor (REVIEW WR-01)"
    requirement: SRC-02
    verification:
      - kind: unit
        ref: "packages/app/src/runtime/server/session-index.test.ts#fetched page > an archived or child row in the fetched page does not lower the floor"
        status: pass
    human_judgment: false
  - id: D4
    description: "With no page fetched, the locally known root sessions are still the list (first paint and offline)"
    requirement: SRC-03
    verification:
      - kind: unit
        ref: "packages/app/src/runtime/server/session-index.test.ts#bounded known window > with no page fetched the known roots are the list"
        status: pass
    human_judgment: false
  - id: D5
    description: "A known root created after a non-empty page still joins, without waiting for a refetch"
    requirement: SRC-02
    verification:
      - kind: unit
        ref: "packages/app/src/runtime/server/session-index.test.ts#fetched page > a known root created after a non-empty page still joins"
        status: pass
    human_judgment: false
  - id: D6
    description: "The Inbox view keeps a known archived row when no page has been fetched"
    requirement: SRC-03
    verification:
      - kind: unit
        ref: "packages/app/src/runtime/server/session-index.test.ts#fetched page > the Inbox view keeps a known archived row with no page"
        status: pass
    human_judgment: false
  - id: D7
    description: "The `inbox-sessions` page requests active roots only (`archived: false`)"
    verification: []
    human_judgment: true
    rationale: "The request input is not observable from a unit test without a production seam or a mock-server contract change (both out of scope); verified by reading the call site, by the compile gate, and by the manual check in the plan."
  - id: D8
    description: "The changed merge is measured against origin/dev with the existing strobe case"
    verification:
      - kind: other
        ref: "bunx strobe bench packages/app/perf/session-index.bench.ts --base origin/dev --head . (exp_f14043)"
        status: pass
    human_judgment: false
  - id: D9
    description: "Manual checks: the all-archived-page state, restart parity in that state, and the Inbox archived search"
    verification: []
    human_judgment: true
    rationale: "Needs the running desktop app and sidecar against real sessions; this executor must not restart or drive them, so the three checks are left for the user."
duration: 8min
completed: 2026-11-12
status: complete
---

# Phase 01 Plan 03: 行源收敛 Summary

**Projects rows are now bounded by a page that actually exists: `inbox-sessions` asks for active roots, and `mergeRootSessionIndex` treats a fetched empty page as "no active roots" instead of "no page", with a floor reduced only over the rows the merge can keep.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-11-12T08:50:20Z
- **Completed:** 2026-11-12T08:58:28Z
- **Tasks:** 2
- **Files modified:** 3 (no files created)

## Accomplishments

- `inbox-sessions` now lists `{ limit: INDEX_LIMIT, order: "desc", parentID: null, archived: false }`. Archived roots can no longer occupy the 50 window slots and hide an active project inside the active window (REVIEW CR-01 / threat T-01-06).
- `mergeRootSessionIndex`'s first parameter is `readonly SessionInfo[] | undefined`: `undefined` means no page has been fetched (known-only list), any array — including `[]` — bounds. The reported state (50 newest roots archived → parsed page `[]`) now yields no project row instead of every locally known root (truths 5 and 6, and the failed 01-02 prohibition against widening the window).
- The floor is reduced over the rows the final filter keeps (`parentID` and, under `includeArchived: false`, archived rows skipped) and seeded at `Number.POSITIVE_INFINITY`, so an emptied page cannot admit a known row and a mixed page cannot lower the floor (REVIEW WR-01 / threat T-01-07).
- `entries()` reads the two pages once and passes `undefined` only when neither the active nor the archived page has data, so first paint and offline still list the known roots, and the Inbox view keeps its known archived row.
- Five new cases and one renamed case pin all of it; both failing-before runs are recorded below.

## Task Commits

Each task was committed atomically (Task 1 is TDD, so it carries the RED and GREEN commits):

1. **Task 1 RED: pin the all-archived page and the page-or-undefined bound** — `67a6fed60f` (test)
2. **Task 1 GREEN: bound projects rows on a fetched page, not an empty one** — `b6a6f03af7` (fix)
3. **Task 2: pin the survivor-only floor and the inbox no-page row** — `d81e212399` (test)
4. **Lint whitespace at the rewritten merge call** — `6bb33d06b4` (refactor)

**Plan metadata:** not committed — `commit_docs` is `false` and `.planning/` is in `.git/info/exclude`.

## Failing-before evidence

### 1. The all-archived page (Task 1 RED, commit `67a6fed60f`, pre-change merge)

`bun test … src/runtime/server/session-index.test.ts` against the merge as 01-02 left it:

```
error: expect(received).toEqual(expected)
- []
+ [
+   { "id": "c", "location": { "directory": "/other" }, … "time": { "created": 1, "updated": 100 }, … },
+   { "id": "d", "location": { "directory": "/other" }, … "time": { "created": 1, "updated": 400 }, … },
+ ]
(fail) fetched page > a fetched page the archive filter empties adds no project row

error: expect(received).toEqual(expected)
- []
+ [ "srv /other" ]   ← the NUL in `srv\u0000/other` is rendered as a space by the reporter
(fail) fetched page > the archived-page state shows the same project rows after a restart

 11 pass
 2 fail
```

The emptied page merged every known root (`c`, `d`) and produced a `srv\u0000/other` project key; with `known: []` the same page produced none, so the row set differed across a restart.

After the change the same file reported **13 pass / 0 fail**.

### 2. The mixed-page floor (Task 2, commit `d81e212399`)

The case was run against the pre-plan merge by restoring `session-index.ts` from `db7df8d999` for one run (`git checkout --` afterwards; `git status` clean for that path):

```
src\runtime\server\session-index.test.ts:
189 |     expect(rows.map((row) => row.id)).toEqual(["a", "b"])
    |                                            ^
error: expect(received).toEqual(expected)
@@ -3,2 +3,3 @@
    "b",
+   "c",
(fail) fetched page > an archived or child row in the fetched page does not lower the floor
 0 pass · 14 filtered out · 1 fail
```

The child row at `time.updated` 50 lowered the floor to 50, so the known root `c` at 100 joined. With the survivor-only reduce the same case returns exactly `a` and `b`.

## Files Created/Modified

- `packages/app/src/runtime/server/session-index.ts` — first parameter accepts `undefined`; floor reduced over surviving rows and seeded at infinity; doc comment updated for the new parameter and the survivor rule (`includeArchived`'s comment and the final filter untouched, IN-01 out of scope).
- `packages/app/src/runtime/server/session-index.test.ts` — `fetched page` block with its own fixtures, the `parseHomeSessionIndex` import, three tracer cases, two Task 2 cases, and the renamed "with no page fetched the known roots are the list" case.
- `packages/app/src/shell/titlebar/inbox-model.ts` — `archived: false` on the `inbox-sessions` request; `active`/`archived` page locals in `entries()` and the `undefined`-when-no-page first argument, with the comment rewritten to the new rule.

## Decisions Made

- **Page-or-undefined, not a new flag.** The merge's first parameter carries the distinction; TanStack Query already has it, so no option field was added and `RootSessionIndexOptions` keeps exactly `includeArchived` and `boundedKnown`.
- **Survivor-only floor.** The reduce skips what the final filter drops and is seeded at infinity, which handles both the emptied page (no known row can join) and the mixed page (no lowering) with one expression and no materialized array.
- **Active roots from the server.** `archived: false` keeps `parseHomeSessionIndex` in place and restores the app-wide convention instead of inventing a client-side slot reallocation.
- **Inbox unchanged in kind.** The Inbox view still merges the active and archived pages unbounded, so a row archived in this process cannot leave its archived section on a cache miss.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Duplicate coverage] The restart-parity case is implemented once, in Task 1**
- **Found during:** Task 1 (the tracer's `<behavior>` lists it as Test 2) and Task 2 (its action lists the same case again)
- **Issue:** Following both instructions literally would add two cases asserting the same contract in one describe block.
- **Fix:** Added it once in Task 1's `fetched page` block; Task 2 added only the mixed-page and Inbox cases. Task 2's acceptance criterion (equal key lists for `known: [c]` and `known: []`, both empty) is satisfied by the existing case.
- **Files modified:** `packages/app/src/runtime/server/session-index.test.ts`
- **Verification:** `session-index.test.ts` 15 pass / 0 fail.
- **Committed in:** `67a6fed60f` (part of the Task 1 RED commit)

**2. [Rule 1 - Duplicate coverage] The "`undefined` keeps the known list" behavior has one owner**
- **Found during:** Task 1
- **Issue:** Task 1's behavior Test 3 (`mergeRootSessionIndex(undefined, [c, child, g], …)` → `["c"]`) duplicates the existing fallback case that the task also renames and re-points at `undefined`.
- **Fix:** Kept the existing case as the single owner (renamed to "with no page fetched the known roots are the list", first argument `undefined`, same `[c, child, g]` fixtures and `["c"]` assertion); no duplicate case was added to `fetched page`.
- **Files modified:** `packages/app/src/runtime/server/session-index.test.ts`
- **Verification:** Case passes; 15 pass / 0 fail in the file.
- **Committed in:** `b6a6f03af7` (part of the Task 1 GREEN commit)

**3. [Rule 1 - Lint regression] One blank line at the rewritten merge call**
- **Found during:** the final lint check (`bunx oxlint` on the three files)
- **Issue:** The rewrite put `const sessions = mergeRootSessionIndex(` immediately after `const archived = …`, which the project's `anti-slop(require-readable-spacing)` rule flags — a warning this plan introduced, unlike the two pre-existing IN-03 instances.
- **Fix:** Added the blank line (whitespace only).
- **Files modified:** `packages/app/src/shell/titlebar/inbox-model.ts`
- **Verification:** oxlint on the three files reports 2 warnings, 0 errors — both the pre-existing IN-03 lines (`session-index.ts:35`, `session-index.test.ts:99`); tests still 25 pass across the two files.
- **Committed in:** `6bb33d06b4`

---

**Total deviations:** 3 auto-fixed (2 duplicate-coverage dedupes, 1 lint whitespace).
**Impact on plan:** No behavior change and no scope creep; the plan's case list is covered by five new cases plus one renamed case, and the only new lint warning the plan created was removed.

## Issues Encountered

- `bun run test:unit` logs `error: connect ECONNRESET 127.0.0.1:4604` inside one passing server test; the run reports **2712 pass / 0 fail** and exits 0. Same class of noise as previous plans' runs.
- `bun run typecheck` (i.e. `bun check`) remains blocked by the pre-existing Windows symlink artifact; the documented swap-and-restore of `packages/app/src/custom-elements.d.ts` was used for `bun run typecheck:tsc` (see Verification).

## TDD Gate Compliance

- `workflow.tdd_mode` is `false` in `.planning/config.json`, so the commit-sequence gate is advisory here; the discipline was still followed for the `tdd="true"` tracer task.
- RED: `67a6fed60f` (`test(01-03): …`) — the archived-page case and the restart-parity case failed on real assertions (`c`/`d` present, `srv\u0000/other` key, restart row sets differing), not on import or syntax errors.
- GREEN: `b6a6f03af7` (`fix(01-03): …`) follows the RED commit and turns the same file from 11 pass / 2 fail to 13 pass / 0 fail.
- REFACTOR: none needed beyond the whitespace commit `6bb33d06b4`, which keeps tests green.

## Verification

| Check (from the plan) | Result |
|-----------------------|--------|
| `bun test … src/runtime/server/session-index.test.ts` | **15 pass / 0 fail** (the 10 prior cases, one of them renamed, plus 3 tracer cases and 2 Task 2 cases) |
| `bun test … src/home/sessions/index.test.ts` | **10 pass / 0 fail** (Home and the merge table keep their row sets) |
| `bun run test:unit` (packages/app) | **2712 pass / 0 fail** across 275 files, exit 0 |
| `bun run typecheck:tsc` with the symlink resolved | **exit 0**; `src/custom-elements.d.ts` restored to its 33-byte pointer and `git status` clean for that path |
| `bunx oxlint` on the three files | 2 warnings (both pre-existing IN-03), 0 errors |
| `bunx strobe bench … --check` | pass — `exp_28bda0`, `merge the session index · app`, `cpu.work` 21.3 ms |
| `bunx strobe bench … --base origin/dev --head .` | `exp_f14043`: see below |
| Manual app checks | not run (executor must not restart the app) — listed below |

### Strobe (exp_f14043)

- Base `origin/dev@070b980c0b`, head `opencode@d81e212399`, Windows 11 26300, 8 pairs of fresh launches (16 blocks), 5 runs per block, 32.3 s.
- Primary `cpu.work`: **71.4 ms → 8.19 ms, Δ −88%** (likely −90% to −85%), better in 8 of 8 pairs → verdict **less** (faster).
- Secondary `cpu.main`: 40.5 ms → 4.91 ms, −88.2% (CI −89.4% to −86.8%), verdict **less**.
- The delta is expected and attributable: both builds receive the same 50-row page and 5,000-session known list, and the head still skips 4,980 known rows with one comparison each; the change adds one `undefined` comparison per recompute and one predicate per indexed row (threat T-01-08, accepted).
- Warnings recorded verbatim: `HighVariance` (head `cpu.work` varies 17% between launches), other work on the measured CPUs in 16 of 16 blocks (23% of all CPUs busy before the run), `OverheadBudget` on both blocks, `StaleCalibration`, and the attribution note about CPU-wait samples. None changes the verdict.

## Manual checks (not run by this executor)

`packages/app/AGENTS.md` forbids restarting the app or the server, so these stay for the user:

1. With a server whose 50 newest root sessions are all archived (archive a batch from Home or the Inbox), open Projects: the active projects inside the active window are listed, and opening an old session Projects does not show adds no row.
2. Restart the app (user action) and open Projects: the same rows as before the restart, including in that all-archived state.
3. Archive a session from Inbox, then open its Archived search without leaving the view: the session is still listed.

Recorded in `.planning/WINDOWS.md` as `unrun-verify` entries 5, 6 and 7 and as coverage item D9 (`human_judgment: true`).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- SRC-02's two failed truths (5 and 6) and the failed 01-02 window-widening prohibition are closed at the merge boundary and at the call site; SRC-03's contract gains the fetched-page and survivor-floor cases.
- Truth 3 (the live-archive drop) and SRC-01 are unchanged: the final filter and the `passive` recency branch are byte-identical to the pre-plan file.
- Home, the command palette and the `mergeHomeSessionIndex` call site keep their two-argument behavior (arrays), so their row sets are unchanged — `home/sessions/index.test.ts` still passes all ten cases.
- Phase 2 can rely on the row source being "the fetched page or nothing"; the pre-existing e2e mock contract (WR-02), the `includeArchived` doc comment (IN-01), Home's duplicate archive predicate (IN-02) and the benchmark blind spots (IN-04) remain out of scope as the plan states.
- Pending human checks: the three manual steps above (no app restart performed).

## Self-Check: PASSED

- `packages/app/src/runtime/server/session-index.ts`, `session-index.test.ts` and `shell/titlebar/inbox-model.ts` exist; the test file is 203 lines (artifact minimum 150) and `inbox-model.ts` is 520 lines.
- Commit `67a6fed60f` is an ancestor of HEAD (`git merge-base --is-ancestor` → exit 0).
- Commit `b6a6f03af7` is an ancestor of HEAD (exit 0).
- Commit `d81e212399` is an ancestor of HEAD (exit 0).
- Commit `6bb33d06b4` is an ancestor of HEAD (exit 0).
- Measured commits between `db7df8d999` and `6bb33d06b4`: **4** (ledger read from `$(git rev-parse --git-dir)/gsd-plan-head-before-01-03`).
- Working tree contains no files outside the plan's three `files_modified`.

---

*Phase: 01-row-source-convergence*
*Completed: 2026-11-12*
