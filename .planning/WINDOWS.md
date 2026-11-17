---
schema_version: 1
open_count: 9
waived_count: 0
fixed_count: 1
total_count: 10
last_updated: 2026-11-17T14:39:06.772Z
---

# Broken Windows Ledger

> Cross-phase defect register. With `workflow.windows_enforce` enabled, `/gsd-ship` blocks while `open_count > 0`.
> Waive with `gsd-tools windows waive <id> "<reason>"` (reason required).
> Mark fixed with `gsd-tools windows fixed <id>`.

| id | phase | kind | file | line | description | status | reason | recorded_at | resolved_at |
|----|-------|------|------|------|-------------|--------|--------|-------------|-------------|
| 1 | 01 | unrun-verify | .planning/phases/01-row-source-convergence/01-02-PLAN.md |  | Manual: open an older session then return to Projects; the row set must be identical (needs the live app) | open |  | 2026-11-12T06:57:08.017Z |  |
| 2 | 01 | unrun-verify | .planning/phases/01-row-source-convergence/01-02-PLAN.md |  | Manual: restart the app (user action) then open Projects; the same rows must show (executor must not restart the app) | open |  | 2026-11-12T06:57:14.764Z |  |
| 3 | 01 | unrun-verify | .planning/phases/01-row-source-convergence/01-02-PLAN.md |  | Manual: archive a session in Inbox then open its Archived search before the archived page refetches; the row must still be listed | open |  | 2026-11-12T06:57:15.603Z |  |
| 4 | 01 | deviation | packages/app/e2e/tsconfig.json |  | Pre-existing: bun run typecheck:e2e reports 184 errors in ../ui/src (no vite/client types; include names the nonexistent ../src/types.ts); identical without this plan's perf files | open |  | 2026-11-12T06:57:16.337Z |  |
| 5 | 01 | unrun-verify | .planning/phases/01-row-source-convergence/01-03-PLAN.md |  | Manual: with the 50 newest root sessions all archived, Projects lists the active projects inside the window and opening an old session adds no row (needs the live app) | open |  | 2026-11-12T08:58:11.879Z |  |
| 6 | 01 | unrun-verify | .planning/phases/01-row-source-convergence/01-03-PLAN.md |  | Manual: restart the app (user action) and open Projects; the same rows as before, in the all-archived-page state too | open |  | 2026-11-12T08:58:20.542Z |  |
| 7 | 01 | unrun-verify | .planning/phases/01-row-source-convergence/01-03-PLAN.md |  | Manual: archive a session from Inbox then open its Archived search without leaving the view; the session is still listed | open |  | 2026-11-12T08:58:21.209Z |  |
| 8 | 02 | unrun-verify | packages/app/src/shell/titlebar/projects.tsx |  | 清单读取失败时的静默降级仍未观察（需端点级故障注入）；「每个可见 projectID 恰好一次请求」与「同一 git 根两份 checkout 各一行」已由 agent 在真实数据上用 CDP 读网络/可访问性树验证（见 02-UAT.md §Agent-Run Evidence） | fixed |  | 2026-11-13T08:25:59.777Z | 2026-11-13T12:37:12.725Z |
| 9 | 02 | unrun-verify | packages/app/src/shell/titlebar/projects.tsx |  | 首帧→清单到达之间的瞬时抖动未被仪器化（CDP 无帧级采样）；本机数据里没有「会话落在 checkout 子目录」的样本，故 CHK-02/CHK-03 的 partial backstop 只核对了稳定态。全新项目（sandboxes 为空）在清单到达前仍可能先按会话目录成行（02-02 objective 已声明的首帧边界） | open |  | 2026-11-13T12:37:20.340Z |  |
| 10 | 06 | deviation | packages/session-ui/src/message/message-content.tsx |  | 06-01: props.files 无 path 字段，labels 作用域改由 file.mention.text.slice(1) 派生（Rule 1 修正，已提交 83509df） | open |  | 2026-11-17T14:39:06.772Z |  |

