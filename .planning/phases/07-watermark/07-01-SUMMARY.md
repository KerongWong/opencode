---
phase: 07-watermark
plan: 01
subsystem: ui
tags: [solidjs, createstore, watermark, workspace-sidebar, i18n-reuse]

requires:
  - phase: 05-sessions
    provides: 会话列表折叠渲染、Show more/less 按钮骨架与 i18n key（sidebar.workspace.sessions.more/.less）
  - phase: 02-01
    provides: createWorkspaceSessions 行投影、ui.expanded 内存 store 与 toggle 折叠先例

provides:
  - COLL-03 水位纯函数三件套：nextWatermark / remainingHidden / shownByWatermark + SESSION_WATERMARK_BASE(5) / SESSION_WATERMARK_AUTO_MAX(50)
  - sidebar.tsx 内存 watermarks createStore（组件生命周期、零持久化）+ Show more/less 重接线（count=剩余隐藏数、aria-expanded）
  - 折叠工作区行重置该行水位（COLL-05 折叠分支）
  - ui-state 持久化消费侧拆除（createWorkspaceUiState 接线与 import 移除；模块本体 07-02 删除）

affects: [07-02-watermark-auto-raise, workspace-sidebar, verify-work]

actuals:
  tokens: 3300
  tasks: 2
  commits: 5

tech-stack:
  added: []
  patterns:
    - "COLL-03 watermark: 基线 5 / +5 增量 / 剩余 ≤5 一步全展开（边界等值含）/ Show less 一步回基线（删 key = 基线缺省）"
    - "undefined-deletes-key store 惯例（setRowWatermark 对齐 setRowWorking）"
    - "TDD RED：stub 导出使测试可编译并在断言路径上失败，bun:test 输出转 TAP 过 tdd-red-evidence 门"

key-files:
  created: []
  modified:
    - packages/app/src/workspace-sidebar/sessions.ts
    - packages/app/src/workspace-sidebar/sessions.test.ts
    - packages/app/src/workspace-sidebar/sidebar.tsx

key-decisions:
  - "水位 store 类型用 Record<string, number | undefined>（对齐 setRowWorking 的 boolean | undefined 先例），undefined 写入即删 key；plan 文本写 Record<string, number>，| undefined 是类型正确化的既有惯例落地"
  - "RED 证据：stub 导出（throw not implemented）使 9 条水位表测试编译并在真实断言路径失败，bun:test 的 (pass)/(fail) 行转 TAP 后 gsd check tdd-red-evidence 返回 RED_EVIDENCE_OK（语义评估：目标测试因特性缺失抛错，属预期 stub-RED）"
  - "Show less 传 undefined 删 key（效果 = 重置基线 5），与折叠重置同一删除惯例，store 随之收缩"

patterns-established:
  - "水位纯函数全部走参数、无测试专用 seam；early-return if-chain、无 else、无 any"
  - "count 语义：language.plural(\"sidebar.workspace.sessions.more\", remainingHidden(...))，i18n key 与文案零变更"

requirements-completed: [COLL-03, COLL-05]

coverage:
  - id: D1
    description: "水位纯函数语义：基线 5、+5 步进、剩余=5 恰好一步全展开、少于 5 一步全展开、永不回退、total ≤ 基线不动、Show less 回基线、remainingHidden 钳制、shownByWatermark 切片"
    requirement: "COLL-03"
    verification:
      - kind: unit
        ref: "packages/app/src/workspace-sidebar/sessions.test.ts#watermark describe (9 tests)"
        status: pass
    human_judgment: false
  - id: D2
    description: "sidebar.tsx 内存水位 store + 按钮重接线 + 折叠重置（JSX 驱动层，纯函数层已由 D1 证明）"
    requirement: "COLL-05"
    verification:
      - kind: unit
        ref: "bun check --no-script src/workspace-sidebar/sidebar.tsx src/workspace-sidebar/sessions.ts -> No type errors in 601 files"
        status: pass
      - kind: manual_procedural
        ref: "grep: sidebar.tsx 无 shownSessions/hiddenSessionCount 命中；watermark store 无 persist 调用；done-criterion 逐项核对"
        status: pass
    human_judgment: true
    rationale: "端到端点击行为（基线→+5→全展开→Show less 的实际渲染与 count 显示）无组件级测试覆盖，且 plan 明确手工 dev 验证在 07-02 之后的整体验收进行"
  - id: D3
    description: "ui-state 持久化消费侧拆除（createWorkspaceUiState 实例化与 import 移除）"
    requirement: "COLL-05"
    verification:
      - kind: unit
        ref: "bun check --no-script file gate pass + grep createWorkspaceUiState 在 sidebar.tsx 零命中"
        status: pass
    human_judgment: false

