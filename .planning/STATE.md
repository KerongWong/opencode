---
gsd_state_version: "1.0"
milestone: v2.2
milestone_name: dsh 交互对齐：@ 引用短路径与会话列表水位线
status: roadmap-created
last_updated: "2026-11-17"
last_activity: 2026-11-17
progress:
  total_phases: 2
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-11-17, v2.2 启动)

**Core value:** 侧栏显示什么完全由我的登记表决定：登记哪个本地文件夹就出现哪一行；同一仓库两份拷贝是两行；移除只是藏起来，目录、git 与会话分毫不动，重新登记即回来。
**Current focus:** v2.2 Phase 6 — @ 引用短路径（composer 与已发消息）
**SPEC:** v2.2 无独立设计文档；范围与默认值以 milestone 启动时的任务简报 + 事实复核结论为准（dsh 只读参照）。

## Current Position

Phase: 6 — @ 引用短路径（composer 与已发消息）(not started)
Plan: —
Status: Roadmap created, awaiting approval
Last activity: 2026-11-17 — v2.2 roadmap created（Phase 6/7）

## Performance Metrics

**Velocity:**
- Total plans completed: 7 (v2.0: 5, v2.1: 2)
- Average duration: 13min
- Total execution time: 0.2 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1 | 1 | - | - |
| 2 | 2 | - | - |
| 3 | - | - | - |
| 04 | 1 | - | - |
| 05 | 1 | - | - |
| 6 | 0/TBD | - | - |
| 7 | 0/TBD | - | - |

**Recent Trend:**
- Last 5 plans: -
- Trend: -

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Roadmap]: v2.2 phase 编号延续 v2.1（Phase 6/7），两个特性（MENT / COLL 水位线）相互独立、可任意顺序交付
- [Roadmap]: MENT 特征（MENT-01/02）合并为单 Phase 6——成功判据是同一条「渲染层缩短、正文/wire 不变」契约的 composer 侧与消息侧两面，拆开会产生两个薄 phase
- [Roadmap]: COLL 特征（COLL-03/04/05）合并为单 Phase 7——三项是同一次「二元持久化 → 内存水位」替换的分支语义，共享水位状态模型，拆开会导致状态实现三处妥协
- [Roadmap]: 事实复核（2026-11-17）确认任务简报 A 项（消息级撤销+复制入口）已存在于 App 端，剔除出范围并记入 Out of Scope

### Pending Todos

None yet.

### Blockers/Concerns

- [全局] 客户端没有 `fs`：归一只做分隔符 / 尾斜杠 / Windows 大小写，符号链接别名会登记成两个工作区（已承认的残余，不假装解决）。
- [全局] 不得派发 `location.get`（会创建 project 行）；登记流程只用 `session.list`。
- [全局] `packages/app/src/custom-elements.d.ts` 是符号链接，未开开发者模式时整包 typecheck 失败——用 `bun check --no-script <files>` 做文件级门，并把该缺陷与本次改动区分开。
- [全局] 不得重启已安装的应用或服务进程；验证走 dev 服务器与 `OPENCODE_CHANNEL=fork` 新构建。
- [Phase 6] 缩短只发生在渲染层：composer 的 model.ts 写入与 request.ts 序列化必须保持全路径；session-ui message-content.tsx 的 data-highlight="file" 渲染做 basename + 同消息最短区分后缀，title 为全路径。
- [Phase 7] dsh 水位语义蓝本（WorkspaceBrowser.tsx）：基线 5、+5/次、剩余 ≤5 一步全展开 + Show less 一步回基线、前 50 条内 running/pending/current/unread-completed 自动抬升且单调、折叠行重置、不持久化；现有 sessions.test.ts L291-312 锚定二元语义，需随实现改写。
- [全局] 触点预算：优先只增不改；本里程碑只动 packages/app 与 packages/session-ui（无 TUI/core/server）。

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 261114-lht | 将 workspace-sidebar 提升为 Interface layout 第四模式（projects 布局，渠道默认启用），渠道 fork→projects | 2026-11-14 | e5513f38c2 | [261114-lht-workspace-sidebar-interface-layout-proje](./quick/261114-lht-workspace-sidebar-interface-layout-proje/) |

## Deferred Items

Items acknowledged and deferred at milestone close, most recent first:

| Category | Item | Status | Deferred At | Milestone |
|----------|------|--------|-------------|-----------|
| verification_gap | Phase 03（v2.0 归档）03-VERIFICATION.md gaps_found：触点收敛与打包隔离未验收随 v2.1 启动归档 | acknowledged | 2026-11-17 | v2.1 |

## Session Continuity

Last session: 2026-11-17
Stopped at: v2.2 roadmap created（Phase 6/7 待审批）
Resume file: None

## Operator Next Steps

- Approve the v2.2 roadmap, then run `/gsd-plan-phase 6`（或 Phase 7，二者相互独立）
