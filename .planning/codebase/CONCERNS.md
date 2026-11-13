---
last_mapped_commit: acdb57123fbf279c585996a507b90f3e79d3e72e
last_mapped_at: 2026-11-12
---
# Codebase Concerns

**Analysis Date:** 2026-11-12

Scope: `packages/app/src/shell/titlebar`, `packages/app/src/runtime/server`, `packages/app/src/workspaces`, `packages/app/src/home`, `packages/app/src/settings`, `docs/designs` on branch `projects-sidebar` (HEAD `acdb57123f`).

## Tech Debt

**Projects sidebar reuses the Inbox index without the Inbox's filters:**
- Issue: `mergeRootSessionIndex` merges the client's in-memory sessions on top of the fetched index, filtering only child sessions. It has no archived filter and no recency cap (`packages/app/src/runtime/server/session-index.ts:4-13`). Home wraps it with an archived filter (`packages/app/src/home/sessions/index.ts:41-43`), and the Inbox splits with `inboxArchived` (`packages/app/src/shell/titlebar/inbox.tsx:110`), but `SidebarProjects` calls `createSessionInbox()` with no options and never filters (`packages/app/src/shell/titlebar/projects.tsx:57,72-99`).
- Files: `packages/app/src/runtime/server/session-index.ts`, `packages/app/src/shell/titlebar/inbox-model.ts:196-202`, `packages/app/src/shell/titlebar/projects.tsx`, `packages/app/src/home/sessions/index.ts`
- Impact: archived sessions that are still in the client data store render as active project rows; sessions older than the server page appear for some servers and disappear after a restart (see Known Bugs).
- Fix approach: filter `time.archived === undefined` in the Projects grouping (or add an `archived` option to `createSessionInbox`) and add a regression test that merges an archived known session into a Projects list.

**No recency bound on locally known sessions:**
- Issue: `data.session.known()` (`packages/app/src/runtime/server/data.ts:99-101`) is merged wholesale. Known sessions accumulate for the app run: every session opened by a tab, Home, Inbox, palette or restored search (`packages/app/src/shell/titlebar/inbox-model.ts:394-404`, `packages/app/src/shell/commands/session-search.tsx`, `packages/app/src/shell/titlebar/route-sync.ts`). Only VCS and project metadata are persisted (`packages/app/src/runtime/server/global-sync/child-store.ts:86-97`), so this extra set is not restored on launch.
- Files: `packages/app/src/runtime/server/session-index.ts`, `packages/app/src/runtime/server/data.ts`, `packages/app/src/shell/titlebar/inbox-model.ts`
- Impact: the Projects list is not reproducible across launches. A project can surface because a session was opened earlier in the same run, then vanish after restart. For a user who expects a stable project tree this reads as a bug, not a cache.
- Fix approach: decide one window per server (index only, or index + a bounded `known` slice capped by `time.updated`), and make Projects use that single window.

**Projects mode never demands worktree inventory:**
- Issue: `normalizeProjectInfo` always supplies `worktrees: [{ directory: canonical }]` when the server omits them (`packages/app/src/runtime/server/global-sync/utils.ts:148-155`), so `project.worktrees` is not undefined. However, only `LocationProvider` (`packages/app/src/workspaces/location.tsx:87-93`), Settings › Worktrees (`packages/app/src/settings/workspaces/queries.ts:25-38`) and Home project selection (`packages/app/src/home/model.ts:74-80`) call `sync.worktrees.list`. `SidebarProjects` renders no Location and never lists worktrees.
- Files: `packages/app/src/shell/titlebar/projects.tsx`, `packages/app/src/shell/titlebar/projects-groups.ts:9-20`, `packages/app/src/workspaces/inventory.ts:29-63`, `packages/app/src/runtime/server/global-sync/utils.ts`
- Impact: `sessionProjectDirectory` only sees the canonical root. Sessions in a linked worktree/clone that is not the canonical root fall back to the session directory, so a subdirectory of one checkout becomes its own project group. A checkout whose sessions are all outside the server's 50-row page never gets a row at all. The old `sandboxes` list already on the project is not consulted, although `projects.forSession` does match it (`packages/app/src/runtime/server/runtime.tsx:294-305`).
- Fix approach: on connect/mount of Projects mode, call `ctx.sync.worktrees.list(projectID)` for each visible project (cached, `staleTime: Infinity`, no per-render `refresh`), and use `project.sandboxes` as an additional fallback in `sessionProjectDirectory` so grouping works before inventory arrives.