````json
[
  {
    "id": 1,
    "kind": "unrun-verify",
    "phase": "01",
    "file": ".planning/phases/01-row-source-convergence/01-02-PLAN.md",
    "line": null,
    "description": "Manual: open an older session then return to Projects; the row set must be identical (needs the live app)",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-11-12T06:57:08.017Z",
    "resolved_at": null,
    "milestone": "v1.0"
  },
  {
    "id": 2,
    "kind": "unrun-verify",
    "phase": "01",
    "file": ".planning/phases/01-row-source-convergence/01-02-PLAN.md",
    "line": null,
    "description": "Manual: restart the app (user action) then open Projects; the same rows must show (executor must not restart the app)",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-11-12T06:57:14.764Z",
    "resolved_at": null,
    "milestone": "v1.0"
  },
  {
    "id": 3,
    "kind": "unrun-verify",
    "phase": "01",
    "file": ".planning/phases/01-row-source-convergence/01-02-PLAN.md",
    "line": null,
    "description": "Manual: archive a session in Inbox then open its Archived search before the archived page refetches; the row must still be listed",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-11-12T06:57:15.603Z",
    "resolved_at": null,
    "milestone": "v1.0"
  },
  {
    "id": 4,
    "kind": "deviation",
    "phase": "01",
    "file": "packages/app/e2e/tsconfig.json",
    "line": null,
    "description": "Pre-existing: bun run typecheck:e2e reports 184 errors in ../ui/src (no vite/client types; include names the nonexistent ../src/types.ts); identical without this plan's perf files",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-11-12T06:57:16.337Z",
    "resolved_at": null,
    "milestone": "v1.0"
  },
  {
    "id": 5,
    "kind": "unrun-verify",
    "phase": "01",
    "file": ".planning/phases/01-row-source-convergence/01-03-PLAN.md",
    "line": null,
    "description": "Manual: with the 50 newest root sessions all archived, Projects lists the active projects inside the window and opening an old session adds no row (needs the live app)",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-11-12T08:58:11.879Z",
    "resolved_at": null,
    "milestone": "v1.0"
  },
  {
    "id": 6,
    "kind": "unrun-verify",
    "phase": "01",
    "file": ".planning/phases/01-row-source-convergence/01-03-PLAN.md",
    "line": null,
    "description": "Manual: restart the app (user action) and open Projects; the same rows as before, in the all-archived-page state too",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-11-12T08:58:20.542Z",
    "resolved_at": null,
    "milestone": "v1.0"
  },
  {
    "id": 7,
    "kind": "unrun-verify",
    "phase": "01",
    "file": ".planning/phases/01-row-source-convergence/01-03-PLAN.md",
    "line": null,
    "description": "Manual: archive a session from Inbox then open its Archived search without leaving the view; the session is still listed",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-11-12T08:58:21.209Z",
    "resolved_at": null,
    "milestone": "v1.0"
  },
  {
    "id": 8,
    "kind": "unrun-verify",
    "phase": "02",
    "file": "packages/app/src/shell/titlebar/projects.tsx",
    "line": null,
    "description": "清单读取失败时的静默降级仍未观察（需端点级故障注入）；「每个可见 projectID 恰好一次请求」与「同一 git 根两份 checkout 各一行」已由 agent 在真实数据上用 CDP 读网络/可访问性树验证（见 02-UAT.md §Agent-Run Evidence）",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-11-13T08:25:59.777Z",
    "resolved_at": "2026-11-13T12:37:12.725Z",
    "milestone": "v1.0"
  },
  {
    "id": 9,
    "kind": "unrun-verify",
    "phase": "02",
    "file": "packages/app/src/shell/titlebar/projects.tsx",
    "line": null,
    "description": "首帧→清单到达之间的瞬时抖动未被仪器化（CDP 无帧级采样）；本机数据里没有「会话落在 checkout 子目录」的样本，故 CHK-02/CHK-03 的 partial backstop 只核对了稳定态。全新项目（sandboxes 为空）在清单到达前仍可能先按会话目录成行（02-02 objective 已声明的首帧边界）",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-11-13T12:37:20.340Z",
    "resolved_at": null,
    "milestone": "v1.0"
  },
  {
    "id": 10,
    "kind": "deviation",
    "phase": "06",
    "file": "packages/session-ui/src/message/message-content.tsx",
    "line": null,
    "description": "06-01: props.files 无 path 字段，labels 作用域改由 file.mention.text.slice(1) 派生（Rule 1 修正，已提交 83509df）",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-11-17T14:39:06.772Z",
    "resolved_at": null,
    "milestone": "v2.2"
  }
]
````
