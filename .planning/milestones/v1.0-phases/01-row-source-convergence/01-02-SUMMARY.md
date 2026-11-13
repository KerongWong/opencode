---
phase: 01-row-source-convergence
plan: 02
subsystem: ui
tags: [solid-js, sidebar, projects, session-index, session-inbox, strobe]
requires:
  - phase: 01-row-source-convergence
    provides: "01-01: RootSessionIndexOptions with includeArchived and an inert boundedKnown, plus session-index.test.ts"
provides:
  - "`mergeRootSessionIndex` bounds locally known additions to the index window floor, with a known-only fallback when the index is empty"
  - "`createSessionInbox` passes `boundedKnown: options.archived !== true`, so only the Projects view is bounded"
  - "session-index.test.ts covers the drop, restart parity, the floor boundary, post-fetch joins, enrichment, the offline list, and the Inbox archived row"
  - "packages/app/perf/session-index.ts + .bench.ts: a strobe script case for the merge"
affects: [03]
actuals:
  tokens: 2633
  tasks: 3
  commits: 3
plan_head_before: b07fe67bca7d13c365dcda60fe94c6310dc78fff
plan_head_after: db7df8d999bf1a7d8625a038e37a219a5f63c8b2
tech-stack:
  added: []
  patterns:
    - "Windowed row source: the server index page defines the window, and the caller selects the bound per view."
key-files:
  created:
    - packages/app/perf/session-index.ts
    - packages/app/perf/session-index.bench.ts
  modified:
    - packages/app/src/runtime/server/session-index.ts
    - packages/app/src/runtime/server/session-index.test.ts
    - packages/app/src/shell/titlebar/inbox-model.ts
key-decisions:
  - "The floor is the smallest `time.updated` among indexed rows, computed with one `reduce` and no materialized array; a known root joins only when its id is already in the row map or its `time.updated` is at or above the floor."
  - "With no indexed page the bound does nothing (`floor === undefined`), so the offline list is the locally known roots — the SRC-03 contract."
  - "The bound rides the same call site as the archived filter: `{ includeArchived: options.archived === true, boundedKnown: options.archived !== true }`. Projects is bounded; the Inbox view merges two pages and keeps every known row."
patterns-established:
  - "Membership wins without a second set: the `rows.has` check reads the map the indexed rows already populated."
  - "A per-view capability is declared at the data source and pinned at the merge boundary, with the controller mapping left to the call site."
requirements-completed: [SRC-02, SRC-03]
coverage:
  - id: D1
    description: "A locally known root older than the index window adds no Projects row"
    requirement: SRC-02
    verification:
      - kind: unit
        ref: "packages/app/src/runtime/server/session-index.test.ts#a locally known root older than the index window adds no project row"
        status: pass
    human_judgment: false
  - id: D2
    description: "The Projects row set is identical with and without an old in-process session (restart parity)"
    requirement: SRC-02
    verification:
      - kind: unit
        ref: "packages/app/src/runtime/server/session-index.test.ts#the row set is the same with and without that old session (restart parity)"
        status: pass
    human_judgment: false
  - id: D3
    description: "A known root at the window floor and one created after the index fetch still join"
    requirement: SRC-02
    verification:
      - kind: unit
        ref: "packages/app/src/runtime/server/session-index.test.ts#a known root at the window floor still joins"
        status: pass
      - kind: unit
        ref: "packages/app/src/runtime/server/session-index.test.ts#a known root created after the index fetch still joins"
        status: pass
    human_judgment: false
  - id: D4
    description: "An indexed row is refreshed by a known copy below the floor without changing its `time.updated`"
    verification:
      - kind: unit
        ref: "packages/app/src/runtime/server/session-index.test.ts#an indexed root is refreshed by a known copy older than the floor"
        status: pass
    human_judgment: false
  - id: D5
    description: "With no server index, the locally known root sessions are the list (children and archived rows still filtered)"
    requirement: SRC-03
    verification:
      - kind: unit
        ref: "packages/app/src/runtime/server/session-index.test.ts#with no index the known roots are the list"
        status: pass
    human_judgment: false
  - id: D6
    description: "The Inbox view's options keep a known archived row that the bound would drop"
    requirement: SRC-03
    verification:
      - kind: unit
        ref: "packages/app/src/runtime/server/session-index.test.ts#the Inbox view keeps a known archived row the bound would drop"
        status: pass
    human_judgment: false
  - id: D7
    description: "The merge is benchmarked against origin/dev with a strobe script case, and its verdict is recorded"
    verification:
      - kind: other
        ref: "bunx strobe bench packages/app/perf/session-index.bench.ts --base origin/dev --head . (exp_af4617)"
        status: pass
    human_judgment: false
  - id: D8
    description: "Manual sidebar checks: open an older session and return to Projects, restart and compare rows, archive in Inbox then open Archived before it refetches"
    verification: []
    human_judgment: true
    rationale: "Needs the running desktop app and sidecar against real sessions; this executor must not restart or drive them, so the three checks are left for the user."
