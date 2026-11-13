---
last_mapped_commit: acdb57123fbf279c585996a507b90f3e79d3e72e
last_mapped_at: 2026-11-12
---
# Coding Conventions

**Analysis Date:** 2026-11-12

Scope: `packages/app/src/shell/titlebar`, `packages/app/src/runtime/server`, `packages/app/src/workspaces`,
`packages/app/src/home`, `packages/app/src/settings`, and `docs/designs`. Repository guidance from `AGENTS.md` and
`packages/app/AGENTS.md` is treated as binding.

## Naming Patterns

**Files:**
- kebab-case for every module: `tab-load-machine.ts`, `projects-groups.ts`, `inbox-settle-machine.ts`,
  `project-session-row.tsx`, `search-results.ts`.
- Tests are co-located and mirror the module name: `projects-groups.test.ts`, `inbox-settle-machine.test.ts`,
  `data.test.ts`, `inventory.test.ts`.
- State machines live in `machine.ts` when the folder has no other machine, otherwise `<feature>-machine.ts`
  (`tab-load-machine.ts`, `inbox-settle-machine.ts`, `search-machine.ts`, `rename-machine.ts`,
  `location-machine.ts`, `project-machine.ts`). This is required by `packages/app/AGENTS.md`.
- Stories use `<name>.stories.tsx` or `<name>.standalone.stories.tsx` (`inbox-card.stories.tsx`,
  `dialog.standalone.stories.tsx`). Component-test specs use `.spec.ts` and fixtures use `.fixture.tsx`.
- CSS is co-located and named after its component: `titlebar.css`, `tab-popover.css`, `settings.css`.

**Functions:**
- `create*` for factories and long-lived controllers: `createWorktreeInventory` (`workspaces/inventory.ts`),
  `createDesktopData` (`runtime/server/data.ts`), `createSessionRecency`, `createSettingsSearchState`
  (`settings/search-machine.ts`), `createSimpleContext` usage in `workspaces/location.tsx`.
- `use*` for Solid context hooks: `useLanguage`, `useGlobal`, `useServerCtx`, `useSettings`, `useTabs`.
- `select*` for pure UI selectors over machine state: `selectInboxLoading`, `selectSessionTabView`,
  `selectSearchQuery`, `selectInlineRenameSaving`.
- `transition*` for pure state-machine transitions: `transitionInboxSettle`, `transitionSessionTabLoads`,
  `transitionSettingsSearch`, `transitionInlineRename`.
- `is*` for type guards and predicates: `isRootTab`, `isProjectTab`, `isSearchActive`, `isWorkspaceDirectory`,
  `isSessionNotFoundError`.
- `parse*`, `format*`, `read*` for pure boundary work: `parseSettingsView`, `formatServerError`,
  `readSessionTabsRemovedDetail`.
- `with*` for non-mutating wrappers: `withWorktreeInventory`, `withInitial`.
- Test helpers use short scenario names: `setup`, `setupDesktop`, `replay`, `target`, `view`, `seed`, `emit`.

**Variables:**
- camelCase for locals and module-level values.
- Module constants are SCREAMING_SNAKE_CASE with a unit suffix where relevant:
  `INBOX_SETTLE_TIMEOUT_MS`, `SESSION_TAB_LOAD_TIMEOUT_MS`, `SEARCH_REVEAL_WAIT_MS`,
  `RECENCY_SESSION_LIMIT`, `REMOVED_SESSION_LIMIT`.
- Fixed singleton states and empty collections are uppercase and frozen: `DISPOSED`, `NONE`, `EMPTY_ENTRIES`,
  `NO_EFFECTS`, `CANCEL`, `EXIT`.
- Event and effect discriminants are dot-separated strings: `"requests.settled"`, `"reveal.timed-out"`,
  `"load.settled"`, `"input.changed"`, `"placeholder.due"`; effects such as `"reveal-timer.start"`,
  `"requests.sync"`, `"load.start"`, `"fetch.start"`, `"save.run"`, `"focus.trigger"`.