**Persisted sidebar keys are append-only and key-shape sensitive:**
- Issue: `projects-sidebar.v1` stores `order` and `removed` arrays of opaque group keys (`packages/app/src/shell/titlebar/projects-state.ts:5-15`). Keys are `${server}\u0000${comparablePath(checkout)}` (`packages/app/src/shell/titlebar/projects-groups.ts:27-37`), where `server` is the raw HTTP URL (`packages/app/src/runtime/server/registry.tsx:190-199`). Nothing prunes keys that no longer match a group. Commit `65aaf126b0` changed grouping from session directory to checkout, so pre-existing keys written under the old shape can never match again; earlier backslash/case variants have the same fate.
- Files: `packages/app/src/shell/titlebar/projects-state.ts`, `packages/app/src/shell/titlebar/projects.tsx:182-188,278-287`
- Impact: localStorage grows slowly and, more importantly, a removed project can reappear after a server URL change or a key-shape change (new key, not in `removed`), and hand-made drag order silently resets. `removedProjects` decodes the key by slicing at `\u0000` (`projects.tsx:184-185`), duplicating the key format.
- Fix approach: bump the storage key to `projects-sidebar.v2` when the shape changes, prune `order` to keys that exist plus a bounded recent set, and expose one shared `parseGroupKey`/`groupKeyFor` helper instead of slicing inline.

**Upstream seam budget and documentation have drifted:**
- Issue: `docs/designs/project-grouped-sessions-sidebar.md:105-130` records 8 touched upstream files at +53/−9 and says the titlebar `fallback` stayed byte-identical. The actual diff against `origin/dev` is 12 files, +76/−19 across the upstream files, plus 894 lines of new code. `titlebar.tsx` is restructured from sibling `<Match>`s into a nested `<Switch fallback={...}>` (`packages/app/src/shell/titlebar/titlebar.tsx:812-835`, +20/−11), which is the hardest kind of hunk to merge. The promised `SEAMS.md` does not exist in the repository.
- Files: `docs/designs/project-grouped-sessions-sidebar.md`, `packages/app/src/shell/titlebar/titlebar.tsx`, `packages/app/src/shell/shell.tsx:217-222`, `packages/app/src/settings/model.tsx:151-153`, `packages/app/src/settings/general/interface-mode.tsx`
- Impact: future merges will be assessed against a stale seam list; the titlebar hunk is exactly where upstream is most active. Current `upstream/dev` is 0 commits ahead, but the design document itself notes 78 upstream commits touching `titlebar.tsx`, so the next sync will exercise this seam.
- Fix approach: update the seam table from `git diff --stat origin/dev...HEAD -- packages/app/src` after each sync, restore the missing `SEAMS.md` (or delete the promise from the doc), and prefer adding a sibling `<Match>`/`<Show>` over restructuring the outer `Switch` when the next upstream change lands.

**ActivityRing workaround is spread over three upstream files:**
- Issue: the shared ring's color is declared in unlayered CSS, which beats Tailwind utilities, so three call sites pass inline styles: `packages/app/src/shell/titlebar/inbox.tsx:690`, `packages/app/src/shell/titlebar/project-session-row.tsx:176`, `packages/app/src/home/sessions/view.tsx:368`, plus two new sites in `projects.tsx` (`582`, `683`).
- Files: those three upstream files and `packages/app/src/shell/titlebar/projects.tsx`
- Impact: each is a merge conflict point for a purely cosmetic workaround, and the visual fix is duplicated. The root cause lives in `packages/ui/src/feedback/activity-ring/activity-ring.css` (outside this scope) and was deliberately not fixed because it changes every caller (documented at `docs/designs/project-grouped-sessions-sidebar.md:129`).
- Fix approach: when the package can be visually verified, put the rule in a layer and delete all inline overrides in one change; until then, keep the inline block identical and listed in the seam table.