duration: 14min
completed: 2026-11-12
status: complete
---

# Phase 01 Plan 02: 行源收敛 Summary

**Projects rows now come from a bounded index window: a locally known session joins only when it is already indexed or at least as recent as the oldest indexed row, while the Inbox view keeps every known row.**

## Performance

- **Duration:** 14 min
- **Started:** 2026-11-12T06:43Z (approx., after the 01-01 commit)
- **Completed:** 2026-11-12T06:57Z
- **Tasks:** 3
- **Files modified:** 5 (3 modified, 2 created)

## Accomplishments

- `mergeRootSessionIndex` computes `floor` as the smallest `time.updated` among indexed rows (one `reduce`, no array) and skips a known root below it unless the id is already in the row map. With an empty index the bound is inert, so the known roots are the list.
- `entries()` now passes `{ includeArchived: options.archived === true, boundedKnown: options.archived !== true }`: `SidebarProjects` is bounded, `SidebarInbox` is not, so a row archived in this process cannot leave an uncached Archived section.
- Seven new cases in the co-located test file pin the drop, restart parity, both sides of the boundary, post-fetch joins, index enrichment, the offline list, and the Inbox archived-row invariant. Two of them failed on the unmodified merge.
- A strobe script case (`packages/app/perf/session-index.{ts,bench.ts}`) measures 200 merges of a 50-row page with a 5,000-session known list and records the comparison against `origin/dev`.

## Task Commits

Each task was committed atomically:

1. **Task 1: An old in-process session stops adding a project row (tracer)** — `1553fe0ef6` (fix)
2. **Task 2: Pin the boundary, post-fetch, enrichment, and offline cases** — `43bd0b8913` (test)
3. **Task 3: Measure the bounded merge against origin/dev with a strobe script case** — `db7df8d999` (perf)

**Plan metadata:** not committed — `commit_docs` is `false` and `.planning/` is in `.git/info/exclude`.

## Failing-before evidence (Task 1)

The bounded block was written first and run against the merge as 01-01 left it (`boundedKnown` declared but inert):

```
bounded known window > a locally known root older than the index window adds no project row
error: expect(received).toEqual(expected)
@@ -3,2 +3,3 @@
    "b",
+   "c",
- Expected  - 0
+ Received  + 1
(fail) bounded known window > a locally known root older than the index window adds no project row

bounded known window > the row set is the same with and without that old session (restart parity)
error: expect(received).toEqual(expected)
@@ -2,2 +2,3 @@
    "srv\u0000/repo",
+   "srv\u0000/other",
(fail) bounded known window > the row set is the same with and without that old session (restart parity)

 3 pass / 2 fail
```

After the floor and the `entries()` options landed, the same file reported `5 pass / 0 fail` (and `10 pass / 0 fail` once Task 2 added its five cases).

## Files Created/Modified

