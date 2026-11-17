---
phase: 07-watermark
reviewed: 2026-11-18T00:00:00Z
depth: standard
files_reviewed: 5
files_reviewed_list:
  - packages/app/src/workspace-sidebar/sessions.ts
  - packages/app/src/workspace-sidebar/sidebar.tsx
  - packages/app/src/workspace-sidebar/store.ts
  - packages/app/src/workspace-sidebar/sessions.test.ts
  - packages/app/src/workspace-sidebar/session-status.ts
findings:
  critical: 1
  warning: 1
  info: 2
  total: 4
status: issues_found
---

# Phase 07: Code Review Report

**Reviewed:** 2026-11-18
**Depth:** standard
**Files Reviewed:** 5
**Status:** issues_found

## Summary

Reviewed the dsh-style batched-watermark replacement for the workspace sidebar session lists: pure functions (`nextWatermark` / `remainingHidden` / `shownByWatermark` / `requiredWatermark` / `raisedWatermark`), the in-memory watermark store, the render-phase monotonic auto-raise driver, and the `workspace-sidebar-ui.v1` persistence removal.

The watermark click math is correct and well-tested at the boundaries that matter (remaining = 5 expands in one step, monotonic guard, clamped remainder, `index <= 50` inclusive ceiling). The persistence layer removal is complete: `ui-state.ts` / `ui-state.test.ts` are deleted from disk, `store.ts` no longer references them, and a repo grep for `ui-state|UiState|workspace-sidebar-ui|createWorkspaceUiState|revealed` shows zero hits inside `workspace-sidebar` (all matches are unrelated features). The driver's SolidJS hygiene is good on its own terms: reads tracked, writes isolated in `untrack`, writes gated on strictly-greater comparison.

However, the COLL-04 attention auto-raise has a structural blind spot: the `statuses` store is fed **only by mounted `SessionRow` components**, and rows render only `shownByWatermark(...)` — the sessions *below* the current watermark. An attention session below the watermark can never report its status, so the driver (which defaults unknown sessions to `"idle"`) can never lift the watermark for exactly the sessions the feature exists for. The 07-02 summary claims "前 50 条内注意力会话与当前会话无需点击即可见" but only the pure functions are tested; the driver-level integration gap is unverified and real.

Verification note: I attempted to re-run `bun test src/workspace-sidebar/sessions.test.ts store.test.ts` locally; it failed at module load with `SyntaxError: Export named 'jsxDEV' not found in module 'solid-js'` — an environment/JSX-transform issue in this shell, not a defect in the reviewed code. Test-pass claims rest on the phase summaries (140 pass claimed).

## Critical Issues

### CR-01: Attention auto-raise is blind to sessions below the current watermark — COLL-04 fails for the case it exists for

**File:** `packages/app/src/workspace-sidebar/sidebar.tsx:361-364` (driver), `packages/app/src/workspace-sidebar/sidebar.tsx:607` (render gating), `packages/app/src/workspace-sidebar/session-row.tsx:120-122` (sole status producer)
**Issue:** The driver computes per-row requirements as:

```ts
requiredWatermark(index, known[session.id] ?? "idle", session.id === activeSession)
```

where `known` is the `statuses` store, which is written **only** by `SessionRow`'s `createEffect(() => props.onStatusChange?.(props.session.id, status()))`. But `SessionRow` components exist only for sessions inside `shownByWatermark(props.row.sessions, props.watermark)` (sidebar.tsx:607). A `working` / `approval` / `input` / `unread` session at index ≥ watermark is never mounted, never reports, and is read by the driver as `"idle"` (`?? "idle"` fallback) — so `requiredWatermark` returns 0 and the watermark is never lifted. The auto-raise only works for attention sessions that are *already visible*, which makes it a no-op in the exact scenario COLL-04 targets (e.g. a row with 20 sessions where a permission request fires on the 6th-newest session at watermark 5).

The design decision (07-02-SUMMARY: "status 信号走 onStatusChange 回调上报既有 row status memo… 避免第二份状态推导") traded correctness for reuse. dsh's reference implementation (`WorkspaceBrowser.tsx` L386-413) computes status requirements over **all** items in the group during render; this adaptation computes them over only the visible prefix.

This is reachable in normal use, contradicts 07-CONTEXT's locked decision ("running / 待交互 / 当前会话 / 未读完成 的会话在列表前 50 条内时自动抬水位使其可见"), and has no test coverage (D2 verification is code-inspection only).