- Prefer inlining a single-use value instead of introducing `const tmp = ...` (root `AGENTS.md`).

**Types:**
- PascalCase. Machine modules export a predictable family:
  `<Feature>State`, `<Feature>Event`, `<Feature>Effect`, `<Feature>Transition`, `INITIAL_<FEATURE>_STATE`,
  plus `create<Feature>State()` when the initial state needs a fresh object.
- Lifecycle containers use `status` as the discriminant; events and effects use `type`; per-entry sub-states use
  `phase` (see `SessionTabLoadsState` and `SessionTabLoad` in `shell/titlebar/tab-load-machine.ts`).
- Every field of a machine type is `readonly`; arrays are `readonly T[]`; dictionaries use
  `Readonly<Record<K, V>>`.
- Discriminated unions are preferred over nullable flags. `packages/app/AGENTS.md` forbids parallel booleans,
  `WeakSet`s, generation counters, or closure variables that encode a phase.
- Branded keys use `unique symbol`:
  `SettingsPluginTab` in `settings/route.ts`, `ServerConnection.Key` in `runtime/server/registry`.
- Use `satisfies` for literal tables and test fixtures (`SESSION_EXECUTION_ENDED satisfies OpenCodeEvent["type"][]`,
  `{ ... } satisfies InboxSettleEvent`).
- Do not use `any`. Type assertions require a `// SAFETY:` comment and usually an `oxlint-disable` line for
  `anti-slop/require-safety-comment-for-type-assertion` or `anti-slop/no-chained-type-assertions`.

## Code Style

**Formatting:**
- Prettier config lives in root `package.json`: `semi: false`, `printWidth: 120`.
- Double quotes, two-space indentation, no semicolons.
- 120-column lines; long call chains are wrapped with one argument per line.
- Function declarations (`export function Titlebar(...)`) are the norm; arrow functions are used for callbacks and
  one-expression helpers.

**Linting:**
- `oxlint` via `bun run lint` and `bun run check`; configuration in `.oxlintrc.json`.
- `no-restricted-globals` bans `Reflect`.
- App/desktop/UI overrides enable the `anti-slop` rules, including:
  `no-array-filter-map`, `no-reduce-accumulator-copy`, `no-chained-type-assertions`,
  `no-known-value-widening`, `no-module-mocking`, `no-object-parameters`, `no-runtime-typeof`,
  `no-unknown-parameters`, `no-unknown-returns`, `no-unknown-type-aliases`, `no-unsafe-dictionary-type`,
  `require-readable-spacing`, `require-safety-comment-for-type-assertion`, and `oxc/no-accumulating-spread`.
- Suppressions are one-line and always explain why:
  `// oxlint-disable-next-line anti-slop/no-runtime-typeof -- probing for a deprecated browser API ...`
  (`composer/attachments/attachments.ts`).
- Type checking is `bun check`/`bun typecheck` from the package; never call `tsc` directly. CI uses
  `typecheck:tsc` and it is the source of truth.

**Language rules from root `AGENTS.md` that show up everywhere in scope:**
- Prefer `const`; use ternaries or early returns instead of reassignment.
- Avoid `else`; return early.
- Avoid destructuring; use dot notation to preserve context.
- Prefer functional array methods (`map`, `filter`, `flatMap`) over `for` loops, with type guards on `filter`.
- Avoid `try`/`catch` except at boundaries where an API can throw synchronously (`health.ts` guards
  `AbortSignal.timeout`).
- Validate `unknown` once at the owning boundary, then pass typed values inward.
- Use Bun APIs when possible; avoid explicit annotations when inference is clear.

## Import Organization

**Order observed:**
1. `bun:test` first in test files.
2. External packages (`solid-js`, `@opencode/...`, `effect`, `@tanstack/solid-query`).
3. Blank line.
4. Internal imports through the `@/*` alias and relative `./`/`../` imports.
5. Side-effect CSS import last in most components (`import "@/settings/settings.css"`,
   `import "./titlebar.css"`), though some older files interleave it.

