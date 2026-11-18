---
phase: 06-composer
plan: 01
subsystem: ui
tags: [session-ui, solidjs, mention-label, path-suffix, i18n-free]

requires:
  - phase: 05-sidebar
    provides: session-ui 包内纯函数 + colocated bun:test 惯例（agent-label 模板）
provides:
  - mentionLabels(paths) 纯函数（basename + 作用域内最短区分后缀，dsh path-suffix 段窗口语义移植）
  - @opencode/session-ui/mention-label 包导出
  - 已发消息 file mention 渲染缩短（显示 basename/区分后缀，title 携带全路径）
affects: [MENT-01 composer 侧接线（06-02）、verify-work UAT]

actuals:
  tokens: 1400        # chars/4 over realized diff（125 insertions + 2 deletions，远低于 estimate 42000——纯函数+单测实际很小）
  tasks: 2
  commits: 3
  plan_head_before: d2605f6841780707813716e5b6936bf3da37f74c
  plan_head_after: 2cbc218ac7db59c5a9f5a0a3859bbffcb898d0a0

tech-stack:
  added: []
  patterns:
    - "basename 分组消歧：按 getFilename(path) 分组而非 dsh 的 title 分组"
    - "双轨显示：渲染节点替换显示文本，正文/剪贴板/wire 永远全路径"

key-files:
  created:
    - packages/session-ui/src/message/mention-label.ts
    - packages/session-ui/src/message/mention-label.test.ts
  modified:
    - packages/session-ui/src/message/message-content.tsx
    - packages/session-ui/package.json

key-decisions:
  - "props.files 无 path 字段（PromptAttachment = FileAttachment | MediaFileAttachment）：labels 作用域改由 file.mention.text.slice(1) 派生，与 segment.text.slice(1) 查键同源同值"
  - "段窗口增长的 while 循环属算法固有（dsh 原版即 while），保留；其余全部函数式数组方法"

patterns-established:
  - "mention-label.ts 遵循 agent-label 纯函数模块惯例：单文件单命名导出、无 Solid/DOM 依赖、colocated bun:test、相对路径 import"
  - "显示缩短 + 原生 title 暴露全路径，零新 i18n key、零新 CSS 规则（UI-SPEC E2/E4 契约）"

requirements-completed: [MENT-02]

coverage:
  - id: D1
    description: "mentionLabels 纯函数：无同名→basename；同名→最短区分后缀（含三同名链式、混和分隔符、根路径回退、大小写不折叠全矩阵）"
    requirement: "MENT-02"
    verification:
      - kind: unit
        ref: "packages/session-ui/src/message/mention-label.test.ts#9 tests"
        status: pass
    human_judgment: false
  - id: D2
    description: "已发消息 data-highlight=\"file\" segment 显示 basename/区分后缀，外层 span title 为完整路径（不含 @）；agent/link 分支、剪贴板、正文不变"
    requirement: "MENT-02"
    verification:
      - kind: unit
        ref: "cd packages/session-ui && bun test src（626 pass）+ bun run typecheck（381 files 无错误）"
        status: pass
    human_judgment: true
    rationale: "JSX 接线本身无组件级断言覆盖（本计划未要求 component test）；缩短渲染观感需人眼确认"

duration: 12min
completed: 2026-11-17
status: complete
---

# Phase 06 Plan 01: @ 引用短路径（已发消息）Summary

**mentionLabels 纯函数（basename + 同消息最短区分后缀）落地 session-ui 并接线已发消息渲染：file segment 显示缩短名、原生 title 携带全路径，正文/剪贴板/wire 分毫不动（MENT-02 垂直切片）**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-11-17T22:28:42Z
- **Completed:** 2026-11-17T22:41:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- `mentionLabels` 纯函数：dsh `distinguishingPathSuffixes()` 段窗口语义按 basename 分组移植，9 条契约用例全绿
- `CurrentHighlightedText` 接线：file segment 显示 label（查不到回退原文）、外层 span `title` 全路径；agent/link 分支、segment 切分、剪贴板、正文零改动
- session-ui `exports` 注册 `./mention-label`，App 侧 `@opencode/session-ui/mention-label` 已可解析（为 MENT-01 composer 接线备好）

