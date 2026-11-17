---
phase: 02-sidebar-render
reviewed: 2026-11-13T18:09:33Z
depth: standard
files_reviewed: 8
files_reviewed_list:
  - packages/app/src/workspace-sidebar/store.ts
  - packages/app/src/workspace-sidebar/sessions.ts
  - packages/app/src/workspace-sidebar/sidebar.tsx
  - packages/app/src/workspace-sidebar/dialogs.tsx
  - packages/app/src/workspace-sidebar/index.ts
  - packages/app/src/workspace-sidebar/registry.ts
  - packages/app/src/runtime/i18n/en.ts
  - packages/app/src/shell/titlebar/titlebar.tsx
findings:
  critical: 1
  warning: 5
  info: 9
  total: 15
  necessity: 1
status: issues_found
---

# Phase 2: Code Review Report

**Reviewed:** 2026-11-13T18:09:33Z
**Depth:** standard
**Files Reviewed:** 8
**Status:** issues_found

## Summary

Reviewed the eight changed files of Phase 2 plus the upstream sibling `packages/app/src/shell/titlebar/sidebar-organized.tsx` (the body this phase replaces, read for context only). The data layer (`registry.ts`, `store.ts`, `sessions.ts`), its renderer (`sidebar.tsx`, `dialogs.tsx`), the two-line titlebar mount, and the new i18n block were traced end to end, including the server-side semantics of `session.list` and `fs.list`.

Positive results on the four areas called out for special attention:

- **(a) `load` re-entrancy** is correct. `createEffect(on(rows, () => sessions.load()))` is safe because Solid's `on` already invokes its callback inside `untrack`, so the `state.rows` / `state.spellings` reads and writes inside `load` cannot re-subscribe the effect. The guarding `dirty`/`pendingProbe`/`inflight` sets also prevent duplicate fetches.
- **(b) spelling comparisons** consistently use `directoryKey`; no raw `===` against a server-returned directory exists in the reviewed code. The one raw comparison (`adoptSpelling`, `sessions.ts:133-134`) only decides whether to persist, and is not row identity.
- **(d) Solid store mutation** is sound: `visible()` returns a fresh filtered/sorted array, `arrayMove` copies, and every store write replaces the array (`probe`/`filter`) instead of mutating a snapshot.
- **(c)/(e)** are where the real defects are: `sessionRows`/row state has no generation guard, so an in-flight response can outlive a removal or a rename event (WR-01, IN-06).

No security vulnerability was found: titles render as text nodes, directories never reach the DOM, no secrets, no dynamic evaluation, and no user input is interpolated into a path or command.

One finding (CR-01) contradicts the phase plan's explicit instruction to omit `archived`; it is reported because the result makes the code's own archive subscriptions unreachable in effect and disagrees with every other session list in the app (`command-palette.tsx:41`, `composer/model.ts:209`, `inbox-model.ts:43`). The owner should either pass `archived: false` or delete the two subscriptions and document that archived sessions stay in rows.

The known Bun/solid-js limitation (server build makes `createEffect` a no-op in unit tests, so `ctx.data.on` wiring is browser-only) is accepted and was not treated as a defect.

## Critical Issues

### CR-01: `session.list` omits `archived`, so archived sessions stay in rows and the archive subscriptions do nothing`n`n**Resolved (2026-11-14):** `session.list` now passes `archived: false` (`sessions.ts`), so archived sessions leave the row and the `session.archived` / `unarchived` handlers become live. The spelling-probe call keeps the archived default on purpose (more chances to learn the server spelling). Not covered by a unit test: the suite pins pure helpers only, and faking the SDK context would be the seam `packages/app/AGENTS.md` forbids.

**File:** `packages/app/src/workspace-sidebar/sessions.ts:170-176` (and `:279-285`)
**Issue:** The row query passes `directory`, `limit`, `parentID` and `order` but not `archived`. The protocol filters archive state only when the field is present: `packages/schema/src/session.ts:90-101` documents "Omit to include both", and `packages/core/src/session/store.ts:160-161` adds the `time_archived` condition only for `input.archived !== undefined`. Therefore both archived and unarchived sessions are returned and rendered by `ProjectSessionRow` (`sidebar.tsx:402-412`), with no filter anywhere in the renderer.

Consequences:

1. Archiving a session (from Inbox, the only place that offers it) does **not** remove it from a workspace row: the `session.archived` handler at `sessions.ts:316-322` schedules a refresh that returns the same archived session. The `session.unarchived` handler at `:323-329` is equally unobservable. Both subscriptions exist solely to reflect archive state, so as written the feature they implement cannot be observed.
2. This is the only session list in the app that includes archived sessions: `home/start/command-palette.tsx:41`, `composer/model.ts:209` and `inbox-model.ts:43/148` all either pass `archived: false` for normal lists or load archived sessions explicitly in a dedicated query.
3. It contradicts requirement ROW-05/ROW-06's intent: the row-level refresh on `archived`/`unarchived` is meaningful only if the list follows archive state.

