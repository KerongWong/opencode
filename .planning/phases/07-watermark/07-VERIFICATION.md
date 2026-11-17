---
phase: 07-watermark
verified: 2026-11-18T02:45:00Z
status: human_needed
score: 5/8 must-haves verified
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
covered_digest: "v4:sha256:b16c10d303447300e5afab39fce113caa8a3a103bea0d15fb02d2f623f570b69"
behavior_unverified: 3
overrides_applied: 0
behavior_unverified_items:
  - truth: "前 50 条内 working/approval/input/unread/当前会话无需点击即可见（含位于当前水位之下、从未挂载 SessionRow 的会话）"
    test: "在 dev 服务器展开一个有 >10 条会话的工作区行，让第 6 条之后的会话进入 working/approval/input/unread（或激活它），观察其无需点击即出现"
    expected: "水位自动抬升到该会话索引+1，会话行立即可见"
    why_human: "driver 是 sidebar.tsx 的 createEffect（JSX 驱动层），纯函数层（requiredWatermark/requiredRowWatermark）已测试，但 render 期实际抬升无任何组件级测试；presence+wiring 不能证明运行期状态迁移"
  - truth: "水位 render 期单调提升：注意力会话完成、新会话入列不降低已抬升水位；降低只发生在折叠行与 Show less"
    test: "抬升水位使远端 working 会话可见后，等待其完成；继续触发其他行重渲染（切换路由/新状态上报）"
    expected: "水位保持抬升值不回落；无信号churn（稳态零写入）"
    why_human: "单调性纯半边（raisedWatermark）已测试，driver 的写门控（严格大于比较）是静态可验证的，但运行期 effect 不回落/不自触发依赖 Solid 响应图的实际执行，无测试覆盖"
  - truth: "折叠工作区行再展开后，该行的会话列表回到基线水位 5"
    test: "展开一个有 20 条会话的行，点击 Show more 到全展开，折叠该行，再展开"
    expected: "重新展开后只显示前 5 条（基线水位），watermark key 已被删除"
    why_human: "toggle 折叠分支的 setRowWatermark(key, undefined) 已接线（sidebar.tsx:289），但折叠→重置的状态转换只在代码路径中可见，无 store 级测试"
human_verification:
  - test: "端到端点击流：bun dev serve --port 4096 + packages/app bun dev -- --port 4444，展开一个有 ≥20 条会话的工作区行"
    expected: "初始显示 5 条，按钮显示 'Show 15 more'；点击 → 10 条 'Show 10 more' → … → 剩余 ≤5 时一步全展开，按钮变 'Show less'；点击 'Show less' 一步回到 5 条"
    why_human: "纯函数表测试（8 条）已证明 nextWatermark/remainingHidden/shownByWatermark 语义，但按钮点击 → store 写 → 重渲染的完整链路无组件级测试（plan 明确安排在 07-02 之后手工验收）"
  - test: "注意力自动抬升：让第 6 条之后的会话进入 working/待交互状态（或激活远端会话），并观察其完成后水位行为"
    expected: "该会话无需点击即可见；完成后水位不回落；稳态无持续重渲染"
    why_human: "render 期单调抬升 driver（sidebar.tsx:349-384）无组件级测试；CR-01 修复后 driver 从行数据经共享 rowSessionStatus 推导全部会话状态，该修复只有纯函数回归测试覆盖"
  - test: "折叠重置：全展开一行后折叠再展开"
    expected: "该行回到基线水位 5"
    why_human: "折叠重置的 undefined-deletes-key 路径只有代码路径证据，无运行期测试"
---

# Phase 7: 会话列表水位线 Verification Report

