---
phase: 02-sidebar-render
plan: 1
subsystem: app
tags: [solidjs, solid-store, session-list, workspace-registry, persistence, filesystem-probe]

requires:
  - phase: 01-registry-model
    provides: "WorkspaceEntry/WorkspaceRegistrySchema, directoryKey, visible, register/remove, registryTarget and initialRegistry"
provides:
  - "Per-row session projection: one `session.list({ directory, limit: 50, parentID: null, order: \"desc\" })` per visible row, filed under the row's directoryKey"
  - "In-memory `sessionID → rowKey` map plus row-level refresh for session.created/archived/unarchived/deleted/renamed"
  - "REG-04 server-spelling reconciliation (non-empty list wins, empty falls back to local normalization) with self-heal on load"
  - "Availability from a read-only `file.list` probe per ready row on every load/reconnect"
  - "The single `persisted(registryTarget(scope), WorkspaceRegistrySchema, initialRegistry)` call site with order/title/remove/scroll writes"
affects: [02-sidebar-render]

actuals:
  tokens: 7207
  tasks: 3
  commits: 4
  plan_head_before: 74c0615c7a893c395a56b9a39f4e266f1f5b4823
  plan_head_after: 6a573beb000ab401f4b326648f25b90fcbf94f00

tech-stack:
  added: []
  patterns:
    - "Synchronous data layer: one `createStore` snapshot read by the renderer, zero `createResource`, zero Suspense"
    - "Row key is `directoryKey` everywhere; no comparison uses raw string equality"
    - "Single-flight per row (inflight + dirty + pendingProbe) so event bursts cannot fan out requests"
    - "Availability is a filesystem answer (`file.list`), never inferred from how many sessions a list returned"

key-files:
  created:
    - packages/app/src/workspace-sidebar/sessions.ts
    - packages/app/src/workspace-sidebar/sessions.test.ts
    - packages/app/src/workspace-sidebar/store.ts
    - packages/app/src/workspace-sidebar/store.test.ts
  modified: []

key-decisions:
  - "`applyOrder` writes `order = index` from the supplied list and leaves removed/unlisted records untouched, so a drag never resurrects a removed row's slot"
  - "`withTitle` stores the trimmed title and returns the same array for a blank or unchanged title, so no-op renames write nothing"
  - "`adoptEntryDirectory` only accepts a server spelling whose `directoryKey` equals the row's, so one row can never take another's directory"
  - "`load()` probes availability for every ready row (with or without sessions); event-driven `refreshRow` refreshes sessions only, so a burst of `session.*` events never adds filesystem probes"
  - "`session.created` refreshes only when `matchCreated` finds a visible row; unmapped id-only events are ignored rather than triggering a global rescan"
  - "A deleted session is removed from its row before the refetch, so a failing request cannot resurrect it"
  - "Reconnect re-runs `load()` inside `untrack`, which re-probes directories the user may have restored and cannot re-trigger itself from its own store writes"

patterns-established:
  - "Pure row-key/spelling/attribution helpers exported beside the factory; the storeful driver stays the only impure layer"
  - "Fixture-driven tests for the factory call the real `load`/`probeSpelling` with a fake server API; no production seam is added"
  - "Panel data is addressed by `Record<RowKey, …>` so a row is added and dropped with its registry entry"

requirements-completed: [REG-04, ROW-01, ROW-02, ROW-03, ROW-06, UX-01, UX-02, UX-03, PST-01]