duration: 8min
completed: 2026-11-17
status: complete
commits: 4
plan_head_before: 83b85036a121d0db8958c38305e58c786e7d6a5a
plan_head_after: 3456cf4970
---

# Phase 07 Plan 01: 会话列表水位线（核心切片）Summary

**dsh 式分批水位替换二元持久化展开：nextWatermark 纯函数（基线 5 / +5 / 剩余 ≤5 一步全展开）+ sidebar.tsx 内存 createStore + Show more/less 重接线（count=剩余隐藏数）+ 折叠行重置。**

## Performance

- **Duration:** 8 min
- **Started:** 2026-11-17T17:55:45Z
- **Completed:** 2026-11-17T18:04:09Z
- **Tasks:** 2
- **Files modified:** 3

## TDD Gate Compliance

Task 1 为 `tdd="true"`（plan type 为 execute，workflow.tdd_mode=false，按项目 RED-commit 惯例执行）：

| Phase | 结果 |
|-------|------|
| RED | `a09fca9c7c test(07-01): add failing watermark table tests (RED)` — 9 条水位表测试对 stub 全部失败，22 条既有测试不受影响 |
| GREEN | `6b4706b241 feat(07-01): watermark pure functions replace binary reveal semantics (COLL-03)` — 31 pass, 0 fail |
| REFACTOR | 无需 — GREEN 实现即最小形态，无额外清理 |

**RED 证据：** `gsd check tdd-red-evidence .planning/phases/07-watermark/07-01-red-evidence.json` → `RED_EVIDENCE_OK`（target_test_failed）。bun:test 不输出 TAP，用一次性转换器将真实运行的 `(pass)/(fail)` 行转 TAP 后入库（转换器已清理，记录文件留存）。语义评估：目标测试因 stub 抛出 "not implemented" 而失败——特性缺失的预期失败，非夹具/加载错误。

## Accomplishments

- COLL-03 点击语义落地为纯函数：`nextWatermark` 基线 5、每次 +5、剩余 ≤5（含恰好 5）一步全展开到 total、已全展开或 total ≤ 基线时不动、永不返回小于 current 的值
- `remainingHidden(total, watermark)` 钳制为零的剩余隐藏数——按钮 count 新语义；`shownByWatermark` 切片
- sidebar.tsx 内存 `watermarks` createStore（`Record<string, number | undefined>`，组件生命周期，无 Persist/persisted 读写）；`watermark()` 缺省读基线，`setRowWatermark(key, undefined)` 删 key（setRowWorking 惯例）
- "Show N more"（`remainingHidden > 0` 时渲染，`aria-expanded={false}`）/ "Show less"（`watermark ≥ total && total > 基线`，`aria-expanded={true}`，点击删 key 一步回基线）
- `toggle` 折叠分支（`next === false`）重置该行水位（COLL-05）
- ui-state 消费侧拆净：删除 `createWorkspaceUiState` 实例化与 import；`ui-state.ts` 模块本体留 07-02 删除
- i18n 零新增 key：`sidebar.workspace.sessions.more.one/.other`、`sidebar.workspace.sessions.less` 复用，英文文案 byte-for-byte 不变

## Task Commits

1. **Task 1 RED: 水位表测试** - `a09fca9c7c` (test)
2. **Task 1 GREEN: 水位纯函数替换二元语义** - `6b4706b241` (feat)
3. **Task 2: 内存水位 store + Show more/less 重接线 + 折叠重置** - `a69878cf17` (feat)