**Config API gaps leave settings paths stubbed:**
- Issue: `updateConfig` always throws (`packages/app/src/runtime/server/sync.tsx:177-182`) and the bootstrap config query resolves to `{}` (`packages/app/src/runtime/server/global-sync/bootstrap.ts:11-16`), both marked TODO. Home archive is also deliberately dead: `archiveHomeSession` is passed a rejecting `archive` (`packages/app/src/home/sessions/controller.tsx:586-596`), while the Inbox archive path works (`packages/app/src/shell/titlebar/inbox-model.ts:464-480`).
- Files: `packages/app/src/runtime/server/sync.tsx`, `packages/app/src/runtime/server/global-sync/bootstrap.ts`, `packages/app/src/home/sessions/controller.tsx`
- Impact: Settings surfaces that read server config can show empty/static data, and any "save config" path fails at runtime. Home's archive action always produces an error toast; the new Projects mode has no archive action at all (`docs/designs/project-grouped-sessions-sidebar.md:128`).
- Fix approach: keep both TODOs visible in the roadmap; when the V2 config API lands, remove the throw and the `{}` query together, and wire Home archive to the same `session.update({ archived: true })` call the Inbox uses.

## Known Bugs

**Archived sessions appear as active Projects rows:**
- Symptoms: after archiving a session from the Inbox (or opening an archived session from search), switching to Projects shows it under its project with a normal status and age.
- Files: `packages/app/src/runtime/server/session-index.ts:4-13`, `packages/app/src/shell/titlebar/inbox-model.ts:196-202,506-508`, `packages/app/src/shell/titlebar/projects.tsx:72-99`
- Trigger: the session is present in `data.session.known()` with `time.archived` set (opened from the Inbox archived list or restored by session search), then the Projects sidebar mounts against the same server. `mergeRootSessionIndex` lets the known record win, and Projects never checks `inboxArchived`.
- Workaround: switch to the Inbox once so its split runs, or restart the app after archiving; the session then drops out of `known()` because known state is memory-only.
- Fix: archived filter in the Projects grouping, with a unit test at the `projects-groups`/inbox boundary.

**One checkout splits into several project rows (or none):**
- Symptoms: sessions in `repo/packages/app` and `repo/packages/ui` show as two "projects" instead of one; a linked worktree (`repo-feature`) gets its own row; a checkout with only older sessions has no row.
- Files: `packages/app/src/shell/titlebar/projects-groups.ts:9-20`, `packages/app/src/shell/titlebar/projects.tsx`, `packages/app/src/workspaces/inventory.ts:29-63`
- Trigger: Projects mode is opened before any Location/Settings/Home view loaded that project's worktree inventory, or the sessions are older than the 50-root server page (`packages/app/src/shell/titlebar/inbox-model.ts:41`).
- Workaround: open a session in that project (loads its Location and inventory) or visit Settings › Worktrees.
- Fix: inventory demand plus a `sandboxes` fallback as described above.

**A removed project returns after a server URL or key-shape change:**
- Symptoms: "Restore" is no longer offered for a project the user removed; it reappears in the tree.
- Files: `packages/app/src/shell/titlebar/projects-state.ts`, `packages/app/src/runtime/server/registry.tsx:190-199`
- Trigger: same project reached through a different server URL form (trailing slash, hostname vs loopback, renamed tunnel) or any future change to `projectGroupFor`'s checkout key.
- Workaround: remove it again; no restore path for the old key.
- Fix: stable server identity plus a persistence migration/prune.

