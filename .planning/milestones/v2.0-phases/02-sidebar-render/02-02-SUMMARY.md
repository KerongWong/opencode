---
phase: 02-sidebar-render
plan: 2
subsystem: app
tags: [solidjs, sidebar, workspace-registry, dnd-kit, i18n, titlebar-mount]

requires:
  - phase: 02-sidebar-render
    provides: "createWorkspaceRegistry (persisted title/order/removedAt/scrollTop), createWorkspaceSessions (per-row session.list, REG-04 spelling, file.list availability)"
  - phase: 01-registry-model
    provides: "WorkspaceEntry, visible(), directoryKey(), hostPlatform(), initialRegistry"
provides:
  - "`SidebarWorkspaces` — the whole registry sidebar: rows, expand/collapse, per-row sessions, add, rename, remove, unavailable state, drag order, scroll restore"
  - "`WorkspaceRenameDialog` / `WorkspaceRemoveDialog`, self-contained, leaving upstream `RenameDialog` untouched"
  - "One contiguous `sidebar.workspace.*` copy block in `runtime/i18n/en.ts`"
  - "The single titlebar mount: `<SidebarWorkspaces />` in the existing `sidebarOrganize === \"projects\"` Match"
affects: [02-verify, 03-security-hardening]

actuals:
  tokens: 5513
  tasks: 3
  commits: 4
  plan_head_before: 8261e14ede76960a2cc49df2f4e6100a52ec4fe2
  plan_head_after: 07928e4c9792cbff495af9949f472f06bcecc3ed

tech-stack:
  added: []
  patterns:
    - "Keyed connection mount: `<Show when={connection()} keyed>` rebuilds `persisted()` per server and passes the value (`conn={conn}`)"
    - "Render-only data layer: rows and sessions come from 02-01's stores via `visible()`/`sessionsOf()`, never from a resource"
    - "Loading driven by `createEffect(on(rows, () => sessions.load()))` so the store writes inside `load` cannot retrigger it"
    - "Row drag via `DragDropProvider` + `useSortable`, with `[data-workspace-action]` excluded from pointer activation"
    - "Scroll position written once per frame with `requestAnimationFrame`, restored a frame after mount and again on the first hydration"

key-files:
  created:
    - packages/app/src/workspace-sidebar/sidebar.tsx
    - packages/app/src/workspace-sidebar/dialogs.tsx
    - packages/app/src/workspace-sidebar/index.ts
  modified:
    - packages/app/src/runtime/i18n/en.ts
    - packages/app/src/shell/titlebar/titlebar.tsx

key-decisions:
  - "The sidebar renders only `visible(entries)`; there is no ungrouped/other fallback group, so a removed record cannot leak back into any bucket"
  - "The add flow reuses `homeProjectDirectories(result)` instead of a runtime `typeof`, which the repo's `anti-slop(no-runtime-typeof)` rule forbids and which already owns the picker's result shape"
  - "The row menu item reads `sidebar.workspace.remove.title` rather than inventing a second removal key inside the copy block"
  - "An unavailable row keeps its menu and drag handlers and only blocks expansion, so it can still be renamed or removed"
  - "Scroll restore runs on the mount frame and again on `registry.ready`, because desktop storage hydrates asynchronously; the second pass only applies while `scrollTop` is still 0"
  - "`createSidebarActivityListener()` is called from `sidebar.tsx`, never from `titlebar.tsx`, keeping the upstream mount to one import and one JSX line"

patterns-established:
  - "Internal presentation components (`WorkspaceRow`) live in the same file and receive plain callbacks, so the data factories stay the only stateful layer"
  - "Refresh on expand is lazy and non-blocking: `sessions.refreshRow(key)` only when the row has no data yet and is not unavailable"

requirements-completed: [ROW-04, ROW-05, UX-01, UX-02, UX-03, UX-04, UX-05, PST-01]

