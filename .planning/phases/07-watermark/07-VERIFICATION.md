---
phase: 07-watermark
verified: 2026-11-18T12:00:00Z
status: passed
score: 4/4 success criteria verified
covered_files:
  - ".planning/phases/07-watermark/07-01-PLAN.md"
  - ".planning/phases/07-watermark/07-01-SUMMARY.md"
  - ".planning/phases/07-watermark/07-02-PLAN.md"
  - ".planning/phases/07-watermark/07-02-SUMMARY.md"
  - "packages/app/src/workspace-sidebar/session-row.tsx"
  - "packages/app/src/workspace-sidebar/sessions.test.ts"
  - "packages/app/src/workspace-sidebar/sessions.ts"
  - "packages/app/src/workspace-sidebar/sidebar.tsx"
  - "packages/app/src/workspace-sidebar/store.test.ts"
  - "packages/app/src/workspace-sidebar/store.ts"
covered_digest: "v4:sha256:e9afdeea97dd6db902cd14b4a45be8627523a5329d9b09aab58f603686ad9682"
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: human_needed
  previous_score: 5/8
  gaps_closed:
    - "三条运行期行为 truth（自动抬升、只升不降、折叠重置）由用户在 OpenCode Test desktop 包中手工验收全部通过"
    - "COLL-03 点击链路端到端由用户手工验收通过"
  gaps_remaining: []
  regressions: []
---

# Phase 7: 会话列表水位线 Verification Report

**Phase Goal:** workspace-sidebar 会话列表从二元持久化展开（v2.1 `revealed: string[]`）替换为 dsh 式分批水位：基线 5、每次 +5、剩余 ≤5 一步全展开、注意力自动抬升（只升不降）、折叠行重置、内存态不持久化。
**Verified:** 2026-11-18T12:00:00Z
**Status:** passed
**Re-verification:** Yes — after three user-directed semantic amendments (2026-11-18)

## Amendments (2026-11-18)

首次验证（human_needed, 5/8）之后，用户定案三条语义修正，均以 commit 落地（均为 HEAD 祖先，git merge-base 确认）：

| Amendment | Commit | 落点 |
|-----------|--------|------|
| 1. 未读会话**不**抬水位；自动抬升仅覆盖 working / approval / input / 当前会话，前 50 条内（含） | `adb828a864` | `sessions.ts:135-141` `requiredWatermark` 注意力集 = working/approval/input，`isActive` 独立分支；unread 不在集合内（doc 注释 L130-133 明确记录用户定案）；测试 `sessions.test.ts:357-360, 365` |
| 2. **无 "Show less" 按钮**：底部按钮只读 "Show N more"（剩余隐藏数），行全展开后按钮消失；收起仅通过折叠工作区行 | `6f8627c257` | `sidebar.tsx` 中 `onShowLess` prop、`sessions.less` key 引用全部移除（workspace-sidebar 模块 grep `less` 仅剩代码注释 "there is no 'Show less'"）；按钮仅在 `remainingHidden(...) > 0` 时渲染（sidebar.tsx:635-644） |
| 3. 折叠重置基线 = `max(5, 注意力需求)`，对 render 期单调再抬升稳定 | `ff1b92d019` | `sessions.ts:149-151` `watermarkBaseline(required) = max(SESSION_WATERMARK_BASE, required)`；折叠分支 `setRowWatermark(key, watermarkBaseline(rowRequirement(key)))`（sidebar.tsx:314）；测试 `sessions.test.ts:340-345`（floor 5 / 需求 7→7 / 50→50） |

三条修正均更新了既有测试（unread 零抬升、watermarkBaseline 表、负门 grep），未新增重复覆盖。ROADMAP Phase 7 success criteria 与 REQUIREMENTS.md COLL-03/04/05 已同步改写为修正后语义。

## 人工验收记录

首次验证标记的 3 条 PRESENT_BEHAVIOR_UNVERIFIED truth + 3 项 human_verification（点击链路端到端、注意力自动抬升、折叠重置）由用户在 **OpenCode Test desktop 包**中手工验证，**四条 success criteria 全部通过**。因此 behavior_unverified 清零、human_verification 关闭，status → passed。

## Goal Achievement

### Success Criteria（ROADMAP Phase 7）

