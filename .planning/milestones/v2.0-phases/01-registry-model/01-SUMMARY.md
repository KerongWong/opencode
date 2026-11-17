---
phase: 01-registry-model
plan: 1
subsystem: app
tags: [solidjs, effect-schema, persistence, workspace-registry, path-normalization]

requires: []
provides:
  - Pure workspace registry model: normalized-directory key, re-register reuse, removal masking, order, default titles
  - `hostPlatform` as the only host-OS to normalization-platform mapping
  - Server-scoped persistence target and document schema for `workspace-registry.v1`
affects: [02-sidebar-rendering, 03-upstream-seams]

actuals:
  tokens: 3200
  tasks: 3
  commits: 3
plan_head_before: 8488e1955f19c73ec61b009b43cef389276e1ab5
plan_head_after: 281ba0a7700a201b656498f06f88afbb5e8655b8

tech-stack:
  added: []
  patterns:
    - "Pure registry module: every input (including `platform`) is explicit, zero I/O, time read as `Date.now()` inside functions"
    - "Persistence contract declared as a schema + `Persist.serverGlobal` target; `persisted()` stays in the rendering component"

key-files:
  created:
    - packages/app/src/workspace-sidebar/registry.ts
    - packages/app/src/workspace-sidebar/registry.test.ts
  modified: []

key-decisions:
  - "Normalization keeps a Windows drive root as `C:/` because the server's `isWindowsStoragePath` only accepts `^[A-Za-z]:/`"
  - "`directoryKey` lowercases only on win32; linux and darwin stay case-sensitive, matching the documented residual for case-insensitive filesystems"
  - "Re-registering a visible record returns the same `entries` reference so no store write happens"
  - "Removal masks with `removedAt` and never deletes the record; the first timestamp wins on repeated removal"
  - "New order is `max(existing order) + 1` including removed records, so a removed row's slot is never reused"
  - "`registryTarget` only returns the persist target; `persisted()` is left to Phase 2 to avoid a Solid owner in this module"

patterns-established:
  - "Platform-explicit normalization: callers pass `HostPlatform`, tests cover win32/linux/darwin without depending on the host machine"
  - "Table-driven contract tests (`test.each`) with one row per distinct behavior, time pinned by `setSystemTime`"

requirements-completed: [REG-01, REG-02, REG-03, PST-02]

coverage:
  - id: D1
    description: "Same directory spelled differently normalizes to one key (separators, duplicate separators, trailing slash, Windows drive case, UNC prefix, drive roots)"
    requirement: "REG-03"
    verification:
      - kind: unit
        ref: "packages/app/src/workspace-sidebar/registry.test.ts#normalizeDirectory"
        status: pass
      - kind: unit
        ref: "packages/app/src/workspace-sidebar/registry.test.ts#directoryKey"
        status: pass
    human_judgment: false
  - id: D2
    description: "Re-registering a directory reuses its record instead of adding a second row"
    requirement: "REG-01"
    verification:
      - kind: unit
        ref: "packages/app/src/workspace-sidebar/registry.test.ts#register"
        status: pass
    human_judgment: false
  - id: D3
    description: "Removal only masks the record; re-registering restores the original title and order; new entries append after the highest order with a predictable default title"
    requirement: "REG-02"
    verification:
      - kind: unit
        ref: "packages/app/src/workspace-sidebar/registry.test.ts#remove"
        status: pass
      - kind: unit
        ref: "packages/app/src/workspace-sidebar/registry.test.ts#defaultTitle"
        status: pass
      - kind: unit
        ref: "packages/app/src/workspace-sidebar/registry.test.ts#visible"
        status: pass
    human_judgment: false
  - id: D4
    description: "Registry persists under `Persist.serverGlobal(serverScope, \"workspace-registry.v1\")` with the documented document shape"
    requirement: "PST-02"
    verification:
      - kind: unit
        ref: "packages/app/src/workspace-sidebar/registry.test.ts#workspace registry document"
        status: pass
    human_judgment: false

metrics:
  duration: 13min
  completed: 2026-11-14
status: complete
---

# Phase 1 Plan 1: Registry Model Summary

A zero-I/O workspace registry module whose every semantic — normalization, reuse, removal, order, default titles — is pinned by table-driven tests, with the persisted document declared as `workspace-registry.v1` under the server scope.

## Performance

- **Duration:** ~13 min
- **Started:** 2026-11-14T00:03:00+08:00
- **Completed:** 2026-11-14T00:16:00+08:00
- **Tasks:** 3
- **Files modified:** 2 created, 0 modified

## Accomplishments

