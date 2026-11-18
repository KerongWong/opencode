---
phase: 06-composer
plan: 02
subsystem: ui
tags: [composer, mention, solidjs, tdd, i18n-free]

requires:
  - phase: 06-composer
    provides: mentionLabels 纯函数 + @opencode/session-ui/mention-label 导出（06-01）
provides:
  - composer file chip 渲染缩短：basename / 同 draft 最短区分后缀 + 原生 title 全路径（MENT-01）
  - parseComposerEditor 双回路保全：渲染过的 file chip 回读 content 仍为 @+全路径（wire 零变化）
  - matchMention file 身份判定迁移：dataset.path/mime/filename 为准，label 比较仅保留非 file 类型
affects: [MENT-01 验收、verify-work UAT（composer chip 观感）]

actuals:
  tokens: 2200        # chars/4 over realized diff（106 changed lines，远低于 estimate 48000——接线 + 单测实际很小）
  tasks: 2
  commits: 3
  plan_head_before: 0979307a41e6aef37c43d9b8b7c0a4e56a2ff50ee
  plan_head_after: a067c8acf9

tech-stack:
  added: []
  patterns:
    - "显示缩短 + 数据保全路径：textContent 换 label，content/dataset/wire 永远全路径"
    - "TDD RED/GREEN 分离提交；match 语义变更（file 跳过 label 比较）由表驱动用例守护"

key-files:
  created: []
  modified:
    - packages/app/src/composer/editor/editor.tsx
    - packages/app/src/composer/editor/dom.ts
    - packages/app/src/composer/editor/dom.test.ts

key-decisions:
  - "parse file 分支生效 content = original?.type === \"file\" ? original.content : textContent——渲染缩短下 original 优先，start/end/position 步进按生效 content 长度计算"
  - "render labels 作用域 = 整个 draft 的非 attachment file parts（flatMap 派生 {path}[]），与 06-01 message 侧同源语义"

patterns-established:
  - "缩短 label 的回退表达式 \"@\" + (labels.get(part.path) ?? part.content.slice(1))：concat 先于 ?? 绑定，括号不可省略"
  - "matchMention 身份判定按类型分轨：file 用 dataset，其余 kind 保留 label/title/name 比较"

requirements-completed: [MENT-01]

coverage:
  - id: D1
    description: "editorMatchesPrompt 在 chip 显示缩短（basename/区分后缀/根级整路径）下仍判定匹配；错误 path、缺失 path 不匹配"
    requirement: "MENT-01"
    verification:
      - kind: unit
        ref: "packages/app/src/composer/editor/dom.test.ts#matches shortened file pills against the prompt (7 cases)"
        status: pass
    human_judgment: false
  - id: D2
    description: "composer file chip 显示 @+basename/最短区分后缀且 title=全路径；parse 回读 content=全路径（wire/正文零变化，request/model/submit 无 diff，tui/core/server 无 diff）"
    requirement: "MENT-01"
    verification:
      - kind: unit
        ref: "cd packages/app && bun test --conditions=solid --preload ../ui/test/solid-jsx.ts --preload ./happydom.ts src/composer（264 pass 0 fail）"
        status: pass
      - kind: unit
        ref: "packages/app/src/composer/request.test.ts（wire 文本与 mention {start,end,text} 来自全路径 content，随全量套件通过）"
        status: pass
      - kind: other
        ref: "git diff --quiet -- src/composer/request.ts src/composer/model.ts src/composer/submit.ts（exit 0）+ git -C ../.. diff --quiet -- packages/tui packages/core packages/server（exit 0）"
        status: pass
    human_judgment: true
    rationale: "chip 渲染观感（basename/title tooltip 实机效果）无组件级断言覆盖；缩短渲染需人眼 UAT 确认，与 06-01 D2 同款残余"

duration: 15min
completed: 2026-11-17
status: complete
---

# Phase 06 Plan 02: @ 引用短路径（composer）Summary

**Composer file chip 渲染缩短接入 06-01 的 mentionLabels：chip 显示 @+basename/同 draft 最短区分后缀、原生 title 携带全路径；parse 回读与 match 双回路保全，wire/正文层零变化（MENT-01）**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-11-17T15:05:00Z
- **Completed:** 2026-11-17T15:20:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- `renderComposerEditor`：对整个 draft 的非 attachment file parts 计算一次 `mentionLabels`，file pill `textContent = "@" + (labels.get(part.path) ?? part.content.slice(1))`，`title = part.path`（全路径，不含 @）；session/agent/skill 分支、dataset、contentEditable/dir/unicodeBidi 全部不动
- `parseComposerEditor` file 分支：生效 content 以 `mentionParts` 中 original part 为准（`original.content` 优先于缩短后的 textContent），start/end 与 position 步进按生效 content 长度计算——提交序列化仍发全路径（T-6-03 三重防护之一）
- `matchMention`：file 类型跳过 `label === part.content` 比较，身份由 `dataset.path/mime/filename` 唯一确定（T-6-04）；缩短显示下 editorMatchesPrompt 不误判，同步 effect 不触发多余重渲染，caret/原生 undo 保住

