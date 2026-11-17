# Phase 07: 会话列表水位线 - Pattern Map

**Mapped:** 2026-11-18
**Files analyzed:** 5 (4 modified, 1 modified/rewritten test, 1 read-only dependency)
**Analogs found:** 5 / 5

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `packages/app/src/workspace-sidebar/sessions.ts` | utility (pure functions) | transform (cutoff math) | `packages/app/src/workspace-sidebar/session-status.ts` + existing `shownSessions/hiddenSessionCount` in same file | exact |
| `packages/app/src/workspace-sidebar/sidebar.tsx` | component (driver host) | event-driven (Solid stores, timers, events) | existing in-file `ui.expanded` memory store (L101, L257-268) + dual-granularity clock driver (L106-124) + add-open-machine driver | exact |
| `packages/app/src/workspace-sidebar/store.ts` + `ui-state.ts` | service (persistence wiring) | file-I/O (client-local persist) | `createWorkspaceRegistry` in same `store.ts` (the surviving persisted call site) | exact |
| `packages/app/src/workspace-sidebar/sessions.test.ts` (+ maybe new `watermark.test.ts`) | test | transform (pure table tests) | existing `sessions.test.ts` describe blocks + `session-status.test.ts` table style | exact |
| `packages/app/src/workspace-sidebar/session-status.ts` (read-only dep) | utility (pure functions) | transform | its own priority if-chain (STAT-02) — pattern to reuse for `requiredWatermark` attention conditions | role-match |

## Pattern Assignments

### `packages/app/src/workspace-sidebar/sessions.ts` (utility, transform)

**Analog:** the module's own pure-function section (`shownSessions`/`hiddenSessionCount`, L88-103) and the `session-status.ts` STAT-02 priority chain.

**Pure-function module convention** (sessions.ts L88-103 — the functions being replaced):
```ts
/** How many sessions a project shows before "show more" (COLL-01 default). */
export const SESSIONS_PER_PROJECT = 5

/**
 * COLL-01: how much of a row's session list is on screen. A revealed row shows everything;
 * otherwise only the newest `limit` rows. Pure so the cutoff math is unit-testable.
 */
export function shownSessions<T>(sessions: readonly T[], revealed: boolean, limit = SESSIONS_PER_PROJECT) {
  if (revealed) return sessions

  return sessions.slice(0, limit)
}

export function hiddenSessionCount(count: number, limit = SESSIONS_PER_PROJECT) {
  return Math.max(0, count - limit)
}

const SESSION_LIST_LIMIT = 50
```

Replacement shape (per CONTEXT): constants `SESSION_WATERMARK_BASE = 5` / `SESSION_WATERMARK_AUTO_MAX = 50`, pure functions such as `nextWatermark(current, total)` (baseline→+5→remaining≤5 → all / `Infinity`), `requiredWatermark(index, status flags…)`, and a slice/count helper keyed by row. Follow the existing style: named constant + doc comment naming the decision id (e.g. `COLL-05`), default-parameter cutoff math, no classes.

