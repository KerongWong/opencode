---
last_mapped_commit: acdb57123fbf279c585996a507b90f3e79d3e72e
last_mapped_at: 2026-11-12
---
# Codebase Structure

**Analysis Date:** 2026-11-12

Scope: `packages/app/src/shell/titlebar`, `packages/app/src/runtime/server`, `packages/app/src/workspaces`, `packages/app/src/home`, `packages/app/src/settings`, `docs/designs`. Root manifests (`packages/app/package.json` and workspace `package.json`) are cited as supporting evidence.

## Directory Layout

```text
opencode/
├── packages/app/src/
│   ├── shell/titlebar/     # Window chrome, tab strip, sidebar modes (projects, inbox, vertical)
│   ├── runtime/server/     # Per-server context: SDK, data, sync, health, registry, persistence schema
│   ├── workspaces/         # Location context, worktree inventory, file tree, directory selection
│   ├── home/               # Home route: projects panel + session list + session search
│   ├── settings/           # Settings surface: pages, navigation, search, settings.v3 model
│   └── …                   # (other app areas: composer, session, shell/shell, new-session, servers, …)
├── docs/designs/           # Design records and wireframes for this fork
└── .planning/codebase/     # These analysis documents
```

## Directory Purposes

**`packages/app/src/shell/titlebar`:**
- Purpose: The desktop titlebar and every sidebar interface mode. The shell layout mounts this component; it owns window chrome, the tab strip, and the vertical sidebar slot.
- Contains: TSX components, per-feature CSS, pure grouping/view modules, lifecycle state machines, colocated unit tests, stories.
- Key files: `titlebar.tsx` (mode dispatch at `812-835`), `projects.tsx` (fork's Projects sidebar), `projects-groups.ts` (pure grouping), `projects-state.ts` (persisted sidebar state), `inbox-model.ts` (`createSessionInbox`), `inbox.tsx` (Inbox sidebar), `sidebar-view.ts` (pure grouping/filtering used by the upstream customized sidebar and its view menu), `sidebar-organized.tsx`, `sidebar-customized.tsx`, `recent-sessions.tsx`, `tab-strip.tsx`, `tab-nav.tsx`, `route-machine.ts`, `tab-load-machine.ts`, `project-session-row.tsx`.

**`packages/app/src/runtime/server`:**
- Purpose: One controller per configured server. Creates the SDK connection, global data store, desktop data wrapper, sync/query layer, health machine, notifications, and server state persistence.
- Contains: Context providers (`runtime.tsx`, `current.tsx`, `registry.tsx`), transport helpers (`client.tsx`, `api.ts`, `media.ts`, `image.ts`), sync/bootstrap (`sync.tsx`, `global-sync/`, `server-sync/`), data/projection (`data.ts`), machines (`machine.ts`, `health-machine.ts`, `plugin-machine.ts`, `request-queue-machine.ts`), keys and schemas (`scope.ts`, `persistence.ts`, `types.ts`), caching (`scoped-cache.ts`, `refcount.ts`).
- Key files: `runtime.tsx:195-368` (`createServerController`: `data`, `sdk`, `sync`, `projects` API including `forSession`), `registry.tsx` (`ServersProvider`, `ServerConnection`, `createServerProjects`), `sync.tsx` (project list + worktree inventory wiring), `data.ts` (`createSessionRecency`, `createSessionMutations`, `createSessionRefresh`), `session-index.ts` (pure merge).

**`packages/app/src/workspaces`:**
- Purpose: Directory-scoped concerns: resolving a Location, syncing it, loading the worktree inventory, and browsing files / choosing directories.
- Contains: `location.tsx` + `location-machine.ts` (Location context and sync machine), `inventory.ts` (worktree inventory query), `paths.ts` (pure workspace/path predicates), `path-key.ts`, `create.ts` (worktree creation), plus subdirectories `files/` and `selection/`.
- Key files: `inventory.ts:30-64` (`createWorktreeInventory`), `inventory.ts:17-27` (`withWorktreeInventory`), `paths.ts:94-98` (`isProjectDirectory`), `location.tsx:87-93` (inventory demand).

**`packages/app/src/workspaces/files`:**
- Purpose: File tree and file content state for the file panel.
- Contains: `model.tsx` (context), `tree-machine.ts`, `tree-store.ts`, `content-machine.ts`, `content-cache.ts`, `view-cache.ts`, `artifact.ts`, `path.ts`, `watcher.ts`, `types.ts`, tests.
- Key files: `model.tsx` (provider/useFile), `tree-machine.ts` (tree lifecycle), `watcher.ts` (external change invalidation).

**`packages/app/src/workspaces/selection`:**
- Purpose: Directory/workspace chooser used by new-session and settings flows.
- Contains: `picker.tsx` (native vs in-app picker), `dialog.tsx`, `combobox-machine.ts`, `tree-machine.ts`, `queue-machine.ts`, `domain.ts`, `policy.ts`, CSS/stories/tests.
- Key files: `picker.tsx:23-40` (`useDirectoryPicker`), `policy.ts` (which picker a platform/server can use).

**`packages/app/src/home`:**
- Purpose: The Home screen: project picker, session list grouped by day, search, scroll behavior, and project import/add/reveal actions.
- Contains: `route.tsx` (composition), `model.ts` (selection controller), `machine.ts` (selection state machine), `scroll.ts` (viewport + sticky headers), subdirectories `projects/`, `sessions/`, `start/`, colocated tests.
- Key files: `home/route.tsx:13-63`, `home/model.ts:20-160`, `home/machine.ts` (selection phases `hydrating`/`verifying`/`ready`/`disposed`), `home/sessions/index.ts` (index page + retain), `home/sessions/queries.ts`, `home/sessions/controller.tsx`, `home/sessions/load-machine.ts`.

**`packages/app/src/home/projects`:**
- Purpose: Home's project column/dropdown: list, add/import, reveal in file manager, menus.
- Contains: `controller.tsx`, `region.tsx`, `view.tsx`, `menu.tsx`, `actions.tsx`, `add.ts`, `import-machine.ts`, `reveal.ts`, `file-manager.ts`, `view.css`.

**`packages/app/src/home/sessions`:**
- Purpose: Home's session list: fetch/load machine, grouping by date, row actions (open, rename, export, read state, delete, archive), search.
- Contains: `controller.tsx`, `region.tsx`, `view.tsx`, `records.ts`, `queries.ts`, `index.ts`, `load-machine.ts`, `row-machine.ts`, `search.ts`, `search-machine.ts`, `archive.ts`, `open.ts`, `alt-hold.ts`, `delete-dialog.stories.tsx`, tests.

**`packages/app/src/home/start`:**
- Purpose: Home command palette entry (`command-palette.tsx`).

**`packages/app/src/settings`:**
- Purpose: The settings surface: root/nested pages, per-server scoping, search, and the persisted settings model.
- Contains: `shell.tsx` (screen + tab groups), `navigation.tsx` (nav shell), `route.ts` (view parsing/redirect), `surface.tsx` (history + search surface), `model.tsx` (`settings.v3` schema/accessors), `pages.ts` (icons/labels), `search*.ts(x)` (catalog/index/machine/results/reveal), `row.tsx`, `scroller.ts`, `settings.css`, plus page folders `general/`, `appearance/`, `notifications/`, `keybinds/`, `models/`, `providers/`, `servers/`, `workspaces/`, `experimental/`, `about/`.
- Key files: `model.tsx:139-160` (literals including `tabLayout`), `model.tsx:345-500` (provider/accessors), `general/interface-mode.tsx` (`modes` array at `7-12`), `shell.tsx:39-73` (tab groups), `route.ts` (settings route normalization).

**`packages/app/src/settings/workspaces`:**
- Purpose: Project and worktree settings pages (rename, icon, extensions, LSP, delete inspection, workspace listing).
- Contains: `projects.tsx`, `project.tsx`, `project-row.tsx`, `project-options.tsx`, `project-model.ts`, `project-machine.ts`, `project-lsp.ts`, `project-folder-missing.tsx`, `project-extensions.tsx`, `delete-machine.ts`, `workspaces.tsx`, `queries.ts`, tests.

**`packages/app/src/settings/general`:**
- Purpose: General preferences including interface mode, behavior, sound preview, controllers.
- Contains: `general.tsx`, `interface-mode.tsx`, `interface-mode.css`, `behavior.ts`, `controllers.ts`, `machine.ts`, `sound-preview-machine.ts`, tests.

**`packages/app/src/settings/servers`:**
- Purpose: Server inventory and connection settings (add/remove/hide, switcher, unavailable state).
- Contains: `servers.tsx`, `switcher.tsx`, `inventory.ts`, `machine.ts`, `unavailable.tsx`, tests.

**`docs/designs`:**
- Purpose: Design records for this personal fork. The project-grouped sidebar design and its wireframe live here.
- Contains: `project-grouped-sessions-sidebar.md` (problem, constraints, seam list, known trade-offs), `projects-sidebar-wireframe.png` (committed binary), `build-desktop.md` (local Windows packaging notes).

## Key File Locations

**Entry Points:**
- `packages/app/src/shell/titlebar/titlebar.tsx`: Titlebar; selects sidebar mode (`projects`, `inbox`, or upstream organization modes).
- `packages/app/src/shell/titlebar/projects.tsx`: `SidebarProjects` component (Projects interface mode).
- `packages/app/src/shell/titlebar/inbox.tsx`: `SidebarInbox` component (Inbox interface mode).
- `packages/app/src/home/route.tsx`: `Home` route component.
- `packages/app/src/settings/shell.tsx`: `SettingsScreen`.
- `packages/app/src/runtime/server/runtime.tsx`: `GlobalProvider` / `useGlobal`.
- `packages/app/src/runtime/server/current.tsx`: `ServerProvider` / `useServer` / `useData`.
- `packages/app/src/workspaces/location.tsx`: `LocationProvider` / `useWorkspaceLocation`.
- `packages/app/package.json`: package exports (`./src/index.ts`, `./src/desktop.ts`).

**Configuration:**
- `packages/app/src/settings/model.tsx`: `settings.v3` schema, defaults, accessors, CSS variable writes.
- `packages/app/src/runtime/server/persistence.ts`: server state, model state, VCS state, project metadata schemas.
- `packages/app/src/runtime/server/registry.tsx:234-242`: persisted server store (`Persist.global("server")`, `previousKey: "server.v3"`).
- `packages/app/src/shell/titlebar/projects-state.ts:19`: `projects-sidebar.v1` store.
- `packages/app/package.json` / `packages/app/vite.config.*`: Vite, Solid, Tailwind v4 build (versions in `packages/app/package.json`; catalog entries resolve at the workspace root).

**Core Logic:**
- `packages/app/src/shell/titlebar/projects-groups.ts`: checkout ownership, group keys, label disambiguation (pure).
- `packages/app/src/shell/titlebar/inbox-model.ts`: session inbox fetch/merge/status/actions.
- `packages/app/src/runtime/server/session-index.ts`: index/live merge rule.
- `packages/app/src/runtime/server/data.ts`: removals and recency projection.
- `packages/app/src/runtime/server/sync.tsx`: project list, worktree inventory wiring, connection sync.
- `packages/app/src/workspaces/inventory.ts`: worktree inventory cache.
- `packages/app/src/workspaces/paths.ts`: workspace/project directory predicates (pure).
- `packages/app/src/home/sessions/index.ts`: Home index page, parse, merge, retain.
- `packages/app/src/shell/titlebar/sidebar-view.ts`: pure grouping/filter/order for organized sidebars.

**Testing:**
- Colocated unit tests beside source: `projects-groups.test.ts`, `sidebar-sessions.test.ts`, `data.test.ts`, `inventory.test.ts`, `location-machine.test.ts`, `paths.test.ts`, `home/machine.test.ts`, `home/sessions/index.test.ts`, `settings/model.test.ts`, `settings/route.test.ts`, `settings/search-machine.test.ts`.
- Story fixtures: `inbox-card.stories.tsx`, `inbox-list.stories.tsx`, `settings/shell.standalone.stories.tsx`, `settings/timeline-detail.stories.tsx`, `workspaces/selection/dialog.standalone.stories.tsx`.
- Package test commands (run from `packages/app`, never repo root): `bun run test:unit`, `bun run test:browser`, `bun run test:e2e`, `bun run test:components` (`packages/app/package.json`). Read the matching skill in `.opencode/skills` before writing tests (`unit-tests`, `component-tests`, `app-e2e-tests`).

## Naming Conventions

**Files:**
- kebab-case always: `session-index.ts`, `projects-state.ts`, `interface-mode.tsx`, `sidebar-organized.tsx`.
- `.tsx` only when the module contains JSX; logic-only modules are `.ts` (`projects-groups.ts`, `session-index.ts`, `scope.ts`).
- Lifecycle machines: `<feature>-machine.ts` with a matching `.test.ts` (`inbox-settle-machine.ts`, `health-machine.ts`, `location-machine.ts`, `home/machine.ts` for a folder-local machine).
- Tests: `<name>.test.ts` colocated with the source; stories: `<name>.stories.tsx` or `<name>.standalone.stories.tsx`.
- Feature styles: `<feature>.css` beside the component (`titlebar.css`, `tab-nav.css`, `tab-popover.css`, `search.css`, `settings.css`, `recently-closed-tabs-menu.css`); settings pages may import one shared `settings.css`.
- Files are named for the feature, not the exported symbol: `projects.tsx` exports `SidebarProjects`, `inbox.tsx` exports `SidebarInbox`, `project-session-row.tsx` exports `ProjectSessionRow` and `RenameDialog`.

**Functions:**
- Factory functions prefixed `create*` and returning accessors/actions: `createSessionInbox`, `createProjectsSidebarState`, `createWorktreeInventory`, `createSessionRecency`, `createHomeController`, `createLocationSyncState`.
- Pure transitions named `transition<Feature>` returning `{ state, effects }`: `transitionLocationSync`, `transitionInboxSettle`, `transitionInboxBranch`, `transitionHomeSelection`.
- Selectors prefixed `select*`: `selectInboxLoading`, `selectHomeSelection`, `selectServerCtx`, `selectServerSignedOut`, `selectSessionRenameDialogView`.
- Predicates named as questions: `isProjectDirectory`, `isWorkspaceSelection`, `canUseServer`, `isServerFailed`, `inboxBusy`, `inboxArchived`.
- Context hooks: `useGlobal`, `useServers`, `useServer`, `useData`, `useSettings`, `useWorkspaceLocation`, `useFile`, `useServerCtx`, `useDialog`, `useLanguage`, `useTabs`, `useLayout`, `usePlatform`.

**Variables:**
- camelCase; constants UPPER_SNAKE in module scope (`INDEX_LIMIT`, `ARCHIVED_LIMIT`, `SESSIONS_PER_PROJECT`, `DRAG_CLICK_GRACE`, `LOCATION_SYNC_TIMEOUT`).
- Composite keys use the null byte `\u0000` and are built through helpers (`ScopedKey.from`, `projectGroupFor`, `` `${server}\0${session.id}` ``).
- Paths stored/compared through `pathKey`/`comparablePath`, typed as branded strings (`PathKey`, `ServerScope`, `ServerConnection.Key`).

**Types:**
- PascalCase; discriminated unions tag with `type` for events and `status`/`phase` for states (`InboxBranchState`, `LocationSyncState`, `HomeSelectionState`, `SessionTabLoad`).
- Effect schemas exported as PascalCase values (`ServerState`, `ModelState`, `ProjectState`, `Persistence.struct`), types derived with `typeof Schema.Type`.
- Context return types derived, not hand-written: `type ServerCtx = ReturnType<typeof createServerController>`, `ServerSync = ReturnType<typeof createServerSyncContext>`, `SessionInbox = ReturnType<typeof createSessionInbox>`.

**Directories:**
- lowercase kebab or single word (`titlebar`, `runtime/server`, `global-sync`, `server-sync`, `new-session`, `workspaces`).
- A feature folder holds its sub-features as folders only when they have their own controller/machine set (`home/sessions`, `home/projects`, `workspaces/files`, `workspaces/selection`, `settings/workspaces`).

## Where to Add New Code

**New sidebar / interface mode:**
- Component: `packages/app/src/shell/titlebar/<mode>.tsx` (follow `projects.tsx` shape: create a feature model, derive groups with pure helpers, render keyed rows).
- Pure derivation: `packages/app/src/shell/titlebar/<mode>-groups.ts` (or extend `sidebar-view.ts` for upstream organization modes) + colocated `.test.ts`.
- Persisted client state: `packages/app/src/shell/titlebar/<mode>-state.ts` using `persisted("<mode>.v1", Persistence.struct({...}), defaults)`.
- Seams to update: `settings/model.tsx` `tabLayout` literal (`:153`) and option arrays (`:351-353`), `settings/general/interface-mode.tsx` `modes` (`:7-12`) plus preview, `shell/titlebar/titlebar.tsx` `<Match>` (`:812-835`), `runtime/i18n/en.ts` keys, and `shell/shell.tsx` divider/inset condition (`:219`). Verify a settings round trip.

**New project grouping or sorting rule:**
- Implementation: `packages/app/src/shell/titlebar/projects-groups.ts` (pure, imports only `@opencode/util/path`), or a sibling pure module if the rule is unrelated to project identity.
- Tests: `projects-groups.test.ts`; cover duplicate folder names, nested checkouts, missing `worktrees`, and Windows-vs-POSIX path separators via `comparablePath`.

**New server-scoped data or cache:**
- Implementation: `packages/app/src/runtime/server/<feature>.ts` (or `.tsx` if it is a context) with keys built from `ServerScope`/`ServerConnection.Key`.
- Wiring: create it in `createServerController` (`runtime/server/runtime.tsx:195-368`) and expose it on the returned `ServerCtx`; register event handling on `input.data.on(...)` or `serverSDK.event.listen(...)` with `onCleanup`.
- Caching: a TanStack Query factory in the same module (pattern: `workspaces/inventory.ts:30-64`); always include the scope/connection in the query key.

**New worktree/workspace inspection:**
- Pure helpers: `packages/app/src/workspaces/paths.ts` (+ `paths.test.ts`).
- Inventory reads: `packages/app/src/workspaces/inventory.ts` (`createWorktreeInventory`, `withWorktreeInventory`); remember `staleTime: Infinity` and event-driven invalidation (`worktree.updated`).

**New Home panel or list behavior:**
- Controller: `packages/app/src/home/<area>/controller.tsx`, machine in `<area>/load-machine.ts` (or `row-machine.ts`), pure data shaping in `<area>/records.ts`/`index.ts`.
- Composition: `packages/app/src/home/route.tsx`; scroll behavior in `packages/app/src/home/scroll.ts`.
- Cache: `packages/app/src/home/sessions/queries.ts` with the `["home-sessions", conn]` key.

**New settings page:**
- Page: `packages/app/src/settings/<area>/<area>.tsx` (one folder per area, CSS imported from `settings.css` or a local file).
- Registration: tab list + `<Tabs.Content>` in `packages/app/src/settings/shell.tsx` (`:39-73`, `:321` region), icon/label in `packages/app/src/settings/pages.ts`, route type/normalization in `packages/app/src/settings/route.ts`, search entries in `packages/app/src/settings/search-catalog.ts`.
- Per-server pages: gate on `serverPagesConnection` (`settings/servers/machine.ts`) and wrap with `SettingsServerDataScope` (`settings/server-scope.tsx`).

**New persisted setting:**
- Schema + accessor: `packages/app/src/settings/model.tsx` (add to `settingsSchema`, defaults at `:318`, accessor with `withFallback`), colocated `model.test.ts`.
- Never read storage directly from a component; go through `useSettings()`.

**New state machine:**
- File: `<feature>-machine.ts` beside the feature, exporting `INITIAL_*_STATE`, the state/event/effect unions, `transition()` and `select*` helpers. Driver stays in the feature controller (pattern: `workspaces/location.tsx` + `location-machine.ts`).

**New pure helper:**
- Put it beside its consumer; promote to `packages/app/src/workspaces/paths.ts` only when several areas need it. No Solid imports, no I/O.

## Special Directories

**`docs/designs`:**
- Purpose: Fork design records and wireframes.
- Generated: No (hand-written; PNG is a captured artifact).
- Committed: Yes — including `projects-sidebar-wireframe.png`.

**`packages/app/src/runtime/server/global-sync` and `server-sync`:**
- Purpose: Bootstrap/config/project query loaders and connection-state synchronization for a server.
- Generated: No.
- Committed: Yes.

**`packages/app/src/settings/workspaces` vs `packages/app/src/workspaces`:**
- `settings/workspaces` is the settings UI for projects/worktrees; `workspaces` is runtime state (Location, inventory, files, pickers). Do not put settings pages in `workspaces/`, and do not put SDK/query code in `settings/workspaces/`.

**`.planning/codebase`:**
- Purpose: Codebase analysis documents consumed by planning/execution commands.
- Generated: Yes (by mapping commands).
- Committed: Yes, when the project commits planning artifacts.

---

*Structure analysis: 2026-11-12*
