---
last_mapped_commit: acdb57123fbf279c585996a507b90f3e79d3e72e
last_mapped_at: 2026-11-12
---
<!-- refreshed: 2026-11-12 -->
# Architecture

**Analysis Date:** 2026-11-12

Scope of this analysis: `packages/app/src/shell/titlebar`, `packages/app/src/runtime/server`, `packages/app/src/workspaces`, `packages/app/src/home`, `packages/app/src/settings`, `docs/designs`. Root manifests were used as supporting evidence (`packages/app/package.json`, workspace `package.json`).

## System Overview

OpenCode Desktop is a SolidJS single-page renderer (`packages/app`) that talks to one or more OpenCode servers over an HTTP + SSE SDK (`@opencode/client`). The renderer is organized as **layered context providers + feature controllers + pure view models**, with TanStack Query as the server cache and Effect Schema-backed `persisted()` stores for client state.

```text
┌───────────────────────────────────────────────────────────────────────────┐
│ Presentation (Solid components, one feature per folder)                   │
│  `shell/titlebar/projects.tsx`   `shell/titlebar/inbox.tsx`               │
│  `shell/titlebar/titlebar.tsx`   `home/route.tsx`   `settings/shell.tsx`  │
└──────────┬───────────────────────────────┬────────────────────────────────┘
           │ reads memos                   │ user actions
           ▼                               ▼
┌───────────────────────────────────────────────────────────────────────────┐
│ Feature controllers / models (Solid owners, lifecycle + effects)          │
│  `shell/titlebar/inbox-model.ts` (createSessionInbox)                     │
│  `home/model.ts` + `home/sessions/controller.tsx`                         │
│  `settings/model.tsx` (settings.v3)                                       │
│  `shell/titlebar/projects-state.ts` (projects-sidebar.v1)                 │
└──────────┬───────────────────────────────┬────────────────────────────────┘
           │                             │
           ▼                             ▼
┌──────────────────────────────────┐  ┌──────────────────────────────────────┐
│ Pure logic (no Solid, unit-tested)│  │ Runtime context per server           │
│ `projects-groups.ts`              │  │ `runtime/server/runtime.tsx`         │
│ `runtime/server/session-index.ts` │  │ `runtime/server/registry.tsx`        │
│ `workspaces/paths.ts`             │  │ `runtime/server/sync.tsx`            │
│ `home/sessions/index.ts`          │  │ `runtime/server/data.ts`             │
└──────────────────────────────────┘  └──────────────┬───────────────────────┘
                                                     │
                                                     ▼
┌───────────────────────────────────────────────────────────────────────────┐
│ SDK + caches: `@opencode/client` (`session.list`, `worktree.list`,         │
│ `project.update`, `location.get`), TanStack Query, SSE event streams      │
└───────────────────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| Titlebar | Window chrome, tab strip, and the vertical sidebar slot that dispatches interface modes | `packages/app/src/shell/titlebar/titlebar.tsx` |
| Projects sidebar | Renders project → session groups, drag order, removed-project menu, scroll restore | `packages/app/src/shell/titlebar/projects.tsx` |
| Project grouping rules | Maps a session to a project checkout group key and disambiguates labels (pure) | `packages/app/src/shell/titlebar/projects-groups.ts` |
| Projects sidebar state | Persists manual order, removed group keys, scroll position | `packages/app/src/shell/titlebar/projects-state.ts` |
| Session inbox model | Fetches one page of root sessions per server, merges live metadata, derives status/age, exposes actions | `packages/app/src/shell/titlebar/inbox-model.ts` |
| Inbox sidebar | Experimental status-grouped sidebar built on the same inbox model | `packages/app/src/shell/titlebar/inbox.tsx` |
| Root session merge | Merges fetched index rows with locally known sessions without promoting passive updates | `packages/app/src/runtime/server/session-index.ts` |
| Global provider | Creates/destroys one server controller per listed server, owns health and notifications | `packages/app/src/runtime/server/runtime.tsx` |
| Server registry | Lists/visible servers, per-server project usage store, connection keys | `packages/app/src/runtime/server/registry.tsx` |
| Server sync | Server project list, config bootstrap, worktree inventory wiring, `project.updated` handling | `packages/app/src/runtime/server/sync.tsx` |
| Desktop data layer | Wraps SDK `createData` with pending removals and send/rename recency projection | `packages/app/src/runtime/server/data.ts` |
| Worktree inventory | TanStack Query cache of worktrees per project, merged into `Project.worktrees` | `packages/app/src/workspaces/inventory.ts` |
| Location | Per-directory context: sync info, git branch, worktree inventory demand | `packages/app/src/workspaces/location.tsx` |
| Home route | Project picker + paginated session list + session search | `packages/app/src/home/route.tsx` |
| Home selection machine | Server/project selection lifecycle, worktree demand, project add | `packages/app/src/home/machine.ts` |
| Settings surface | Root/nested settings pages, search, per-server scoping | `packages/app/src/settings/shell.tsx`, `packages/app/src/settings/route.ts` |
| Settings model | `settings.v3` persisted schema, accessors/memos, CSS variable side effects | `packages/app/src/settings/model.tsx` |

## Pattern Overview

**Overall:** Layered feature modules with explicit state machines at lifecycle edges, Solid context providers for dependency injection, pure functions for derivation, and TanStack Query for server state.

**Key Characteristics:**
- **Contexts, not globals.** `createSimpleContext` from `@opencode/ui/context` gives `useGlobal`, `useServers`, `useServer`, `useCustom` style hooks. Examples: `GlobalProvider` (`runtime/server/runtime.tsx:50`), `ServersProvider` (`runtime/server/registry.tsx:230`), `ServerProvider` (`runtime/server/current.tsx:32`), `LocationProvider` (`workspaces/location.tsx:108`), `SettingsProvider` (`settings/model.tsx:345`).
- **Per-server scoping.** Every server gets a `ServerScope` (`"local"` for the sidecar/canonical server, otherwise the connection key) and every cross-server cache key or persisted key includes it (`runtime/server/scope.ts:23`, `workspaces/inventory.ts:8`).
- **Pure derivation separated from effects.** Grouping (`projects-groups.ts`), index merging (`runtime/server/session-index.ts`), path predicates (`workspaces/paths.ts`), and sidebar view rendering (`shell/titlebar/sidebar-view.ts`) are pure and unit-tested; timers, fetch, and Solid signals live in controllers/drivers.
- **Explicit state machines for phases.** `*-machine.ts` modules hold a discriminated union plus a pure `transition()` and effects consumed by a thin driver: `home/machine.ts`, `workspaces/location-machine.ts`, `shell/titlebar/inbox-settle-machine.ts`, `inbox-branch-machine.ts`, `session-rename-dialog-machine.ts`, `runtime/server/health-machine.ts`.
- **Stateful projections are explicit.** Recency is not read straight from the server: `createSessionRecency()` in `runtime/server/data.ts` projects `time.updated` for pending sends, renames, and floors, with a `WeakMap` remembering the raw server value (`data.ts:22`).
- **Persistence via Effect Schema.** `persisted(key, schema, defaults)` decodes/repairs stored state. Unknown union values are a risk (see Anti-Patterns): `tabLayout` is a persisted `Schema.Literals` (`settings/model.tsx:153`, key `settings.v3` at `settings/model.tsx:349`).

## Layers

**Presentation layer (`shell/titlebar`, `home`, `settings`):**
- Purpose: Render and dispatch user intent.
- Location: `packages/app/src/shell/titlebar/`, `packages/app/src/home/`, `packages/app/src/settings/`
- Contains: `.tsx` components, per-feature CSS (`titlebar.css`, `tab-nav.css`, `settings.css`, `search.css`), `.stories.tsx` fixtures.
- Depends on: feature controllers, context hooks, `@opencode/ui` primitives.
- Used by: `shell/shell.tsx` layout dispatch (outside this scope).

**Feature controller layer (`inbox-model.ts`, `home/model.ts`, `home/sessions/controller.tsx`, `projects.tsx` memos):**
- Purpose: Own lifecycle (Solid owner, timers, query subscriptions), derive view state.
- Location: `packages/app/src/shell/titlebar/inbox-model.ts`, `packages/app/src/home/model.ts`, `packages/app/src/home/sessions/controller.tsx`, `packages/app/src/workspaces/location.tsx`
- Contains: `create*` factory functions returning accessors and actions, `createMemo` derivations, `onCleanup` registrations.
- Depends on: runtime contexts, TanStack Query, pure modules.
- Used by: presentation components only.

**Runtime / transport layer (`runtime/server`):**
- Purpose: One controller per server: SDK connection, global data store, project list, sync, health, notifications.
- Location: `packages/app/src/runtime/server/`
- Contains: `runtime.tsx` (GlobalProvider + `createServerController`), `registry.tsx` (server list + per-server project usage), `sync.tsx` (bootstrap/client cache), `data.ts` (desktop data wrapper), `health.ts`/`health-machine.ts`, `client.tsx`, `request-queue*.ts`, `scope.ts`, `persistence.ts`.
- Depends on: `@opencode/client`, Effect Schema, TanStack Query.
- Used by: all feature controllers.

**Pure logic layer:**
- Purpose: Deterministic derivation with no I/O and no signals.
- Location: `packages/app/src/shell/titlebar/projects-groups.ts`, `packages/app/src/runtime/server/session-index.ts`, `packages/app/src/workspaces/paths.ts`, `packages/app/src/workspaces/path-key.ts`, `packages/app/src/home/sessions/index.ts`, `packages/app/src/shell/titlebar/sidebar-view.ts`, `packages/app/src/runtime/server/request-queue-machine.ts`
- Contains: grouping, sorting, path containment, merge, pagination/retention helpers.
- Depends on: `@opencode/util/path` only.
- Used by: controllers and tests; never imports Solid.

**Persistence layer:**
- Purpose: Durable client state keyed by namespaced keys.
- Location: `packages/app/src/runtime/persistence/` (schema/storage, outside this scope), `packages/app/src/settings/model.tsx`, `packages/app/src/shell/titlebar/projects-state.ts`, `packages/app/src/shell/titlebar/inbox.tsx` (inbox expand state), `packages/app/src/runtime/server/persistence.ts` (server state schema), `packages/app/src/runtime/server/registry.tsx` (store wiring).
- Contains: `Persistence.struct/array/record/fallback`, `persisted("key", schema, defaults)`.
- Depends on: Effect Schema.
- Used by: controllers read/write through accessors; components never touch storage.

## Data Flow

### Projects sidebar: where the rows come from

Trace for the fork's only own feature (project-grouped sessions sidebar):

1. **Mode dispatch.** `titlebar.tsx` renders the vertical sidebar and selects a mode. The fork's seam is the top-level `<Switch>` at `packages/app/src/shell/titlebar/titlebar.tsx:812-835`: `<Match when={settings.appearance.tabLayout() === "projects"}>` renders `<SidebarProjects />` (`titlebar.tsx:832`). The `fallback` remains upstream's nested `Switch` (projects/customize/recent organization).
2. **Inbox construction.** `SidebarProjects` creates an inbox instance: `const inbox = createSessionInbox()` (`projects.tsx:57`). `SidebarInbox` creates a *second* instance with `{ archived: true }` (`inbox.tsx:53`).
3. **Visible servers.** `connections()` keeps only `servers.visible` entries with a live controller (`inbox-model.ts:81-87`); a server that rejects credentials (no controller) or is hidden contributes nothing.
4. **Index fetch (server state).** `useQueries` fetches one page per connection: `sdk.api.session.list({ limit: 50, order: "desc", parentID: null })` then `parseHomeSessionIndex(response.data)` (`inbox-model.ts:126-140`), which drops subagents and archived sessions (`home/sessions/index.ts:37-39`). Cache key: `["inbox-sessions", conn]`; `staleTime: 30_000`, `refetchOnMount/Reconnect`.
5. **Merge with live metadata.** `mergeRootSessionIndex([...index], data.session.known())` (`inbox-model.ts:196-202`; implementation `runtime/server/session-index.ts:4-14`). Index rows are inserted first, live rows overwrite by `id`; a "passive" live row (idle marker not advanced) keeps the indexed `time.updated`; the result filters out `parentID` rows.
6. **Desktop projection.** `data.session.apply(sessions)` (`data.ts:78-88`, implementation `232-281`) applies pending local removals (`createSessionMutations`, `data.ts:342-378`) and then recency projection for pending sends, renames and floors (`project`, `data.ts:166-181`). `apply` is stateful: settling a send raises a floor and can `queueMicrotask(changed)`.
7. **Status and age.** For every session, `sessionRequests(ctx, id, true, settings.permissions.autoApproves(projectSettingsKey(scope, projectID)))` yields permission/form requests; status is `approval` > `input` > `working` (busy family) > `failed`/`done` (unread + outcome) > `ready` (`inbox-model.ts:172-193`). Entries are sorted by projected `time.updated` desc (`inbox-model.ts:222`).
8. **Project resolution.** Each entry resolves its project through `entry.ctx.projects.forSession(entry.session)` (`projects.tsx:77`). In the server controller, `forSession: (session) => projectForSession(session, list())` (`runtime/server/runtime.tsx:350`), where `list()` is `sync.data.project.map(withLocalMeta)` (`runtime.tsx:263-269`). `sync.data.project` is the server's project list, maintained by bootstrap and `project.updated` (`runtime/server/sync.tsx:122-146`).
9. **Checkout grouping.** `projectGroupFor(entry.server, project, entry.session.location.directory)` (`projects-groups.ts:27-37`) picks the closest `project.worktrees[].directory` containing the session directory (`sessionProjectDirectory`, `projects-groups.ts:9-20`) and returns a key `` `${server}\0${comparablePath(checkout)}` ``. With no project it returns `{ key: "ungrouped", directory }`.
10. **Worktree inventory (the `Project.worktrees` source).** Wire payloads carry no worktrees (`sync.tsx:130`). `createWorktreeInventory` (`workspaces/inventory.ts:30-64`) stores `worktree.list` results under `[scope, "worktree", projectID]` with `staleTime: Infinity`, and its `updated` callback merges them into the store via `withWorktreeInventory` (`inventory.ts:17-27`; wired at `sync.tsx:56-74`). Reads are demand-driven: showing a Location calls `ctx.sync.worktrees.list(projectID).then(() => ctx.sync.worktrees.refresh(projectID))` (`workspaces/location.tsx:87-93`), Home's machine effects issue the same demand (`home/model.ts:69-81`), and `worktree.updated` events re-list and refetch bootstrap (`sync.tsx:156-161`).
11. **Ordering and labels.** Groups sort by persisted manual rank, then project `time.created`, then display name (`projects.tsx:101-131`); `ungrouped` always last and not sortable (`projects.tsx:105-108`, `479-489`). Duplicate folder names are disambiguated with a parent folder, then the full normalized directory (`directoryGroupLabels`, `projects-groups.ts:43-69`).
12. **Removed projects.** `sidebar.removed()` keys whose group exists are hidden from the main list and their sessions fold into `ungrouped` (`projects.tsx:83-84`); `removedProjects()` still lists them for restore, using the stored key's directory tail when no session remains (`projects.tsx:155-189`).
13. **Render.** Keys are group-key strings, not group objects, so a rebuild does not remount rows or reset scroll (`projects.tsx:191-195`, `399-419`). Each group shows 5 sessions plus "Show more" (`SESSIONS_PER_PROJECT`, `projects.tsx:32`, `492-495`, `660-669`). Scroll is remembered/restored through `createProjectsSidebarState` (`projects.tsx:289-340`).

### Opening a session

1. Row click → `inbox.open(entry)` (`projects.tsx:411`, implementation `inbox-model.ts:394-404`).
2. Resolves the directory from `ctx.projects.forSession(session)?.worktree ?? session.location.directory`.
3. Warms the transcript (`data.session.message.sync`), then `startTransition(() => tabs.addSessionTab(...); data.session.remember(...); ctx.projects.touch(directory))` — the same path Home uses, so tabs and project recency stay consistent.
4. Tab persistence/route restoration is handled by `shell/titlebar/route-machine.ts`, `route-sync.ts`, `tab-load-machine.ts` (outside the data path above).

### Rename / remove / restore a project

- **Rename:** `RenameDialog` (`projects.tsx:206-224`) → `sdk.api.project.update({ projectID, name })` + `sync.project.update(updated)`; for `project.id === "global"` (repos without a root commit) it writes per-directory metadata through `sync.project.meta(project.worktree, { name })` instead.
- **Remove:** local only — `sidebar.remove(groupKey)` plus a toast with restore (`projects.tsx:242-255`). The server project is untouched.
- **Restore:** `sidebar.restore(key)` removes the key from `removed` (`projects-state.ts:32-37`).
- **Drag:** `DragDropProvider`/`useSortable` reorder visible keys, then append keys not on screen so projects that drop out of the index keep their slot (`projects.tsx:278-287`, `386-396`).

### State management

- Solid stores: `createStore` for local component state (`projects.tsx:62`), `createStore` inside controllers (`inbox-model.ts:74-79`), `createSignal` for machine state (`inbox-model.ts:240`).
- Server state: TanStack Query, keys always include the connection or `ServerScope` (`inbox-model.ts:128`, `home/sessions/queries.ts:12`, `workspaces/inventory.ts:8`).
- Durable client state: `persisted()` (`settings.v3`, `projects-sidebar.v1`, `sidebar.inbox`, server state) decoded by Effect Schema.
- Derived view state: `createMemo` only; no cached copies of server lists in components.

**Failure modes along this path (where it can go wrong):**

1. **Worktree inventory lag re-keys groups.** `projectGroupFor` depends on `project.worktrees` (`projects-groups.ts:13`). Before inventory loads, a session in a checkout subdirectory falls back to its own `directory`, producing a different group key; when inventory lands, the key changes. Consequences: collapsed state (component-local `state.collapsed`, `projects.tsx:62`, `405`) is lost, drag order entries reference a stale key, and a `removed` key may no longer match. Groups can visibly jump from several directory groups into one checkout group.
2. **Projects not yet loaded look ungrouped.** `projects.forSession` returns `undefined` while `sync.data.project` is empty, so cold-start rows land in `ungrouped` and move later. The `removed` set only matches project keys, so a temporary `ungrouped` fallback is not removable.
3. **Index is a 50-row page.** Each server contributes at most 50 newest root sessions (`INDEX_LIMIT`, `inbox-model.ts:41`). Per-project counts and "Show N more" therefore describe only loaded rows; a project whose sessions are older than the newest 50 roots shows an incomplete history with no paging (design doc open question 4 remains unresolved: `docs/designs/project-grouped-sessions-sidebar.md:145`).
4. **Archived sessions are invisible in Projects mode.** `parseHomeSessionIndex` drops `time.archived` rows (`home/sessions/index.ts:38`), and `SidebarProjects` constructs `createSessionInbox()` without `archived: true` (`projects.tsx:57`), so archive/unarchive actions are not reachable from this sidebar.
5. **Cross-server collisions.** `ungrouped` is a single key shared by every server, and rows show no server label. Two servers pointing at the same checkout path also produce identical group labels because `directoryGroupLabels` only disambiguates by title and directory (`projects-groups.ts:43-69`).
6. **`global` project ID.** Repositories without a root commit share `project.id === "global"`; `withLocalMeta` patches name/icon per directory from a child store (`runtime.tsx:261-267`). Grouping stays per checkout, but anything keyed by project ID (per-project settings, `projectSettingsKey`) cannot tell them apart.
7. **Projected recency is not server truth.** `time.updated` may be raised by a local send or suppressed after a rename (`data.ts:166-181`), so sidebar ordering and ages can disagree with the server and with other windows. `syntheticTimes` makes `remember()` store the raw value (`data.ts:22-23`, `102-106`); writing a projected time back as truth is a bug.
8. **Stateful memo.** `entries()` calls `data.session.apply()` inside a memo (`inbox-model.ts:204-205`); `apply` mutates recency and may schedule `changed()`, so recomputation order and repeated reads matter. Adding more side effects there risks loops.
9. **Removed key drift.** Removed keys are raw `` server\0path `` strings (`projects-state.ts:8-11`); renaming or moving a checkout orphans them, and `removedProjects` recovers a label from the key's directory tail (`projects.tsx:182-186`). Nothing prunes the list.
10. **No cold-start auto-open in scoped code.** Nothing under the scoped paths opens the most recently updated session on cold start; opening is user-driven (`inbox.open`) or restored by tab/route restoration. This does not satisfy the design's success criterion 6 (`docs/designs/project-grouped-sessions-sidebar.md:155`) without additional wiring.

## Key Abstractions

**`ServerCtx` — per-server controller:**
- Purpose: Single owner of one server's SDK, data store, projects, sync, notifications.
- Examples: created in `createServerController` (`runtime/server/runtime.tsx:195-368`), consumed via `useGlobal().serverCtx(key)`.
- Pattern: `selectServerCtx(controllers(), key)`; controllers are created/disposed only by the controllers machine (`runtime.tsx:62-90`). A replaced controller is disposed before its successor starts.

**`ServerScope` / `ScopedKey`:**
- Purpose: Namespace caches, settings and persisted keys per server.
- Examples: `ServerScope.fromServerKey` (`runtime/server/scope.ts:25`), `ScopedKey.from(scope, projectID)` via `projectSettingsKey` (`settings/model.tsx:36`).
- Pattern: null-byte-separated composed keys; fragments reject `\0`.

**`Project` with injected `worktrees`:**
- Purpose: Server project metadata plus a client-side inventory of checkouts.
- Examples: type at `runtime/server/types.ts:3-6`; injection at `workspaces/inventory.ts:17-27`.
- Pattern: never trust `worktrees` to be populated; it is filled lazily by demand (`workspaces/location.tsx:87`) and `worktree.updated` events (`runtime/server/sync.tsx:156`).

**`InboxEntry` / `InboxStatus`:**
- Purpose: One root session with the state a person acts on.
- Examples: `inbox-model.ts:46-56`; status derivation `172-182`.
- Pattern: entries are keyed `` `${server}\0${sessionID}` `` (`inbox-model.ts:212`) and rows are keyed by that string.

**Project group key:**
- Purpose: Stable identity for a project row across rebuilds and restarts.
- Examples: `projectGroupFor` (`projects-groups.ts:27-37`), consumed by `projects.tsx:81-84`, persisted in `order`/`removed`.
- Pattern: depends only on server + comparable checkout path, never on label or position.

**`persisted()` stores:**
- Purpose: Durable client state with schema repair.
- Examples: `projects-sidebar.v1` (`projects-state.ts:19`), `settings.v3` (`settings/model.tsx:349`), server state with `previousKey: "server.v3"` (`registry.tsx:234-242`).
- Pattern: schema declared with `Persistence.*`; accessors close over `store`/`setStore`; no component writes storage directly.

## Entry Points

**Titlebar / sidebar dispatch:**
- Location: `packages/app/src/shell/titlebar/titlebar.tsx:812-835`
- Triggers: layout renders the titlebar; `settings.appearance.tabLayout()` is `inbox` or `projects`, or the fallback nested switch selects upstream organization modes.
- Responsibilities: mounts `SidebarProjects`/`SidebarInbox`, owns tab strip and window chrome.

**Global provider:**
- Location: `packages/app/src/runtime/server/runtime.tsx:50`
- Triggers: app root (outside this scope) mounts `GlobalProvider`.
- Responsibilities: server controllers, health probes, notifications, models.

**Server provider:**
- Location: `packages/app/src/runtime/server/current.tsx:32`
- Triggers: a screen that needs one server mounts `ServerProvider` with a connection.
- Responsibilities: expose `Server`/`Data` contexts; unmount children while credentials are rejected.

**Location provider:**
- Location: `packages/app/src/workspaces/location.tsx:108`
- Triggers: session/file/settings screens that need a directory.
- Responsibilities: resolve and sync a Location, expose git branch, demand worktree inventory.

**Home route:**
- Location: `packages/app/src/home/route.tsx:13`
- Triggers: router renders Home.
- Responsibilities: compose home controller, projects panel, sessions panel, search, scroll.

**Settings screen:**
- Location: `packages/app/src/settings/shell.tsx:75`
- Triggers: router renders settings; navigation groups at `settings/shell.tsx:39-73`.
- Responsibilities: per-server page switching, plugin settings pages, search surface.

**Package entry:**
- Location: `packages/app/src/index.ts` and `packages/app/src/desktop.ts` (declared as package exports in `packages/app/package.json`).
- Responsibilities: renderer bootstrap for web and desktop builds.

## Architectural Constraints

- **Threading:** Single-threaded Solid/browser event loop. All async work is promises/timers on the main thread; no workers in this scope.
- **Global state:** Module-level `WeakMap` `syntheticTimes` (`runtime/server/data.ts:23`) keyed by `SessionInfo["time"]` objects; contexts (`Global`, `Servers`, `Settings`) are the intended singletons. `createSessionInbox` is instantiated per mounted sidebar mode (`projects.tsx:57`, `inbox.tsx:53`); the two never mount together, and both instances share the `["inbox-sessions", conn]` query cache, so switching modes reuses the fetched index while each instance owns its own clock, timers and event subscriptions.
- **Controller lifecycle:** Per-server controllers are created under `createRoot` and disposed before replacement (`runtime/server/runtime.tsx:62-90`); worktree inventory is created per server sync context (`runtime/server/sync.tsx:56`).
- **Cache identity:** Query keys must include the connection or `ServerScope`; the Home cache and the inbox cache are intentionally separate (`["home-sessions", conn]` vs `["inbox-sessions", conn]`) so interface modes cannot reuse a partial index (`inbox-model.ts:123-125`).
- **Path identity:** Compare paths only through `comparablePath`/`pathKey` (`workspaces/path-key.ts`, `workspaces/paths.ts`); never `===` on raw paths.
- **Server payload gaps:** `project.list` and `project.updated` carry no worktrees (`runtime/server/sync.tsx:130`); `session.list` pages are bounded; git branch is not on the session and is loaded per location (`inbox-model.ts:309-373`).
- **Persistence compatibility:** `tabLayout` is a persisted literal union (`settings/model.tsx:153`). A build that does not know a value can fail normalization of the whole `settings.v3` key (documented fork risk: `docs/designs/project-grouped-sessions-sidebar.md:130`). Add modes by appending to the union and verify the fallback path, per `packages/app/AGENTS.md` theme/i18n rules.
- **Localization:** Visible copy must go through `language.t`/`language.plural`; `projects.tsx` uses `sidebar.projects.*` keys defined in `runtime/i18n/en.ts:819-836`, `977`.
- **Hot path:** The sidebar recomputes on every session event and every second while a session works (`inbox-model.ts:227-233`). Avoid allocations and layout reads in `groups()`/`entries()`; see `packages/app/AGENTS.md` (strobe benchmarks before touching session/timeline code).

## Anti-Patterns

### Deriving group identity from a label or an order

**What happens:** A naive implementation keys project groups by display name or index.
**Why it's wrong:** Names are user-editable (`renameProject`, `projects.tsx:199-225`) and order is user-dragged; a key that changes invalidates persisted `order`/`removed` and collapse state.
**Do this instead:** Keep `projectGroupFor` as the only key source (`projects-groups.ts:27-37`): server + comparable checkout path, with labels derived afterward (`directoryGroupLabels`).

### Keying `<For>` by freshly built group objects

**What happens:** `groups()` rebuilds every group object on each inbox update.
**Why it's wrong:** A list keyed by object identity destroys and recreates rows, killing an in-flight drag and resetting the scroll container.
**Do this instead:** Render `groupKeys()` and look groups up through `groupByKey()` (`projects.tsx:191-195`, `399-419`).

### Keeping a second session list beside the inbox

**What happens:** A new sidebar copies sessions into a local store or a new query key.
**Why it's wrong:** Two caches diverge on rename/delete/archive and duplicate the 50-row page fetch; ordering and unread state stop matching Home.
**Do this instead:** Use `createSessionInbox` (`inbox-model.ts:63`) and its `entries`/`byKey`; extend the model rather than copy it. If a per-project page is genuinely needed, add it to the model with a scoped cache key.

### Mutating or persisting projected `time.updated`

**What happens:** Code writes `session.time.updated` back into a store or compares it to server values.
**Why it's wrong:** Projections include local sends, rename suppression and floors (`data.ts:166-181`); the raw server value lives in `syntheticTimes`. Persisting the projection makes ordering sticky and can promote a renamed session.
**Do this instead:** Treat `SessionInfo` as read-only from the sidebar; call `data.session.remember()` (which strips projections, `data.ts:102-106`) only when loading a row into the store.

### Adding a persisted union value without checking decode behavior

**What happens:** A new `tabLayout`/`sidebarOrganize` value is stored, then read by another build.
**Why it's wrong:** Unknown literal values can drop the whole settings key instead of falling back (`docs/designs/project-grouped-sessions-sidebar.md:130`).
**Do this instead:** Add the value with a fallback accessor (`withFallback`, `settings/model.tsx:336-338`), extend both `settings/model.tsx:153` and the option arrays (`settings/model.tsx:351-353`), and test a round trip like `settings/model.test.ts:132`.

### Assuming `Project.worktrees` is present

**What happens:** Grouping or reveal logic reads `project.worktrees` without considering load state.
**Why it's wrong:** The field starts empty and arrives asynchronously (`workspaces/inventory.ts:17`), so the sidebar would show wrong groups or throw on `undefined` worktrees.
**Do this instead:** Treat missing inventory as "not loaded": render a directory-level group that can converge later, or gate grouping on `ctx.sync.worktrees.cached(projectID)`; never assume a stable key before inventory arrives.

### Revalidating values already guaranteed upstream

**What happens:** Adding extra `typeof`/`Array.isArray` checks on `SessionInfo`, `Project`, or route payloads inside the sidebar.
**Why it's wrong:** Validation belongs at the SDK/schema boundary (`packages/app/AGENTS.md`); duplicate checks hide type errors and bloat the hot path.
**Do this instead:** Validate once in `@opencode/client`/Effect schemas, then pass typed values; decode only untrusted local storage.

## Error Handling

**Strategy:** Failures become explicit states or toasts; bounded timers prevent stuck UIs.

**Patterns:**
- **Machines with bounded attempts/timeouts:** Location sync retries twice and times out at 30 s (`workspaces/location-machine.ts:3-7`, `56-92`); inbox settle has a reveal timer (`inbox-model.ts:252-280`); branch loading has per-location attempt timers (`inbox-model.ts:324-373`).
- **Toasts for user actions:** `showToast` + `formatServerError`/`errorMessage` (`runtime/server/runtime.tsx:220-226`, `projects.tsx:248-254`, `inbox-model.ts:406-410`).
- **Deliberate silence for cache reads:** Inventory reads swallow errors (`.catch(() => undefined)`, `workspaces/inventory.ts:57-62`) because staleness is recoverable and a failed list still triggers discovery via `refresh`.
- **Late results:** Machines carry an attempt id and ignore results whose id is not current (`workspaces/location-machine.ts:63`, `inbox-branch-machine.ts` effects).
- **Missing resources:** Typed not-found clears cached rows (`forget`, `inbox-model.ts:90-97`, `397`) instead of showing a dead row; session removal is optimistic with `session.notFound` tolerated (`data.ts:360-371`).

## Cross-Cutting Concerns

**Logging:** No logger in this scope. Failures surface as toasts or machine states; async callbacks use `void` + `.catch` so nothing rejects unhandled (`projects.tsx:206`, `inbox-model.ts:360-372`).

**Validation:** SDK responses are typed by `@opencode/client`; persisted values are decoded by Effect Schema (`Persistence.*`); paths are normalized by `comparablePath`/`pathKey`. Unknown search params and settings routes are normalized in `settings/route.ts`.

**Authentication:** Per-server credentials belong to `ServerConnection` (`runtime/server/registry.tsx:151-228`); a rejected credential removes the controller, so consumers see no data and `ServerProvider` can render a signed-out surface (`runtime/server/current.tsx:30-48`). The sidebar silently skips such servers (`inbox-model.ts:81-87`).

**Localization:** `language.t` / `language.plural` only; plural keys live beside their base key (`runtime/i18n/en.ts:819-836`).

**Theming and typography:** v2 semantic tokens (`text-v2-text-text-muted`, `bg-v2-background-bg-layer-02`), 13 px/16 px compact rows, explicit control heights (`projects.tsx:535-590`). Deep-dive rules live in `packages/app/AGENTS.md`.

**Scrolling:** Plain scroll containers with `data-scrollable` and `min-h-0` (`projects.tsx:360-367`); scroll position persistence is feature-owned (`projects-state.ts`), restored from `onMount`/resize rather than the ref (`projects.tsx:313-334`).

---

*Architecture analysis: 2026-11-12*