**Fix:** Pass `archived: false` in both calls, so a row lists unarchived root sessions only:

```ts
const result = await ctx.sdk.api.session.list({
  directory: queryDirectoryFor(entry, input.platform(), state.spellings),
  limit: SESSION_LIST_LIMIT,
  parentID: null,
  archived: false,
  order: "desc",
})
```

(If including archived sessions is genuinely intended, remove the `session.archived`/`session.unarchived` subscriptions and record the decision instead; leaving both is internally contradictory.)

## Warnings

### WR-01: In-flight list/probe responses have no generation guard and can resurrect a removed row or revert a rename

**File:** `packages/app/src/workspace-sidebar/sessions.ts:154-198` (writes at `:177`, `:179`, `:183`, `:189`, `:148`, `:150`), with forgetting at `:123-129` and `:254-267`
**Issue:** `fetchRow` writes the response into the store after `await` without re-checking that the row still exists or that its state was not updated in the meantime. `forget(key)` (called from `load` when an entry leaves `visible(entries)`) only deletes the current keys; it does not mark an in-flight request stale. Two concrete failures follow:

- **Removed row resurrection:** remove a workspace while its `fetchRow` is in flight (e.g. a `session.created` refresh started microseconds earlier). The response then executes `setState("rows", key, { status: "ready", sessions })`, `probeAvailability` recreates `availability[key]`, `adoptSpelling` recreates `spellings[key]`, and `attributeSessions` re-adds `sessionRows` entries — all for a workspace that `forget` already removed. The row is not rendered (rendering is driven by `visible(entries)`), so this is not user-visible in the list, but it leaves multiple orphaned store records and stale `sessionID → row` mappings until a later event or `load` happens to clean them. The failure path at `:186-189` has the same problem: a failed request can recreate a `"failed"` row for a removed workspace.
- **Rename revert:** `renameSession` (`:230-236`) updates the row in place and deliberately does not schedule a refresh. If a `session.list` issued before the rename resolves afterwards, `:177` replaces the whole row with the pre-rename titles and the rename is lost until the next full load.

**Fix:** Give each row write an epoch (or re-resolve the entry before applying), and drop the response if the row was forgotten or mutated since the request started:

```ts
const epoch = (epochs.get(key) ?? 0) + 1
epochs.set(key, epoch)
const result = await ctx.sdk.api.session.list(...)
if (epochs.get(key) !== epoch || !entryForKey(key)) return
```

Bump the epoch in `forget`, `renameSession`, and `dropSession` so event-driven mutations win over older list responses.

### WR-02: Any `file.list` failure is reported as "Folder unavailable"

**File:** `packages/app/src/workspace-sidebar/sessions.ts:137-152`
**Issue:** The availability probe has a single `catch` that writes `"unavailable"` for every rejection: 404 (the intended "folder was moved/deleted" case), but also 401 (credentials), 5xx, transport errors, aborts, and timeouts. The generated client declares `[400, 401, 404]` for `fs.list` (`client/src/promise/generated/client.ts:2213-2224`), and the server maps every `fs.list` failure to `FileNotFoundError` (`packages/server/src/handlers/fs.ts:32-45`), so the client cannot distinguish them by status alone. A transient failure marks a perfectly valid row unavailable and blocks expansion (`sidebar.tsx:334-336`, `aria-disabled`) until the next full `load` (reconnect, add, reorder) resets it. Requirement UX-05 asks for "moved or deleted", not "any request failed".

**Fix:** Treat only the not-found answer as unavailable, keep the previous availability on transport/auth/server errors, and surface the latter without blocking the row:

```ts
try {
  await ctx.sdk.api.file.list({ location: { directory: ... } })
  setState("availability", key, "available")
} catch (error) {
  if (isNotFound(error)) setState("availability", key, "unavailable")
  else setState("availability", key, "checking") // or keep the previous value
}
```

If no reliable discriminator exists, keep the previous value on failure rather than claiming the folder is gone.

### WR-03: A failed row renders nothing, and expanding it never retries

