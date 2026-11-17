---
phase: 05-add-open-and-collapse
plan: 1
subsystem: ui
tags: [solidjs, state-machine, persistence, i18n, workspace-sidebar]

# Dependency graph
requires:
  - phase: 02-sidebar-render
    provides: workspace-sidebar 模块（sidebar.tsx、sessions.ts、store.ts persisted 模式）
  - phase: 04-session-row-status-time
    provides: SessionRow / 时钟（本计划不改动其 props 与行为）
provides:
  - add-open-machine.ts（NAV-01 纯状态机 + attempt 防陈旧 + 10s 超时静默失败）
  - sidebar.tsx 机器 driver（watch effect 归 awaiting 态所有、open actions 在边缘）
  - ui-state.ts（workspace-sidebar-ui.v1 持久化 + 纯 reveal/conceal）
  - 折叠 UI（默认 5 条、Show N more / Show less、展开态按 rowKey 持久化）
affects: [workspace-sidebar]

# Actuals (#2632)
actuals:
  tokens: 14000
  tasks: 3
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "状态驱动 watch：嵌套 effect 归 awaiting 态所有，re-run 即 dispose，无需手工 watch.stop driver"
    - "机器 effect 声明式表达（watch.start/stop），driver 只消费 open.* effects"

key-files:
  created:
    - packages/app/src/workspace-sidebar/add-open-machine.ts
    - packages/app/src/workspace-sidebar/add-open-machine.test.ts
    - packages/app/src/workspace-sidebar/ui-state.ts
    - packages/app/src/workspace-sidebar/ui-state.test.ts
  modified:
    - packages/app/src/workspace-sidebar/sessions.ts
    - packages/app/src/workspace-sidebar/sessions.test.ts
    - packages/app/src/workspace-sidebar/store.ts
    - packages/app/src/workspace-sidebar/sidebar.tsx
    - packages/app/src/runtime/i18n/en.ts

key-decisions:
  - "watch 生命周期用「状态驱动的嵌套 effect」实现：awaiting 态的 effect 每次运行创建 watch effect 与 timeout，re-run/dispose 自动清理，watch.start/stop 无需 driver 动作"
  - "open.recent 的会话在 driver 侧按 id 从就绪行内回查全量 SessionInfo（机器只传 Pick<SessionInfo, 'id'>，保持可测的结构化参数）"
  - "展开态存 revealed 数组（默认收起）；行移除后残留 key 无害，重登记自然继承"

patterns-established:
  - "纯 reveal/conceal 引用守卫（与 withTitle 同风格）：不变返回原引用，persisted 零写入"

requirements-completed: [NAV-01, COLL-01, COLL-02]

coverage:
  - id: D1
    description: "Add-folder 跳转状态机：registered→awaiting→opening/ failed 迁移、attempt 防陈旧、超时静默、dispose 清理"
    requirement: "NAV-01"
    verification:
      - kind: unit
        ref: "packages/app/src/workspace-sidebar/add-open-machine.test.ts#transitionAddOpen"
        status: pass
    human_judgment: false
  - id: D2
    description: "注册成功后行自动展开并打开最近会话或新建 draft（driver 接线）"
    requirement: "NAV-01"
    verification:
      - kind: unit
        ref: "add-open-machine.test.ts（迁移契约）；bun check --no-script 0 诊断"
        status: pass
      - kind: manual_procedural
        ref: "bun dev：Add local folder 观察自动展开 + 打开"
        status: unknown
    human_judgment: true
    rationale: "打开动作依赖真实目录选择器与 tabs 系统，自动化未覆盖端到端"
  - id: D3
    description: "折叠：默认 5 条、Show N more / Show less、≤5 条无折叠 UI"
    requirement: "COLL-01"
    verification:
      - kind: unit
        ref: "packages/app/src/workspace-sidebar/sessions.test.ts#shownSessions / hiddenSessionCount"
        status: pass
      - kind: manual_procedural
        ref: "bun dev：>5 条会话的行渲染"
        status: unknown
    human_judgment: true
    rationale: "按钮渲染与观感需人眼确认"
  - id: D4
    description: "展开态按 rowKey 持久化（workspace-sidebar-ui.v1），重启保持"
    requirement: "COLL-02"
    verification:
      - kind: unit
        ref: "packages/app/src/workspace-sidebar/ui-state.test.ts#reveal / conceal / persistence shape"
        status: pass
    human_judgment: false

