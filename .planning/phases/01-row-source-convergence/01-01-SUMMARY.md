---
phase: 01-row-source-convergence
plan: 01
subsystem: ui
tags: [solid-js, sidebar, projects, inbox, session-index, archive]
requires: []
provides:
  - "mergeRootSessionIndex option `includeArchived` (default keeps archived roots)"
  - "Exported `RootSessionIndexOptions` with `boundedKnown` declared for plan 01-02"
  - "Projects drops archived known sessions; Inbox keeps them for its archived section"
  - "packages/app/src/runtime/server/session-index.test.ts row-source contract tests"
affects: [01-02, 02, 03]
actuals:
  tokens: 1175
  tasks: 2
  commits: 2
plan_head_before: acdb57123fbf279c585996a507b90f3e79d3e72e
plan_head_after: b07fe67bca7d13c365dcda60fe94c6310dc78fff
tech-stack:
  added: []
  patterns:
    - "Archived filtering lives in the pure merge and is selected by the caller, so every sidebar view shares one predicate."
key-files:
  created:
    - packages/app/src/runtime/server/session-index.test.ts
  modified:
    - packages/app/src/runtime/server/session-index.ts
    - packages/app/src/shell/titlebar/inbox-model.ts
key-decisions:
  - "The merge takes an `includeArchived` option instead of changing projects.tsx: the view already consumes inbox.entries(), so the contract stays unit-testable with the view layer untouched."
  - "Projects builds its inbox with `createSessionInbox()` (no archived option) and therefore drops archived rows; Inbox builds it with `{ archived: true }` and keeps them."
patterns-established:
  - "Per-view capability declared at the data source: `createSessionInbox` maps its `archived` option onto the merge predicate."
requirements-completed: [SRC-01, SRC-03]
coverage:
  - id: D1
    description: "An archived locally known session no longer produces a Projects row, and a child session still never does"
    requirement: SRC-01
    verification:
      - kind: unit
        ref: "packages/app/src/runtime/server/session-index.test.ts#keeps a locally known archived session out of a project row"
        status: pass
    human_judgment: false
  - id: D2
    description: "The default merge keeps archived roots so the Inbox archived section still has rows"
    requirement: SRC-03
    verification:
      - kind: unit
        ref: "packages/app/src/runtime/server/session-index.test.ts#the default keeps archived rows for the Inbox view"
        status: pass
    human_judgment: false
  - id: D3
    description: "A live archive event drops a row even while the cached index still lists that session as active"
    requirement: SRC-01
    verification:
      - kind: unit
        ref: "packages/app/src/runtime/server/session-index.test.ts#a live archive wins over a cached active index row"
        status: pass
    human_judgment: false
  - id: D4
    description: "Manual sidebar check: archiving in Inbox removes the row from every Projects group (and empties a group that only held it), while the archived search still lists it"
    requirement: SRC-01
    verification: []
    human_judgment: true
    rationale: "Needs the running desktop app and sidecar against real sessions; this executor must not restart or drive them, so the check is left for the user."
duration: 13min
completed: 2026-11-12
status: complete
---

# Phase 01 Plan 01: 行源收敛 Summary

**Archived sessions stop sourcing Projects rows through a caller-selected `includeArchived` option on `mergeRootSessionIndex`, while the Inbox view keeps its archived entries.**

## Performance

- **Duration:** 13 min
- **Started:** 2026-11-12T06:30Z (approx.)
- **Completed:** 2026-11-12T06:43Z
- **Tasks:** 2
- **Files modified:** 3 (2 modified, 1 created)

## Accomplishments

- `mergeRootSessionIndex` gained a third parameter `RootSessionIndexOptions = {}`; its final filter is now `!info.parentID && (options.includeArchived !== false || info.time.archived === undefined)`. The recency merge (passive known copy keeps the indexed `time.updated`) is byte-identical.
- `createSessionInbox` passes `{ includeArchived: options.archived === true }` into the merge, so `SidebarProjects` (`createSessionInbox()`) drops archived rows while `SidebarInbox` (`{ archived: true }`) keeps them. `projects.tsx`, `inbox.tsx`, `home/sessions/index.ts` and the palette are untouched.
- A new co-located contract test file covers the archived-known Projects composition, the Inbox default, and a live archive overriding a cached active index row. It failed on the unmodified merge (`srv\0/other` appeared in the key list) and passes on the wired code.

## Task Commits

Each task was committed atomically:

1. **Task 1: Archived known sessions stop producing a project row (tracer)** — `c8fe47c525` (fix)
2. **Task 2: Pin the live-archive and Inbox-default edge cases** — `b07fe67bca` (test)

