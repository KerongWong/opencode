---
gsd_state_version: "1.0"
milestone: v2.0
milestone_name: 工作区登记侧栏
status: planning
last_updated: "2026-11-13T16:10:00.000Z"
last_activity: 2026-11-13
progress:
  total_phases: 3
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-11-13)

**Core value:** 侧栏显示什么完全由我的登记表决定：登记哪个本地文件夹就出现哪一行；同一仓库两份拷贝是两行；移除只是藏起来，目录、git 与会话分毫不动，重新登记即回来。
**Current focus:** Phase 1 — 登记表数据模型与纯函数
**SPEC:** `docs/designs/workspace-registry-sidebar.md`（§8 按文件实施、§11 验证、§12 冲突预算）

## Current Position

Phase: 1 of 3 (登记表数据模型与纯函数)
Plan: 0 of TBD in current phase
Status: Ready to plan
Last activity: 2026-11-13 — v2.0 roadmap created（3 phases，20/20 requirements mapped）

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

**Velocity:**
- Total plans completed: 0 (v2.0)
- Average duration: -
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1 | - | - | - |
| 2 | - | - | - |
| 3 | - | - | - |

**Recent Trend:**
- Last 5 plans: -
- Trend: -

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Roadmap]: phase 边界按 SPEC 建议切分（模型 → 可见性 → 接缝），不按文件切分；v2.0 编号从 1 重启，不延续 v1.0。
- [Roadmap]: `REG-04`（登记后用 `session.list` 的 `location.directory` 校准服务端拼写）落在 Phase 2，而不是 SPEC 建议的 Phase 1——Phase 1 的验收是纯单测，而该要求需要 HTTP 层（`row-sessions.ts`）。
- [Roadmap]: 回退只由 Phase 3 拥有；Phase 1–2 从空目录新写模块，不修复、不复用 v1.0 的会话派生行代码。
- [Roadmap]: Phase 1 的成功判据是「修复前失败的纯单测」，Phase 2 是「可见性与交互 + 文件级 typecheck」，Phase 3 是「diff 预算与隔离实测」——三者不互相替代。

### Pending Todos

None yet.

### Blockers/Concerns

- [全局] 客户端没有 `fs`：归一只做分隔符 / 尾斜杠 / Windows 大小写，符号链接别名会登记成两个工作区（已承认的残余，不假装解决）。
- [全局] 不得派发 `location.get`（会创建 project 行）；登记流程只用 `session.list`。
- [全局] `packages/app/src/custom-elements.d.ts` 是符号链接，未开开发者模式时整包 typecheck 失败——用 `bun check --no-script <files>` 做文件级门，并把该缺陷与本次改动区分开。
- [全局] 不得重启已安装的应用或服务进程；验证走 dev 服务器与 `OPENCODE_CHANNEL=fork` 新构建。
- [Phase 2] `archived` / `unarchived` / `deleted` 事件只带 `sessionID`，必须靠内存映射做行级刷新，不能退回全局重扫。
- [Phase 3] 触点预算（5 文件 / ~10 行 / 0 删除）是需求而非偏好；任何超出都要先收口再继续。

## Deferred Items

Items acknowledged and deferred at milestone close, most recent first:

| Category | Item | Status | Deferred At | Milestone |
|----------|------|--------|-------------|-----------|
| *(none)* | | | | |

## Session Continuity

Last session: 2026-11-13T16:10:00.000Z
Stopped at: v2.0 roadmap created（ROADMAP.md / STATE.md / REQUIREMENTS.md traceability 已写）
Resume file: None
