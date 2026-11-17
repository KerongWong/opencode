---
phase: 05-add-open-and-collapse
reviewed: 2026-11-17
status: findings
findings: 4
---

# Phase 05 (add-open-and-collapse): Code Review Report

**Scope:** `add-open-machine.ts`, `ui-state.ts`, `sessions.ts` (added selectors only), `store.ts` (`createWorkspaceUiState`), `sidebar.tsx` (machine driver + collapse UI), `en.ts` (3 added keys). Commits `3b51b3c279`, `2e432cf6f3`, `cf231a7471`.

## Findings

| ID | Severity | File | Line | Issue | Recommendation |
|----|----------|------|------|-------|----------------|
| F-01 | BLOCKER | `packages/app/src/workspace-sidebar/add-open-machine.ts` | 105 | `failed` is an absorbing state: any later `registered` event falls through to `unchanged`, so after one 10s watch timeout (or one failed open) the Add→open feature silently never works again for the life of the component | Handle `registered` in `failed` exactly as in `awaiting` (new attempt, `watch.stop` not needed, `watch.start` with new attempt) |
| F-02 | WARNING | `packages/app/src/workspace-sidebar/sidebar.tsx` | 134–209 | The machine's `disposed` event is never dispatched by the driver, contrary to the AGENTS.md state-machine rule ("dispatch a `disposed` event", cleanup tied to owner lifetime). No leak today (timer cleared via `onCleanup`, body keyed per connection), but the machine's `disposed` transition is dead in production | Add `onCleanup(() => dispatchAddOpen({ type: "disposed" }))` in `WorkspaceSidebarBody`, or delete the unreachable event |
| F-03 | INFO | `packages/app/src/workspace-sidebar/sidebar.tsx` | 148–150, 193 | `watch.start` effect payload (`timeoutMs`, and `key`/`attempt` for re-derivation) is ignored; the driver re-hardcodes `ADD_OPEN_WATCH_TIMEOUT_MS`. The effect field is dead data and the machine no longer owns the timeout value it emits | Either carry `timeoutMs` through the `awaiting` variant to the watch effect, or drop the field from the effect union |
| F-04 | INFO | `packages/app/src/workspace-sidebar/sidebar.tsx` | 136, 161–180 | `addOpenDirectory` is never cleared after `opened`/`failed`/dispose; it holds a stale directory string. Unreachable misuse today (open effects only follow a synchronous `registered` that rewrites it), but it is the kind of shared mutable edge state the machine rules exist to prevent | Clear it in the `opened`/`open.failed` dispatch path, or store the directory inside the machine's `awaiting`/`opening` variants |

## Evidence

### F-01 (BLOCKER): `failed` has no exit — Add-open is permanently dead after one timeout

`transitionAddOpen` handles `idle`, `awaiting`, and `opening`; `failed` is matched by neither branch, so it falls to the final `return unchanged(state)` (line 105). Events in `failed`:

- `registered` → `unchanged(state)` — a new Add click expands the row (sidebar.tsx:292–294 sets `addOpenDirectory` and `expanded`) but the machine stays `failed`, the watch effect returns early (sidebar.tsx:189 `state.type !== "awaiting"`), nothing ever opens. Silent, with no toast by design, so the user has no signal the feature is dead.
- `sessions.ready` / `watch.timed-out` → `unchanged(state)`.
- Only `disposed` exits the state — and `disposed` is never dispatched (see F-02).

Concretely: one slow disk where a freshly added row's `session.list` exceeds `ADD_OPEN_WATCH_TIMEOUT_MS` (10s), and every subsequent Add on that server for the whole session opens nothing. The "supersede-on-second-registration" semantics are implemented for `awaiting` but not for `failed`, and the machine rules ("Every async path ends in a state", retries are new attempts with new ids) imply a user retry must re-enter the lifecycle.

Fix:

```ts
if (state.type === "failed") {
  if (event.type !== "registered") return unchanged(state)

  const attempt = state.attempt + 1

  return {
    state: { type: "awaiting", attempt, key: event.key },
    effects: [{ type: "watch.start", key: event.key, attempt, timeoutMs: ADD_OPEN_WATCH_TIMEOUT_MS }],
  }
}
```

(Note: `failed` carries the last attempt id, so `attempt + 1` keeps stale-event rejection intact.)

### F-02 (WARNING): `disposed` is a dead event in production

`grep` across `workspace-sidebar/` shows `disposed` dispatched nowhere in production code (only in `add-open-machine.test.ts:90,99`). AGENTS.md State Machines requires the driver to "dispatch a `disposed` event rather than keeping a disposed flag" with cleanup tied to owner lifetime. The current code happens to be safe — the watch `setTimeout` is cleared by the `onCleanup` inside the state-driven effect (sidebar.tsx:195), and `WorkspaceSidebarBody` is keyed per connection (sidebar.tsx:60 `<Show when={connection()} keyed>`) so a server switch disposes the whole signal — but the machine's `watch.stop`-on-dispose path (add-open-machine.ts:44) can never execute, and any future driver-side resource hung off `watch.start`/`watch.stop` would silently never be released. Either wire `onCleanup(() => dispatchAddOpen({ type: "disposed" }))` or remove the event from the union.

### F-03 (INFO): redundant timeout source

