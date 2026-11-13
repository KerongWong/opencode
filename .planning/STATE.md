---
gsd_state_version: "1.0"
milestone: v1.0
milestone_name: Projects 侧栏正确性
current_phase: 3
current_phase_name: 持久化 key 与接缝文档
status: planning
stopped_at: Phase 02 complete, ready to plan Phase 3
last_updated: "2026-11-13T12:31:53.210Z"
last_activity: 2026-11-13
last_activity_desc: Phase 02 complete, transitioned to Phase 3
state_head: 865c92915a8d4cda33229aae005bc93c6acf8b6d
progress:
  total_phases: 3
  completed_phases: 2
  total_plans: 6
  completed_plans: 6
  percent: 67
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-11-13)

**Core value:** 无论启动顺序、仓库布局、服务器 URL 如何变化，Projects 侧栏都稳定显示「我的项目 × 本地 checkout」及其会话。
**Current focus:** Phase 02 — 每个本地 checkout 成行

## Current Position

Phase: 3 — 持久化 key 与接缝文档
Plan: Not started
Status: Ready to plan
Last activity: 2026-11-13 — Phase 02 complete, transitioned to Phase 3

Progress: [███████░░░] 67%

## Performance Metrics

**Velocity:**
- Total plans completed: 6
- Average duration: -
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01 | 4 | - | - |
| 02 | 2 | - | - |

**Recent Trend:**
- Last 5 plans: -
- Trend: -

*Updated after each plan completion*
**Per-Plan Metrics:**

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| Phase 01 P01 | 13m | 2 tasks | 3 files |
| Phase 01 P02 | 14m | 3 tasks | 5 files |
| Phase 01 P03 | 8min | 2 tasks | 3 files |
| Phase 01 P04 | - | 2 tasks | 3 files |
| Phase 02 P01 | 6min | 2 tasks | 2 files |
| Phase 02 P02 | 48min | 3 tasks | 4 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Roadmap]: 三个 phase 按身份层级切分（会话行源 → checkout 身份 → 持久化 key），而不是按文件切分；每个修复先有能失败的测试。
- [Roadmap]: 沿用 `createSessionInbox` 作为唯一数据源，通过参数/合并层收紧窗口，不新建会话缓存（见 PROJECT.md Revisit 项）。
- [Roadmap]: `known` 会话的取舍在 Phase 1 定案（仅索引窗口，或索引 + 按 `time.updated` 上界的 known 切片），Phase 2 不得再改行源。
- [Phase 01]: merge 的第一个参数就是抓取到的页面：数组（含空数组）代表页面已获取并据此定界，只有 undefined 才回退到 known 列表，首屏与离线行为不变 — TanStack Query 已区分 no data 与空页面，entries() 把该区别透传，无需新增 option 字段（关闭 truth 5/6 与 01-02 扩窗禁令）
- [Phase 01]: floor 只由最终能存活的 root 行推导（跳过 parentID 与归档行，种子为 +Infinity），过滤掉的行不能降低下限 — 同时关闭 REVIEW WR-01；空页面得到无人可及的下限，混合页面无法放宽窗口
- [Phase 01]: inbox-sessions 请求 archived: false，只取活跃 root，归档行不再占用 50 个索引槽 — 与服务端仅在该参数存在时过滤的实现一致（store.ts:160-161），也是 app 内其它 root 会话列表的既有约定（CR-01 / T-01-06）
- [Phase 01]: 空页面的下限取查询的 `dataUpdatedAt`（`fetchedAt`），不再用 `+∞`；只有页面无存活 root 时才启用，非空页面仍以存活行最小时间为准 — 抓取后新建的会话无需 refetch 即成行（truth 7 / CR-01），Inbox 仍不传 bound
- [Phase 02]: 进入 Projects 模式的清单读取用「组件体内 Set + worktrees.cached()」双保险：Set 挡同挂载期（含会话更新引发的 effect 重跑），cached 挡切走再切回（list 的 staleTime: 0 不判空必然重发）
- [Phase 02]: 清单读取只经 entry.ctx.sync.worktrees（按 ServerScope 分区）且只调 list；projects.tsx 中永不出现 refresh / global.serverCtx(，失败静默降级到 sandboxes 兜底，不重试、不 toast、不引入 loading
- [Phase 02]: Phase 2 的成功标准 4 选择「不显示」分支（D-10）：空 checkout 不生成行，行源仍由 inbox.entries() 推导；理由记入 docs/designs/project-grouped-sessions-sidebar.md §已知取舍 第 4 条
- [Phase 02]: 根集合显式包含 canonical：`sandboxes` 从不含 `project.worktree`，元数据也可能只带 canonical，缺这一项 `repo/packages/ui` 这类会话会退化成按会话目录成行
- [Phase 02]: 分组 key 表达式一字未改（`${server}\u0000${comparablePath(checkout)}`）：清单到达只改变归属选择，不改写已有 checkout 的身份（D-08）
- [Phase 02]: D-09 的缓存键用元数据对象（WeakMap）而非 `project.id`：`withWorktreeInventory` 会为同一 id 重写 `sandboxes`，按 id 记忆会让清单揭示的更深 checkout 永远不生效
- [Phase 02]: strobe 的 `--base origin/dev` 对 `projects-groups.ts` 不成立（上游无此文件，exp_eedb3c 无 verdict），改用 02-01 的 head `777504be9c`；加缓存前 cpu.work +1499%，加缓存后 +3%（CI -1%..+7%，无判定）

### Pending Todos

None yet.

### Blockers/Concerns

- [Phase 2] 改动仍落在侧栏重算热路径（`entries()`/`groups()`）：Phase 1 已用 strobe 对 `origin/dev` 建立 `session-index` 基线（verdict less），Phase 2 改动需同样度量。
- [Phase 2] `Project.worktrees` 初始只有 canonical，必须把「未加载」当正常状态处理，不能在渲染中 `refresh`。
- [全局] 不得重启应用或 sidecar 服务器进程；只能通过 dev 服务器（`bun dev serve --port 4096` + `packages/app` 的 `bun dev`）验证。
- [Phase 3] 迁移必须只读 v1、写 v2，禁止原地改写 v1，否则回退到旧构建会丢状态。

## Deferred Items

Items acknowledged and deferred at milestone close, most recent first:

| Category | Item | Status | Deferred At | Milestone |
|----------|------|--------|-------------|-----------|
| *(none)* | | | | |

## Session Continuity

Last session: 2026-11-13T08:43:22.789Z
Stopped at: Phase 02 complete, ready to plan Phase 3
Resume file: None