**Phase Goal:** workspace-sidebar 会话列表从二元持久化展开（v2.1 `revealed: string[]`）替换为 dsh 式分批水位：基线 5、每次 +5、剩余 ≤5 一步全展开、注意力自动抬升（只升不降）、折叠行重置、内存态不持久化。
**Verified:** 2026-11-18T02:45:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | 点击 "Show N more" 每次 +5；剩余 ≤5（含恰好 5）一步全展开；"Show less" 一步回基线 5（COLL-03） | ✓ VERIFIED | `sessions.ts:104-114 nextWatermark`（基线 5 / `total - current <= 5 → total` 边界等值含 / 永不回退）；`sidebar.tsx:466 onShowLess` 删 key 回基线；8 条水位表测试（sessions.test.ts:296-338）全绿 |
| 2 | 按钮 count 显示剩余隐藏数，i18n key 复用零新增（COLL-03） | ✓ VERIFIED | `sidebar.tsx:634 language.plural("sidebar.workspace.sessions.more", remainingHidden(...))`；`remainingHidden` 钳制（sessions.ts:117-119）有测试；en.ts L941-943 文案 byte-for-byte 未变 |
| 3 | 前 50 条内 working/approval/input/unread/当前会话自动抬升可见，含水位以下未挂载会话（COLL-04） | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | `requiredWatermark`（sessions.ts:133-139，50 含等值）与 `requiredRowWatermark`（L159-171，遍历行内**全部**会话）已测试含 CR-01 回归测试（L389-397）；driver（sidebar.tsx:349-384）经共享 `rowSessionStatus`（session-row.tsx:42-63）推导状态——CR-01 盲点的修复已在代码与 review re-verification（204f1b1490，clean）中确认；但 render 期实际抬升无组件级测试 |
| 4 | 水位只升不降：注意力完成/新会话入列不回落；降低仅折叠与 Show less（COLL-04） | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | `raisedWatermark` 单调性 3 条测试；driver 写门控为静态严格比较 `if (raised > watermark(key)) setRowWatermark(...)`（sidebar.tsx:379-381），无无条件写分支；untrack 隔离写入——但运行期 effect 不回落/稳态零写无测试 |
| 5 | 折叠工作区行重置该行水位（COLL-05） | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | `sidebar.tsx:288-289 toggle` 折叠分支 `setRowWatermark(key, undefined)`（undefined-deletes 惯例，对齐 setRowWorking）；driver 跳过折叠行（L360）保证折叠期间不被抬升——状态转换本身无运行期测试 |
| 6 | 不再读写 `workspace-sidebar-ui.v1`；ui-state.ts 模块删除（COLL-05） | ✓ VERIFIED | `ui-state.ts` / `ui-state.test.ts` 不在磁盘（git rm，fb76d54715）；grep `ui-state\|UiState\|workspace-sidebar-ui` 于 packages/app/src 零命中（store.ts 唯一 persisted 调用是 `registryTarget` = workspace-registry.v1，L88） |
| 7 | 水位为内存态：组件生命周期 createStore，刷新后回基线 5（COLL-05） | ✓ VERIFIED | `sidebar.tsx:119` 组件内 `createStore<Record<string, number | undefined>>({})`，无任何 persisted/Persist 调用；读缺省 `?? SESSION_WATERMARK_BASE`（L148）；不持久化即卸载回基线是静态可证的机制事实 |
| 8 | workspace-registry.v1 持久化不受影响 | ✓ VERIFIED | `store.ts:87-123 createWorkspaceRegistry` 原样保留；store.test.ts 11 用例全绿；模块 doc 注释只命名存活 key |