## Security Considerations

**Persisted server URLs are copied into a second localStorage key:**
- Risk: `projects-sidebar.v1` stores group keys that embed the raw HTTP URL (`ServerConnection.key`). `normalizeServerUrl` only trims whitespace and trailing slashes (`packages/app/src/runtime/server/registry.tsx:12-19`), so a URL with embedded credentials or a token query is duplicated into the sidebar state.
- Files: `packages/app/src/shell/titlebar/projects-state.ts:19`, `packages/app/src/runtime/server/registry.tsx:12-19,190-199`
- Current mitigation: the URL is already persisted by the server registry, so this is duplication rather than a new exposure class; keys are never rendered, only the derived label is.
- Recommendations: strip `username`/`password` and sensitive query parameters in `normalizeServerUrl`, and avoid persisting full URLs in group keys (use a hashed/stable server id).

**Manual desktop packaging swaps in an unverified CLI binary:**
- Risk: `docs/designs/build-desktop.md:38-52` instructs copying `opencode-cli.exe` out of an installed app into `packages/cli/dist/...` and hand-writing its `package.json` version. Provenance and version integrity depend on the operator; a wrong version makes the desktop sidecar restart-loop ("Timed out waiting for the background service to start").
- Files: `docs/designs/build-desktop.md`
- Current mitigation: the document records the exact version check and the failure mode.
- Recommendations: keep the workaround local and uncommitted, prefer building the CLI from the same commit, and add a checksum/version assertion to the packaging script (`packages/desktop/script/build.ts`, outside this scope) when it becomes a repeatable release path.

**No injection or secret-handling issues found in the scoped UI:**
- Labels, project names and paths render as Solid text nodes; inline styles only carry numeric sizes; the sidebar performs local-only remove/restore and never deletes server data. The only path input to `revealProject.reveal` comes from the server project record and requires an explicit user action.

## Performance Bottlenecks

**Projects group rebuild runs on every session data update:**
- Problem: `groups` depends on `inbox.entries()`, which re-merges the index with every known session and calls `sessionRequests` per session on each data-store version bump (`packages/app/src/runtime/server/data.ts:78-101`). The grouping then calls `projects.forSession` and `projectGroupFor` per entry, and `projectGroupFor` sorts worktrees with `toSorted` per call (`packages/app/src/shell/titlebar/projects-groups.ts:13-19`). `directoryGroupLabels` then scans all groups again.
- Files: `packages/app/src/shell/titlebar/projects.tsx:72-151`, `packages/app/src/shell/titlebar/inbox-model.ts:158-223`, `packages/app/src/shell/titlebar/projects-groups.ts`
- Cause: no per-session memoization and an unbounded `known` merge; every streaming event invalidates the aggregate.
- Improvement path: memoize `(server, project, directory) -> group` per session id, cap the known merge, and benchmark with strobe before changing the hot path (the app guidance requires strobe for session/timeline hot paths).

**Settings › Worktrees lists inventory for every project (N+1):**
- Problem: `workspaceInventoryQuery` with no `projectID` fetches project metadata, then calls `context.sync.worktrees.list(project.id)` for every project and optionally `refresh` for each (`packages/app/src/settings/workspaces/queries.ts:25-38`). All calls pass through the shared request queue.
- Files: `packages/app/src/settings/workspaces/queries.ts`
- Cause: the page wants complete inventory; there is no server bulk endpoint.
- Improvement path: list worktrees lazily per expanded project or add a bulk inventory endpoint; keep `shouldRefresh` false for the overview as it already does.

**Fixed request header timeouts can abort slow LAN work:**
- Problem: every queued request is aborted if response headers take longer than 60 s; only setup requests get 10 minutes (`packages/app/src/runtime/server/request-queue.ts:20-25,140-150`).
- Files: `packages/app/src/runtime/server/request-queue.ts`
- Cause: bounded to recover from sleeping-device sockets. A very slow remote server or a large project list can legitimately exceed 60 s.
- Improvement path: classify more long-running endpoints like worktree creation, or expose the timeout per request kind in the classifier.

