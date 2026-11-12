---
gsd_state_version: "1.0"
milestone: v1.0
milestone_name: Projects 侧栏正确性
current_phase: 01
current_phase_name: 行源收敛
status: verifying
stopped_at: "Phase 01 re-verification gaps_found (11/14): truth 7 regression (post-fetch session dropped, CR-01) + CI lint gate (CR-02)"
last_updated: "2026-11-12T09:30:24.958Z"
last_activity: 2026-11-12
last_activity_desc: Phase 01 execution started
state_head: 6bb33d06b4582b797b5d74721b7cc3d495dff5c0
progress:
  total_phases: 3
  completed_phases: 0
  total_plans: 3
  completed_plans: 3
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-11-12)

**Core value:** 无论启动顺序、仓库布局、服务器 URL 如何变化，Projects 侧栏都稳定显示「我的项目 × 本地 checkout」及其会话。
**Current focus:** Phase 01 — 行源收敛

## Current Position

Phase: 01 (行源收敛) — EXECUTING
Plan: 3 of 3
Status: Phase complete — ready for verification
Last activity: 2026-11-12 — Phase 01 execution started

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

**Velocity:**
- Total plans completed: 0
- Average duration: -
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

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

### Pending Todos

None yet.

### Blockers/Concerns

- [Phase 1/2] 改动落在侧栏重算热路径（`entries()`/`groups()`）：按 `packages/app/AGENTS.md`，改会话/时间线热路径前需用 strobe 对 `origin/dev` 做基准。
- [Phase 2] `Project.worktrees` 初始只有 canonical，必须把「未加载」当正常状态处理，不能在渲染中 `refresh`。
- [全局] 不得重启应用或 sidecar 服务器进程；只能通过 dev 服务器（`bun dev serve --port 4096` + `packages/app` 的 `bun dev`）验证。
- [Phase 3] 迁移必须只读 v1、写 v2，禁止原地改写 v1，否则回退到旧构建会丢状态。
- Phase 01 verification gaps_found: inbox-sessions list omits archived:false, so archived rows consume the 50-slot page and the floor/restart parity break (CR-01)

## Deferred Items

Items acknowledged and deferred at milestone close, most recent first:

| Category | Item | Status | Deferred At | Milestone |
|----------|------|--------|-------------|-----------|
| *(none)* | | | | |

## Session Continuity

Last session: 2026-11-12T09:30:24.932Z
Stopped at: Phase 01 re-verification gaps_found (11/14): truth 7 regression (post-fetch session dropped, CR-01) + CI lint gate (CR-02)
Resume file: 01-VERIFICATION.md
