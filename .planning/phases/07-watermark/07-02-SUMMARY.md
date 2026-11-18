---
phase: 07-watermark
plan: 02
subsystem: ui
tags: [solidjs, createstore, watermark, workspace-sidebar, attention, persistence-removal]

requires:
  - phase: 07-01
    provides: 水位纯函数三件套 + 内存 watermarks createStore + SESSION_WATERMARK_AUTO_MAX 常量 + Show more/less 重接线

provides:
  - COLL-04 注意力自动抬升：requiredWatermark / raisedWatermark 纯函数（前 50 内 working/approval/input/unread/当前会话 → index + 1，只升不降）
  - sidebar.tsx render 期单调抬升 driver（untrack 隔离、严格大于才写、稳态零写入）+ session-row onStatusChange 上报（对齐 onWorkingChange 先例）
  - COLL-05 持久化层清零：ui-state.ts / ui-state.test.ts 删除，store.ts 的 createWorkspaceUiState 与 import 移除，workspace-sidebar-ui.v1 读写为零
  - workspace-registry.v1（createWorkspaceRegistry）原样保留，行为不变

affects: [verify-work, phase-07-acceptance]

actuals:
  tokens: 3900
  tasks: 2
  commits: 3

tech-stack:
  added: []
  patterns:
    - "COLL-04 attention lift: requiredWatermark(index, status, isActive) 纯谓词 + raisedWatermark(current, required) 单调半边；AUTO_MAX=50 上限只约束自动提升（边界等值含）"
    - "render 期单调抬升 driver：untrack 隔离读写同一 store，仅当 raisedWatermark 严格大于当前水位才 setRowWatermark——稳态零写入无信号churn"
    - "status 上报通道：SessionRow 经 onStatusChange 上报既有 status memo（复用 v2.1 裁决输出，不新造状态机），镜像 onWorkingChange 注册先例"

key-files:
  created: []
  modified:
    - packages/app/src/workspace-sidebar/sessions.ts
    - packages/app/src/workspace-sidebar/sessions.test.ts
    - packages/app/src/workspace-sidebar/sidebar.tsx
    - packages/app/src/workspace-sidebar/session-row.tsx
    - packages/app/src/workspace-sidebar/store.ts

key-decisions:
  - "status 信号走 onStatusChange 回调上报既有 row status memo（PATTERNS 落点二），不在 driver 里重算 sessionRowStatus 旗标——复用 v2.1 裁决输出，避免第二份状态推导"
  - "statuses store 无卸载清理：stale id 对 driver 无害（只查当前行内会话），且每服务端组件独立一份；对齐 working store 的内存惯例但不复制其 timer 清理需求"
  - "RED 证据沿用 07-01 惯例：stub 导出 + bun:test (pass)/(fail) 行转 TAP，targetTest 用完整发射名（requiredWatermark > ...），gsd check tdd-red-evidence 返回 RED_EVIDENCE_OK"

patterns-established:
  - "无写纪律的 render driver：先 untrack 读快照（{ ...statuses } spread 跟踪 key 集合），纯函数计算，比较通过才写——add-open-machine unchanged 先例的水位版"
  - "TAP 转换器一次性使用后删除，证据 JSON 留存 plan 目录"

requirements-completed: [COLL-04, COLL-05]

coverage:
  - id: D1
    description: "requiredWatermark 纯谓词：四种注意力状态 × 激活 × 索引边界（49/50/51，50 等值生效）× failed/idle 不抬升；raisedWatermark 单调不降低、相等返回当前值"
    requirement: "COLL-04"
    verification:
      - kind: unit
        ref: "packages/app/src/workspace-sidebar/sessions.test.ts#requiredWatermark / raisedWatermark describes (8 tests, 39 pass 0 fail 全文件)"
        status: pass
    human_judgment: false
  - id: D2
    description: "sidebar.tsx render 期单调抬升 driver + session-row onStatusChange 上报（JSX 驱动层，纯函数层已由 D1 证明）"
    requirement: "COLL-04"
    verification:
      - kind: unit
        ref: "bun check --no-script src/workspace-sidebar/{sessions,sidebar,session-row}.ts -> No type errors in 601 files"
        status: pass
      - kind: manual_procedural
        ref: "code-path inspection: driver 无无条件写分支（required === 0 continue + raised > watermark 才写）；untrack 隔离；session-row effect 仅在 status memo 变化时上报"
        status: pass
    human_judgment: true
    rationale: "端到端注意力抬升的实际渲染（working 会话入列自动可见、完成不回落）无组件级测试覆盖；plan 明确 dev 服务器手工验收在 07-02 之后的整体验收进行"
  - id: D3
    description: "ui-state 持久化层净删除（workspace-sidebar-ui.v1 读写为零，水位纯内存；workspace-registry.v1 行为不变）"
    requirement: "COLL-05"
    verification:
      - kind: unit
        ref: "packages/app/src/workspace-sidebar/store.test.ts 11 pass 0 fail + bun check --no-script store.ts -> No type errors in 600 files"
        status: pass
      - kind: manual_procedural
        ref: "grep gate: rg \"ui-state|UiState|workspace-sidebar-ui\" packages/app/src --glob *.ts --glob *.tsx -> zero hits（T-7-03 阻断性负门）"
        status: pass
    human_judgment: false