## Task Commits

Each task was committed atomically:

1. **Task 1 (RED): mention-label 显示契约测试** - `10088e4` (test)
2. **Task 1 (GREEN + 接线): mentionLabels 纯函数 + 消息渲染缩短** - `83509df` (feat)
3. **Task 2: 消歧契约全矩阵测试** - `2cbc218` (test)

_TDD RED/GREEN 分离提交；Task 2 纯测试扩展。_

## Files Created/Modified
- `packages/session-ui/src/message/mention-label.ts` - basename/最短区分后缀纯函数（新）
- `packages/session-ui/src/message/mention-label.test.ts` - 9 条契约矩阵（新）
- `packages/session-ui/src/message/message-content.tsx` - CurrentHighlightedText：labels memo + file segment 显示/title（+9/-2 行）
- `packages/session-ui/package.json` - exports 新增 ./mention-label（+1 行）

## Decisions Made
- 沿用 dsh 段窗口 while 增长循环（算法固有），其余 map/filter/some 函数式
- title 与查键均用 `segment.text.slice(1)`（正文切片），与 `file.mention.text.slice(1)` 同源同值，不扩大 diff 去反查附件字段

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] props.files 无 path 字段，labels 作用域派生方式修正**
- **Found during:** Task 1（GREEN 阶段 `bun check` 报错 TS2345）
- **Issue:** 计划假设 `props.files` 元素含 `path`（`mentionLabels(props.files)`）；实际 `PromptAttachment = FileAttachment | MediaFileAttachment` 均只有 `data/mime/source/name/description/mention`，全路径只存在于 `mention.text`（`@<path>` 形态）
- **Fix:** labels memo 改为 `props.files.flatMap(file => file.mention ? [{ path: file.mention.text.slice(1) }] : [])`，查键仍是 `segment.text.slice(1)`——二者同源同值；纯函数签名不变（仍收 `{path}[]`），App composer 未来接线不受影响
- **Files modified:** packages/session-ui/src/message/message-content.tsx
- **Verification:** `bun check --no-script` 三文件通过、`bun test src` 626 全绿
- **Committed in:** `83509df`（Task 1 GREEN 提交）

**2. [Rule 1 - Bug] Solid JSX 中 memo 需调用取值**
- **Found during:** Task 1（GREEN 阶段 `bun check` 报错 TS2339）
- **Issue:** JSX 内写 `labels.get(...)`，Solid 不自动解包 accessor
- **Fix:** 改为 `labels().get(...)`
- **Files modified:** packages/session-ui/src/message/message-content.tsx
- **Verification:** 同上 type gate 通过
- **Committed in:** `83509df`（Task 1 GREEN 提交）

---

**Total deviations:** 2 auto-fixed（均为 Rule 1 类型错误）
**Impact on plan:** 均为计划假设与真实类型不符的最小修正，未改变任何契约；diff 仍控制在宿主文件 +9/-2 行。

## Issues Encountered
- `bun check` 首次报 2 个类型错误（见 Deviations），修复后全绿，无遗留。

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- MENT-02 完成；06-02（MENT-01 composer 侧）可直接从 `@opencode/session-ui/mention-label` import 复用同一纯函数
- D2（渲染观感）待人眼 UAT：dev 服务器发一条含 @ 同目录文件的消息验证 basename/后缀与 title tooltip

## Self-Check: PASSED

All 5 created/modified files present on disk; all 3 task commits (10088e4, 83509df, 2cbc218) are ancestors of HEAD; plan_head_after = 2cbc218.

---
*Phase: 06-composer*
*Completed: 2026-11-17*