coverage:
  - id: D1
    description: "Rows exist only for `visible(entries)`: a removed record never loads and never issues a request"
    requirement: "ROW-01"
    verification:
      - kind: unit
        ref: "packages/app/src/workspace-sidebar/sessions.test.ts#createWorkspaceSessions > never loads a row for a removed record"
        status: pass
      - kind: unit
        ref: "packages/app/src/workspace-sidebar/sessions.test.ts#matchCreated > finds no row for an unregistered directory or a removed record"
        status: pass
    human_judgment: false
  - id: D2
    description: "Each row lists only its own `session.list({ directory })` result; alias spellings are filed under the queried row, never a second one"
    requirement: "ROW-02"
    verification:
      - kind: unit
        ref: "packages/app/src/workspace-sidebar/sessions.test.ts#attributeSessions > files every returned id under the queried row, whatever spelling the session carries"
        status: pass
      - kind: unit
        ref: "packages/app/src/workspace-sidebar/sessions.test.ts#createWorkspaceSessions > loads a row and probes its directory even when the row lists sessions"
        status: pass
      - kind: unit
        ref: "packages/app/src/workspace-sidebar/sessions.test.ts#rowKeyFor > Windows folds separators, drive case and a trailing separator into one key"
        status: pass
    human_judgment: false
  - id: D3
    description: "REG-04: a non-empty list adopts the server's `location.directory` spelling for its own row only; an empty list falls back to local normalization and older records self-heal on first load"
    requirement: "REG-04"
    verification:
      - kind: unit
        ref: "packages/app/src/workspace-sidebar/sessions.test.ts#serverSpelling"
        status: pass
      - kind: unit
        ref: "packages/app/src/workspace-sidebar/sessions.test.ts#queryDirectoryFor > ignores a spelling that resolves to a different row"
        status: pass
      - kind: unit
        ref: "packages/app/src/workspace-sidebar/sessions.test.ts#createWorkspaceSessions > probeSpelling adopts a non-empty server spelling and falls back to local normalization"
        status: pass
      - kind: unit
        ref: "packages/app/src/workspace-sidebar/sessions.test.ts#createWorkspaceSessions > self-heals an old record's spelling on the first non-empty load"
        status: pass
      - kind: unit
        ref: "packages/app/src/workspace-sidebar/store.test.ts#adoptEntryDirectory"
        status: pass
    human_judgment: false
  - id: D4
    description: "Availability comes from a read-only `file.list` probe of every ready row, so a renamed or deleted directory is unavailable even while `session.list` still returns its history"
    verification:
      - kind: unit
        ref: "packages/app/src/workspace-sidebar/sessions.test.ts#needsAvailabilityProbe > probes every ready row, whether it lists sessions or not"
        status: pass
      - kind: unit
        ref: "packages/app/src/workspace-sidebar/sessions.test.ts#createWorkspaceSessions > marks a row unavailable when the directory probe fails, even with history"
        status: pass
    human_judgment: false
  - id: D5
    description: "`session.created` routes by `location.directory`; `archived` / `unarchived` / `deleted` / `renamed` refresh only the mapped row and unmapped events are ignored without a global rescan"
    requirement: "ROW-06"
    verification: []
    human_judgment: true
    rationale: "Bun resolves solid-js to its server build, where `createEffect` never runs, so the subscription wiring cannot be observed in a unit test. The row decisions are pinned by `matchCreated`; the wiring itself needs the browser (02-02 or a manual pass)."
  - id: D6
    description: "Registry writes are pure and write-free on no-ops: order by supplied position, title only for a real rename, and a server spelling only within its own row"
    requirement: "UX-01"
    verification:
      - kind: unit
        ref: "packages/app/src/workspace-sidebar/store.test.ts#applyOrder"
        status: pass
      - kind: unit
        ref: "packages/app/src/workspace-sidebar/store.test.ts#withTitle"
        status: pass
      - kind: unit
        ref: "packages/app/src/workspace-sidebar/store.test.ts#adoptEntryDirectory"
        status: pass
    human_judgment: false
  - id: D7
    description: "The registry document is mounted exactly once as `persisted(registryTarget(scope), WorkspaceRegistrySchema, initialRegistry)`, covering title, order, removal and scrollTop"
    requirement: "PST-01"
    verification:
      - kind: other
        ref: "packages/app/src/workspace-sidebar/store.ts:createWorkspaceRegistry — the only `persisted(`/`Persist.serverGlobal` call for the registry"
        status: pass
    human_judgment: false

