# Phase 4: 会话行状态与时间标签 - Context

**Gathered:** 2026-11-17
**Status:** Ready for planning

<domain>
## Phase Boundary

在 `packages/app/src/workspace-sidebar/` 内新增会话行组件 `session-row.tsx`（以 `shell/titlebar/project-session-row.tsx` 为起点改造，upstream 文件不触碰），每行显示一个状态标记（failed/approval/input/working/unread，idle 无标记）与相对时间标签（now/Nm/Nh/Nd）。状态裁决与时间分桶是纯函数（`session-status.ts`），双粒度时钟（working 秒级 / 其余分钟级）由边缘 driver 管理。`sidebar.tsx` 从渲染 `ProjectSessionRow` 切换到渲染新组件。

</domain>

<decisions>
## Implementation Decisions

> 自主模式：用户已预先授权按任务简报默认值执行，以下推荐答案全部自动接受（auto-accepted），无未决灰区。

### 状态集合与优先级
- 状态集合：failed / approval / input / working / unread / idle；idle（读完且无异常）不显示标记。
- 优先级：failed > approval > input > working > unread > idle，if-chain 顺序即裁决，纯函数 `sessionRowStatus()` 可逐组合单测。
- unread 的判定沿用现有机制（`notification.session.unread` + attention）；working 判定为 root 会话其 family 任成员 busy（复用 `sessionBusy` 语义）。
- failed 不要求 unread：outcome === "failed" 即标记（与蓝本不同，按本里程碑默认值，REQUIREMENTS STAT-02）。

### 图标与颜色映射
- failed→`close` / `text-v2-state-fg-danger`；approval→`circle-exclamation` / `text-v2-state-fg-warning`；input→`help` / `text-v2-state-fg-warning`；working→`ActivityRing` 内联 `var(--v2-state-fg-info)`（理由同蓝本：ring 的无 layer CSS 盖不过 utility class）；unread→`check` / `text-v2-state-fg-success`。
- sr-only 可访问标签复用现有 key：`sidebar.inbox.status.*`。

### 时间标签
- 规则（蓝本 `age()`）：seconds = max(0, floor((now - session.time.updated)/1000))；<60→`sidebar.inbox.time.now`；<3600→plural minutes；<86400→plural hours；否则 plural days。复用现有 upstream key `sidebar.inbox.elapsed.*`，不新增 key。
- 粒度：行 status === "working" 用秒级时钟，否则分钟级；时钟为 sidebar body 级共享 store `{second, minute}`，无 working 行时不运行秒级 interval（行通过计数注册/注销）。
- 展示：11px `tabular-nums` `text-v2-text-text-muted`，位于状态标记右侧（蓝本布局）。

### 组件边界
- 新组件 `workspace-sidebar/session-row.tsx`：保留 `ProjectSessionRow` 的 context menu（rename/export/read/delete）与 openTab 圆点、active 样式；用本模块状态派生替换 `useSessionTabAvatarState`。
- 状态派生需要的输入（requests/busy/unread/outcome）在行内 memo 从 `ServerCtx` 读取，与蓝本 inbox-model 同一数据源（`sessionRequests`、`sessionBusy`、`notification.session.unread`）。

### the agent's Discretion
- 纯函数的模块名与内部结构（`session-status.ts` 一个文件承载状态裁决 + 时间桶，或拆分）由执行 agent 决定。
- 时钟 store 的具体形状（`{second, minute}` 双字段 vs 派生 signal）由执行 agent 决定，契约为「working 时秒级、否则分钟级、无 working 无秒级 interval」。

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `shell/layout/project-avatar-state.ts`：`sessionRequests()`、`sessionBusy()`、`SessionRequests` 类型（upstream 共享，只读复用）。
- `shell/titlebar/inbox-working.ts`：`workingSince()`（本 phase 不用 since，留待 STAT-04）。
- `@opencode/ui/activity-ring`、`@opencode/ui/icon`：标记渲染。
- i18n 现有 key：`sidebar.inbox.time.now`、`sidebar.inbox.elapsed.{minutes,hours,days}.{one,other}`、`sidebar.inbox.status.{approval,input,working,failed,done}`。
- 蓝本（`origin/projects-sidebar`，只读）：`projects.tsx` 的 `age()`、`SessionStatusMark`、`SESSIONS_PER_PROJECT`；`inbox-model.ts` 的双粒度时钟（`clock.second/clock.minute` + `now(status)`）。

### Established Patterns
- 纯函数 + 修复前失败的单测（registry.ts / sessions.ts 的测试风格，`bun test src/workspace-sidebar`）。
- createStore 优先；driver 管定时器（onCleanup 清理）。
- 颜色只用语义 token（`text-v2-state-fg-*` / `v2-text-*`）；13px 行高用 `--line-height-compact`。

### Integration Points
- `workspace-sidebar/sidebar.tsx`：`WorkspaceRow` 内 `<ProjectSessionRow>` 调用点替换为新组件；body 级创建时钟并下传。
- `shell/tabs/project-sessions.ts`：`openProjectSession`（本 phase 不改）。

</code_context>

<specifics>
## Specific Ideas

- 以 `shell/titlebar/project-session-row.tsx` 为起点改造，但它本身一行不改（upstream 共享文件）。
- 蓝本 `SessionStatusMark` 的 `Switch`/`Match` 结构原样借鉴。
- 不新增 @font-face、不重启 app/server 进程；视觉验证走 `bun dev`（app 4444 + backend 4096）。

</specifics>

<deferred>
## Deferred Ideas

- "Working {{duration}}" 等待时长标签（蓝本 `since` 双粒度）——REQUIREMENTS STAT-04 已列 v2。
- 行 expanded（整个 project 行折叠）持久化——本 milestone 明确不做。

</deferred>