coverage:
  - id: D1
    description: "Rows come only from `visible(entries)`: an unregistered directory never appears, and no ungrouped/other fallback group exists"
    requirement: "ROW-04"
    verification: []
    human_judgment: true
    rationale: "The absence of a fallback group is an architecture claim about what renders; only a browser pass over a directory that has history but no registration can confirm it."
  - id: D2
    description: "Each row expands into exactly its own `session.list({ directory })` result, and clicking a session opens a preview tab through `openProjectSession(..., { preview: true })`"
    requirement: "ROW-02"
    verification: []
    human_judgment: true
    rationale: "Row contents and the preview-tab interaction depend on a live server and the tab store; 02-01 already pins the projection logic with unit tests."
  - id: D3
    description: "Rename writes only `title`, removal writes only `removedAt`, and re-registering restores the previous name and order"
    requirement: "UX-02"
    verification:
      - kind: unit
        ref: "packages/app/src/workspace-sidebar/store.test.ts#withTitle"
        status: pass
      - kind: unit
        ref: "packages/app/src/workspace-sidebar/registry.test.ts"
        status: pass
    human_judgment: true
    rationale: "The writes are unit-pinned, but 'restart keeps the new name', 'the directory and .git are untouched' and 'Inbox still lists the sessions' need a real app pass."
  - id: D4
    description: "An empty registry shows only the empty state and one 'Add local folder' action; a directory that no longer exists keeps its row, marked unavailable and not expandable"
    requirement: "UX-04"
    verification: []
    human_judgment: true
    rationale: "Availability comes from a live `file.list` probe; the unavailable presentation needs a directory renamed on disk while the app is running."
  - id: D5
    description: "The first frame never suspends: rows and sessions render from the persisted store's synchronous initial value, and the loading indicator is `Loader`"
    requirement: "UX-05"
    verification:
      - kind: other
        ref: "packages/app/src/workspace-sidebar/sidebar.tsx — renders `sessionsOf(sessions.rows(), key)`; no `createResource`, no `Suspense`, and `Loader` is the only loading indicator"
        status: pass
    human_judgment: false
  - id: D6
    description: "Drag reordering writes `order` only, a new registration still appends at the end, and the scroll position is restored per server"
    requirement: "PST-01"
    verification: []
    human_judgment: true
    rationale: "Drag indices, append-at-end behaviour and scroll restore across a restart are browser-only observations."
  - id: D7
    description: "All user-visible copy goes through `language.t` from one contiguous `sidebar.workspace.*` block; the titlebar mount is one import plus one JSX line"
    requirement: "UX-03"
    verification:
      - kind: other
        ref: "`git diff --numstat upstream/dev -- packages/app/src/shell/titlebar/titlebar.tsx` → 2/2 (one import line replaced, one JSX line replaced)"
        status: pass
      - kind: other
        ref: "bun script/lint-changed.ts upstream/dev → 0 problems in 11 changed files"
        status: pass
    human_judgment: false

duration: 50min
completed: 2026-11-14
status: complete
---

# Phase 2 Plan 2: Sidebar Render Summary

**The workspace registry became the sidebar: rows rendered from `visible(entries)` with per-row session lists, rename/remove dialogs, unavailable state, drag order and scroll restore, mounted through one import and one JSX line in `titlebar.tsx`.**

## Performance

- **Duration:** ~50 min
- **Started:** 2026-11-14T02:05:00+08:00
- **Completed:** 2026-11-14T02:55:00+08:00
- **Tasks:** 3
- **Files modified:** 3 created, 2 modified

## Accomplishments

- `sidebar.tsx` is the whole presentation layer for the registry: a keyed connection mount, rows from `visible(registry.entries())`, expand/collapse with a per-row `Loader`, per-row `ProjectSessionRow` list opened as preview tabs, an empty state with the single "Add local folder" action, a per-row menu (pointer, context menu, `Shift+F10`), an unavailable marker that blocks expansion but not the menu, dnd-kit reordering and a frame-coalesced scroll restore.
- `dialogs.tsx` owns both self-contained dialogs, so upstream `project-session-row.tsx` and its `RenameDialog` were not touched at all; the remove dialog states that the folder, its git state and its sessions stay untouched.
- `index.ts` exposes exactly one symbol, and `titlebar.tsx` changed by 2 insertions / 2 deletions: the unused `SidebarOrganized` import became `SidebarWorkspaces`, and the JSX line inside the existing `projects` Match became `<SidebarWorkspaces />`. Line 21 (`SidebarCustomized` + `type SidebarStripGrouping`) is untouched, and there is no re-indent hunk.
- `runtime/i18n/en.ts` gained one contiguous block of 11 `sidebar.workspace.*` keys directly after `sidebar.view.*`; no existing key or copy was changed.