The machine emits `{ type: "watch.start", key, attempt, timeoutMs }` (add-open-machine.ts:24,55,67), but `runAddOpenEffect` returns early for every non-`open.*` effect (sidebar.tsx:150) and the watch effect hardcodes `ADD_OPEN_WATCH_TIMEOUT_MS` (sidebar.tsx:193). Same constant today, so no behavioral drift — but the effect payload is decorative, and the machine's "the driver turns effects into calls" contract is violated for the one effect that carries configuration. Either thread `timeoutMs` through the `awaiting` variant into the effect, or trim the field.

### F-04 (INFO): stale `addOpenDirectory`

`addOpenDirectory` (sidebar.tsx:136) is written on every `registered` (sidebar.tsx:292) and read on `open.recent`/`open.new` (sidebar.tsx:152), but never reset on `opened`/`open.failed` or disposal. It is only read in the same synchronous dispatch that follows a fresh `registered`, so no current path can observe a stale value; still, it is parallel mutable state outside the machine that the AGENTS.md machine rules ("no … closure variables beside it that also encode the phase") discourage. Carrying the directory in the `awaiting`/`opening` variants (or clearing it in the open-effect path) removes the hazard.

## Verified correct (checked, no findings)

- **Nested-effect disposal (the headline lifecycle question):** empirically verified against the repo's `solid-js@1.9.17` (browser condition) with a repro script: a `createEffect` created inside a `createEffect` run **is** disposed when the parent re-runs — the old inner effect never fires again after the parent returns early. So the state-driven watch effect in sidebar.tsx:186–209 does not leak per Add cycle, and the comment at sidebar.tsx:184 is accurate for this version.
- **Attempt guards:** `sessions.ready`/`watch.timed-out`/`opened`/`open.failed` all check `event.attempt === state.attempt`; supersede-on-second-registration (attempt N → N+1) correctly invalidates the first watch, and the replaced nested effect/timer die with the parent's re-run.
- **Signal writes during effects:** every dispatch goes through `untrack` (sidebar.tsx:138–146), so the synchronous `setAddOpen` inside the nested effect cannot re-enter the parent effect mid-run.
- **Timeout/ready race:** timer is cleared by `onCleanup` the moment state leaves `awaiting`; a late `watch.timed-out` or `sessions.ready` in `opening`/`failed` falls to `unchanged`.
- **i18n plural shape:** `AppI18nPluralKey` (language.tsx:54–56) requires both `<base>.one` and `<base>.other`; en.ts:909–910 provide both, and `plural()` injects `count` automatically (language.tsx:347–348), so `{{count}}` interpolates. No `.one`/`.other` key is passed to `language.t`. AGENTS.md localization rules satisfied.
- **`open.recent` lookup:** `openProjectSession`/`openProjectNewSession` are synchronous (project-sessions.ts:13–41 — promises are `void`ed internally), so the `try`/`catch` in `runAddOpenEffect` is effective; the row lookup key is `directoryKey`-stable across REG-04 spelling adoption, which only adopts when the key matches (registry.ts:76).
- **`probeSpelling` rejection:** never rejects — all failure paths `catch` and return `undefined` (sessions.ts:296–313), so the `void … .then()` in `add()` (sidebar.tsx:296–299) cannot produce an unhandled rejection.
- **`ui-state.ts`:** `reveal`/`conceal` are reference-stable, and `createWorkspaceUiState.commit` (store.ts:136–140) compares references, so no-op writes persist nothing. Schema uses `Persistence.struct`/`Persistence.array` consistent with the registry schema.
- **Cutoff math:** `shownSessions` slices `sessions.slice(0, 5)` and `hiddenSessionCount` computes `count - 5` — consistent; "Show less" only appears when `length > SESSIONS_PER_PROJECT` and revealed, which matches when "Show N more" could have been shown.
- **Machine purity:** no I/O, timers, `Date.now()`, or signals inside `transitionAddOpen`; `unchanged` returns the identical state object so no signal write occurs for non-applicable events.

## Dispositions (orchestrator, 2026-11-17)

| ID | Severity | Disposition | Rationale |
|----|----------|-------------|-----------|
| F-01 | BLOCKER | **Fixed** | `failed` 吸收态是真 bug：一次超时/失败后所有后续 Add 被静默忽略。修复：`failed + registered` → 新 attempt 的 `awaiting`（watch 已在离开 awaiting 时停止，只发 watch.start）；新增回归用例「a failed run never blocks the next Add」。 |
| F-02 | WARNING | **Fixed** | driver 从未派发 `disposed`（机器侧已处理）。修复：body 级 `onCleanup(() => dispatchAddOpen({ type: "disposed" }))`。 |
| F-03 | INFO | **Accepted（设计保留）** | `timeoutMs` 作为 effect 载荷是机器契约的一部分（driver 可改超时策略而不改机器）；当前 driver 用状态驱动 effect 实现，载荷暂不使用属合理冗余。 |
| F-04 | INFO | **Accepted（良性）** | `addOpenDirectory` 在终态后残留，但仅在 open effect 处理时读取，且每次 add() 都先写入新值；无错误读取路径。 |

## Notes

- Phase-04 code (clock, `working` registry, `SessionRow` internals) and pre-existing `sessions.ts` v2.0 code were excluded per scope.
- The temporary Solid repro script used for the disposal verification was deleted after the run; no source files were modified.