**Path Aliases:**
- `@/*` maps to `./src/*` (`packages/app/tsconfig.json`).
- Use `import type` for types, and never alias an import (`import { foo as bar }`) or use star imports; root
  `AGENTS.md` forbids both.

## Error Handling

**Patterns:**
- Message extraction is centralized in `formatServerError(cause, translate?, fallback?)`
  (`runtime/server/errors.ts`). It unwraps SDK errors (`cause.body`, `cause.cause`) and recognizes tagged errors
  such as `ConfigInvalidError`, `ProviderModelNotFoundError`, and `SessionNotFoundError`.
- Classify `unknown` only at the boundary that owns it. `errors.ts` uses `Predicate` from `effect`
  (`isObjectOrArray`, `hasProperty`, `isTagged`, `isString`) instead of manual `typeof` chains.
- Best-effort UI reads return `undefined` rather than rejecting:
  `fetchQuery(...).catch(() => undefined)` and `refresh(...).catch(() => undefined)` in
  `workspaces/inventory.ts`.
- Async outcomes that the user can observe become machine states/events, never a silent `return` or a log line:
  `{ type: "fetch.failed", attempt, message }`, `{ type: "save.timed-out", attempt }`,
  `{ type: "requests.settled", key }` (`home/sessions/load-machine.test.ts`,
  `settings/rename-machine.test.ts`, `inbox-settle-machine.ts`).
- `throw new Error(...)` is reserved for programmer errors and invariants:
  `runtime/server/scope.ts` rejects null bytes, `runtime/server/runtime.tsx` and `sync.tsx` require a Solid owner,
  `global-sync/child-store.ts` uses translated messages for failed store creation.
- Fire-and-forget effect drivers use `Promise.try(...).catch((cause: unknown) => console.error(...))`
  (`settings/providers/providers.tsx`, `settings/workspaces/project-model.ts`,
  `home/projects/actions.tsx`).

## Logging

**Framework:** `console` only; no logging library in this area.

**Patterns:**
- Bracketed area prefixes: `[project.import]`, `[persistence]`, `[plugin]`, `[tabs]`, `[new-session]`,
  `[server-request-queue]`, `[global-sdk]`.
- Log at the edge, not inside pure machines. `runtime/server/request-queue.ts` accepts an injectable
  `log(message, data)` and defaults to `console.warn("[server-request-queue] ...")`.
- Warning vs error: recoverable transport/socket information uses `console.info`/`console.warn`; failed writes,
  failed plugin effects, and rejected imports use `console.error`.
- Never hardcode user-visible errors; display them through i18n keys or `formatServerError`.

## Comments

**When to Comment:**
- Explain why, not what. One or two lines above the code:
  "A loaded or missing session leaves the entry: the tab reads both from the session cache."
  (`tab-load-machine.ts`).
- Use `/** ... */` on exported types, constants, and contract-bearing functions to describe the observable
  lifecycle and the user consequence. Examples: `InboxSettleState` and `INBOX_SETTLE_TIMEOUT_MS`
  (`inbox-settle-machine.ts`), `SettingsSearchState` (`settings/search-machine.ts`).
- Use `// SAFETY:` immediately before a type assertion, naming the invariant that makes it sound. This is both a
  review convention and an oxlint requirement.
- Use `// oxlint-disable-next-line <rule> -- <reason>` for each suppression; group file-wide suppressions at the
  top with a single explanatory comment (`workspaces/selection/domain.test.ts`,
  `home/projects/import-machine.test.ts`).
- No commented-out code and no `@param`/`@returns` boilerplate. Doc comments describe behavior and edge cases.

## Function Design

**Size:** Keep the happy path in the exported function and move supporting branches into small helpers below it
(root `AGENTS.md`, "Complex Logic"). Examples: `transitionInboxSettle` delegates to `ready`, `same`, `unchanged`;
`transitionSettingsSearch` delegates to `input`, `synced`, `returnToOrigin`, `idle`, `cancel`.

