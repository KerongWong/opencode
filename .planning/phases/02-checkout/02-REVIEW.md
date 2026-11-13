---
phase: 02-checkout
reviewed: 2026-11-13T09:36:46Z
depth: standard
files_reviewed: 6
files_reviewed_list:
  - docs/designs/project-grouped-sessions-sidebar.md
  - packages/app/perf/projects-groups.bench.ts
  - packages/app/perf/projects-groups.ts
  - packages/app/src/shell/titlebar/projects-groups.test.ts
  - packages/app/src/shell/titlebar/projects-groups.ts
  - packages/app/src/shell/titlebar/projects.tsx
findings:
  critical: 0
  warning: 2
  info: 4
  total: 6
  necessity: 0
status: issues_found
---

# Phase 02: Code Review Report

**Reviewed:** 2026-11-13T09:36:46Z
**Depth:** standard
**Files Reviewed:** 6
**Status:** issues_found

## Summary

Scope: the phase diff `7a61e6550f..HEAD` (6 files, +168/−13). The core of the change is sound. I traced the two new contracts against their owners:

- `projectRoots` (`projects-groups.ts:16-32`) builds `worktrees ∪ sandboxes ∪ worktree`, deduped with `sameDirectory`, and `sessionProjectDirectory` still selects the closest owner by comparable-path length. I confirmed the `WeakMap` memo cannot go stale under the current write paths: every `setGlobalStore("project", …)` call site either reuses the existing raw object (`sync.tsx:61-63,123-139`, `global-sync/bootstrap.ts:43-50`, all of which are identity-preserving through `solid-js/store`'s `unwrap`/`wrap` caching) or replaces the changed project with a fresh object (`withWorktreeInventory`, `normalizeProjectInfo`, `updateProjectInfo`, `withLocalMeta`). The summary's documented assumption ("metadata is replaced rather than edited") holds today.
- The mount-time inventory effect satisfies D-02/D-03 literally: the claim Set is added before the request, the `cached()` probe prevents re-fetching across mode switches, only `list` (never `refresh`) is called, and the `/global` pseudo project is skipped. `<Match>` in `titlebar.tsx:832-834` does unmount the component, so the Set is genuinely mount-scoped.

What the tweaks expose is lifecycle behaviour around removal and around a failed read — see Warnings. Verification run locally: `bun test src/shell/titlebar/projects-groups.test.ts` → 12 pass / 0 fail; `bun check --no-script` on the five source files → no type errors in 525 files; `bun script/lint-changed.ts 7a61e6550f` → 0 problems in 5 changed files. The two known Windows environment defects (`custom-elements.d.ts` symlink, `typecheck:e2e` UI errors) were not re-triggered.

## Warnings

### WR-01: Removing a project no longer survives the inventory load — its checkout rows return and Restore becomes a no-op

**File:** `packages/app/src/shell/titlebar/projects.tsx:111` (with `packages/app/src/shell/titlebar/projects-groups.ts:23-27,56`, `packages/app/src/shell/titlebar/projects-state.ts:9-11,28-37`)
**Issue:** Removal is stored per **checkout key** (`server\0comparablePath(checkout)`), and `groups()` only remaps keys that are present in `removed`. This phase adds two things that break that pairing:

1. `projectRoots` now includes `sandboxes`, so once the inventory lands, a session in `repo/.worktrees/feature/src` keys to `server\0/repo/.worktrees/feature` instead of `server\0/repo`.
2. `projects.tsx:75-94` loads the inventory **from the sidebar itself, after first paint**, so this re-keying now happens on every mount without visiting Home or Settings.

Reproduction on every app start: the user removes the only visible row of a project that has linked worktrees (`removed = [server\0/repo]`); first paint keys all its sessions to `/repo`, so they are (by design, `projects.tsx:96-98,110-111`) folded into `Ungrouped`; the effect then lists inventory, `/repo` gains `/repo/.worktrees/feature`, and those sessions produce a new `feature` key that is **not** in `removed` — a named project row reappears. In parallel, `removedProjects()` (`projects.tsx:209-213`) keeps the now-stale canonical key as a phantom menu entry with `count: 0`, and its Restore action (`projects.tsx:468`) un-removes a key no session uses, so it visibly does nothing. This contradicts the promise in `projects-state.ts:9-11` ("a finished project does not return the next time it is used"). The root cause (per-checkout key + per-key removal) predates this phase, but the phase's own mount-time read makes it reliably reproducible.
**Fix:** Treat "the canonical root of this project is removed" as "the project is removed" when remapping, so checkouts discovered after removal fold into `Ungrouped` too, while a removed *non-canonical* checkout key still suppresses only that checkout (add `comparablePath` to the existing `@opencode/util/path` import at `projects.tsx:16`):

```ts
const removed = removedKeys()

const key =
  group.key === "ungrouped" ||
  removed.has(group.key) ||
  (project && removed.has(`${entry.server}\u0000${comparablePath(project.worktree)}`))
    ? "ungrouped"
    : group.key
```

Also drop or reconcile the stale canonical entry in `removedProjects()` when the project's canonical key no longer has sessions, or point Phase 3's `projects-sidebar.v2` migration (ROADMAP §Phase 3, criterion 2) at this exact transition. If the product decision is instead "a newly discovered checkout of a removed project is a new row", record that in `docs/designs/project-grouped-sessions-sidebar.md` §已知取舍 and make Restore target the live row, because today the UI offers an action that cannot work.

### WR-02: A failed inventory read is never retried for the life of the mount, so D-04's "reconnect" recovery path does not exist

**File:** `packages/app/src/shell/titlebar/projects.tsx:85-92`
**Issue:** The claim is added to `requestedWorktrees` **before** the request, and it is never released:

```ts
if (requestedWorktrees.has(key)) return
requestedWorktrees.add(key)                                   // claimed unconditionally
if (entry.ctx.sync.worktrees.cached(project.id) !== undefined) return
void entry.ctx.sync.worktrees.list(project.id)                // failure is swallowed (inventory.ts:57)
```

The effect does not gate on `connected()` and does not re-run on connection state, so if the first read happens while the server is not connected (offline start, server restart), it fails, leaves `cached()` undefined, and the claim blocks every later attempt. `sync.tsx:104-118` handles reconnect by invalidating queries with `refetchType: "none"` and refetching only bootstrap; `loadProjects` (`global-sync/bootstrap.ts:43-50`) reads the inventory cache rather than calling `list`, and `worktree.updated` (`sync.tsx:156-161`) requires a server event. Net effect: the sidebar stays on the `sandboxes` fallback — which is `[]` for projects that were not V1-migrated (`02-02-PLAN.md:89-91`) — so all checkouts collapse into the canonical row until the person switches modes, which is exactly the "intermediate state" the phase set out to shorten. D-04 lists "重连失效" as an existing recovery path, but the code has no such path. Home already does this correctly for the same query: `home/machine.ts:278-284` only lists while `entry.connected`, and `home/machine.test.ts:165-174` pins "a disconnect drops the demand; the next connection lists again".
**Fix:** Read connection state inside the effect (so it is tracked) and release the claim while disconnected, keeping the retry one-shot rather than a loop:

```ts
createEffect(() => {
  inbox.entries().forEach((entry) => {
    const project = entry.ctx.projects.forSession(entry.session)
    if (!project?.id || project.id === "global") return

    const key = `${entry.server}\u0000${project.id}`
    if (entry.ctx.sdk.connection.status() !== "connected") {
      requestedWorktrees.delete(key)   // the next connection may list once
      return
    }
    if (requestedWorktrees.has(key)) return
    requestedWorktrees.add(key)
    if (entry.ctx.sync.worktrees.cached(project.id) !== undefined) return
    void entry.ctx.sync.worktrees.list(project.id)
  })
})
```

This keeps D-04's "no retry on failure" (there is still no retry timer and no toast) while making the documented reconnect recovery real.

## Info

### IN-01: Two servers exposing the same checkout path still produce identical labels

**File:** `packages/app/src/shell/titlebar/projects-groups.ts:63-89`
**Issue:** `directoryGroupLabels` escalates duplicates title → `title · parent` → `title · full directory`. When two groups share both the title and the full directory (the same repository checkout served by two servers — plausible with local + remote, and this phase makes duplicate folder names the common case), the third form is also identical, so both rows render the same label and the disambiguation loop terminates on a collision. The function's own doc comment claims the full directory is the final disambiguator, which is only true when the directories differ.
**Fix:** Add a final discriminator (for example the server key, or a numeric suffix) when the full-directory label is still duplicated, or document that labels are unique per directory, not per row.

### IN-02: The "moves a session into a deeper checkout" test cannot fail on the pre-fix code and restates existing cases

**File:** `packages/app/src/shell/titlebar/projects-groups.test.ts:88-106`
**Issue:** All three assertions pass against the implementation before this phase: the `inventoried` fixture already lists `feature` in `worktrees`, so `feature/src → feature` (assertion 1) and `inventoried → canonical` (assertion 3) hold with roots taken from `worktrees` alone, and `sandboxesOnly → canonical` for `packages/ui` (assertion 2) also holds because `packages/ui` is inside the canonical root. The SUMMARY's pre-fix failure list correctly omits this test. Its name says "moves", but the move it describes (a session changing checkout when the inventory arrives) is not observable in the fixture it uses: both `sandboxesOnly` and `inventoried` already resolve `feature/src` to `feature` **after** the fix, and to `feature`/`canonical` respectively **before** it. So the case is a characterization of the D-08 decision, not regression coverage, and each assertion repeats one the adjacent tests already own. `packages/app/AGENTS.md` §Tests requires a test to be able to fail and to not repeat a case another test owns.
**Fix:** Delete the case and keep the adjacent `projectGroupFor > keys the same sessions the same way before and after the inventory arrives` as the owner of the dual-path contract, or rename it and state in the comment that it pins D-08's accepted interpretation (a deeper checkout gets its own row; the other rows' keys are unchanged) rather than guarding a regression.