- Normalization contract: `\` → `/`, duplicate separators folded, trailing separators trimmed, UNC `//` prefix preserved, Windows drive uppercased, drive roots kept as `C:/`.
- Re-register reuse: an existing record (visible or removed) is returned in place — no second row, `removedAt` cleared, `title`/`order`/`createdAt` and the first normalized `directory` spelling untouched.
- Lifecycle: `remove` masks with `removedAt` only, `visible` filters removed rows and sorts by `order`, new entries append after the highest order (including removed rows), and `defaultTitle` handles `/`, `C:/`, ordinary directories and UNC shares.
- Persistence shape: `WorkspaceRegistrySchema` round-trips `{ entries, scrollTop }` without inventing a `removedAt` key, and `registryTarget(ServerScope.local).key === "workspace-registry.v1"`.

## Task Commits

1. **Task 1: end-to-end re-register reuse** — `147e80e408` (feat)
2. **Task 2: normalization matrix and `hostPlatform`** — `0a1a08a7dc` (feat)
3. **Task 3: removal/restore, order, default titles, persistence shape** — `281ba0a770` (feat)

**Plan metadata:** the docs commit that adds `.planning/phases/01-registry-model/01-SUMMARY.md` (recorded by this plan's close-out).

## Files Created/Modified

- `packages/app/src/workspace-sidebar/registry.ts` — pure registry model: entry/document schemas, `hostPlatform`, `normalizeDirectory`, `directoryKey`, `defaultTitle`, `register`, `remove`, `visible`, `registryTarget`, `initialRegistry`.
- `packages/app/src/workspace-sidebar/registry.test.ts` — the sole contract owner; 36 tests, all table rows fail before their implementation.

## Decisions Made

- Drive root stays `C:/` (not `C:`) because the server's `isWindowsStoragePath` only accepts `^[A-Za-z]:/`; the default title for it is `C:`.
- Case comparison is lowercased only for `win32`; `linux`/`darwin` stay case-sensitive, with the case-insensitive-filesystem duplicate documented as an accepted residual beside symlink aliases.
- Reusing a visible record returns the identical `entries` array so no pointless store write occurs.
- `registryTarget` deliberately does not call `persisted()`; Phase 2 owns the Solid owner and the `workspace-registry.v1` document instance.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Encoded registry array is optional in the schema's encoded type**
- **Found during:** Task 3 type gate
- **Issue:** `encoded.entries[0]!` does not type-check because `Persistence.array`'s fallback makes the encoded side optional (`entries?: ...`).
- **Fix:** Asserted through `expect(encoded.entries?.[0]).not.toHaveProperty("removedAt")`, which still proves the key is absent.
- **Files modified:** `packages/app/src/workspace-sidebar/registry.test.ts`
- **Verification:** file-scoped `bun check --no-script` reports 0 diagnostics; the round-trip assertion still passes.
- **Committed in:** `281ba0a770`

**2. [Rule 1 - Bug] `require-readable-spacing` lint findings**
- **Found during:** Tasks 1–3 (`bun script/lint-changed.ts`)
- **Issue:** Consecutive `if` statements inside function bodies and a multiline `const` after a statement each need a blank line under the repo's anti-slop spacing rule.
- **Fix:** Added the required blank lines; no semantic change.
- **Files modified:** `packages/app/src/workspace-sidebar/registry.ts`, `registry.test.ts`
- **Verification:** `bun script/lint-changed.ts` reports 0 problems.
- **Committed in:** `147e80e408`, `0a1a08a7dc`, `281ba0a770`

---

**Total deviations:** 2 auto-fixed (2 × Rule 1)
**Impact on plan:** Both were type/lint conformance fixes inside the new files. No scope creep, no API change.

## Issues Encountered

- Whole-package `bun typecheck` is unavailable on this machine because `packages/app/src/custom-elements.d.ts` is a git symlink materialized as text (`core.symlinks=false`, Developer Mode off). The file-scoped gate `bun check --no-script src/workspace-sidebar/registry.ts src/workspace-sidebar/registry.test.ts` was used instead and reports 0 diagnostics; this environment defect is unrelated to the plan and is recorded, not claimed as a whole-package pass.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 2 can read rows exclusively through `visible(entries)`, derive the platform with `hostPlatform(platform.os)`, and mount persistence with `persisted(registryTarget(scope), WorkspaceRegistrySchema, initialRegistry)`.
- REG-04 (reconciling the stored spelling with `session.list`'s `location.directory`) remains for Phase 2, as planned; this plan only owns the normalized internal key.
- Accepted residual at this boundary: symlink aliases and case-insensitive filesystems can still register two rows for one directory; documented in `normalizeDirectory`/`directoryKey`.

---
*Phase: 01-registry-model*
*Completed: 2026-11-14*

## Self-Check: PASSED

- Commits present: 147e80e408, 0a1a08a7dc, 281ba0a770
- Files present: registry.ts, registry.test.ts
- Tests: 36 pass / 0 fail; file-scoped type gate 0 diagnostics; lint-changed 0 problems
