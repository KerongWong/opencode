---
name: upstream-sync
description: Use when asked to sync upstream dev into this fork's dev branch and merge upstream/dev into workspace-registry, resolving conflicts and verifying the result. Covers fork remotes (origin/upstream), fast-forward-only dev sync, merge conflict policy, bun install plus bun run check verification, and pushing to origin. Also use for 同步 upstream、同步官方 dev、把官方 dev 合并到 workspace-registry.
---

# Upstream Sync

Repo-specific workflow for this fork:

- `origin` = `KerongWong/opencode` (your fork, writable).
- `upstream` = `anomalyco/opencode` (official, read-only).
- `dev` = mirror of `upstream/dev`. Fork-specific work never lives here.
- `workspace-registry` = long-lived feature branch (fork work).
- Other branches (including the abandoned one and historical backups) are out of scope: never modify, delete, or merge them.

## Authorization boundary

Invoking this skill authorizes: `fetch`, `merge`, `commit`, `add` of merge-resolved paths, and normal `push` to `origin` as described below. It does **not** authorize disk-destructive or history-rewriting operations:

- Never `git push --force` / `--force-with-lease`.
- Never `git reset --hard` a branch that is already pushed.
- Never delete branches, tags, or worktrees.
- Never `git add -A` (untracked junk such as `packages/cli/.bun-cache/` must stay out).

If `dev` cannot be fast-forwarded, stop and report instead of mirroring by force. The user's stated policy is that `dev` is never modified locally, so divergence means something unexpected happened upstream or in the fork.

## Step 0: Preflight

1. Confirm the repo root and remotes:

   ```powershell
   git rev-parse --show-toplevel
   git remote -v
   ```

   Require `origin` and `upstream` to exist. If the URLs are not the fork/official pair above, report and stop.

2. Require a clean tracked worktree:

   ```powershell
   git status --porcelain -uno
   ```

   If anything is listed, stop and ask the user to commit or stash it. Never auto-stash, never discard. Untracked files are ignored by this check and must not be touched.

3. Fetch and record the starting point:

   ```powershell
   git fetch upstream dev --prune
   git fetch origin --prune
   git rev-parse upstream/dev origin/dev workspace-registry
   ```

   Keep these three SHAs; the final report and rollback instructions need them.

## Step 1: Sync `dev` to `upstream/dev` (fast-forward only)

Decide the case before writing to the remote:

```powershell
git merge-base --is-ancestor origin/dev upstream/dev
git rev-list --left-right --count origin/dev...upstream/dev
```

- **Equal SHAs** → no-op. Report "dev 已是最新".
- **`origin/dev` is an ancestor of `upstream/dev`** (left count `0`) → fast-forward is safe:

  ```powershell
  git push origin refs/remotes/upstream/dev:refs/heads/dev
  git branch -f dev upstream/dev
  ```

  Pushing the tracking ref keeps the local `dev` checkout undisturbed. Report old → new SHA.
- **Diverged or `origin/dev` ahead** (left count `> 0`) → stop before merging. Report `git log --oneline origin/dev --not upstream/dev` (fork-only commits) and `git log --oneline upstream/dev --not origin/dev` (upstream commits), and state that no force push was attempted because `dev` must stay a mirror.

If the push is rejected anyway, do not retry with force. Report the rejection and stop. `git branch -f dev ...` fails when `dev` is checked out in another worktree; in that case report it and leave the local branch alone.

## Step 2: Merge `upstream/dev` into `workspace-registry`

1. Switch and confirm state:

   ```powershell
   git switch workspace-registry
   git status --porcelain -uno
   ```

2. If `git merge-base --is-ancestor upstream/dev workspace-registry` succeeds, the branch already contains upstream. Report "无需合并" and stop; there is nothing to merge or push.

3. Start the merge without committing, so conflicts can be resolved deliberately:

   ```powershell
   git merge --no-ff --no-commit upstream/dev
   ```