**Plan metadata:** not committed — `.planning/` is excluded from git in this repository (`.git/info/exclude`) and `commit_docs` is `false`.

## Failing-before evidence (Task 1)

Run against the unmodified merge (test file written first, no options parameter existed):

```
root session index merge > keeps a locally known archived session out of a project row [0.91ms]
error: expect(received).toEqual(expected)
  [
    "srv\0/repo",
+   "srv\0/other",
  ]
(fail) root session index merge > keeps a locally known archived session out of a project row
 0 pass
 1 fail
```

After implementing the option and wiring `entries()`, the same file passes (`3 pass / 0 fail` once Task 2 lands).

## Files Created/Modified

- `packages/app/src/runtime/server/session-index.ts` — exported `RootSessionIndexOptions` (`includeArchived`, plus `boundedKnown` declared for plan 01-02), merged the archived predicate into the existing final filter.
- `packages/app/src/runtime/server/session-index.test.ts` (new) — `session()` fixture builder (`// SAFETY:` cast, mirroring `home/sessions/index.test.ts`), Projects key composition through `projectGroupFor`, Inbox default, and live-archive cases.
- `packages/app/src/shell/titlebar/inbox-model.ts` — `entries()` passes `{ includeArchived: options.archived === true }` plus one comment line explaining the Projects/Inbox split.

## Decisions Made

- **Filter owner:** the predicate stays in the pure merge and the caller selects it (`options.archived === true`), so Projects and Inbox cannot disagree about what "archived" means.
- **No view edits:** `projects.tsx` already consumes `inbox.entries()`, so the seam is one option on the merge; the view layer stays byte-identical.

## Deviations from Plan

None in production code — the plan executed as written. One environment-level blocker is documented under Issues Encountered (the plan's `bun typecheck` step cannot run in this Windows checkout for a pre-existing reason).

## Issues Encountered

**`bun typecheck` is blocked by a pre-existing symlink checkout artifact (not caused by this plan).**

- `packages/app/src/custom-elements.d.ts` is a git symlink (mode `120000`) but this Windows checkout materialized it as a 33-byte text file containing `../../ui/src/custom-elements.d.ts`, so `bun check` and `tsc -b` both report `TS1128` in that file before checking anything else.
- The file is unmodified by this plan (`git status` shows only the three plan files), so the failure predates the change and is out of scope per the deviation scope boundary.
- To still type-check this work, the executor temporarily substituted the real `packages/ui/src/custom-elements.d.ts` content, ran `bun run typecheck:tsc` → **exit 0**, then restored the 33-byte pointer file byte-for-byte (`git status` clean for that path).

## Plan variance notes

- `must_haves.artifacts` estimated `session-index.test.ts` at ≥80 lines; the specified three cases land in 48 lines. No case was omitted — the estimate was high.
- The plan's manual checks (archive in Inbox, then confirm Projects drops the row and an emptied group disappears; confirm the archived search still lists it) were **not** run: they need the live desktop app/sidecar, which this executor must not restart or drive. Recorded as coverage item D4 (`human_judgment: true`).

## Verification

| Check | Result |
|-------|--------|
| `bun test ... src/runtime/server/session-index.test.ts` (from `packages/app`) | 3 pass / 0 fail |
| `bun test ... src/runtime/server/session-index.test.ts src/home/sessions/index.test.ts` | 11 pass / 0 fail (Home recency + existing Inbox surface cases unchanged) |
| `bun typecheck` | blocked pre-existing (symlink artifact above) |
| `bun run typecheck:tsc` with the symlink resolved | exit 0 |
| `mergeRootSessionIndex([], [archivedRoot])` / `{ includeArchived: true }` | returns `['archived']` both ways |
| `mergeRootSessionIndex([activeRoot], [archivedCopy], { includeArchived: false })` | `[]` |

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The row source is converged for archived sessions; plan 01-02 can consume `RootSessionIndexOptions.boundedKnown` and add `boundedKnown: options.archived !== true` at the same call site.
- Pending human check: the two manual archive steps above (no app restart performed).

## Self-Check: PASSED

- `packages/app/src/runtime/server/session-index.test.ts` exists.
- `packages/app/src/runtime/server/session-index.ts` exists.
- `packages/app/src/shell/titlebar/inbox-model.ts` exists.
- Commit `c8fe47c525` is an ancestor of HEAD.
- Commit `b07fe67bca` is an ancestor of HEAD.
- Measured commits between `acdb57123f` and HEAD: 2.
- Working tree contains no files outside the plan's `files_modified` (plus this SUMMARY, which is excluded from git).

---

*Phase: 01-row-source-convergence*
*Completed: 2026-11-12*