**Attention-conditions analog** (session-status.ts L6-26 — pattern for `requiredWatermark`'s running/approval/input/unread conditions):
```ts
export type SessionRowStatus = "failed" | "approval" | "input" | "working" | "unread" | "idle"

export function sessionRowStatus(input: {
  failed: boolean
  permission: boolean
  form: boolean
  busy: boolean
  unread: boolean
}): SessionRowStatus {
  if (input.failed) return "failed"

  if (input.permission) return "approval"

  if (input.form) return "input"

  if (input.busy) return "working"

  if (input.unread) return "unread"

  return "idle"
}
```
The watermark auto-raise condition is exactly `status ∈ {working, approval, input, unread}` plus "is the active session" plus `index ≤ SESSION_WATERMARK_AUTO_MAX`; express as one pure predicate over `(index, SessionRowStatus, isActive)`.

**House style notes (repo AGENTS.md) that apply to new code here:**
- No `else` statements — early returns (the if-chains above are the established precedent).
- Prefer functional array methods over for loops.
- Do not add test-only seams (`now` params etc.); pure functions take all inputs as arguments.

---

### `packages/app/src/workspace-sidebar/sidebar.tsx` (component, event-driven)

**Analog 1 — in-memory store pattern** (L101 + L257-268). The watermark store must be a sibling of this `ui.expanded` store — same shape, same lifetime (unmount = reset):
```tsx
const [ui, setUi] = createStore<{ expanded: Record<string, boolean> }>({ expanded: {} })
...
const expanded = (key: string) => ui.expanded[key] === true

const toggle = (key: string) => {
  const next = !expanded(key)

  setUi("expanded", key, next)

  // The first frame never waits: an expanded row renders what it already has, then fills in.
  if (next && !sessions.rows()[key] && !unavailable(key)) sessions.refreshRow(key)
}
```
Fold-reset hook: in `toggle`, when `next === false`, also delete that row's watermark key (`setWatermark(key, undefined)` — undefined deletes the key so the store shrinks, same idiom as `setRowWorking` at L127: `setWorking(sessionID, value ? true : undefined)`).

**Analog 2 — render-phase driver effect (monotonic raise)** (L114-122, the dual-granularity clock; and L254-255):
```tsx
createEffect(() => {
  if (!Object.values(working).some(Boolean)) return

  setClock("second", Date.now())

  const secondTimer = setInterval(() => setClock("second", Date.now()), 1_000)

  onCleanup(() => clearInterval(secondTimer))
})
```
```tsx
// `on` tracks the row list only: `load` reads and writes the session store, so a bare effect would retrigger itself.
createEffect(on(rows, () => sessions.load()))
```
The auto-raise effect reads each row's sessions + status memos and writes the watermark store only when it increases ("只升不降"); guard writes so no signal churn when nothing changes (reference-stable-write discipline, cf. `add-open-machine.ts` L31-38 `unchanged`).

**Analog 3 — add-open-machine driver boundary** (sidebar.tsx L131-140 + add-open-machine.ts L1-40):
```ts
// NAV-01 driver: the machine decides, this edge acts.
const dispatchAddOpen = (event: AddOpenEvent) =>
  untrack(() => {
    const previous = addOpen()
    ...
```
Per CONTEXT the watermark is **not** a state machine, but the same "pure functions decide, driver at the edge acts" split applies: `sessions.ts` pure functions compute the next watermark; `sidebar.tsx` owns the `createStore` and applies results with `untrack` where the effect both reads and writes the store.

**Show more/less rewiring** (L536-566, the JSX being replaced):
```tsx
<Key each={shownSessions(props.row.sessions, props.revealed)} by={(session) => session.id}>
  ...
</Key>
<Show when={hiddenSessionCount(props.row.sessions.length) > 0 && !props.revealed}>
  <button ... onClick={props.onRevealMore}>
    {language.plural("sidebar.workspace.sessions.more", hiddenSessionCount(props.row.sessions.length))}
  </button>
</Show>
<Show when={props.revealed && props.row.sessions.length > SESSIONS_PER_PROJECT}>
  <button ... onClick={props.onRevealLess}>
    {language.t("sidebar.workspace.sessions.less")}
  </button>
</Show>
```
New wiring: props `revealed/onRevealMore/onRevealLess` (L387-389, L429-431) become a numeric `watermark` + `onShowMore/onShowLess`; "Show more" count becomes remaining-hidden (`sessions.length - watermark`, clamped ≥ 0); "Show less" button shows when watermark ≥ total (all expanded). i18n keys stay `sidebar.workspace.sessions.more` / `.less` (en.ts L941-943, unchanged copy):
```
"sidebar.workspace.sessions.more.one": "Show {{count}} more",
"sidebar.workspace.sessions.more.other": "Show {{count}} more",
"sidebar.workspace.sessions.less": "Show less",
```

**Where attention signals come from** (session-row.tsx L80-113 — read-only dependency, per-row status memo already computed):
```tsx
const status = createMemo((): SessionRowStatus => {
  const serverCtx = ctx()
  if (!serverCtx) return "idle"
  ...
  return sessionRowStatus({ failed, permission: !!requests.permission, form: !!requests.form, busy, unread })
})
```
The auto-raise driver needs the same flags per session; options per CONTEXT's discretion: lift a per-session status memo into the row component and report it up via `onStatusChange`-style callback (mirroring `onWorkingChange` at L386/544), or recompute `sessionRowStatus` in the driver. The `isActive` check pattern is at L308-312:
```tsx
const isActive = (sessionID: string) => {
  const current = route()

  return current.type === "session" && current.server === serverKey && current.sessionId === sessionID
}
```

---

### `packages/app/src/workspace-sidebar/store.ts` + `ui-state.ts` (service, file-I/O)

**What is removed:** the whole `workspace-sidebar-ui.v1` persistence layer — `ui-state.ts` exports (`UI_STATE_KEY`, `WorkspaceUiSchema`, `initialUiState`, `uiStateTarget`, `reveal`, `conceal`) and `store.ts` `createWorkspaceUiState` (L132-152) plus its import block (L14-20). Sidebar call site L129 + L387-389 also go. The `workspace-registry.v1` persistence (`createWorkspaceRegistry`, L94-130) **stays** and is the surviving pattern reference:

```ts
export function createWorkspaceRegistry(scope: ServerScope, platform: HostPlatform) {
  const [state, setState, , ready] = persisted(registryTarget(scope), WorkspaceRegistrySchema, initialRegistry)

  const commit = (entries: WorkspaceEntry[]) => {
    if (entries === state.entries) return

    setState("entries", entries)
  }
  ...
}
```
Note: no new persisted store replaces it — the watermark is in-memory only (`createStore` in sidebar.tsx), matching the `ui.expanded` precedent. Update the module doc comment at store.ts L85-88 which currently names both persisted keys.

**Persistence schema pattern** (ui-state.ts L12-25 — the pattern being deleted, kept here so the planner knows exactly what to excise):
```ts
export const UI_STATE_KEY = "workspace-sidebar-ui.v1"

export const WorkspaceUiSchema = Persistence.struct({
  revealed: Persistence.array(Schema.String),
})

export type WorkspaceUiState = typeof WorkspaceUiSchema.Type

export const initialUiState: WorkspaceUiState = { revealed: [] }

export function uiStateTarget(scope: ServerScope): ReturnType<typeof Persist.serverGlobal> {
  return Persist.serverGlobal(scope, UI_STATE_KEY)
}
```
Also check for `ui-state.test.ts`: CONTEXT says the revealed-persistence pure-function tests (`reveal`/`conceal`) are deleted with the module. Verify no other importer references `ui-state` before deleting (grep `from "./ui-state"` across `packages/app/src`).

---

### `packages/app/src/workspace-sidebar/sessions.test.ts` (+ possible `watermark.test.ts`) (test, transform)

**Analog — describe/table style for pure cutoff math** (sessions.test.ts L291-313, the block being rewritten):
```ts
describe("shownSessions / hiddenSessionCount", () => {
  const list = (count: number) => Array.from({ length: count }, (_, index) => ({ id: `s${index}` }))

  test("a collapsed row shows the most recent five", () => {
    expect(shownSessions(list(6), false).map((item) => item.id)).toEqual(["s0", "s1", "s2", "s3", "s4"])
  })
  ...
  test("hidden count clamps at zero around the limit", () => {
    expect(hiddenSessionCount(5)).toBe(0)
    expect(hiddenSessionCount(6)).toBe(1)
    expect(hiddenSessionCount(0)).toBe(0)
    expect(hiddenSessionCount(12, 5)).toBe(7)
  })
})
```

**Table-test style analog** (session-status.test.ts — file header imports `describe, expect, test` from `bun:test`):
```ts
import { describe, expect, test } from "bun:test"
import { elapsedBucket, sessionRowStatus, statusMark } from "./session-status"
```
The watermark table tests (dsh-aligned: initial 5 / +5 / remaining≤5→all / auto-raise ≤50 / monotonic / fold-reset / Show less→baseline) follow the same one-table-per-behavior discipline from repo AGENTS.md: pure functions imported directly, no DOM, no timers, no mocks, no test-only seams.

If a new `watermark.ts` is split out (CONTEXT allows it when the function set grows), name the test `watermark.test.ts` per the module's flat `feature.ts + feature.test.ts` kebab-case convention. Otherwise rewrite the L291-313 describe in place.

## Shared Patterns

### Pure-function module conventions (apply to sessions.ts / watermark.ts and their tests)
**Source:** `packages/app/src/workspace-sidebar/sessions.ts` L88-103, `session-status.ts` L6-26
- Export named constants with decision-id doc comments (`COLL-01`, `STAT-02` → new ones reference `COLL-05`).
- All decisions as early-return if-chains; reference-stable returns (return same array/object when nothing changes) so store writes stay no-ops.
- Unit tests: `bun:test` `describe`/`test`, plain expect calls, one table per behavior.

### In-memory Solid store (apply to sidebar.tsx watermark store)
**Source:** `packages/app/src/workspace-sidebar/sidebar.tsx` L101, L127, L257-268
```tsx
const [ui, setUi] = createStore<{ expanded: Record<string, boolean> }>({ expanded: {} })
const setRowWorking = (sessionID: string, value: boolean) => setWorking(sessionID, value ? true : undefined)
```
`Record<RowKey, number>` store, `undefined` deletes a key (fold-reset), component-lifetime scope = process-local reset (no persistence).

### i18n count copy (unchanged)
**Source:** `packages/app/src/runtime/i18n/en.ts` L941-943
Use `language.plural("sidebar.workspace.sessions.more", remainingHidden)` for the button (count semantics change to "remaining hidden"; copy unchanged) and `language.t("sidebar.workspace.sessions.less")` for Show less. No new keys.

## No Analog Found

None — every file has an exact in-module analog. The dsh-side reference (`WorkspaceBrowser.tsx` watermark constants/raise/drop and button block) is read-only external semantics documented in CONTEXT.md, not a codebase analog.

## Metadata

**Analog search scope:** `packages/app/src/workspace-sidebar/` (all 14 module files), `packages/app/src/runtime/i18n/en.ts`, usages of `sessionRowStatus`/`SESSION_LIST_LIMIT` under `packages/app/src`
**Files scanned:** ~10
**Pattern extraction date:** 2026-11-18
**Git-tracked verification:** all analog paths confirmed via `git ls-files`