duration: 20min
completed: 2026-11-17
status: complete
commits: 3
plan_head_before: 5d10077790ded832ffd01c423d07d23fabb4303
plan_head_after: fb76d547156ed9f6fafd77eb37b19b85d401bdfe
---

# Phase 07 Plan 02: 注意力自动抬升 + 持久化层清零 Summary

**COLL-04 注意力水位纯函数（requiredWatermark/raisedWatermark，50 上限只约束自动提升）+ sidebar render 期单调抬升 driver（untrack 隔离、严格抬升才写、稳态零写入）+ COLL-05 净删除 workspace-sidebar-ui.v1 持久化层。**

## Performance

- **Duration:** 20 min
- **Started:** 2026-11-17T17:55:00Z
- **Completed:** 2026-11-17T18:14:52Z
- **Tasks:** 2
- **Files modified:** 5（+2 删除）

## TDD Gate Compliance

Task 1 为 `tdd="true"`（plan type 为 execute，workflow.tdd_mode=false，按项目 RED-commit 惯例执行）：

| Phase | 结果 |
|-------|------|
| RED | `fff6fd484b` test(07-02): add failing attention watermark table tests — 8 条新表测试对 stub 全部失败（not implemented），31 条既有测试不受影响 |
| GREEN | `e5137f36aa` feat(07-02): attention auto-raise pure functions + monotonic render driver (COLL-04) — 39 pass, 0 fail |
| REFACTOR | 无需 — GREEN 实现即最小形态（driver 直接以严格比较门控写入） |

**RED 证据：** `gsd check tdd-red-evidence .planning/phases/07-watermark/07-02-red-evidence.json` → `RED_EVIDENCE_OK`（target_test_failed）。bun:test 不输出 TAP，沿用 07-01 的一次性转换器将真实运行的 `(pass)/(fail)` 行转 TAP（转换器用完即删，证据 JSON 留存）。targetTest 必须取 TAP 中完整发射的测试名（`requiredWatermark > the ceiling boundary is inclusive: ...`），短名会判 `no_target_test_failure`。语义评估：目标测试因 stub 抛出 "not implemented" 而失败——特性缺失的预期失败，非夹具/加载错误。

## Accomplishments

- `requiredWatermark(index, status, isActive)`：index ≤ 50（含等值）且 status ∈ {working, approval, input, unread} 或 isActive 时返回 index + 1，否则 0——前 50 条内注意力会话与当前会话无需点击即可见（COLL-04）
- `raisedWatermark(current, required)`：只升不降的纯半边；required ≤ current 返回 current，driver 据此刻意跳过写（无信号churn）
- sidebar.tsx render 期单调抬升 driver：遍历各行 ready 会话按序索引取最大需求，`untrack` 隔离读写同一 watermarks store（sessions.load() effect 先例），仅当抬升值严格大于当前水位才 `setRowWatermark`；注意力会话完成、新会话入列均不降低水位——降低只发生在折叠行与 Show less
- session-row.tsx 新增 `onStatusChange` 可选 prop：createEffect 在 status memo 变化时上报 `(sessionID, status)`，镜像 onWorkingChange 注册模式；driver 复用 v2.1 `sessionRowStatus` 裁决输出，不新造状态机
- COLL-05 持久化层清零：`ui-state.ts` / `ui-state.test.ts` 删除（UI_STATE_KEY / WorkspaceUiSchema / reveal / conceal 及测试一并清除）；`store.ts` 移除 `createWorkspaceUiState`、ui-state import 块，模块 doc 注释改为只命名存活的 `workspace-registry.v1`；grep 负门（T-7-03）通过——`ui-state|UiState|workspace-sidebar-ui` 在 packages/app/src 零命中
- `createWorkspaceRegistry`（workspace-registry.v1）原样保留，registry 测试 11 pass 0 fail，持久化路径行为不变
- i18n 零新增 key、零新增依赖；模块内改动（packages/app/src/workspace-sidebar/），无 TUI/core/server 触碰

## Task Commits

1. **Task 1 RED: 注意力表测试** - `fff6fd484b` (test)
2. **Task 1 GREEN: 注意力纯函数 + 单调 driver** - `e5137f36aa` (feat)
3. **Task 2: 移除 revealed 持久化层** - `fb76d54715` (feat)

