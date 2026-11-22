---
phase: 08-fold-persistence
reviewed: 2026-11-22T12:45:00Z
depth: standard
files_reviewed: 5
files_reviewed_list:
  - packages/app/src/workspace-sidebar/registry.ts
  - packages/app/src/workspace-sidebar/registry.test.ts
  - packages/app/src/workspace-sidebar/store.ts
  - packages/app/src/workspace-sidebar/sidebar.tsx
  - packages/app/e2e/regression/home.spec.ts
findings:
  critical: 0
  warning: 1
  info: 3
  total: 4
  necessity: 0
status: findings
---

# Phase 08: Code Review Report

**Reviewed:** 2026-11-22T12:45:00Z
**Depth:** standard
**Files Reviewed:** 5
**Status:** findings

## Summary

The change moves workspace-row fold state from the component-local `createStore` into the persisted
`workspace-registry.v1` document (`expanded: Record<rowKey, boolean>`), rewires `WorkspaceRow` to the
registry store, and adds schema/unit tests plus a reload e2e. The core requirements hold: old documents
without `expanded` decode with `{}` while keeping `entries`/`scrollTop`, the initial document carries
`expanded: {}`, unexpanded rows read as folded, session watermarks remain in component memory, and
`add()` still auto-expands the new row through the same store.

Verification performed for this review:

- `bun test --conditions=solid --isolate --preload ../ui/test/solid-jsx.ts --preload ./happydom.ts ./src/workspace-sidebar`
  → **148 pass / 0 fail**.
- `bun run test:e2e -- e2e/regression/home.spec.ts -g "fold state"` → **1 passed (24.8s)**, including both
  reload assertions (expanded survives, collapsed survives).
- Type-checking could not be run in this checkout: `packages/app/src/custom-elements.d.ts` is a plain text
  file containing `../../ui/src/custom-elements.d.ts` (symlink materialized as text on Windows), so both
  `bun run typecheck` and `bun run typecheck:tsc` fail with `TS1128` before reaching any reviewed file. This
  is a pre-existing environment issue, not a finding against this phase.

One behavior deviates from the phase's stated decision, and two coverage/hygiene gaps and one pre-existing
accessibility latch (now reachable after restart) are recorded below. No security issue was found: the
persisted fold map crosses a local trust boundary but is decoded through the existing schema, values are
booleans only, and no new identity source or injection path is introduced.

## Findings

| ID    | Severity | File                                                       | Line    | Issue                                                                                                         |
| ----- | -------- | ---------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------- |
| WR-01 | warning  | `packages/app/src/workspace-sidebar/registry.ts`           | 25      | One malformed `expanded` entry resets the whole fold map to `{}` instead of dropping only that entry.         |
| IN-01 | info     | `packages/app/src/workspace-sidebar/store.ts`              | 123-127 | Collapsed rows persist explicit `false` values and keys of removed workspaces are never pruned.                |
| IN-02 | info     | `packages/app/e2e/regression/home.spec.ts`                 | 227-273 | The only end-to-end proof uses synchronous web `localStorage`; desktop async hydration restore is untested.   |
| IN-03 | info     | `packages/app/src/workspace-sidebar/sidebar.tsx`           | 550-573, 604 | An unavailable row can still report `aria-expanded=true` with its content hidden; persistence now survives restarts. |

## Warnings

### WR-01: Corrupt fold entry discards every row's fold state

**File:** `packages/app/src/workspace-sidebar/registry.ts:25`
**Issue:** `expanded: Persistence.record(Schema.Boolean)` wraps the record in `Persistence.fallback`
(`packages/app/src/runtime/persistence/schema.ts:110-114`), which replaces the **entire** record when any
value fails decoding. `08-CONTEXT.md:31` and plan Task 1 require per-entry recovery ("逐条丢弃"), and the
phase summary documents the coarser behavior instead. The new unit test
(`registry.test.ts:269-281`) codifies the coarse behavior by asserting `{}` for
`{ "d:/code/app": "true" }`; the valid rows in the same map would also be lost. Impact is limited to view
state (entries/scrollTop survive), but a single corrupt value silently folds every row after the next
start. The per-entry idiom already exists in this codebase at
`packages/app/src/runtime/persistence/schema.test.ts:174-177`.

**Fix:**