### IN-03: The perf harness comment claims every pass pays the root-set dedupe, but the memo makes that once per module load

**File:** `packages/app/perf/projects-groups.ts:8-9` (with `:21-32`)
**Issue:** "so the benchmark pays the root-set dedupe and the closest-owner scan" — `rootsByProject` (`projects-groups.ts:14-32`) is keyed by the module-level `project` object, and strobe loads the harness once per block, so only the first of the 50 `group()` passes builds the root set; the other 49 measure the cached owner scan. That is the right steady state for the production hot path, but the comment overstates what the case observes: a regression in the `projectRoots` build itself (the O(n²) dedupe this phase added) is attenuated to roughly 1/50 of its real cost, so the case cannot police that code path. Record the distinction so a later reader does not assume it is covered.
**Fix:** Reword to "one cold root-set build plus 49 cached passes, matching one `groups()` recompute per project object in the app", or add a second case that builds a fresh project object per pass if cold cost should be guarded.

### IN-04: "sandboxes never carries the canonical directory" is an unenforced invariant

**File:** `packages/app/src/shell/titlebar/projects-groups.ts:21-22`
**Issue:** The comment states as fact that `sandboxes` never contains the canonical directory. The repo does not guarantee that: `workspaces/paths.ts:11-13` (`workspaceDirectories`) filters the canonical out of `sandboxes` before use, which only makes sense if callers cannot assume it is absent. Correctness is unaffected here only because the final `[...worktrees, ...sandboxes, ...worktree]` list is deduped with `sameDirectory`, so a canonical duplicate is collapsed anyway. As written the comment invites a future reader to drop the explicit canonical append.
**Fix:** State the actual invariant used by the code — "the canonical root is appended explicitly because `worktrees` may be empty after `withWorktreeInventory`; duplicates are removed by the `sameDirectory` filter" — and drop the claim about what `sandboxes` may contain.

---

_Reviewed: 2026-11-13T09:36:46Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: standard_