## Task Commits

Each task was committed atomically:

1. **Task 1: end-to-end path — add folder → registered row → sessions in the row** — `c5ac7d413a` (feat)
2. **Task 2: rename, remove and unavailable states for workspace rows** — `65c34fd9b9` (feat)
3. **Task 3: drag ordering and scroll restore** — `69b89d6681` (feat)
4. **Follow-up: restore scroll once the registry hydrates** — `07928e4c97` (fix)

**Plan metadata:** the docs commit that adds this SUMMARY (recorded by this plan's close-out).

## Files Created/Modified

- `packages/app/src/workspace-sidebar/sidebar.tsx` — `SidebarWorkspaces` (keyed connection mount + activity listener) and `WorkspaceSidebarBody`/`WorkspaceRow` (rows, sessions, menu, dialogs, drag, scroll).
- `packages/app/src/workspace-sidebar/dialogs.tsx` — `WorkspaceRenameDialog` (trim-empty disables Save) and `WorkspaceRemoveDialog` (danger action, cancel autofocused).
- `packages/app/src/workspace-sidebar/index.ts` — `export { SidebarWorkspaces } from "./sidebar"`.
- `packages/app/src/runtime/i18n/en.ts` — the `sidebar.workspace.*` block.
- `packages/app/src/shell/titlebar/titlebar.tsx` — the single mount seam.

## Decisions Made

- Rows render only from `visible(entries)`; there is no fallback group, so "removed means invisible everywhere in the sidebar" is a property of the model rather than an extra filter (T-2-10).
- `createSidebarActivityListener()` is imported from `sidebar-organized` and called inside `sidebar.tsx`; `titlebar.tsx` never imports it, which keeps the upstream mount at one import line.
- The add flow reuses the existing `homeProjectDirectories(result)` helper: `oxlint`'s `anti-slop(no-runtime-typeof)` rejects a `typeof result === "string"` narrow, and the helper already owns the picker's `string | string[] | null` shape.
- An unavailable row keeps its menu, context menu and sortable handle; only expansion is blocked (`aria-disabled`, no session area). The availability answer stays the filesystem probe from 02-01, never a session count.
- `registry.reorder` receives the visible directories in their new order; 02-01's `applyOrder` writes `order = index` and leaves unlisted/removed records alone.
- Scroll writes go through one `requestAnimationFrame` per frame so a scrolling burst persists once (T-2-09).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The picker's `typeof` narrow broke the lint gate**
- **Found during:** Task 1 (add flow)
- **Issue:** `typeof result === "string"` tripped `anti-slop(no-runtime-typeof)`, which fails `bun script/lint-changed.ts` for any touched file.
- **Fix:** Reused `homeProjectDirectories(result)` from `@/shell/layout/helpers`, which already turns the picker's `string | string[] | null` into a `string[]`, then took the first entry.
- **Files modified:** `packages/app/src/workspace-sidebar/sidebar.tsx`
- **Verification:** `bun script/lint-changed.ts upstream/dev` → 0 problems; `bun check --no-script` → 0 diagnostics.
- **Committed in:** `c5ac7d413a`

**2. [Rule 2 - Missing Critical] Scroll restore raced desktop hydration**
- **Found during:** Task 3, reviewing the restore path
- **Issue:** The planned `onMount` + `requestAnimationFrame` restore reads `registry.scrollTop()` once, ~16 ms after mount. Desktop storage hydrates asynchronously, so on the shipped desktop app that read is still the initial `0` and the position silently fails to restore (acceptance criterion 5 requires it to survive a restart).
- **Fix:** Extracted `restoreScroll()` (guarded by `scrollTop === 0` so a user's own scroll is never overridden) and also ran it from `createEffect(on(registry.ready, ...))` with `defer: true`. No new module, no test seam.
- **Files modified:** `packages/app/src/workspace-sidebar/sidebar.tsx`
- **Verification:** `bun check --no-script src/workspace-sidebar/sidebar.tsx` → 0 diagnostics; `bun test ... src/workspace-sidebar` → 80 pass; `lint-changed` → 0 problems.
- **Committed in:** `07928e4c97`

---

**Total deviations:** 2 auto-fixed (1 × Rule 1, 1 × Rule 2)
**Impact on plan:** No scope creep, no new dependency, no upstream file beyond the three promised seams. Both fixes were required for the plan's own gates and acceptance criteria to hold.

## Issues Encountered

- **The `titlebar.tsx` seam had to be exactly three changes.** `SidebarOrganized` was only referenced on its import line and the JSX line, so replacing the import instead of adding one kept the diff at 2 insertions / 2 deletions with no re-indent hunk.
- **`text-13-*` utility classes do not exist in this repo.** Empty-state and row copy use explicit `text-[13px] leading-[var(--line-height-compact)]`, matching `sidebar-organized.tsx`, rather than a non-existent `text-13-medium`.
- **`createEffect` is still a no-op under `bun test`** (Bun resolves solid-js's server build), so this plan added no DOM unit tests; all row interaction is verified in the browser UAT below. This is the same environment property 02-01 recorded for `ctx.data.on(...)`; no production seam was introduced to work around it.

## Manual UAT (copied verbatim from the plan — run these)

1. 同一 git 仓库两份本地拷贝各自登记 → 两行；各自展开只显示本目录会话（子目录会话不出现）。
2. 有历史会话但未登记的目录 → 侧栏不出现；侧栏无任何「未分组 / 其它」分组。
3. 重命名 → 显示名变；目录名、`git status`、会话标题不变；重启后保持。
4. 移除 → 行消失；Inbox 仍可见该目录会话；目录与 `.git` 未动。
5. 重新登记 → 行回来，显示名与顺序沿用，会话完整。
6. 目录改名 → 行标记不可用、不可展开、不自动指向（该目录仍有历史会话，`session.list` 仍返回它们）；重新 Add 得到新行。
7. 重启 → 列表、标题、顺序、移除状态、滚动位置全部保持。
8. 空登记表 → 只有空态与「Add local folder」，无自动工作区。
9. Top tabs / Side tabs / Inbox 三种既有模式不受影响。

Setup for the pass: `bun dev serve --port 4096` at the repository root, `bun dev -- --port 4444` in `packages/app`, open `http://localhost:4444`, and set Settings → experimental → *Organize vertical sidebar* to **Projects**.

Task-level human checks that were deferred to that pass:
- Task 1: one row appears with the directory's name; expanding lists only that directory's sessions; a session opens as a preview tab.
- Task 2: rename changes the sidebar label only; removing hides the row while Inbox still lists its sessions; a renamed directory shows "Folder unavailable" and cannot expand.
- Task 3: dragging two rows and restarting keeps the order, a new folder appends at the end, and the scroll position returns.

## Known Stubs

None. Every row, session, menu action and empty state is wired to the 02-01 stores; no placeholder copy, mock data or unwired prop was introduced.

## Threat Flags

None. The new surface is exactly what the plan's `<threat_model>` covers: user-written `title`/`directory` reach the DOM only through Solid text nodes and `language.t` (T-2-06), rename/remove call only `registry.rename`/`registry.remove` (T-2-07), the add flow accepts only the picker's result through Phase 1's `registrable` guard (T-2-08), scroll is frame-coalesced (T-2-09), and no fallback group exists to republish a removed row's sessions (T-2-10).

## Next Phase Readiness

- Phase 2 has no remaining code work: 02-01 pinned the data path, 02-02 renders it, and the automatic gates are green (80 unit tests, 0 file-scoped type diagnostics, 0 lint problems, empty `packages/server|protocol|core` diff).
- Blocking item before verification: the nine manual UAT steps above have not been run. Everything they cover is browser-only by design.
- `persisted()` still has no cross-window sync, the same accepted residual recorded in Phase 1 (last writer wins between two windows of the same server).

---

*Phase: 02-sidebar-render*
*Completed: 2026-11-14*

## Self-Check: PASSED

- Commits present: `c5ac7d413a`, `65c34fd9b9`, `69b89d6681`, `07928e4c97`
- Files present: `sidebar.tsx`, `dialogs.tsx`, `index.ts` under `packages/app/src/workspace-sidebar/`
- Gates: `bun test ... src/workspace-sidebar` 80 pass / 0 fail; `bun check --no-script` over the 11 phase files → no type errors; `bun script/lint-changed.ts upstream/dev` → 0 problems; `titlebar.tsx` diff 2/2; `packages/server|protocol|core` diff empty.