**File:** `packages/app/src/workspace-sidebar/sessions.ts:186-189`, `packages/app/src/workspace-sidebar/sidebar.tsx:143-150` and `:386-401`
**Issue:** A first-load failure stores `{ status: "failed", sessions: [] }`, and `WorkspaceRow` only branches on `"loading"` and `"ready" + empty`; `"failed"` renders an empty area with no message and no retry. `toggle` only calls `refreshRow` when `!sessions.rows()[key]` (`sidebar.tsx:149`), which is false for a `failed` row, so collapsing/expanding cannot retry. The only recovery is an unrelated full `load` (add, reorder, or reconnect). An async failure with no user-visible state and no retry path is a missing error-handling path, not just styling; the plan's "leave a blank line" applies only to a row that has previous sessions, not to the sole state the user ever sees.

**Fix:** Render a retry affordance for `"failed"` (a message plus a `Button` that calls `sessions.refreshRow(key)`), or make `toggle` refresh when `row.status === "failed"`. Keep the "keep previous sessions on a failed refresh" behavior by only showing the retry when `sessions.length === 0`.

### WR-04: On the web client, a Windows host cannot register any folder (silent no-op)

**File:** `packages/app/src/workspace-sidebar/sidebar.tsx:75` and `packages/app/src/workspace-sidebar/registry.ts:43-49`, `:91-97`
**Issue:** `host` is computed as `hostPlatform(platform.platform === "desktop" ? platform.os : undefined)`, and `Platform` types `os` as `never` on web (`runtime/platform/platform.tsx:142-147`). So any web client is normalized as POSIX. But the directory picker is **not** desktop-only: `useDirectoryPicker` falls through to the server-backed `DirectoryPickerDialog` whenever `directoryPickerKind` is not `"native"` (`workspaces/selection/picker.tsx:29-37`, `workspaces/selection/policy.ts:4-8`), and that dialog returns server-native absolute paths — for a Windows host, `D:/code/app` or `//server/share` (`workspaces/selection/domain.ts:315-331`). `registrable` then requires a leading `/` on POSIX (`registry.ts:96`), so every Windows folder is rejected, `register` returns `undefined`, and `add()` returns silently (`sidebar.tsx:170-172`). The documented local dev flow (`bun dev -- --port 4444`, `packages/app/AGENTS.md`) is exactly this configuration on Windows, so the feature appears broken with no error. The design note in `registry.ts:38-42` ("the directory picker is desktop-only") is factually wrong.

**Fix:** Do not derive path semantics from the client platform alone. Use the server's own path information (`sync.data.path` already exposes `directory`/`home` and therefore the separator convention) or accept both absolute forms in `registrable`/`normalizeDirectory`, and surface a failure (toast) instead of returning silently when `register` rejects.

### WR-05: Impossible-state guard — `needsAvailabilityProbe` is always true at its only call site

**File:** `packages/app/src/workspace-sidebar/sessions.ts:185`
**Category:** necessity
**Issue:** The guard `probe && needsAvailabilityProbe(state.rows[key]!)` can only ever pass because of `probe`: the immediately preceding synchronous block sets the row to `"ready"` (`:177`), and `needsAvailabilityProbe` returns `true` exactly for `status === "ready"` (`:79-81`). There is no `await` between the two lines, so no other code can change the status. The predicate therefore defends against a state this function rules out two lines earlier, and its `"loading"`/`"failed"` branches are unreachable in production (only the unit test at `sessions.test.ts:128-137` exercises them). It is a named predicate, so removal is a scope decision, not a defect fix.
**Fix:** Simplify to `if (probe) await probeAvailability(entry, key)`, or move the readiness check into `probeAvailability` if another caller will ever probe a non-ready row, and keep the unit test only for that real contract.

## Info

### IN-01: `rowKeyOf` is a test-only export

**File:** `packages/app/src/workspace-sidebar/sessions.ts:24-26`
**Issue:** `rowKeyOf(directory, platform)` is a thin wrapper over `directoryKey` and has no production caller; it exists only for `sessions.test.ts:10,29-30`. `packages/app/AGENTS.md` §Tests forbids test-only exports.
**Fix:** Drop the wrapper and use `directoryKey` directly in the test, or keep the function private if production later needs it.

### IN-02: `refresh: load` has no caller

**File:** `packages/app/src/workspace-sidebar/sessions.ts:361-368`
**Issue:** The returned `refresh` alias is never read (`sidebar.tsx` uses `load` and `refreshRow`). Dead public surface.
**Fix:** Remove `refresh`, or rename `load` to `refresh` consistently.

### IN-03: The add flow adopts the same spelling twice and reloads twice

**File:** `packages/app/src/workspace-sidebar/sidebar.tsx:174-178` with `packages/app/src/workspace-sidebar/sessions.ts:183`, `:290`
**Issue:** `probeSpelling` already calls `adoptSpelling`, which calls `onServerSpelling` → `registry.adoptDirectory`. The caller then calls `registry.adoptDirectory(entry.directory, spelling)` again and `sessions.load()` again. The second adopt is a no-op, and the registry write already triggers the `on(rows, …)` effect. This doubles the write path and, when several rows are present, issues a duplicate full refetch.
**Fix:** In `add`, just `void sessions.probeSpelling(entry)` and let the adopt callback and the rows effect do the work.

