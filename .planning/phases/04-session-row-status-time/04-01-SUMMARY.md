---
phase: 04-session-row-status-time
plan: 1
subsystem: ui
tags: [solidjs, state-machine, i18n, semantic-tokens, workspace-sidebar]

# Dependency graph
requires:
  - phase: 02-sidebar-render
    provides: workspace-sidebar 模块（sidebar.tsx 渲染、sessions.ts 行数据、store.ts 持久化）
provides:
  - 纯状态裁决 sessionRowStatus（failed > approval > input > working > unread > idle）
  - 纯时间分桶 elapsedBucket（now / minutes / hours / days）
  - 纯标记映射 statusMark（图标 + text-v2-state-fg-* 语义 token）
  - SessionRow 行组件（状态标记 + 相对时间 + 既有菜单行为）
  - sidebar body 级双粒度时钟 driver（working 秒级 / 其余分钟级）
affects: [workspace-sidebar, session-row]

# Actuals (#2632)
actuals:
  tokens: 11000
  tasks: 3
  commits: 4

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "纯派生模块 session-status.ts：状态/时间/标记三纯函数，组件只读派生"
    - "body 级共享时钟 + 行注册 working（onCleanup 注销），无 working 无秒级 interval"

key-files:
  created:
    - packages/app/src/workspace-sidebar/session-status.ts
    - packages/app/src/workspace-sidebar/session-status.test.ts
    - packages/app/src/workspace-sidebar/session-row.tsx
  modified:
    - packages/app/src/workspace-sidebar/sidebar.tsx

key-decisions:
  - "failed 不要求 unread：outcome === failed 即标记（按 v2.1 默认值，优先级高于蓝本）"
  - "unread 用 check/success 标记（语义=有未读产出），sr-only 标签复用 sidebar.inbox.status.done"
  - "零新增 i18n key：复用 sidebar.inbox.time.now / sidebar.inbox.elapsed.* / sidebar.inbox.status.*"
  - "标记渲染从 statusMark 派生（单一真相），ring 内联 var(--v2-state-fg-info)"

patterns-established:
  - "行组件改造纪律：复制 ProjectSessionRow 行为、import 其 RenameDialog，upstream 文件零改动"
  - "双粒度时钟：minute interval 常驻 body，second interval 只在 working 计数 >0 的 effect 内"

requirements-completed: [TIME-01, TIME-02, STAT-01, STAT-02, STAT-03]

coverage:
  - id: D1
    description: "状态优先级裁决（failed > approval > input > working > unread > idle）为纯函数"
    requirement: "STAT-02"
    verification:
      - kind: unit
        ref: "packages/app/src/workspace-sidebar/session-status.test.ts#sessionRowStatus"
        status: pass
    human_judgment: false
  - id: D2
    description: "相对时间分桶（<60s now、<60m、<24h、否则天）含边界与未来钳制"
    requirement: "TIME-01"
    verification:
      - kind: unit
        ref: "packages/app/src/workspace-sidebar/session-status.test.ts#elapsedBucket"
        status: pass
    human_judgment: false
  - id: D3
    description: "状态→图标/颜色映射（语义 token）"
    requirement: "STAT-03"
    verification:
      - kind: unit
        ref: "packages/app/src/workspace-sidebar/session-status.test.ts#statusMark"
        status: pass
    human_judgment: false
  - id: D4
    description: "行渲染：标记 + 11px tabular-nums 时间标签 + sr-only 状态名，零新增 i18n key"
    requirement: "STAT-01"
    verification:
      - kind: unit
        ref: "packages/app/src/workspace-sidebar/session-status.test.ts（派生模块契约）；bun check --no-script 0 诊断"
        status: pass
      - kind: manual_procedural
        ref: "bun dev 视觉验证（下文 VERIFICATION.md 人工项）"
        status: unknown
    human_judgment: true
    rationale: "像素级观感（标记位置、截断、颜色观感）需人眼确认；自动化只证明类型与契约"
  - id: D5
    description: "双粒度时钟：working 秒级、其余分钟级、无 working 无秒级 interval"
    requirement: "TIME-02"
    verification:
      - kind: manual_procedural
        ref: "bun dev：制造 working 会话观察 1m→秒级刷新；bun check 0 诊断"
        status: unknown
    human_judgment: true
    rationale: "interval 生命周期是运行时行为，单测未覆盖组件生命周期，需人工观察"

# Metrics
duration: 25min
completed: 2026-11-17
status: complete
---

# Phase 4: 会话行状态与时间标签 Summary

**workspace-sidebar 新行组件 SessionRow：五态状态标记（语义 token 颜色）+ now/Nm/Nh/Nd 相对时间标签，双粒度时钟 driver（working 秒级、其余分钟级），upstream shell/titlebar 零改动**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-11-17T09:30:00Z
- **Completed:** 2026-11-17T09:55:00Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments
- `session-status.ts` 三纯函数（裁决/分桶/标记）由 25 个修复前失败的用例钉住
- `session-row.tsx` 从 ProjectSessionRow 改造：状态标记 + 时间标签 + 完整保留 context menu
- `sidebar.tsx` 双粒度时钟：minute 常驻、second 仅 working 时运行，行经 onWorkingChange 注册

## Task Commits

Each task was committed atomically:

1. **Task 1: 纯状态裁决与时间分桶** - `652068b7a7` (feat)
2. **Task 2: 会话行组件 session-row.tsx** - `1ccdc13928` (feat)
3. **Task 3: 双粒度时钟 driver 与接线** - `c5085ab689` (feat)

**Plan metadata:** `b0541719da` (docs: phase contexts and plans)

## Files Created/Modified
- `packages/app/src/workspace-sidebar/session-status.ts` - 纯函数：sessionRowStatus / elapsedBucket / statusMark
- `packages/app/src/workspace-sidebar/session-status.test.ts` - 25 用例：优先级组合、时间边界、标记映射
- `packages/app/src/workspace-sidebar/session-row.tsx` - 行组件：状态派生、标记、时间标签、菜单
- `packages/app/src/workspace-sidebar/sidebar.tsx` - 时钟 store + working 注册 + SessionRow 接线

## Decisions Made
- failed 不要求 unread（v2.1 默认值优先于蓝本）
- unread → check/success（有未读产出），sr-only 复用 sidebar.inbox.status.done
- 组件渲染从 statusMark 派生，保持图标/颜色单一真相

## Deviations from Plan

**1. [计划内裁量] setWorking 保留 false 值而非删 key**
- **Found during:** Task 3
- **Issue:** solid-js/store 类型不接受 `undefined` 作为 boolean path 的 setter 值
- **Fix:** `setWorking(sessionID, value)` 直接写布尔；`anyWorking` 用 `.some(Boolean)` 判定
- **Files modified:** packages/app/src/workspace-sidebar/sidebar.tsx
- **Verification:** type gate 0 诊断；测试全绿
- **Committed in:** c5085ab689

---

**Total deviations:** 1 auto-fixed（类型约束）
**Impact on plan:** 无行为差异，语义等价。

## Issues Encountered
- 无

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 5 可在 sidebar.tsx 继续叠加（add-open machine driver + 折叠 UI）；行组件 props 已稳定。
- 人工项：bun dev 视觉验证标记/时间标签观感（VERIFICATION.md 记录）。

---
*Phase: 04-session-row-status-time*
*Completed: 2026-11-17*