```ts
// registry.ts
import { Effect, Option, Schema } from "effect"

export const WorkspaceRegistrySchema = Persistence.struct({
  entries: Persistence.array(WorkspaceEntrySchema),
  scrollTop: Schema.Number,
  expanded: Persistence.record(
    Schema.Boolean.pipe(Schema.catchDecoding(() => Effect.succeed(Option.none()))),
  ),
})
```

Update the "corrupt fold map" test to prove valid siblings survive, e.g. decode
`{ entries: [app], scrollTop: 12, expanded: { "d:/code/app": true, "bad": "true" } }` and expect
`expanded` to be `{ "d:/code/app": true }`.

## Info

### IN-01: Fold map grows with explicit `false` values and removed workspaces

**File:** `packages/app/src/workspace-sidebar/store.ts:123-127` (with `registry.ts:150-161`)
**Issue:** `setExpanded` short-circuits on an equal value, so a collapse of an expanded row writes
`false` instead of removing the key. `remove()` only masks an entry and never clears its fold key. The
persisted document therefore keeps one dead boolean per ever-collapsed row plus keys for workspaces the user
removed, and never shrinks. The impact is tiny (the map is read/written as a whole and is bounded by the
user's workspace history), but it contradicts the assumption recorded in `08-SECURITY.md:31` that keys are
"bounded by the registered workspace count".

**Fix:** treat folded as absent, which is already the documented read semantics
(`import { produce } from "solid-js/store"`):

```ts
setExpanded(key: string, value: boolean) {
  if (state.expanded[key] === value) return

  if (!value) {
    setState("expanded", produce((map) => void delete map[key]))
    return
  }

  setState("expanded", key, true)
}
```

Prune the same key in `remove()` if stale entries for removed workspaces should not be retained.

### IN-02: The restart contract is proven only on the synchronous web hydration path

**File:** `packages/app/e2e/regression/home.spec.ts:227-273`
**Issue:** The e2e runs `page.goto("/")` against the Vite web app, where `persisted` reads `localStorage`
synchronously before the first render. The stated requirement is desktop restart, where the registry
hydrates asynchronously over IPC after first paint and fold state arrives through `reconcile`. That path is
covered only generically by `packages/app/src/runtime/persistence/persist.test.ts` /
`storage.test.ts`, not with this schema, so "expanded row restored through async hydration (with session
content and `scrollTop`)" has no test. `08-VERIFICATION.md:95` claims no human verification is required;
that is accurate for the storage contract but not for the desktop shell.

**Fix:** add a persistence-level test that hydrates `WorkspaceRegistrySchema` from an async storage stub
(following `persist.test.ts`) and asserts `expanded` arrives after `ready`, or narrow the verification
claim to the web storage path.

### IN-03: Unavailable rows can announce `aria-expanded=true` with hidden content

**File:** `packages/app/src/workspace-sidebar/sidebar.tsx:550-573` and `:604`
**Issue:** The row button renders `aria-expanded={props.expanded}` and a downward chevron from
`props.expanded`, while the session content is gated by `props.expanded && !props.unavailable`. Availability
is probed after load, so a row that was expanded (or, after this phase, restored expanded) and then probes
as unavailable keeps `aria-expanded=true`, no visible content, and a disabled button that cannot be clicked
to correct it. This pre-dates the diff, but persisting the fold state makes the inconsistent state reachable
at startup when the directory disappeared while the app was closed.

**Fix:** derive one effective value and use it for the attribute, chevron and content:

```tsx
const open = () => props.expanded && !props.unavailable
// aria-expanded={open()}
// classList={{ "-rotate-90 rtl:rotate-90": !open() }}
// <Show when={open()}>
```

---

## Verification Evidence

| Command                                                                                                                             | Result                                     |
| ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| `bun test --conditions=solid --isolate --preload ../ui/test/solid-jsx.ts --preload ./happydom.ts ./src/workspace-sidebar` (`packages/app`) | 148 pass / 0 fail                          |
| `bun run test:e2e -- e2e/regression/home.spec.ts -g "fold state"` (`packages/app`)                                                  | 1 passed (24.8s)                           |
| `bun run typecheck` / `bun run typecheck:tsc` (`packages/app`)                                                                      | Blocked by pre-existing `custom-elements.d.ts` TS1128, unrelated to this diff |

_Reviewed: 2026-11-22T12:45:00Z_
_Reviewer: gsd-code-reviewer_
_Depth: standard_