duration: 22min
completed: 2026-11-14
status: complete
---

# Phase 2 Plan 1: Sidebar Data Path Summary

**A synchronous row model for the workspace registry: one `session.list` per visible row, REG-04 server-spelling reconciliation, and filesystem-derived availability, with every registry write reduced to `title` / `order` / `removedAt` / `scrollTop` through a single `persisted()` call site.**

## Performance

- **Duration:** ~22 min
- **Started:** 2026-11-14T01:24:00+08:00
- **Completed:** 2026-11-14T01:48:00+08:00
- **Tasks:** 3
- **Files modified:** 4 created, 0 modified

## Accomplishments

- `sessions.ts` owns every read: per-row `session.list({ directory, limit: 50, parentID: null, order: "desc" })`, a `sessionID → rowKey` map, row-level event refresh, REG-04 spelling adoption/self-heal, and a `file.list` availability probe for every ready row on each load/reconnect.
- `store.ts` is the only `persisted(registryTarget(scope), WorkspaceRegistrySchema, initialRegistry)` call site; registration, rename, removal, reorder, scroll and spelling adoption all go through it, and a no-op returns the same array so nothing is written.
- Pure contracts pin the semantics that were easy to get wrong: `applyOrder` (removed rows keep their order), `withTitle` (trimmed, no write on blank/unchanged), `adoptEntryDirectory` (same-row keys only), `queryDirectoryFor` (cross-row spelling rejected), `attributeSessions` (alias spellings stay in the queried row), `matchCreated` (Windows case/separator folding vs POSIX exactness), `serverSpelling`, `needsAvailabilityProbe`, `sessionsOf` (never throws, no Suspense).
- No `createResource`, no `location.get`, no `ctx.data.session.apply`, no `Ungrouped` fallback, and no changes outside `packages/app/src/workspace-sidebar/`.

## Task Commits

Each task was committed atomically:

1. **Task 1: row key → `session.list` → per-row projection** — `a7a09dffcf` (feat)
2. **Task 2: `store.ts` persistence call site and pure order/title/spelling writes** — `957cebe4ab` (feat)
3. **Task 3: REG-04 spelling, availability probe and session events** — `79f153ea71` (feat)
4. **Follow-up: removed records never become rows** — `6a573beb00` (test)

