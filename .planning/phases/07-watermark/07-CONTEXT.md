# Phase 7: 会话列表水位线 - Context

**Gathered:** 2026-11-18
**Status:** Ready for planning

<domain>
## Phase Boundary

workspace-sidebar 会话列表从二元持久化展开（v2.1 COLL-02 的 `revealed: string[]`）替换为 dsh 式分批水位：基线 5、点击 +5、剩余 ≤5 一步全展开变 "Show less"（一步回基线）、注意力自动抬升（只升不降）、折叠工作区行重置该行水位、内存态不持久化。改动收敛在 `packages/app/src/workspace-sidebar/` 模块内（i18n 复用现有 key，无新增）。

</domain>

<decisions>
## Implementation Decisions

> 决策来源：任务简报（v2.2 启动）+ 2026-11-17 事实复核（explore 核实 opencode 与 dsh 两侧代码，dsh 语义逐条确认到行号）；用户授权 autonomous 按最优方案定案。

### 水位语义（对齐 dsh WorkspaceBrowser.tsx）

- 基线 `SESSION_WATERMARK_BASE = 5`；每次点击 "Show N more" 提升 `+5`（dsh L640-643）
- 剩余隐藏数 ≤5 时一步提升到全展开（Infinity 语义）；全展开后按钮变 "Show less"（dsh L629-651）
- 点击 "Show less" 一步回到基线（不是逐档回退；dsh L635-639）
- 按钮文案显示**当前水位下的剩余隐藏数**（`Show {{count}} more` 的 count 语义从"相对 5 的总量"变为"剩余量"，现有 i18n key 复用，en.ts L941-943 文案不变）
- 上限 50 只约束自动提升（dsh `SESSION_WATERMARK_AUTO_MAX`，L77-94）：running / 待交互（approval/input）/ 当前会话 的会话在列表前 50 条内时自动抬水位使其可见（以原始任务简报清单为准；dsh 的"未读完成"条件**不采用**——2026-11-18 用户澄清）
- 水位只升不降（render 期单调提升，dsh L401-402）；降低只发生在：折叠工作区行（重置该行水位，opencode 无嵌套组，`withinGroup` 退化为单行 key）与点击 "Show less"
- 不持久化：水位为内存 `createStore`（对齐行展开/折叠 `ui.expanded` 的现有内存态模式，sidebar.tsx L101、L257-268）；卸载即重置。**停止读写 `workspace-sidebar-ui.v1` 的 revealed 展开态**（v2.1 COLL-02 语义被 COLL-05 替换）

### 注意力信号来源（opencode 侧落地）

- running 用 v2.1 `session-status.ts` 的 working 状态；待交互用 approval/input 状态；当前会话用激活 tab 的 sessionID（未读 unread 状态**不**抬水位——以原始任务简报清单为准，dsh 的 completed 条件不采用）
- 与 v2.1 优先级裁决解耦：水位只关心"是否需要可见"，直接复用 `session-status.ts` 输出的状态标记，不新造状态机
- 自动提升仅在索引 ≤50 内生效（每行 `session.list` 本来就只拉 50 条，天然上限）

### 实现位置

- 纯函数进 `packages/app/src/workspace-sidebar/sessions.ts`（沿用模块惯例；若函数集变大按 `feature.ts + feature.test.ts` 约定拆 `watermark.ts`）
- 水位 store（内存）由 `sidebar.tsx` 的 driver 持有（对齐双粒度时钟与 add-open 机器的既有 driver 模式）
- 现有 `shownSessions / hiddenSessionCount` 二元语义测试（sessions.test.ts L291-312）重写为水位表测试；`ui-state.ts` 的 revealed 持久化纯函数测试随持久化移除一并删除

### 状态重置时机

- 折叠工作区行（`ui.expanded` 翻折时）重置该行会话水位
- "Show less" 回基线
- 其余情况水位只升不降（新会话顶到前列、running 会话完成等都不降低水位）

### the agent's Discretion

- 纯函数的具体命名与拆分（watermark 相关函数签名）
- 自动提升对 "未读完成" 的排除细节：unread 状态的读取不再参与水位（2026-11-18 用户澄清，以原始简报清单为准；✓ 未读标记本身保留）

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- v2.1 既有：`session-status.ts`（状态裁决纯函数）、`sessions.ts`（`SESSIONS_PER_PROJECT=5`、`SESSION_LIST_LIMIT=50`、`shownSessions/hiddenSessionCount`）、`ui-state.ts`（将被移除的 revealed 持久化）、`store.ts`（`createWorkspaceUiState` 接线）、`sidebar.tsx`（Show more/less L549-566、行折叠 L257-268、双粒度时钟 driver）
- dsh 参照（只读）：`WorkspaceBrowser.tsx` L55-106（水位常量 + raiseWatermarks/dropWatermarks）、L386-413（render 期单调提升 + withinGroup）、L629-651（按钮与 Show less）、L77-94（requiredWatermark 注意力条件）

### Established Patterns
- 模块惯例：`feature.ts + feature.test.ts` 平铺 kebab-case；纯函数边界优先；状态"纯 transition + sidebar.tsx driver"（v2.1 add-open-machine 先例）
- i18n：`sidebar.workspace.sessions.more.one/.other`（"Show {{count}} more"）与 `sidebar.workspace.sessions.less`（en.ts L941-943）直接复用，count 语义改为剩余隐藏数
- 测试：`sessions.test.ts` 现有 9 个 describe 块，新增/重写水位测试跟随既有 bun:test 惯例

### Integration Points
- `packages/app/src/workspace-sidebar/sessions.ts`：水位纯函数（nextWatermark / requiredWatermark / shownByWatermark 等）
- `packages/app/src/workspace-sidebar/sidebar.tsx`：水位 store driver + Show more/less 按钮接线 + 折叠重置
- `packages/app/src/workspace-sidebar/store.ts` + `ui-state.ts`：移除 revealed 持久化读写
- `packages/app/src/workspace-sidebar/sessions.test.ts`（+ 可能新增 `watermark.test.ts`）：水位行为表测试

</code_context>

<specifics>
## Specific Ideas

- dsh 行为逐项对齐清单（事实复核 2026-11-17 已确认行号）：初始 5 / +5 增量 / 剩余≤5 全展开 / 上限 50 只约束自动提升 / running·待交互·当前·未读完成自动抬升 / 只升不降 / 折叠重置 / 不持久化 / Show less 一步回基线
- 现持久化差异记录：v2.1 COLL-02 把展开态持久化到 `workspace-sidebar-ui.v1`，dsh 恰好相反（组展开持久化、水位不持久化）；v2.2 按 dsh 改为不持久化
- 触点预算：模块内改动 + sidebar.tsx 宿主小 diff（预算参照 v2.1：宿主改动数行）

</specifics>

<deferred>
## Deferred Ideas

- 会话列表真分页（服务端 cursor 拉取超 50 条）— 已延期 UIX-02
- 行级中间操作（归档会话等）— 已延期 UIX-03
- dsh 的搜索定位 reveal（revealSessionId 不受 50 上限约束）— opencode 侧栏无搜索定位，不引入

</deferred>