## Fragile Areas

**`SidebarProjects` is a ~700-line view with only pure-function tests:**
- Files: `packages/app/src/shell/titlebar/projects.tsx`, `packages/app/src/shell/titlebar/projects-groups.test.ts`
- Why fragile: one component owns drag-and-drop (`@dnd-kit/solid` plugin filtering at `projects.tsx:369-396`), persisted order, scroll restore with two timers/`ResizeObserver` (`projects.tsx:289-340`), grouping, removal/restore, rename dialog and status badges. Only `projects-groups.ts` has tests; none of the interaction, ordering or removal behavior is covered.
- Safe modification: keep new logic in pure helpers next to `projects-groups.ts` with tests, and verify drag/scroll by hand in a desktop build (no e2e keeper exists under `packages/app/e2e` for this mode in the scoped paths).
- Test coverage: high risk, low coverage.

**Session-index recency bookkeeping is subtle:**
- Files: `packages/app/src/runtime/server/data.ts:122-312`, `packages/app/src/runtime/server/session-index.ts`
- Why fragile: send/rename/floors/observed maps (512-entry caps, `syntheticTimes` WeakMap) encode "only a completed run advances recency". `mergeRootSessionIndex` adds a second, different rule (passive known records keep the indexed `updated`). A one-line change here reorders Home, Inbox, Projects and the command palette at once.
- Safe modification: change `session-index.ts` only with tests covering passive updates, archived records and a known-only (offline) list; the existing coverage in `packages/app/src/home/sessions/index.test.ts:101-111` does not cover archived known sessions.
- Test coverage: merge contract partially tested; archived path untested.

**Group keys are stringly typed and parsed in three places:**
- Files: `packages/app/src/shell/titlebar/projects-groups.ts:36`, `packages/app/src/shell/titlebar/projects.tsx:84,166,184-185`, `packages/app/src/shell/titlebar/inbox-model.ts:514-516`
- Why fragile: `"\u0000"` separators and the assumption "server, then NUL, then path" are duplicated; `removedProjects` slices the key to synthesize a label. Any format change breaks persisted removal state, labels and dedupe together.
- Safe modification: introduce `groupKey(server, directory)` and `parseGroupKey(key)` in `projects-groups.ts`, migrate the storage key, and keep the old parser only for reading v1.
- Test coverage: key round-trip is not tested.

**Nested titlebar dispatch:**
- Files: `packages/app/src/shell/titlebar/titlebar.tsx:812-835`
- Why fragile: an outer `Switch` whose `fallback` is another `Switch` interleaves `tabLayout` and `sidebarOrganize` precedence. The behavior is currently equivalent (inbox/projects win over organize), but adding a fourth organize option or a new layout means editing both levels, and a mis-ordered `<Match>` silently changes which sidebar renders.
- Safe modification: extract the sidebar selection into a pure `sidebarView(tabLayout, sidebarOrganize)` selector with a unit test, then keep the JSX a single flat `<Switch>`.
- Test coverage: none for the precedence.

**`inbox-model` is a 500-line aggregator with multiple embedded drivers:**
- Files: `packages/app/src/shell/titlebar/inbox-model.ts`
- Why fragile: two state machines, three timer maps, query-cache mutation (`move`/`forget`) and branch-load retries live in one closure. The machines are tested (`inbox-settle-machine.test.ts`, `inbox-branch-machine.test.ts`), the aggregation and cache mutation are not.
- Safe modification: add tests around `entries()` for archived, parent and known-only cases before changing merge behavior; keep cache mutations paired with `forget` so an archived/deleted row cannot bounce back.
- Test coverage: drivers tested, composition untested.

## Scaling Limits

