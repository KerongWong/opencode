---
gsd_state_version: "1.0"
milestone: v2.1
milestone_name: workspace-sidebar 会话行状态与交互增强
current_phase: 05
current_phase_name: Add-folder 跳转与会话列表折叠
status: executing
stopped_at: Phase 04 complete, ready to execute Phase 05
last_updated: "2026-11-17T06:28:11.012Z"
last_activity: 2026-11-17
last_activity_desc: Phase 04 complete, transitioned to Phase 05
state_head: 597e5a55595aa8ce5ff63f61c44d81932fcfbd2d
progress:
  total_phases: 2
  completed_phases: 1
  total_plans: 2
  completed_plans: 1
  percent: 50
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-11-13)

**Core value:** 侧栏显示什么完全由我的登记表决定：登记哪个本地文件夹就出现哪一行；同一仓库两份拷贝是两行；移除只是藏起来，目录、git 与会话分毫不动，重新登记即回来。
**Current focus:** Phase 1 — 登记表数据模型与纯函数
**SPEC:** `docs/designs/workspace-registry-sidebar.md`（§8 按文件实施、§11 验证、§12 冲突预算）

## Current Position

Phase: 05 — Add-folder 跳转与会话列表折叠
Plan: Not started
Status: Ready to execute
Last activity: 2026-11-17 — Phase 04 complete, transitioned to Phase 05

## Performance Metrics

**Velocity:**
- Total plans completed: 4 (v2.0)
- Average duration: 13min
- Total execution time: 0.2 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1 | 1 | - | - |
| 2 | 2 | - | - |
| 3 | - | - | - |
| 04 | 1 | - | - |

**Recent Trend:**
- Last 5 plans: -
- Trend: -

*Updated after each plan completion*
**Per-Plan Metrics:**

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| Phase 01 P1 | 13 | 3 tasks | 2 files |
| Phase 02 P1 | 22min | 3 tasks | 4 files |
| Phase 02-sidebar-render P2 | 50min | 3 tasks | 5 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Roadmap]: phase 边界按 SPEC 建议切分（模型 → 可见性 → 接缝），不按文件切分；v2.0 编号从 1 重启，不延续 v1.0。
- [Roadmap]: `REG-04`（登记后用 `session.list` 的 `location.directory` 校准服务端拼写）落在 Phase 2，而不是 SPEC 建议的 Phase 1——Phase 1 的验收是纯单测，而该要求需要 HTTP 层（`row-sessions.ts`）。
- [Roadmap]: 回退只由 Phase 3 拥有；Phase 1–2 从空目录新写模块，不修复、不复用 v1.0 的会话派生行代码。
- [Roadmap]: Phase 1 的成功判据是「修复前失败的纯单测」，Phase 2 是「可见性与交互 + 文件级 typecheck」，Phase 3 是「diff 预算与隔离实测」——三者不互相替代。
- [Phase 01]: 归一后的绝对路径即主键；Windows 盘符根保留 C:/（服务端 isWindowsStoragePath 只认 ^[A-Za-z]:/），比较仅在 win32 下不区分大小写
- [Phase 01]: 重复登记复用既有记录（含已移除），清 removedAt 并保留 title/order/首次归一拼写；已可见时返回同一个 entries 引用以避免写入
- [Phase 01]: 移除只写 removedAt，记录不删；新登记 order = 所有既有（含已移除）最大值 + 1；registryTarget 只返回 Persist.serverGlobal(scope, workspace-registry.v1) 目标，persisted() 留给 Phase 2
- [Phase 02]: Rows come only from visible(entries); per-row session.list is filed under that row's directoryKey, and alias spellings never create a second row
- [Phase 02]: REG-04 adopts a non-empty server spelling per row only; empty lists fall back to local normalization and older records self-heal on load
- [Phase 02]: Availability is the filesystem's answer (file.list per ready row on load/reconnect), never inferred from session count; event refreshes skip the probe
- [Phase 02]: Sidebar renders only visible(entries); no ungrouped/other fallback group exists
- [Phase 02]: The titlebar mount replaces the SidebarOrganized import instead of adding one, keeping the diff at 2/2 lines

### Pending Todos

None yet.

### Blockers/Concerns

- [全局] 客户端没有 `fs`：归一只做分隔符 / 尾斜杠 / Windows 大小写，符号链接别名会登记成两个工作区（已承认的残余，不假装解决）。
- [全局] 不得派发 `location.get`（会创建 project 行）；登记流程只用 `session.list`。
- [全局] `packages/app/src/custom-elements.d.ts` 是符号链接，未开开发者模式时整包 typecheck 失败——用 `bun check --no-script <files>` 做文件级门，并把该缺陷与本次改动区分开。
- [全局] 不得重启已安装的应用或服务进程；验证走 dev 服务器与 `OPENCODE_CHANNEL=fork` 新构建。
- [Phase 2] `archived` / `unarchived` / `deleted` 事件只带 `sessionID`，必须靠内存映射做行级刷新，不能退回全局重扫。
- [Phase 3] 触点预算（5 文件 / ~10 行 / 0 删除）是需求而非偏好；任何超出都要先收口再继续。

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 261114-lht | 将 workspace-sidebar 提升为 Interface layout 第四模式（projects 布局，渠道默认启用），渠道 fork→projects | 2026-11-14 | e5513f38c2 | [261114-lht-workspace-sidebar-interface-layout-proje](./quick/261114-lht-workspace-sidebar-interface-layout-proje/) |

## Deferred Items

Items acknowledged and deferred at milestone close, most recent first:

| Category | Item | Status | Deferred At | Milestone |
|----------|------|--------|-------------|-----------|
| *(none)* | | | | |

## Session Continuity

Last session: 2026-11-13T17:57:11.626Z
Stopped at: Phase 04 complete, ready to execute Phase 05
Resume file: None