- `packages/app/src/runtime/server/session-index.ts` — `floor` computation plus the skip in the known loop; the `passive` recency branch and the final archived/parent filter are untouched.
- `packages/app/src/runtime/server/session-index.test.ts` — a `projectKeys` helper (distinct keys, matching how `groups()` fills one entry per key) and the `bounded known window` block.
- `packages/app/src/shell/titlebar/inbox-model.ts` — the third argument now carries `boundedKnown`, with one comment line explaining the Projects-only window; index arrays, query keys, and actions unchanged.
- `packages/app/perf/session-index.ts` (new) — script-case harness: 50 indexed roots in `/repo` (floor 999_951) and 5,000 known roots in `/other`, 20 above the floor and the rest below; exports `merge(count)` and returns the last row count.
- `packages/app/perf/session-index.bench.ts` (new) — one `bench` with target `app: script("./session-index.ts")`, case "merge the session index", `primary: "cpu.work"`, `ctx.call("merge", 200)`.

## Decisions Made

- **Floor from `reduce`, membership from the map.** The floor is one `Math.min` per indexed row, and the `rows.has` check reuses the map the indexed rows already filled, so the bound adds no second set and no array.
- **Empty index means no bound.** `options.boundedKnown && indexed.length` guards the floor: the offline fallback is the observable known-only list the plan requires, not an empty sidebar.
- **Bound selected per view at the call site.** The merge stays view-agnostic; whether a floor applies is the caller's decision, which keeps `palette.ts` (two-argument call) on its current behavior and leaves the Inbox view untouched.

## Deviations from Plan

None in code — tasks 1–3 executed as written. Two pre-existing environment failures are documented under Issues Encountered; both fail identically without this plan's files.

## Issues Encountered

**1. `bun typecheck` in `packages/app` is blocked by the known symlink artifact (pre-existing).**

- `packages/app/src/custom-elements.d.ts` is a git symlink (mode `120000`) materialized as a 33-byte text file in this Windows checkout, so `bun check -b` stops with `TS1128` before checking any file ("Found 2 errors in 1 file, checked 0 files").
- Targeted check used instead: the file was temporarily replaced with the real `packages/ui/src/custom-elements.d.ts` content, `bun run typecheck:tsc` returned **exit 0**, and the 33-byte pointer file was restored byte-for-byte (`git status` clean for that path, `Length` 33). The file is not modified by this plan.

**2. `bun run typecheck:e2e` fails on 184 pre-existing errors, none in this plan's files.**

- Every diagnostic is in `../ui/src/**` (`TS2882` for CSS side-effect imports, `ImportMeta.glob`, theme typing). `packages/app/e2e/tsconfig.json` includes `../src/types.ts`, which does not exist, so the `vite/client` ambient types that `packages/app/src/sst-env.d.ts` provides are absent from that program.
- Evidence that this plan's perf files are still checked and clean: the same command without the two new files reports the same 184 error lines (exit 2), the run with them reports 184 lines with **zero** naming `session-index`, and a deliberate `const probe: number = 'not a number'` added to `perf/session-index.ts` produced `perf/session-index.ts(38,7): error TS2322` plus `TS6133` — proving both files are inside the program and typecheck cleanly.

## Benchmark (strobe)

| Run | Experiment | Result |
|-----|------------|--------|
| `--check` (new case validation) | `exp_a49195` | `pass merge the session index · app`, `cpu.work` 22.7 ms, 3.6 s |
| `--base origin/dev --head .` | `exp_af4617` | primary `cpu.work` **67.6 ms → 8.30 ms, Δ −87.9%** (CI −89.4% … −86.3%) → verdict **less** (faster) |

- Base `origin/dev@070b980c0b`, head `opencode@43bd0b8913`, Windows 11, 8 pairs of fresh launches (16 blocks), 12 s of measured runs, 31.2 s total.
- Secondary: `cpu.main` 39.1 ms → 4.98 ms (−87.2%, CI −88.3% … −86.0%), also `less`.
- The delta is expected rather than suspicious: both builds receive the identical index page and 5,000-session known list, and the head skips 4,980 of them with one comparison each instead of inserting every row into the map and array. The hot path therefore got cheaper, not slower; the case exists so a future change that re-widens the row source shows up as a regression.
- Warnings recorded verbatim in the report: `HighVariance` (head `cpu.work` varies 11% between launches), background work on the measured CPUs during all 16 blocks (31% of all CPUs busy before the run), and the base attribution block failing `ClockUnsynced`. None changes the primary verdict.