**Session window per server:**
- Current capacity: one page of 50 root sessions per server (`INDEX_LIMIT = 50`, `packages/app/src/shell/titlebar/inbox-model.ts:41`), 50 archived when the Inbox asks for them (`ARCHIVED_LIMIT`), 5 sessions shown per project (`SESSIONS_PER_PROJECT`, `projects.tsx:30-32`).
- Limit: a multi-project user whose 5 hottest projects produce 50 recent roots will see older projects disappear; "Show more" only expands within the fetched page, never fetches more. Local `known` sessions partly mask this but only until restart.
- Scaling path: per-project session queries on group expansion, or a server endpoint that returns projects with recent sessions, instead of one global page.

**Project count and DOM:**
- Current capacity: every group renders a header plus up to 5 rows; no virtualization (`For`, `projects.tsx:399-419`), and grouping is O(sessions × worktrees) per update.
- Limit: dozens of projects/checkouts with drag-and-drop and a resize observer will grow both render and recompute cost; the sidebar has no strobe benchmark, unlike session/timeline paths.
- Scaling path: virtualize the group list and memoize group keys/labels; benchmark with `packages/app/perf` before optimizing.

**Persisted state:**
- Current capacity: unbounded `order`/`removed` arrays and one `scrollTop`.
- Limit: not a size problem in practice, but stale keys make behavior unpredictable (see Tech Debt); there is no cap or TTL.
- Scaling path: prune on load against currently known keys plus a recently-removed set.

## Dependencies at Risk

**`@dnd-kit/solid` / `@dnd-kit/dom` / `@dnd-kit/abstract` plugin internals:**
- Risk: `projects.tsx:379-385` filters out `Accessibility`, `AutoScroller` and `Feedback` from library defaults and reconfigures the rest. That depends on exported plugin identities and option shapes, which are pre-1.0 and can change between releases.
- Impact: a dependency bump can break drag reorder at runtime (type-check may still pass), with no test covering the interaction.
- Migration plan: pin versions, wrap sensor/plugin configuration behind a small adapter, and add a component/e2e story that drags one group before upgrading.

**TanStack Query keys keyed by connection objects:**
- Risk: Home and Inbox use the connection object itself in query keys (`["home-sessions", conn]`, `["inbox-sessions", item.conn]`), while other code reconstructs that object from the registry (`packages/app/src/shell/titlebar/recent-sessions.tsx:674-681`). Structural hashing makes this work today, but any non-serializable field added to a connection changes the hash and silently splits caches.
- Impact: duplicated fetches, stale rows, failed `setQueryData` invalidation (archive/delete/rename would stop reflecting).
- Migration plan: key by `ServerConnection.key(conn)` everywhere and keep the connection only as a query function input.

**Effect Schema persistence:**
- Risk: `tabLayout` is a persisted `Schema.Literals` union extended with `"projects"` (`packages/app/src/settings/model.tsx:151-153`) and stored under `settings.v3` (`model.tsx:349`). The design document claims a stock upstream build that reads this profile deletes the whole `settings.v3` key (`docs/designs/project-grouped-sessions-sidebar.md:130`), but current settings tests assert per-section defaulting for invalid values (`packages/app/src/settings/model.test.ts:141-186`) and do not exercise an unknown `tabLayout`. The real blast radius is unverified.
- Impact: at worst, using the fork and then a stock build loses all settings; at best, only the layout falls back. Either way the claim in the design doc should not be trusted until tested.
- Migration plan: add a decode test with `tabLayout: "projects"` against the upstream schema variant and record the observed result; if the whole key is dropped, gate the value behind a separate persisted key instead of the shared union.

**Shared `@opencode/ui/activity-ring` styling contract:**
- Risk: an unlayered CSS rule defeats utilities, forcing inline-style overrides at five call sites (three of them upstream files).
- Impact: upstream changes to the ring or its call sites reintroduce inconsistent colors and merge conflicts.
- Migration plan: layer the rule in `packages/ui` and remove all inline overrides together.