**Score:** 5/8 truths verified (3 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `sessions.ts` | 水位纯函数与常量（基线/+5/≤5 一步全展开/Show less/注意力谓词/单调半边/行级需求） | ✓ VERIFIED | 常量 L90/L96；nextWatermark/remainingHidden/shownByWatermark/requiredWatermark/raisedWatermark/requiredRowWatermark 全部导出且无 stub |
| `sessions.test.ts` | 水位 + 注意力表测试 | ✓ VERIFIED | watermark 8 条 + requiredWatermark 5 条 + raisedWatermark 3 条 + requiredRowWatermark 5 条；全文件 144 测试中零失败 |
| `sidebar.tsx` | 内存水位 store + 按钮重接线 + 折叠重置 + 单调抬升 driver | ✓ VERIFIED | L119 store、L148-151 helper、L460-466 按钮接线、L288-289 折叠重置、L349-384 driver；无 shownSessions/hiddenSessionCount 残留 |
| `session-row.tsx` | 共享 rowSessionStatus 纯函数 | ✓ VERIFIED | L42-63 导出，被 SessionRow memo（L113）与 sidebar driver（L364）双方消费；onStatusChange 回调通道已随 CR-01 修复移除 |
| `store.ts` | 移除 createWorkspaceUiState 后只剩 registry | ✓ VERIFIED | ui-state import/工厂零引用；persisted 仅 registryTarget |
| `ui-state.ts` / `ui-state.test.ts` | 已删除 | ✓ VERIFIED | 文件不存在 |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| Show more 按钮 | `sidebar.workspace.sessions.more` i18n key | `language.plural(key, remainingHidden(...))` | WIRED | sidebar.tsx:634；en.ts:941-942 文案未变 |
| Show less 按钮 | `sidebar.workspace.sessions.less` i18n key | `language.t(key)` | WIRED | sidebar.tsx:646；en.ts:943 |
| 折叠 toggle | watermarks store key 删除 | `setRowWatermark(key, undefined)` | WIRED | sidebar.tsx:289 |
| 抬升 driver | session-status 裁决输出 | 共享 `rowSessionStatus`（session-row.tsx:42-63） | WIRED | sidebar.tsx:362-371；只读依赖，无第二份状态推导 |
| driver 写路径 | watermarks store | untrack + 严格大于比较门控 | WIRED | sidebar.tsx:375-383；无无条件写分支 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| 会话行列表 | `props.row.sessions` → `shownByWatermark(...)` | `session.list({ directory, limit: 50 })`（sessions.ts:255-261） | 是 | ✓ FLOWING |
| 按钮 count | `remainingHidden(row.sessions.length, watermark)` | 行长度（server 查询结果）+ 内存水位 | 是 | ✓ FLOWING |
| 注意力抬升 | `requiredRowWatermark(row, statusOf, activeSession)` | `rowSessionStatus` 读 serverCtx 的 requests/busy/unread/outcome | 是 | ✓ FLOWING |

无静态兜底、无硬编码空数据。

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| workspace-sidebar 全模块测试 | `bun test --conditions=solid --isolate --preload ../ui/test/solid-jsx.ts --preload ./happydom.ts ./src/workspace-sidebar/`（packages/app） | 144 pass / 0 fail / 222 expect() calls，515ms | ✓ PASS |
| 文件级类型门 | `bun check --no-script src/workspace-sidebar/{sidebar,sessions,session-row,store}.ts` | No type errors in 600 files | ✓ PASS |
| 持久化负门（grep） | `rg "ui-state\|UiState\|workspace-sidebar-ui" packages/app/src` | 零命中（T-7-03 阻断性负门） | ✓ PASS |
| 旧二元语义负门 | `rg "shownSessions\|hiddenSessionCount\|SESSIONS_PER_PROJECT\|createWorkspaceUiState" packages/app/src` | 零命中 | ✓ PASS |
| ui-state 模块删除 | `ls packages/app/src/workspace-sidebar/` | ui-state.ts / ui-state.test.ts 不存在 | ✓ PASS |
| 点击/抬升/折叠端到端运行期行为 | — | 无组件级测试可运行；plan 明确安排在整体验收手工 dev 验证 | ? SKIP → human |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| COLL-03 | 07-01 | +5 增量 / ≤5 一步全展开 / Show less 回基线 / count=剩余隐藏数 | ✓ SATISFIED | 纯函数表测试 + 按钮接线 + i18n 复用（truth 1、2） |
| COLL-04 | 07-02 | 前 50 注意力自动抬升、只升不降、无信号churn | ? NEEDS HUMAN | 纯函数与 driver 接线已验证（truth 3、4 的机制面）；运行期行为无测试 |
| COLL-05 | 07-01/07-02 | 折叠重置、内存态不持久化、替换 COLL-02 | ✓ SATISFIED | 持久化层净删除（truth 6、7、8）；折叠重置机制接线（truth 5 的运行期面转 human） |

无孤儿需求（REQUIREMENTS.md 中 Phase 7 三个 ID 均被 plan 认领）。

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | TBD/FIXME/XXX/TODO/PLACEHOLDER/空实现/console-only | 无 | 模块内 grep 零命中；无 return null / return {} 桩 |

### Human Verification Required

1. **端到端点击流** — 展开一个 ≥20 条会话的行：初始 5 条、"Show 15 more" → 逐档 +5 → 剩余 ≤5 一步全展开变 "Show less" → 点击一步回基线 5。纯函数层已证明，点击→store→重渲染链路无组件级测试（plan 明确安排）。
2. **注意力自动抬升** — 让第 6 条之后的会话进入 working/approval/input/unread（或激活远端会话）：无需点击即可见；完成后水位不回落；稳态无持续重渲染。
3. **折叠重置** — 全展开一行后折叠再展开：回到基线 5 条。

### Gaps Summary

无 FAILED 项。所有纯函数语义（COLL-03 点击数学、COLL-04 注意力谓词与单调半边、COLL-05 持久化净删除）均有表测试与 grep 负门证据，模块 144 测试全绿、类型门零错误。三条 success criteria 的运行期行为面（自动抬升的实际渲染、只升不降的 effect 行为、折叠重置的状态转换、点击链路端到端）依赖 Solid 响应图的实际执行，无组件级测试覆盖——07-CONTEXT/两份 SUMMARY 均明确将手工 dev 验收安排在 07-02 之后的整体验收。按验证规则这些 truth 记为 PRESENT_BEHAVIOR_UNVERIFIED 并路由人工验收，整体状态 human_needed（非 gaps_found：代码全部在位且接线正确）。

---

_Verified: 2026-11-18T02:45:00Z_
_Verifier: the agent (gsd-verifier)_