_TDD 任务产生 2 个提交（RED → GREEN），REFACTOR 无变更未提交。_

## Files Created/Modified

- `packages/app/src/workspace-sidebar/sessions.ts` — 删除 shownSessions/hiddenSessionCount/SESSIONS_PER_PROJECT；新增 SESSION_WATERMARK_BASE/AUTO_MAX 常量与 nextWatermark/remainingHidden/shownByWatermark
- `packages/app/src/workspace-sidebar/sessions.test.ts` — 二元 describe 块整段重写为 9 条水位表测试
- `packages/app/src/workspace-sidebar/sidebar.tsx` — watermarks store + helper、toggle 折叠重置、按钮重接线、ui-state 消费侧拆除

## Decisions Made

- 水位 store 值类型带 `| undefined`（setRowWorking 先例），undefined 写入即删 key——plan 文本的 `Record<string, number>` 在此惯例下类型不严
- RED 阶段加 stub 导出使测试编译、在断言路径失败（tdd 参考对 "symbol does not exist" 的明确修法），RED 提交因此含测试 + stub + 常量，旧二元函数保留至 GREEN 删除
- Show less 与折叠重置共用 "删 key = 回基线" 路径，不引入第二个重置机制

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] bun:test 无 TAP 输出，RED 证据门无法直接验收**
- **Found during:** Task 1 RED 阶段
- **Issue:** `gsd check tdd-red-evidence` 只接受 TAP/JUnit 等标准报告；bun:test 默认输出无法解析，且初版记录因模块加载错误（export 不存在）被判 `INVALID_RED (no_target_test_failure)`
- **Fix:** 按 tdd.md 参考的 "make the test compile and fail on its assertion" 修法，在 RED 提交中加入抛出 "not implemented" 的 stub 导出；用一次性转换器将真实运行输出转 TAP 重跑，`RED_EVIDENCE_OK`。转换器脚本用完即删，证据 JSON 留存于 plan 目录
- **Files modified:** packages/app/src/workspace-sidebar/sessions.ts（stub，GREEN 中替换为真实实现）、.planning/phases/07-watermark/07-01-red-evidence.json（新增证据记录）
- **Verification:** 分类器 verdict `RED_EVIDENCE_OK`；GREEN 后 31 pass 0 fail
- **Committed in:** a09fca9c7c（RED）、6b4706b241（GREEN）

---

**Total deviations:** 1 auto-fixed (1 blocking/工具链适配)
**Impact on plan:** 纯执行纪律适配，无行为偏差；实现与 plan action 逐条一致。

## Issues Encountered

None - 其余流程按计划执行。

## Authentication Gates

None.

## Known Stubs

无。SESSION_WATERMARK_AUTO_MAX 已导出为真实常量（备 07-02），非桩。

## Threat Flags

无新增信任边界（plan threat_model 已声明无新增；T-7-01/T-7-02 accept 条目不变）。

## Next Phase Readiness

- 07-02 可直接消费：三个纯函数 + 内存 store + `SESSION_WATERMARK_AUTO_MAX` 均已就位；注意力自动抬升（render 期单调提升 driver）从已验证切片扩展
- `ui-state.ts` / `store.ts` 的 `createWorkspaceUiState` 本体与 `ui-state.test.ts` 已无消费侧引用，07-02 可整模块删除
- 手工 dev 端到端验收（点击语义、count 显示）按 plan 安排在 07-02 之后整体验收

## Self-Check: PASSED

- 文件存在：packages/app/src/workspace-sidebar/{sessions.ts, sessions.test.ts, sidebar.tsx} 均已修改并提交
- 提交存在：a09fca9c7c / 6b4706b241 / a69878cf17 均为 HEAD 祖先（git merge-base --is-ancestor 通过）
- 复验：水位表测试 31 pass 0 fail；bun check --no-script 文件级门零错误；done-criterion grep 零命中旧二元名

---
*Phase: 07-watermark*
*Completed: 2026-11-17*