| # | Criterion | Status | Evidence |
|---|-----------|--------|----------|
| 1 | 点击 "Show N more" 每次 +5；剩余 ≤5（含恰好 5）一步全展开且按钮消失（无 "Show less"）；折叠工作区行再展开后回到基线水位 | ✓ VERIFIED | `sessions.ts:104-114 nextWatermark`（基线 5 / `total - current <= 5 → total` 边界等值含 / 全展开后不再移动）；按钮仅 `remainingHidden > 0` 时渲染（sidebar.tsx:635-644），count = 剩余隐藏数（`language.plural("sidebar.workspace.sessions.more", ...)`）；模块内无 onShowLess / sessions.less 引用（amendment 2）；`watermarkBaseline` 表测试 4 条（sessions.test.ts:340-345） |
| 2 | 前 50 条（含）内 running / 待交互 / 当前会话无需点击即可见；水位 render 期单调提升，不因完成而回落 | ✓ VERIFIED | `requiredWatermark`（sessions.ts:135-141，`index <= 50` 含等值，注意力集 working/approval/input + isActive，**unread 排除**——amendment 1）；`requiredRowWatermark`（L171-183）遍历行内全部会话含未挂载者；driver（sidebar.tsx:364-394）经共享 `rowSessionStatus` 推导、untrack 写隔离、严格大于比较门控零稳态写；`raisedWatermark` 单调性 3 条测试；unread 零抬升 + 50 边界含等值测试（sessions.test.ts:357-366） |
| 3 | 折叠工作区行再展开后该行回到基线水位（重置） | ✓ VERIFIED | 折叠分支 `setRowWatermark(key, watermarkBaseline(rowRequirement(key)))`（sidebar.tsx:306-318，amendment 3：基线 = max(5, 注意力需求)，重置对单调再抬升稳定）；driver 跳过折叠行（L380）；共享 `rowRequirement` 保证折叠与抬升同一需求口径（L284-304） |
| 4 | 水位为内存态：刷新后回基线；不再读写 `workspace-sidebar-ui.v1` | ✓ VERIFIED | 组件内 `createStore`（sidebar.tsx，无任何 persisted 调用）；读缺省 `?? SESSION_WATERMARK_BASE`；`ui-state.ts` / `ui-state.test.ts` 不在磁盘；grep `ui-state\|UiState\|workspace-sidebar-ui` 于 packages/app/src 零命中；`workspace-registry.v1` 持久化原样（store.ts） |

**Score:** 4/4 success criteria verified（含 2026-11-18 三条用户修正后的最终语义）

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `sessions.ts` | 水位纯函数与常量（基线/+5/≤5 一步全展开/注意力谓词/单调半边/行级需求/重置基线） | ✓ VERIFIED | 常量 L90/L96；nextWatermark/remainingHidden/shownByWatermark/requiredWatermark/watermarkBaseline/raisedWatermark/requiredRowWatermark 全部导出且无 stub |
| `sessions.test.ts` | 水位 + 注意力表测试 | ✓ VERIFIED | watermark 10 条（含 watermarkBaseline 4 条）+ requiredWatermark 6 条 + raisedWatermark 3 条 + requiredRowWatermark 5 条；unread 零抬升与 50 含等值边界覆盖 |
| `sidebar.tsx` | 内存水位 store + 按钮重接线 + 折叠重置 + 单调抬升 driver | ✓ VERIFIED | onShowMore（L470-475）+ 按钮（L635-644）；折叠重置 watermarkBaseline（L314）；driver（L364-394）；无 onShowLess / shownSessions 残留 |
| `session-row.tsx` | 共享 rowSessionStatus 纯函数 | ✓ VERIFIED | L42-63 导出，SessionRow memo 与 sidebar driver 双方消费 |
| `store.ts` | 移除 createWorkspaceUiState 后只剩 registry | ✓ VERIFIED | persisted 仅 registryTarget |
| `ui-state.ts` / `ui-state.test.ts` | 已删除 | ✓ VERIFIED | 文件不存在 |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| Show more 按钮 | `sidebar.workspace.sessions.more` i18n key | `language.plural(key, remainingHidden(...))` | WIRED | sidebar.tsx:642；en.ts:941-942 文案未变 |
| 折叠 toggle | watermarks store 重置 | `setRowWatermark(key, watermarkBaseline(rowRequirement(key)))` | WIRED | sidebar.tsx:314（amendment 3） |
| 抬升 driver | session-status 裁决输出 | 共享 `rowSessionStatus` | WIRED | sidebar.tsx:293-303, 364-394 |
| driver 写路径 | watermarks store | untrack + 严格大于比较门控 | WIRED | sidebar.tsx:385-393；无无条件写分支 |
| （已移除）Show less 按钮 | — | — | REMOVED | amendment 2：无 UI 路径、无 i18n 引用（en.ts L943 key 成为无引用遗留数据，非阻断） |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| 会话行列表 | `props.row.sessions` → `shownByWatermark(...)` | `session.list({ directory, limit: 50 })`（sessions.ts:267-273） | 是 | ✓ FLOWING |
| 按钮 count | `remainingHidden(row.sessions.length, watermark)` | 行长度（server 查询）+ 内存水位 | 是 | ✓ FLOWING |
| 注意力抬升 | `requiredRowWatermark(row, statusOf, activeSession)` | `rowSessionStatus` 读 serverCtx requests/busy/unread/outcome | 是 | ✓ FLOWING |

