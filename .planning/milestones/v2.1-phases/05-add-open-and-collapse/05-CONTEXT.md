# Phase 5: Add-folder 跳转与会话列表折叠 - Context

**Gathered:** 2026-11-17
**Status:** Ready for planning

<domain>
## Phase Boundary

在 `packages/app/src/workspace-sidebar/` 内完成两个交互：(1) sidebar Add 注册 folder 成功后自动展开该行并打开一个会话——已有会话打开最近一个（`order: "desc"` 首条），无会话则新建 draft 并打开；流程是显式状态机（`add-open-machine.ts`，纯 transition + driver，attempt 防陈旧）。(2) 每行会话列表默认显示最近 5 条，"Show N more" 展开全部 / "Show less" 收起，展开态按 rowKey 持久化到 `Persist.serverGlobal(scope, "workspace-sidebar-ui.v1")`。

</domain>

<decisions>
## Implementation Decisions

> 自主模式：用户已预先授权按任务简报默认值执行，以下推荐答案全部自动接受（auto-accepted）。

### Add-folder 跳转
- "最近一个" = 该行 `session.list({ order: "desc" })` 的首条（`session.time.updated` 最新）。
- 新建 = `createProjectSessionActions().openProjectNewSession(conn, directory)`（draft tab，不预建会话）。
- 失败语义：行会话加载超时（watch 10s）或打开失败 → failed 态，静默停止（不 toast、不阻塞侧栏）。注册本身成功（行已出现），跳转只是增强。
- 状态机：`add-open-machine.ts`，判别联合 state（idle/awaiting/opening/failed）+ 纯 `transition(state, event)` 返回 `{ state, effects }`；attempt 单调递增，attempt 不匹配的事件被忽略；`disposed` 回到 idle 并停掉 watch。定时器与打开动作全在 driver（sidebar.tsx 边缘）。
- 注册流程改动最小：现有 `add()` 的 register + probeSpelling + load 保留，追加「展开该行 + 向 machine dispatch registered(key)」。

### 会话列表折叠
- 默认显示 5 条（`SESSIONS_PER_PROJECT = 5`，同蓝本）；≤5 条不渲染折叠 UI。
- "Show N more" 用 `language.plural("sidebar.workspace.sessions.more", hiddenCount)`；"Show less" 用 `language.t("sidebar.workspace.sessions.less")`（新增两个英文源串 key，插入 en.ts `sidebar.workspace` 块）。
- 持久化：`workspace-sidebar-ui.v1`，形状 `{ revealed: string[] }`（rowKey 数组，默认收起=不在数组）；reveal/conceal 是纯函数（引用不变返回原数组，零写入），与 `withTitle` 风格一致；只增不删 key（行移除后残留 key 无害，重登记同 key 自然恢复展开态）。
- 纯折叠 helpers（`shownSessions` / `hiddenSessionCount`）放 `sessions.ts` 并由 `sessions.test.ts` 钉住（5 条边界、全展开、隐藏计数）。

### the agent's Discretion
- watch 超时值（默认 10s）与 machine 内部字段命名由执行 agent 决定。
- Show more/less 按钮的精确 padding/class 由执行 agent 对齐现有行样式。

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `shell/tabs/project-sessions.ts`：`openProjectSession(conn, directory, session, { preview })` 与 `openProjectNewSession(conn, directory)`。
- `workspace-sidebar/store.ts`：`persisted(registryTarget(scope), ...)` 唯一调用点先例；`withTitle`/`applyOrder` 纯函数 + 引用守卫风格。
- `workspace-sidebar/registry.ts`：`Persist.serverGlobal`、`Persistence.struct/array` schema 形状。
- `workspace-sidebar/sessions.ts`：`sessionsOf(rows, key)` 同步读；`RowSessions` 判别联合。
- 蓝本 `projects.tsx`：`SESSIONS_PER_PROJECT = 5`、`hidden()` 计数、Show more 按钮结构（行 687–696）。

### Established Patterns
- machine.ts + 纯 transition + 边缘 driver（app/AGENTS.md §State Machines；先例 `session-rename-dialog-machine.ts`）。
- persisted schema 坏数据回退初始值（Persistence schema 解码）。
- i18n plural key 形状：`"key.one"` / `"key.other"` + `language.plural(baseKey, count)`。

### Integration Points
- `sidebar.tsx` `add()`（行 160–179）：register 成功后接入 machine dispatch 与行展开。
- `sidebar.tsx` `WorkspaceRow`（行 386–414）：会话列表渲染处插入折叠。
- `en.ts` `sidebar.workspace` 块（行 902–915）：新增两个 key。

</code_context>

<specifics>
## Specific Ideas

- 任务简报默认值：默认 5 条；Add 后自动展开该 project 行；有会话开最近、无会话新建并打开；展开态按 project key 持久化。
- 蓝本只读参照，不整文件搬移。

</specifics>

<deferred>
## Deferred Ideas

- 冷启动自动打开最近修改的会话（PROJECT.md Out of Scope 既有项）。
- 折叠阈值可配置（设置项）。

</deferred>