## Task Commits

Each task was committed atomically:

1. **Task 1 (RED): shortened file pill match contract** - `64c0d42` (test)
2. **Task 1 (GREEN): composer file chip shortening + parse/match 双回路** - `9097853` (feat)
3. **Task 2: fallback-scope contract cases + 回归门** - `a067c8a` (test)

_TDD RED/GREEN 分离提交；Task 2 纯测试扩展 + 机器门执行记录。_

## Files Created/Modified
- `packages/app/src/composer/editor/editor.tsx` - renderComposerEditor labels 接线（+13/-4 行）；parseComposerEditor file 分支 original.content 优先（+4/-1 行）
- `packages/app/src/composer/editor/dom.ts` - matchMention file 跳过 label 比较 + docstring 更新（+4/-2 行）
- `packages/app/src/composer/editor/dom.test.ts` - 7 条缩短 pill 匹配契约用例（+72/-0 行）

## Decisions Made
- parse 生效 content 规则：`original?.type === "file" ? original.content : textContent`——手建 DOM（无 original）保持现行为，单点回退不扩散
- 回退表达式写成 `"@" + (labels.get(part.path) ?? part.content.slice(1))`：concat 先于 `??` 绑定，不加括号时回退不可达（计划已预警，照此实现）

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] RED 用例自身缺陷：row「kept the full path label」未包 editor() 容器**
- **Found during:** Task 1（RED 验证阶段，3 条用例失败而非预期的 2 条）
- **Issue:** 该 row 的 `dom()` 直接返回 pill span 而非 `editor(...)` 容器，`editorMatchesPrompt` 把 pill 的文本节点当正文匹配，任何实现下都为 false——非生产代码缺陷，会让 RED 证据失真
- **Fix:** 修正测试将 pill 包进 `editor()` 后，恰好 2 条缩短 label 用例失败（预期 RED 面），提交前修复
- **Files modified:** packages/app/src/composer/editor/dom.test.ts
- **Verification:** 修正后 20 tests：2 fail（缩短 label true 用例）/18 pass
- **Committed in:** `64c0d42`（RED 提交本身即修正后版本）

### Verification Command Adjustment

**2. [计划 verify 命令与包测试惯例不符] `bun test src/composer` 缺 Solid 条件，tsx 测试文件报 jsxDEV SyntaxError**
- **Found during:** Task 1 `<verify>` 执行
- **Issue:** 计划 verify 写 `bun test src/composer`，但 packages/app 的 DOM/JSX 测试需 `--conditions=solid --preload ../ui/test/solid-jsx.ts --preload ./happydom.ts`（package.json `test:unit` 即如此）；裸命令下 7 个 tsx 测试文件因 jsxDEV 解析失败
- **Fix:** 用 stash 在未改动树上复现确认 7 fail/7 errors 完全一致（pre-existing，与本计划无关），改用包规范条件跑全量：264 pass 0 fail
- **Files modified:** 无
- **Verification:** pre-change 树同样 7 fail；条件版 264 pass

---

**Total deviations:** 1 auto-fixed（Rule 1，测试自身缺陷）+ 1 验证命令调整（pre-existing harness 条件问题）
**Impact on plan:** 生产代码与计划逐字一致；验证以包规范命令等价执行，回归门结论不变。

## Issues Encountered
- 裸 `bun test src/composer` 的 jsxDEV 失败为 pre-existing harness 条件问题（见 Deviations 2），已用包规范命令绕过；建议后续计划把 verify 写成 `bun run test:unit` 或带 preload 的完整命令。

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- MENT-01 完成，Phase 06 两计划全绿（MENT-01 composer 侧 + MENT-02 消息侧）；可跑 `/gsd-verify-work 6` 做相位级 UAT
- D2（chip 渲染观感）待人眼 UAT：dev 服务器在 composer 输入 `@` 引用两个同名文件，验证 basename/区分后缀显示与 title tooltip
- Phase 07（COLL 水位线）与 Phase 06 相互独立，可任意顺序启动

## Self-Check: PASSED

All 3 modified files present on disk; all 3 task commits (64c0d42, 9097853, a067c8a) are ancestors of HEAD; wire gate exit 0; touchpoint gate exit 0; type gate `bun check --no-script` 3 files 0 errors; composer suite 264 pass 0 fail (solid conditions).

---
*Phase: 06-composer*
*Completed: 2026-11-17*