### IN-04: `untrack(load)` is redundant under `on`, and the comment misstates the mechanism

**File:** `packages/app/src/workspace-sidebar/sessions.ts:349-359`
**Issue:** Solid's `on(deps, fn)` invokes `fn` inside `untrack`, so `load`'s store reads were never tracked by this effect. The explicit `untrack` and the comment ("`untrack` keeps this effect from subscribing to the store writes `load` performs") imply the effect would self-trigger without it, which is false. This is harmless but misleading for the next maintainer.
**Fix:** Drop `untrack` and say the callback is already untracked by `on`, or keep it and correct the comment.

### IN-05: `session.moved` is not subscribed, so rows go stale after a location change

**File:** `packages/app/src/workspace-sidebar/sessions.ts:299-347`
**Issue:** `session.moved` exists (`packages/schema/src/session-event.ts:82-90`) and moves a session between directories. The sidebar only handles `created`/`archived`/`unarchived`/`deleted`/`renamed`, so a session moved out of a row stays listed until a full `load`, and one moved in does not appear. ROW-06 does not require it, but `ProjectSessionRow` exposes `session.location`-changing actions through its menu, so this is reachable from the sidebar itself.
**Fix:** Handle `session.moved` like `created`: re-attribute (or drop) the mapped session and schedule the affected row(s), or at minimum schedule `load()`.

### IN-06: `sessionRows` never prunes sessions that fall out of the 50-item window

**File:** `packages/app/src/workspace-sidebar/sessions.ts:110`, `:179`, `:123-129`
**Issue:** Every successful fetch adds `sessionID → rowKey` for up to 50 sessions, but mappings are only removed on `session.deleted` or when the whole row is removed. A busy directory therefore accumulates mappings for every session ever seen in the window; the map is bounded by session history, not by the rows, and grows for the lifetime of the mounted sidebar.
**Fix:** After a successful fetch, prune entries for that row that are not in the returned page (or at least when the row is forgotten), e.g. rebuild that row's slice of the map from `result.data`.

### IN-07: `SidebarOrganized` is now unreachable, and Projects mode no longer renders `verticalTabStrip`

**File:** `packages/app/src/shell/titlebar/titlebar.tsx:816`, `packages/app/src/shell/titlebar/sidebar-organized.tsx:73`, `:167`, `:368`
**Issue:** After the mount swap, nothing imports `SidebarOrganized`; its `ProjectList`/`ProjectRow` subtree is dead. Only `createSidebarActivityListener` from that module is still used (`sidebar.tsx:25`). Separately, `SidebarOrganized`'s `props.children(...)` slot was what rendered the vertical session-tab strip in Projects mode; `<SidebarWorkspaces />` has no equivalent, so users in Projects mode cannot see or switch their open tabs. The design doc for the sibling mode states that mode replaces the entire tab bar, so this may be intended — but it is a user-visible removal that no requirement in this phase records.
**Fix:** Record the tab-strip removal explicitly (ROADMAP/REQUIREMENTS or the design doc) and remove or relocate the dead `SidebarOrganized`/`ProjectList`/`ProjectRow` code; if tabs must stay, render `verticalTabStrip` under the workspace list.

### IN-08: The last scroll position is lost when the sidebar unmounts inside one frame

**File:** `packages/app/src/workspace-sidebar/sidebar.tsx:120-134`
**Issue:** `handleScroll` persists `scroller.scrollTop` only on the next animation frame; `onCleanup` cancels the pending frame without flushing it. Switching sidebar mode, switching servers (keyed remount), or navigating the app away within ~16 ms of the last scroll event drops that position, so the next mount restores the older value.
**Fix:** In `onCleanup`, write `registry.setScrollTop(scroller.scrollTop)` (or flush through a shared helper) before cancelling the frame.

### IN-09: Desktop hydration can flash the empty state

**File:** `packages/app/src/workspace-sidebar/sidebar.tsx:199-214`
**Issue:** On desktop, `persisted()` hydrates asynchronously, so `rows()` is `[]` until hydration lands and the "No workspaces / Add local folder" state renders for a frame or more even when the user has workspaces. `registry.ready` already exists and is used for scroll restore.
**Fix:** Gate the empty state on `registry.ready()` (render nothing, or a quiet placeholder, until ready) so the empty state means "no registered workspaces", not "not hydrated yet".

---

_Reviewed: 2026-11-13T18:09:33Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: standard_