无静态兜底、无硬编码空数据。

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| workspace-sidebar 全模块测试 | `bun test --conditions=solid --isolate --preload ../ui/test/solid-jsx.ts --preload ./happydom.ts src/workspace-sidebar/`（packages/app） | 146 pass / 0 fail / 225 expect() calls，573ms | ✓ PASS |
| 持久化负门（grep） | `rg "ui-state\|UiState\|workspace-sidebar-ui" packages/app/src` | 零命中 | ✓ PASS |
| Show less 负门（grep） | `rg "onShowLess\|sessions\.less" packages/app/src/workspace-sidebar` | 零命中（仅注释 "there is no 'Show less'"） | ✓ PASS |
| 未读抬升负门（代码 + 测试） | `requiredWatermark(0..7, "unread", false) === 0` | sessions.test.ts:357-360 通过 | ✓ PASS |
| 折叠基线测试 | `watermarkBaseline(0/3/7/50)` | 5/5/7/50（sessions.test.ts:340-345） | ✓ PASS |
| 端到端运行期行为（点击流 / 自动抬升 / 折叠重置） | 用户在 OpenCode Test desktop 包手工验收 | 四条 success criteria 全部通过（2026-11-18） | ✓ PASS (human) |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| COLL-03 | 07-01 | +5 增量 / ≤5 一步全展开 / **全展开后按钮消失（无 Show less）** / count=剩余隐藏数 | ✓ SATISFIED | 纯函数表测试 + 按钮接线 + 负门 grep + 人工点击链路验收（amendment 2） |
| COLL-04 | 07-02 | 前 50（含）running/待交互/当前自动抬升、**unread 不抬**、只升不降、无信号churn | ✓ SATISFIED | 纯函数与 driver 接线 + unread/边界测试 + 人工注意力验收（amendment 1） |
| COLL-05 | 07-01/07-02 | 折叠重置（基线 = max(5, 注意力需求)）、内存态不持久化、替换 COLL-02 | ✓ SATISFIED | 持久化层净删除 + watermarkBaseline 接线与测试 + 人工折叠验收（amendment 3） |

无孤儿需求（REQUIREMENTS.md 中 Phase 7 三个 ID 均被 plan 认领，均已勾选）。

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | TBD/FIXME/XXX/TODO/PLACEHOLDER/空实现/console-only | 无 | 模块内 grep 零命中；无 return null / return {} 桩 |

### Human Verification Required

无——全部人工验收项已由用户在 OpenCode Test desktop 包中完成并通过（见 "人工验收记录"）。

### Gaps Summary

无 gaps。三条 2026-11-18 用户修正（unread 不抬水位、移除 Show less、折叠基线 = max(5, 注意力需求)）均已以 commit 落地并有对应的纯函数测试与负门 grep 证据；模块测试 146 pass / 0 fail。首次验证遗留的 6 项运行期/端到端人工验收项已由用户在 OpenCode Test desktop 包中全部通过，behavior_unverified 清零。四条 ROADMAP success criteria 全部达成。

---

_Verified: 2026-11-18T12:00:00Z_
_Verifier: the agent (gsd-verifier)_
