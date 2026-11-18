---
phase: 07-watermark
fixed_at: 2026-11-18T00:00:00Z
review_path: .planning/phases/07-watermark/07-REVIEW.md
iteration: 1
findings_in_scope: 4
fixed: 4
skipped: 0
status: all_fixed
---

# Phase 07: Code Review Fix Report

**Fixed at:** 2026-11-18
**Source review:** `.planning/phases/07-watermark/07-REVIEW.md`
**Iteration:** 1

**Summary:**
- Findings in scope: 4 (CR-01, WR-01, IN-01, IN-02)
- Fixed: 4
- Skipped: 0

**Verification environment:** all gates ran in the main checkout on branch `workspace-registry`
(`workflow.use_worktrees` unset; the spawning orchestrator's project rules direct fixes into the
main working tree). Type gate: `bun check --no-script <files>` from `packages/app`. Tests:
`bun test --conditions=solid --isolate --preload ../ui/test/solid-jsx.ts --preload ./happydom.ts
src/workspace-sidebar/` from `packages/app` — 145 pass / 0 fail before the IN-01 test deletion,
144 pass / 0 fail after (one tautological test removed).

## Fixed Issues

### CR-01: Attention auto-raise is blind to sessions below the current watermark

**Files modified:** `packages/app/src/workspace-sidebar/session-row.tsx`,
`packages/app/src/workspace-sidebar/sidebar.tsx`, `packages/app/src/workspace-sidebar/sessions.ts`,
`packages/app/src/workspace-sidebar/sessions.test.ts`
**Commit:** `204f1b1490`
**Status:** fixed: requires human verification (driver reactivity is semantic, not just syntactic)
**Applied fix:** Per the reviewer's recommended direction (not the fallback): the mounted-row
reporting channel is gone entirely.

- Extracted `rowSessionStatus` (exported from `session-row.tsx`) as a pure read over
  `serverCtx` + `session` + `active` + `autoApprove` — exactly the inputs the old memo used. The
  `SessionRow` status memo now delegates to it, so mounted rows and the driver compute identical
  statuses.
- Added `requiredRowWatermark(row, statusOf, activeSession)` to `sessions.ts` (pure, follows the
  existing `requiredWatermark`/`raisedWatermark` pattern; the status lookup is injected so the
  hidden-session case is unit-testable without a DOM or server fixture).
- Rewrote the sidebar driver: for each **expanded** ready row it computes the requirement over
  **every** session in the row's already-loaded data (≤ 50 per row), so a `working`/`approval`/
  `input`/`unread` or active session below the watermark lifts it without a click. All reads
  (including the per-session status reads) stay in the tracked region; only the watermark store
  writes are inside `untrack`, so a session turning working below the watermark re-runs the
  effect.
- Deleted the `statuses` store, `setSessionStatus`, the `onStatusChange` prop (both declaration
  sites), and the reporting `createEffect` in `SessionRow`.
- Added five regression tests under `describe("requiredRowWatermark")`, led by "a working session
  below the baseline watermark raises the row" — this fails on the old mounted-row-only design,
  which read hidden sessions as `"idle"`.

### WR-01: Stale `statuses` are never retracted — they re-raise the watermark

**Files modified:** same commit `204f1b1490`
**Applied fix:** Both facets closed by the CR-01 redesign, as the review anticipated:

1. **Show less silently undone** — moot: the `statuses` store no longer exists, so there is no
   stale-state path that can re-raise a watermark after `onShowLess` deletes the key.
2. **Fold reset defeated** — the driver now skips non-expanded rows
   (`if (!expanded(key)) return [key, 0]`), so a folded row's watermark stays at its fold-reset
   baseline; on re-expansion the driver re-runs (it reads `expanded`) and re-raises only from
   live-derived statuses.

### IN-01: The "Show less" test asserts a constant identity

**Files modified:** `packages/app/src/workspace-sidebar/sessions.test.ts`
**Commit:** `7162220722`
**Applied fix:** Chose the reviewer's first option: deleted the tautological test (the
`undefined → baseline` path remains covered by the "first click lands on the baseline" test) and
removed the now-unused `SESSION_WATERMARK_BASE` import.

### IN-02: Non-null assertion on a store read two lines after the write

**Files modified:** `packages/app/src/workspace-sidebar/sessions.ts`
**Commit:** `bb0c65671b`
**Applied fix:** Hoisted the written value — `const ready: RowSessions = { status: "ready", sessions: result.data }`
is now both stored (`setState("rows", key, ready)`) and passed to
`needsAvailabilityProbe(ready)`, removing the `state.rows[key]!` re-read and its assertion.

## Skipped Issues

None.

## Notes

- No conflicts with 07-CONTEXT locked decisions. The fix implements the locked COLL-04 wording
  ("running / 待交互 / 当前会话 / 未读完成 的会话在列表前 50 条内时自动抬水位使其可见") more faithfully
  than the reviewed code did; the "status 信号走 onStatusChange 回调" line in 07-02-SUMMARY was an
  implementation note, not a CONTEXT-locked decision, and the review explicitly recommended
  replacing it.
- No new i18n keys, no `any`, module-internal diffs only.
- The driver's status computation now runs over all ≤50 sessions per expanded row (dsh-aligned);
  per-session work is the same reads the mounted rows already performed.
