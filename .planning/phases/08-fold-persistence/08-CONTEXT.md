# Phase 8: 工作区行折叠状态持久化 - Context

**Gathered:** 2026-11-22
**Status:** Ready for planning

<domain>
## Phase Boundary

让 `packages/app/src/workspace-sidebar/` 中每个工作区行的展开/折叠状态跨应用重启保留。当前 `sidebar.tsx` 的 `ui.expanded` 是组件内 `createStore`（v2.2 COLL-05 把 v2.1 的持久化展开态改成内存态），因此每次启动所有行都折回折叠。本 phase 只恢复「行折叠态」的持久化；会话水位（每行显示多少条会话）仍是内存态、折叠时重置，v2.2 的 COLL-03/04/05 语义不变。

</domain>

<decisions>
## Implementation Decisions

### 持久化落点

- 折叠态并入 `workspace-registry.v1` 文档（同一 server scope），新增 `expanded: Record<rowKey, boolean>`；理由：该文档已承载同类的视图状态 `scrollTop`，且与登记表同一次水合，避免第二个持久化 store 造成的「先折叠后展开」首帧闪烁。
- `workspace-sidebar-ui.v1` 继续零读零写（v2.2 决定不回退）。

### 读写语义

- `expanded[key] === true` 视为展开；缺省或 `false` 为折叠。未操作过的行保持默认折叠。
- `toggle` 写入 `registry.setExpanded(key, next)`；`Add` 注册成功后仍写入展开态（沿用现有自动展开流程）。
- rowKey 使用既有 `directoryKey(entry.directory, host)`，不新造身份；Windows 大小写/斜杠拼写差异由既有归一化吸收。
- 会话水位仍存于 `createStore`，折叠时按 v2.2 规则重置；不与折叠态共用持久化。

### 兼容与迁移

- 旧 `workspace-registry.v1` 文档没有 `expanded` 字段：`Persistence.withInitial` 的字段级 recover 以 `{}` 补齐，entries 与 scrollTop 不丢。
- 非布尔脏值由 `Persistence.record` 逐条恢复并丢弃，不使整份文档解码失败。

### 测试边界

- schema/store 层：bun 测试覆盖初始文档、含 `expanded` 的 round-trip、旧文档缺字段的解码回退。
- 端到端：`packages/app/e2e/regression/home.spec.ts` 新增一例真实交互（点击行 → reload 后恢复；另一行保持折叠），这是唯一能证明「写穿存储再水合」的边界，避免只测 schema 而接线回归无人发现。

</decisions>

<code_context>
## Existing Code Insights

- `registry.ts`：`WorkspaceRegistrySchema`（entries + scrollTop）、`initialRegistry`、`registryTarget(scope)`。
- `store.ts`：`createWorkspaceRegistry` 是唯一 `persisted(registryTarget(scope), ...)` 调用点；已有 `entries`、`scrollTop`、`setScrollTop`。
- `sidebar.tsx`：`[ui, setUi] = createStore({ expanded: {} })`（L116）、`expanded()`（L280）、`toggle()`（L306-318）、`add()` 的 `setUi(...)`（L345）。
- `registry.test.ts` 的 "workspace registry document" describe 固定 round-trip 与 initial 形状，需要同步更新。
- e2e：`mockWorkspace` + `seed.storage` 可注入 `opencode.global.dat:workspace-registry.v1`；`settings.appearance.tabLayout = "projects"` 使 `#vertical-tabs-sidebar` 渲染 `SidebarWorkspaces`。

</code_context>

<specifics>
## Specific Ideas

- 行按钮已有 `aria-expanded`，e2e 直接断言该属性，不新增测试专属 DOM 属性。
- e2e 只驱动 UI，不手算 rowKey（host 平台差异由组件自身处理）。

</specifics>

<deferred>
## Deferred Ideas

- 会话水位持久化 — 与 COLL-05 用户定案冲突，明确不做。
- 整条侧栏 `sidebarOpen` — 已由 settings 持久化，不属于本 phase。

</deferred>
