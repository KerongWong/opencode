---
quick: 20261118-queue-slow-class
date: 2026-11-18
status: complete
subsystem: runtime/server
tags: [request-queue, classification, slow-slots]
key-files:
  modified:
    - packages/app/src/runtime/server/request-queue-machine.ts
    - packages/app/src/runtime/server/request-queue.test.ts
decisions:
  - Imported classifyRequest in the test from request-queue-machine (its defining module) rather than adding a re-export to request-queue.ts, keeping the production diff to one line.
  - Amended the RED commit once before the implementation commit because the first staged test edit dropped the createRequestQueue import (module-load error instead of failing assertions); the amended RED was re-verified to fail on exactly the three new slow-classification cases.
metrics:
  duration: ~12min
  commits: 2
---

# Quick Task Summary: 请求队列慢分类补全（/api/location、/api/file）

`classifyRequest` now marks `/api/location` (first-time project resolution shells out to git) and `/api/file` (availability probes walk the filesystem) as slow, so on a fresh directory these second-scale requests hold the slow slots (limit 2) instead of occupying the ordinary budget (limit 4) and starving user sends (`session.create`) behind the sync storm. Root cause: `.planning/todos/pending/add-open-draft-hang.md`.

## Tasks

| Task | Result | Commit |
| ---- | ------ | ------ |
| RED: `classifyRequest` table tests | 3 new cases fail (`/api/location`, `/api/location?...`, `/api/file/list`), negatives (`/api/session`, `/api/filex`, `POST /api/worktree`, `/api/event`) pass | `e9bb437559` |
| Implementation: extend `slowRequestPaths` | one-line change; full suite 21/21 green | `a3f18c8d5f` |

## Verification

- `bun test --conditions=solid --isolate --preload ../ui/test/solid-jsx.ts --preload ./happydom.ts src/runtime/server/request-queue.test.ts` — 21 pass, 0 fail (from `packages/app`)
- RED evidence re-verified at `e9bb437559`: 18 pass / 3 fail, failures limited to the three slow-classification cases
- `bun check --no-script src/runtime/server/request-queue-machine.ts src/runtime/server/request-queue.test.ts` — no type errors

## Boundaries respected

- Queue limits (4/2), priority semantics, and UI feedback untouched per plan
- No STATE.md / ROADMAP.md edits (orchestrator handles tracking)

## Deviations from Plan

1. **[Process] RED commit amended once.** The first staged version of the test edit dropped the existing `createRequestQueue` import, so the RED run errored at module load rather than failing on assertions. The commit was amended (pre-implementation, unpublished) with the correct two-module import; RED was re-run and confirmed to fail on exactly the three new cases before the implementation commit was made. Net diff unchanged.
2. **[Minor] Test import source.** Plan implied importing through `request-queue.ts`; that module imports `classifyRequest` for its own use but does not re-export it. The test imports `classifyRequest` from `./request-queue-machine` (its defining module) to keep the production diff minimal.

## Self-Check: PASSED

- `git merge-base --is-ancestor e9bb437559 HEAD` ✔
- `git merge-base --is-ancestor a3f18c8d5f HEAD` ✔