# Metrics
duration: 30min
completed: 2026-11-17
status: complete
---

# Phase 5: Add-folder 跳转与会话列表折叠 Summary

**Add folder 后自动展开并打开会话（add-open 纯状态机 + 状态驱动 watch driver）；会话列表默认 5 条 + Show more/less，展开态持久化到 workspace-sidebar-ui.v1**

## Performance

- **Duration:** ~30 min
- **Started:** 2026-11-17T10:00:00Z
- **Completed:** 2026-11-17T10:30:00Z
- **Tasks:** 3
- **Files modified:** 9

## Accomplishments
- `add-open-machine.ts`：10 个用例钉住迁移序列、attempt 防陈旧、超时静默、dispose
- `sidebar.tsx` driver：注册 → 行展开 → awaiting watch（嵌套 effect + 10s timeout）→ 开最近/新建 draft
- 折叠：默认 5 条、Show N more（plural）/ Show less、展开态按 rowKey 持久化并保持

## Task Commits

1. **Task 1: add-open-machine.ts 纯状态机** - `3b51b3c279` (feat)
2. **Task 2: ui-state 持久化、折叠 helpers 与 i18n key** - `2e432cf6f3` (feat)
3. **Task 3: sidebar.tsx 接线** - `cf231a7471` (feat；含机器 lint 修正)

**Plan metadata:** `b0541719da` (docs: phase contexts and plans)

## Files Created/Modified
- `packages/app/src/workspace-sidebar/add-open-machine.ts` / `.test.ts` - NAV-01 纯状态机（10 用例）
- `packages/app/src/workspace-sidebar/ui-state.ts` / `.test.ts` - workspace-sidebar-ui.v1 schema/target + 纯 reveal/conceal
- `packages/app/src/workspace-sidebar/sessions.ts` / `.test.ts` - shownSessions / hiddenSessionCount / SESSIONS_PER_PROJECT
- `packages/app/src/workspace-sidebar/store.ts` - createWorkspaceUiState
- `packages/app/src/workspace-sidebar/sidebar.tsx` - 机器 driver、折叠 UI、ui-state 接线
- `packages/app/src/runtime/i18n/en.ts` - +3 key（more.one/more.other/less）

## Decisions Made
- watch 生命周期用状态驱动嵌套 effect 实现（见 key-decisions）
- 机器事件用结构化 Pick<SessionInfo,"id">，driver 回查全量会话

## Deviations from Plan

**1. [规则收紧] transitionAddOpen 返回类型改命名契约 `AddOpenResult`**
- **Found during:** Task 3 lint 门禁
- **Issue:** anti-slop(no-known-value-widening) 拒绝匿名对象返回类型；`effects: [] as AddOpenEffect[]` 需要 SAFETY 注释
- **Fix:** 命名 `AddOpenResult` 类型；`unchanged` 直接返回空数组字面量
- **Files modified:** packages/app/src/workspace-sidebar/add-open-machine.ts
- **Verification:** lint 0 problem、type gate 0 诊断、测试全绿
- **Committed in:** cf231a7471

**2. [计划内裁量] onRevealMore/onRevealLess 两个回调**
- 与计划一致；Show less 仅在 revealed 且 >5 条时渲染。

---

**Total deviations:** 1 auto-fixed（lint 规则）+ 1 计划内裁量
**Impact on plan:** 无行为差异。

## Issues Encountered
- 无

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- v2.1 全部 phase 完成；遗留人工项：Add folder 端到端与 >5 条折叠 UI 的观感（VERIFICATION.md 记录）。

---
*Phase: 05-add-open-and-collapse*
*Completed: 2026-11-17*