4. Resolve conflicts with this priority order:

   1. **Upstream behavior is never reverted.** Upstream fixes and refactors win as the base structure.
   2. **Fork features must stay functional.** `workspace-registry` behavior keeps working; never delete fork-only feature code.
   3. **Both when structurally possible.** Keep upstream structure and re-apply the fork delta on top. Inspect the fork-side change first:

      ```powershell
      git diff (git merge-base <PRE_WR> upstream/dev)..<PRE_WR> -- <path>
      ```
   4. **When a single hunk cannot express both**, take the upstream implementation and port the fork delta to the nearest valid location, then record the decision.

   Per-file-type rules:

   - `bun.lock` / lockfiles: take either side, then regenerate with `bun install`. Never hand-merge lockfile lines.
   - Generated code (protocol/client/SDK outputs): take upstream (`git checkout --theirs -- <path>`), then run `bun run generate` from `packages/client` if the protocol or HttpApi changed.
   - Docs and changelogs: keep both sides; upstream entries first, fork entries after.
   - `package.json` dependency conflicts: union of dependencies, then `bun install` to normalize.
   - Delete-vs-modify: prefer the upstream deletion; if the fork change is a real feature, port it to the replacement location, otherwise keep the file and record why.

5. Never leave conflict markers. Verify:

   ```powershell
   git grep -nE '^(<<<<<<<|=======|>>>>>>>)' -- ':!.git'
   ```

   Must produce no output.

6. Regenerate the lockfile before committing if dependencies changed or the lockfile conflicted, and stage it:

   ```powershell
   bun install
   git add -- bun.lock
   ```

7. Stage only merge-related paths, then commit:

   ```powershell
   git diff --name-only --diff-filter=U
   git add -A -- <the paths above and any files created while porting>
   git commit --no-edit
   ```

   If `git commit` needs an explicit message, use:

   ```text
   chore: merge upstream/dev into workspace-registry
   ```

## Step 3: Verify

Run from the repo root:

```powershell
bun run check
```

This is the canonical full lint + typecheck. Rules:

- Fix errors caused by the merge by editing the merged code; keep fixes inside the merge scope.
- Re-run `bun run check` after each fix round. Stop after three rounds and report instead of looping.
- If conflicts touched tested code, also run the closest test from that package directory, for example `bun test <file>` inside `packages/<pkg>`.
- Never push while `bun run check` fails.

If verification cannot be made green without a product decision, leave the local merge commit in place, skip Step 4, and report the failing packages plus the rollback command.

## Step 4: Push

Only after verification passes:

```powershell
git push origin workspace-registry
```

Plain push only. If it is rejected as non-fast-forward, stop and report; do not force.

## Rollback

If the merge was not pushed yet:

```powershell
git reset --hard <PRE_WR>
```

If `dev` was pushed and must be undone, do not force push; report the situation to the user.

## Acceptance Invariants

Verify all of these before reporting success:

```powershell
git merge-base --is-ancestor upstream/dev workspace-registry   # upstream history preserved
git merge-base --is-ancestor <PRE_WR> workspace-registry       # fork history preserved
git merge-base --is-ancestor $(git rev-parse origin/dev) upstream/dev  # dev is a mirror
```

- No conflict markers remain (`git grep` check above returns nothing).
- `bun run check` exits 0 in the final state.
- Fork-only files from `<PRE_WR>` still exist unless they were deliberately ported, and every port is listed in the report.
- When pushed, `git rev-parse workspace-registry` equals `git rev-parse origin/workspace-registry`.

## Required Report

Return these fields at the end:

- `upstream/dev`: old SHA → new SHA.
- `dev` sync: pushed (old → new) / already current / stopped because of divergence.
- Merge: commit SHA, whether it was a no-op, number of conflicted files.
- Conflicts: one line per file with the chosen side (`upstream` / `fork` / `both` / `ported`) and a one-sentence reason.
- Fork behavior that had to be adjusted while resolving, if any.
- Verification: exact commands run and their outcome.
- Push: pushed / skipped (reason).
- Untouched: the abandoned branch and all other feature/backup branches.

## Pitfalls

- `upstream` is a partial clone (`blob:none`); merges need network access to fetch missing blobs.
- Repo tests cannot run from the root; package tests run from their package directory.
- After changing the public Protocol or Server `HttpApi`, regenerate the client (`bun run generate` in `packages/client`) instead of editing generated files.
- An empty merge happens when upstream is already contained; detect it with `--is-ancestor` before merging.
- Do not commit unrelated local changes that appear during the run; report them instead.