_TDD 任务产生 2 个提交（RED → GREEN），REFACTOR 无变更未提交。_

## Files Created/Modified

- `packages/app/src/workspace-sidebar/sessions.ts` — 新增 requiredWatermark / raisedWatermark（替换 RED stub）；import SessionRowStatus 类型
- `packages/app/src/workspace-sidebar/sessions.test.ts` — 新增 requiredWatermark（5 表测试：注意力四态 × 激活 × 49/50/51 边界 × failed/idle 不抬升）与 raisedWatermark（3 表测试：单调性）
- `packages/app/src/workspace-sidebar/sidebar.tsx` — statuses 内存 store + setSessionStatus；render 期单调抬升 driver effect（untrack + 严格比较门控）；WorkspaceRow/SessionRow 的 onStatusChange 接线
- `packages/app/src/workspace-sidebar/session-row.tsx` — onStatusChange 可选 prop + 上报 effect（status memo 变化才触发）
- `packages/app/src/workspace-sidebar/store.ts` — 删除 createWorkspaceUiState 与 ui-state import；doc 注释只描述 workspace-registry.v1
- `packages/app/src/workspace-sidebar/ui-state.ts` / `ui-state.test.ts` — **已删除**（113 行净删除）

## Decisions Made

- status 信号选 onStatusChange 回调上报（PATTERNS 落点二）而非 driver 内重算旗标：复用 row 组件既有 status memo（v2.1 裁决输出），不复制 sessionRequests/sessionBusy/unread 推导
- statuses store 不做卸载清理：stale id 对 driver 不可见（只查行内现存会话），避免每次状态变化产生 undefined→新值的双写抖动
- RED 证据 targetTest 用 TAP 完整发射名（含 describe 前缀 `>` 连接符），短模块名无法过分类器

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- tdd-red-evidence 分类器对 targetTest 要求 TAP 中完整发射的测试名（首次用短名 `requiredWatermark` 判 `no_target_test_failure`），修正证据 JSON 后 `RED_EVIDENCE_OK`——纯证据记录格式问题，未影响实现
- pwsh 环境下 `gsd_run`/`sh` 不在 PATH：经 `node C:\Users\theso\.config\opencode\gsd-core\bin\gsd-tools.cjs` 调用等价 verb，行为一致

## Authentication Gates

None.

## Known Stubs

无。requiredWatermark / raisedWatermark 均为真实实现；SESSION_WATERMARK_AUTO_MAX 自 07-01 起即为真实常量。

## Threat Flags

无新增信任边界（plan threat_model 已声明无新增）。T-7-03 阻断性 grep 负门通过；T-7-04 的 untrack 隔离 + 严格比较零写入在 driver 代码路径中落实。

## Next Phase Readiness

- Phase 7 四条 success criteria 全部满足（COLL-03/04/05 + 内存态不持久化），可进入整体验收：dev 服务器手工验证（`bun dev serve --port 4096` + `packages/app` 下 `bun dev -- --port 4444`）+ 全模块测试复跑
- 手工验收要点：前 50 条内 working/approval/input/unread/当前会话自动可见、只升不降、折叠行与 Show less 回基线 5、刷新后所有行回基线

## Self-Check: PASSED

- 文件存在：sessions.ts / sessions.test.ts / sidebar.tsx / session-row.tsx / store.ts 均已修改并提交；ui-state.ts / ui-state.test.ts 已删除（git rm，提交 fb76d54715 含 2 个删除）
- 提交存在：fff6fd484b / e5137f36aa / fb76d54715 均为 HEAD 祖先（git rev-list --count plan_head_before..HEAD = 3，与 measured commits 一致）
- 复验：workspace-sidebar 全模块 140 pass 0 fail（5 文件）；bun check --no-script 文件级门零错误（601/600 files）；grep 负门零命中；plan-level verification 全部通过

---
*Phase: 07-watermark*
*Completed: 2026-11-17*

---

## Post-delivery amendments (2026-11-18, user-directed)

Three semantic corrections landed after this plan's execution, per the user's clarifications (the original milestone brief is authoritative over dsh source details):

1. **Unread sessions do not raise the watermark** — auto-raise covers working / approval / input / active only (commit `adb828a864`).
2. **No "Show less" button** — the reveal button disappears at full expansion; collapse is folder-fold only (commit `6f8627c257`).
3. **Fold reset targets max(5, attention requirement)** — a reset is stable against the monotonic re-lift (commit `ff1b92d019`).

Final verification: 4/4 success criteria, 146 module tests green, user-validated in the OpenCode Test desktop package (see 07-VERIFICATION.md).