## Manual checks (not run by this executor)

`packages/app/AGENTS.md` forbids restarting the app or the server, so these stay for the user:

1. Note the current Projects rows, open a session Projects does not show, return to Projects — the row set is identical.
2. Restart the app (user action), then open Projects — the same rows as before the restart.
3. Archive a session from Inbox and open its Archived search without leaving the view — the session is listed before the archived page refetches.

Recorded in `.planning/WINDOWS.md` as `unrun-verify` entries and as coverage item D8 (`human_judgment: true`).

## Plan variance notes

- `must_haves.artifacts` estimated `session-index.test.ts` at ≥140 lines; the file is 124 lines with all seven new cases present. No case was omitted — the estimate was high (01-01 saw the same on the same file).
- `success_criteria` asks for SRC-03's known-only contract to be proven by a case that fails on the unmodified merge. The empty-index case passes on both builds by design: it is the fallback contract, and 01-01's `includeArchived` filter is what makes it return `["c"]`. The failing-before evidence belongs to the two bounded cases above, which are the actual SRC-02 behavior change.
- The Inbox per-view mapping in `createSessionInbox` is not unit-tested (it needs the Solid runtime and server context); the merge-level case pins the drop the mapping prevents, and the wiring is verified by reading the call site.

## Verification

| Check (from the plan) | Result |
|-----------------------|--------|
| `bun test ... src/runtime/server/session-index.test.ts` | **10 pass / 0 fail** |
| `bun test ... src/home/sessions/index.test.ts` | **10 pass / 0 fail** (Home recency and Inbox-surface cases unchanged) |
| `bun run test:unit` | **2707 pass / 0 fail** across 275 files |
| `bun typecheck` (packages/app) | blocked pre-existing (symlink artifact); `bun run typecheck:tsc` with the symlink resolved → **exit 0** |
| `bun run typecheck:e2e` | 184 pre-existing `../ui/src` errors, **0** naming the new perf files; probe error proved both are checked |
| `bunx strobe bench ... --check` | pass (`exp_a49195`) |
| `bunx strobe bench ... --base origin/dev --head .` | `exp_af4617`: `cpu.work` −87.9%, verdict `less` (faster) |
| Manual app checks | not run (executor must not restart the app) — see above |

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The Projects row source is now a function of the server page: a session older than the window loaded in-process cannot add a row, and a fresh process derives the same rows from the index.
- Plan 03 can build on `RootSessionIndexOptions` and on the merge's empty-index fallback; `bunx strobe bench packages/app/perf/session-index.bench.ts --base origin/dev --head .` is the regression guard for the hot path.
- Pending human checks: the three manual steps above (no app restart performed).

## Self-Check: PASSED

- `packages/app/src/runtime/server/session-index.test.ts` exists (124 lines).
- `packages/app/src/runtime/server/session-index.ts` exists with the `floor` and skip rule.
- `packages/app/src/shell/titlebar/inbox-model.ts` passes `boundedKnown: options.archived !== true`.
- `packages/app/perf/session-index.ts` and `packages/app/perf/session-index.bench.ts` exist.
- Commit `1553fe0ef6` is an ancestor of HEAD (`git merge-base --is-ancestor` → exit 0).
- Commit `43bd0b8913` is an ancestor of HEAD (exit 0).
- Commit `db7df8d999` is an ancestor of HEAD (exit 0).
- Measured commits between `b07fe67bca` and `db7df8d999`: **3** (ledger read from `$(git rev-parse --git-dir)/gsd-plan-head-before-01-02`).
- Working tree contains no files outside the plan's `files_modified`.

---

*Phase: 01-row-source-convergence*
*Completed: 2026-11-12*