**Parameters:** Prefer a single object parameter when a function has more than two related options:
`createWorktreeInventory(input: { scope; queryClient; api; updated })`,
`settingsViewRedirect(input: { view; loaded; servers })`, `checkServerHealth(server, fetch, opts?)`.
Do not wrap a single value in an object (`anti-slop/no-object-parameters` pushes back).

**Return Values:**
- Pure transitions return `{ state, effects }`; selectors return a derived view; predicates return booleans or
  type predicates.
- Return the same state object when an event does not apply, so Solid writes nothing and the no-op is explicit:
  `return unchanged(state)` in `inbox-settle-machine.ts`, `tab-load-machine.ts`, `search-machine.ts`.
- Return `undefined` for "no answer" instead of throwing in UI-facing helpers.

**State machines (binding, from `packages/app/AGENTS.md`):**
- One discriminated union in its own module is the single source of truth. No booleans, nullable in-flight
  fields, `WeakSet`s, generation counters, or closure flags beside it.
- `transition(state, event)` is pure: no I/O, timers, signals, `await`, or `Date.now()`.
- Async work runs in a thin driver at the edge. The driver performs effects, dispatches results as events, owns
  timers and abort controllers, and cleans up with `onCleanup`/`ctx.onCleanup`. Dispatch `disposed` rather than
  keeping a disposed flag.
- Claim work synchronously before the first `await`; carry an attempt id and reject stale results by comparing it
  in the machine (`SessionTabLoad.attempt`, `SettingsSearchState.activation`).
- Every async path ends in a state: success, failure, timeout, cancel, dispose.
- Serialize operations on shared data through one queue in the machine (`active` + `pending`) when the feature
  mutates data.
- On identity changes (session, server, window, credential), start a new target and attempt instead of carrying
  the old error/controller/result.
- Hot paths stay allocation-free: reuse event objects, frozen singleton states, and return the same object when
  nothing changes.

## Module Design

**Exports:**
- Production modules use named exports only. There are no default exports in `src` (story files are the
  exception: they export a default `{ title, id }` meta object).
- Keep helper functions non-exported below the exported surface. Export a helper only when a test or another
  module genuinely owns that contract.
- Barrel files are not used; import the concrete module. `home/sessions/index.ts` is a module with logic, not a
  re-export barrel.

**Feature layout:**
- Feature folder + co-located machine, CSS, tests, and stories:
  `workspaces/inventory.ts` + `inventory.test.ts`,
  `shell/titlebar/tab-popover.tsx` + `tab-popover.css` + `tab-popover-machine.ts` + its test.
- Cross-cutting runtime state lives under `runtime/server/*` and is consumed through contexts
  (`useGlobal`, `useServerCtx`, `useData`, `useServerSDK`), not imported ad hoc by components.

## SolidJS Conventions

- Prefer `createStore` over multiple `createSignal` calls (`packages/app/AGENTS.md`, SolidJS).
  `settings/model.tsx`, `runtime/server/data.ts`, and `settings/shell.tsx` use stores for structured state.
- Derived values use `createMemo`, with equality comparators where identity matters:
  `createMemo(() => ({ directory, workspaceID }), undefined, { equals: sameLocationRef })`
  (`workspaces/location.tsx`).
- Read machine state through `untrack` when dispatching snapshots, then dispatch:
  `const next = transitionLocationSync(untrack(syncState), event)` (`workspaces/location.tsx`).
- Subscriptions and timers are released with `onCleanup`; machine drivers dispatch `{ type: "disposed" }`
  (`data.ts`, `location.tsx`, `tab-load-machine` consumers).
- Render branches use `<Show>` and `<Switch>`/`<Match>`; keyed matches or memos prevent a branch from reading a
  value another branch narrowed (`packages/app/AGENTS.md`).
- Contexts are created with `createSimpleContext` from `@opencode/ui/context`
  (`workspaces/location.tsx`).