**Plan metadata:** the docs commit that adds `.planning/phases/02-sidebar-render/02-01-SUMMARY.md` (recorded by this plan's close-out).

## Files Created/Modified

- `packages/app/src/workspace-sidebar/sessions.ts` — row keys, query spelling, attribution, `session.created` matching, `serverSpelling`, `needsAvailabilityProbe`, `sessionsOf`, and `createWorkspaceSessions` (load/refresh/refreshRow/probeSpelling plus event and reconnect effects).
- `packages/app/src/workspace-sidebar/sessions.test.ts` — pure projection contracts plus fixture-driven `load`/`probeSpelling` tests against a fake server API.
- `packages/app/src/workspace-sidebar/store.ts` — `applyOrder`, `withTitle`, `adoptEntryDirectory`, and `createWorkspaceRegistry` (the persisted document plus register/rename/remove/reorder/setScrollTop/adoptDirectory).
- `packages/app/src/workspace-sidebar/store.test.ts` — the pure write contracts.

## Decisions Made

- Row identity is always `directoryKey(entry.directory, platform)`; `queryDirectoryFor` re-validates an adopted spelling with the same key before using it.
- `applyOrder` positions follow the supplied list index even when an unknown directory sits between two known ones; gaps are harmless because `visible()` sorts by `order`.
- `load()` is the only place that probes availability; event-driven refreshes never do, which keeps a `session.*` burst from turning into a filesystem probe burst.
- The reconnect effect reads only `ctx()?.sdk.connection.status()` and wraps `load` in `untrack`, so the store writes inside `load` cannot re-trigger the effect.
- `probeSpelling` returns `undefined` (never throws) when the list is empty, the connection is not connected, or the request fails, so the add flow can always fall back to the local spelling.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Event subscription is not observable under `bun test`**
- **Found during:** Task 3 (session events)
- **Issue:** Bun resolves `solid-js` to `dist/server.js`, where `createEffect` is a no-op, so `ctx.data.on(...)` never subscribes in unit tests. Planned integration assertions for `created`/`archived`/`renamed`/`deleted` and for the reconnect effect could not pass against production code.
- **Fix:** Kept the idiomatic `createEffect` + `onCleanup` wiring (matching `sidebar-organized.tsx`) and tested the decisions instead of the subscription: `matchCreated`, `serverSpelling`, `needsAvailabilityProbe`, `attributeSessions`, plus imperative `load`/`probeSpelling` tests that do run. The event path is recorded as a human-judgment deliverable (D5) for the 02-02 browser pass.
- **Files modified:** `packages/app/src/workspace-sidebar/sessions.test.ts`
- **Verification:** `bun test ... src/workspace-sidebar` → 80 pass / 0 fail; the wiring is unchanged production code.
- **Committed in:** `79f153ea71`, `6a573beb00`

**2. [Rule 1 - Bug] `applyOrder` needed a real change check, not a self-comparison**
- **Found during:** Task 2 first draft
- **Issue:** A mistyped guard compared the position with itself, so every reorder would rewrite unchanged rows.
- **Fix:** Compared against `entry.order` and returned the original record when equal; the pure test table covers both the changed and unchanged rows.
- **Files modified:** `packages/app/src/workspace-sidebar/store.ts`
- **Verification:** `store.test.ts#applyOrder` green; lint and type gate clean.
- **Committed in:** `957cebe4ab`

---

**Total deviations:** 2 auto-fixed (2 × Rule 1)
**Impact on plan:** No scope creep and no API change. The only reduced coverage is the declarative event subscription (D5), which is explicitly routed to a human/browser check rather than claimed as unit-proven.

## Issues Encountered

- **`createEffect` is a no-op in Bun unit tests.** `solid-js` maps the `node` condition to its server build; `createComputed` runs, `createEffect` does not. This is an environment property of the existing test command (also why no other app unit test asserts effect behavior), so the plan kept its pure-contract tests and documented the gap instead of changing production code or the repo's test script.
- Whole-package `bun typecheck` remains unavailable because `packages/app/src/custom-elements.d.ts` is a symlink materialized as text on this machine; the file-scoped `bun check --no-script` gate reports 0 diagnostics for all four files.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 02-02 can build rows from `visible(registry.entries())` and read `sessions.rows()`, `sessions.availability()`, `sessions.load()` with no Suspense boundary; `sessions.probeSpelling(entry)` is ready for the add flow, followed by `store.adoptDirectory(entry.directory, spelling)`.
- 02-02 should surface 02-01's `onServerSpelling` callback into `store.adoptDirectory` so the persisted record adopts the server spelling too.
- Browser verification still needs to confirm the event wiring (D5): create a session in a registered directory (row refreshes), archive/rename/delete one (only that row changes), and rename a directory on disk (row goes unavailable, then recovers on reconnect).
- Accepted residual from Phase 1 is unchanged: symlink aliases and case-insensitive filesystems can still register two rows for one directory.

---

*Phase: 02-sidebar-render*
*Completed: 2026-11-14*

## Self-Check: PASSED

- Commits present: a7a09dffcf, 957cebe4ab, 79f153ea71, 6a573beb00
- Files present: store.ts, store.test.ts, sessions.ts, sessions.test.ts
- Tests: 80 pass / 0 fail; file-scoped type gate 0 diagnostics; lint-changed 0 problems