**Fix:** Derive status for all row sessions in the driver instead of only mounted rows. Extract the status computation from `SessionRow`'s memo into a shared pure helper (over `serverCtx`, `session`, `active`, auto-approves — the same inputs `session-row.tsx:82-105` already uses), call it from both the `SessionRow` memo and the watermark driver for every session in each ready row (≤ 50 per row). Then `onStatusChange` / the `statuses` store can be dropped, removing the stale-state surface in WR-01 as well. If the callback channel must stay, add a fallback in the driver that computes status on cache-miss for unmounted sessions.

## Warnings

### WR-01: Stale `statuses` are never retracted — they re-raise the watermark after "Show less" and defeat fold-reset

**File:** `packages/app/src/workspace-sidebar/session-row.tsx:120-122` (no cleanup), `packages/app/src/workspace-sidebar/sidebar.tsx:346-374` (driver iterates rows unconditionally), `packages/app/src/workspace-sidebar/sidebar.tsx:290` / `457` (the two legitimate lowers)
**Issue:** When a session leaves the visible prefix (Show less, fold, or the watermark shrinking), its `SessionRow` unmounts without retracting its status — the 07-02 decision "statuses store 无卸载清理" assumed stale ids are harmless because "the driver only consults sessions currently in a row." That assumption is wrong in two ways:

1. **Show less is silently undone.** Trace: session s7 is `working`, watermark raised to 8; user clicks Show less → key deleted, watermark reads baseline 5; s7 unmounts, but `statuses["s7"]` remains `"working"` forever. The driver does not track `watermarks`, so it does not immediately re-run — but *any* later change to a tracked dep (a status report from another row's session, a `sessions.rows()` update, a route change) re-runs the driver, which reads the stale `"working"`, computes `requiredWatermark(7, "working", …) = 8`, and re-raises the watermark. The user's explicit lower is undone by phantom state; the watermark then never drops again until fold.

2. **Fold reset (COLL-05) is defeated for collapsed rows.** The driver iterates *all* registry rows (`for (const entry of entries)`), with no `expanded` check. A collapsed row's sessions are unmounted, so only stale pre-fold statuses are available; a stale attention status at index ≥ baseline raises that row's stored watermark while collapsed, so re-expanding shows a pre-lifted list instead of the baseline the fold reset promised.

Note facet 1 partially mirrors dsh (dsh's render-phase raise would also re-lift for a *genuinely* working session), but here the re-raise is seeded by **stale** data: s7 may have finished long ago with no mounted row to report it.

**Fix:** Add `onCleanup(() => props.onStatusChange?.(props.session.id, "idle"))` to the reporting effect in `session-row.tsx` (mirroring the `onWorkingChange` cleanup at L114), and skip non-expanded rows in the driver (`if (!expanded(key)) continue`) so a folded row's watermark stays at baseline until re-expansion. If CR-01's fix (driver-side status computation) is adopted, the cleanup problem disappears with the `statuses` store.

## Info

### IN-01: The "Show less" test asserts a constant identity and cannot fail meaningfully

**File:** `packages/app/src/workspace-sidebar/sessions.test.ts:327-331`
**Issue:** The test named "show less returns to the baseline in one step, not stepwise" asserts `expect(nextWatermark(undefined, 20)).toBe(SESSION_WATERMARK_BASE)` — the production constant compared against the test's import of the same constant. It verifies no behavior of Show less (which lives in the sidebar's `onShowLess` store-key deletion, sidebar.tsx:457, untested at any level) and per `packages/app/AGENTS.md` ("A test must be able to fail") it would pass even if Show less were deleted entirely.

**Fix:** Either delete the test as redundant (the `undefined → baseline` path is already covered by L299-301) or, better, move the delete-key assertion to a small store-level test of `setRowWatermark(key, undefined)` semantics.

### IN-02: Non-null assertion on a store read two lines after the write

**File:** `packages/app/src/workspace-sidebar/sessions.ts:250`
**Issue:** `needsAvailabilityProbe(state.rows[key]!)` — the `!` is safe by synchronous construction (the row was just set `"ready"` at L242), but it re-reads mutable shared state to learn what the local code already knows, and the assertion would mask a real regression (e.g. a future `forget(key)` racing this await point) as a TypeError-free `undefined` call.

**Fix:** Capture the written value or inline the known answer: the row was just set to `{ status: "ready", … }`, so `probe && needsAvailabilityProbe({ status: "ready", sessions: result.data })` — or hoist `const rowSessions = { status: "ready" as const, sessions: result.data }` and write/read that local.

---

_Reviewed: 2026-11-18_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: standard_