- Render-time async reads must be guarded so they never enter Suspense unintentionally:
  `resource.state === "ready" || resource.state === "refreshing"`, then read `resource.latest`, otherwise fall
  back to cached data (`packages/app/AGENTS.md`, "Suspense").
- Never call `crypto.randomUUID()` in renderer code; use `uuid()` from `@opencode/util/uuid` so plain-HTTP
  origins keep working.

## UI, CSS, and Copy

- Style through semantic attributes and theme tokens, not ad-hoc class names inside feature CSS:
  `[data-slot="titlebar-tab-item"]`, `[data-action="mobile-tabs-home"][data-state="pressed"]`,
  `[data-scrollable]` (`shell/titlebar/titlebar.css`).
- Use logical CSS properties (`padding-block-end`, `inset-inline-end`, `margin-block-start`) for RTL support.
- Never write a literal font family. Use the UI/code/terminal roles from `packages/app/AGENTS.md` and the
  `--font-family-*` / `--v2-font-family-*` variables. Font faces live only in `packages/app/src/index.css`.
- Use `--line-height-compact` for 13px compact UI and `--line-height-base` for body text; no `leading-none`.
- All user-visible English copy goes through `language.t(...)` or `language.plural(baseKey, count, params)`
  (`settings/shell.tsx` stores i18n keys in navigation tables; `runtime/server/errors.ts` takes a translator).
  Never hardcode visible strings, placeholders, tooltips, accessible labels, or empty states.
- Scroll containers follow the shared rules: `overflow-y-auto` + `min-h-0` for pages/panels, `MenuScroll` for
  menus/popovers, `data-scrollable` on each scroll container. Do not restyle shared indicators or scrollbars.

## Data and Event Conventions

- Server data is shaped by `@opencode/client/promise` types (`SessionInfo`, `WorktreeDirectory`,
  `OpenCodeEvent`, `Project`) and consumed through `runtime/server/data.ts`.
- Durable event names are treated as wire contracts: `session.renamed`, `session.execution.succeeded`,
  `session.execution.interrupted`, `session.deleted`, `session.inbox.enqueued`. Do not invent local aliases.
- Recency/projection logic lives in pure factories (`createSessionRecency`, `createSessionMutations`,
  `createSessionRefresh` in `runtime/server/data.ts`) and is tested through the real store.
- Query keys are tuples with the server scope first: `[scope, "worktree", projectID]`,
  `[scope, "settings-workspace-inventory", projectID ?? null]` (`workspaces/inventory.ts`).

## Documentation Conventions (`docs/designs`)

- Design docs are written in Chinese in this fork and open with a title plus generated metadata
  (`Generated by /office-hours 2026-11-03`, `Repo:`, `Status:`, `Mode:`, `Wireframe:`).
- They separate problem, premises, considered approaches, recommendation, seam list, and validation results,
  with tables for seam/conflict analysis (`docs/designs/project-grouped-sessions-sidebar.md`).
- Paths, types, and identifiers stay in English/monospace even inside Chinese prose.

## Anti-Patterns

**Booleans beside a lifecycle.** `loading`/`error`/`submitting` flags next to each other instead of one
discriminated state union. Use a machine and selectors (`inbox-settle-machine.ts`).

**Re-validating typed data.** Checking `typeof value === "object"` after a schema or constructor already
guaranteed the shape. Validate once at the boundary (`runtime/server/errors.ts`).

**Test-only production seams.** Adding `now`, `delay`, `budget`, a flag, a global, or a `data-*` attribute only
for tests. Tests control time with `setSystemTime` or `jest.useFakeTimers` and drive the real entry point
(`packages/app/AGENTS.md`, Tests).

**Hardcoded copy or font families.** Both bypass user settings and fail localization/RTL review. Use
`language.t(...)` and the font-role variables.

**Import aliasing and star imports.** Forbidden repository-wide. Import the module's exported namespace by name
when namespacing is needed (`import { Project } from "@opencode/core/project"`).

---

*Convention analysis: 2026-11-12*