## Missing Critical Features

**Projects mode has no project-level actions:**
- Problem: no "new session in this project", no archive-session action and no project context menu; only rename, reveal and local remove. This is a recorded tradeoff (`docs/designs/project-grouped-sessions-sidebar.md:128`).
- Blocks: users cannot start work or clean up from the project tree; they must switch to Home or the Inbox.

**No pagination behind "Show more":**
- Problem: `onExpand` only reveals entries already fetched (`projects.tsx:410,493-495,660-669`); it cannot load a project's history.
- Blocks: the documented success criterion "project → default 5 + Show more" is only a display truncation, not access to older sessions (`docs/designs/project-grouped-sessions-sidebar.md:19`).

**Documented cold-start selection is not visible in this scope:**
- Problem: the design's third commit and success criterion say to open the most recently updated session on cold start (`docs/designs/project-grouped-sessions-sidebar.md:136,155`), but no module under `shell/titlebar/projects.tsx` or the other scoped paths selects a session. Any cold-start behavior comes from generic tab/layout restoration, which is outside the new sidebar.
- Blocks: if that requirement still matters, it needs an explicit implementation and a test; otherwise the design document should drop it.

**Collapse/expand state is not persisted:**
- Problem: `collapsed`/`expanded` live in a component-local store (`projects.tsx:62-65`); only order, removed keys and scroll position persist (`projects-state.ts`).
- Blocks: switching interface mode or restarting resets which projects were folded, contrary to the "reopen where I was" intent of the persisted scroll position.

## Test Coverage Gaps

**Session-index archived behavior:**
- What's not tested: `mergeRootSessionIndex` with a known archived session, and a known-only (offline) list; `packages/app/src/home/sessions/index.test.ts:101-111` asserts passive/updated behavior but not archive exclusion.
- Files: `packages/app/src/runtime/server/session-index.ts`, `packages/app/src/home/sessions/index.test.ts`
- Risk: the archived leak above ships unnoticed; future merge changes reorder Home/Inbox/Projects silently.
- Priority: High.

**Projects sidebar interaction and persistence:**
- What's not tested: grouping from inbox entries, drag reorder, scroll restore, remove/restore, `projects-sidebar.v1` key handling, collapse/expand. Only `projects-groups.test.ts` covers pure helpers.
- Files: `packages/app/src/shell/titlebar/projects.tsx`, `packages/app/src/shell/titlebar/projects-state.ts`
- Risk: every upstream merge or dnd-kit upgrade can break the mode without a failing test; the fork's stated priority is "no bugs over features".
- Priority: High.

**Inbox composition (`inbox-model.ts`):**
- What's not tested: `entries()` merging (archived, parent, known-only), `forget`/`move` cache mutation, and the interaction between the two machines. Only the machines themselves are tested.
- Files: `packages/app/src/shell/titlebar/inbox-model.ts`
- Risk: archive/unarchive and delete can leave a row in the wrong list; the Projects mode inherits all of it.
- Priority: High.

**Stubbed runtime paths:**
- What's not tested: `updateConfig` rejection, the `{}` config bootstrap, and Home's archive rejection.
- Files: `packages/app/src/runtime/server/sync.tsx`, `packages/app/src/runtime/server/global-sync/bootstrap.ts`, `packages/app/src/home/sessions/controller.tsx`
- Risk: these are known-dead features; without a test or an explicit guard, a partial V2 API landing can make them fail silently or half-work.
- Priority: Medium.

**Worktree inventory demand from Projects mode:**
- What's not tested: that entering Projects mode loads `project.worktrees`, and that grouping stays one row per checkout with and without inventory.
- Files: `packages/app/src/shell/titlebar/projects-groups.ts`, `packages/app/src/workspaces/inventory.test.ts`
- Risk: the regression is visual and environment-dependent (depends on which view ran first), so it will not be seen in unit tests.
- Priority: Medium.

---

*Concerns audit: 2026-11-12*
