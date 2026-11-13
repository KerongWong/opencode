# Phase 2: 每个本地 checkout 成行 - Context

**Gathered:** 2026-11-13
**Status:** Ready for planning

<domain>
## Phase Boundary

进入 Projects 模式时按需为可见项目加载 worktree 清单，并在清单到达前用项目已有的 `sandboxes` 兜底，使同一 git 根的每份本地 checkout 恰好一行，checkout 内的子目录不再各自成行。

范围内：

- `packages/app/src/shell/titlebar/projects.tsx`：为可见项目按需请求 worktree 清单（每个 `projectID` 每挂载期一次）。
- `packages/app/src/shell/titlebar/projects-groups.ts`：`sessionProjectDirectory` 的根集合加入 `project.sandboxes`。
- 上述两条路径的回归测试。
- 设计文档补记「不显示空 checkout 行」的理由。

范围外（不属于本 phase）：

- 会话行源。Phase 1 已收敛，禁止再改 `mergeRootSessionIndex`、`inbox-sessions` 的请求参数或 `items()` 的推导方式。
- group key 的构造/解析统一、`projects-sidebar.v1` 迁移与裁剪（Phase 3）。
- 折叠状态持久化、Show more 分页、项目级操作（REQUIREMENTS.md 的 v2 条目）。
- 任何 `packages/server` / `packages/protocol` 改动。

</domain>

<decisions>
## Implementation Decisions

### 清单加载（讨论区 ① — 用户选定）

- **D-01:** 清单请求放在 `SidebarProjects` 的 `createEffect`。组件挂载即「进入模式」，从 `inbox.entries()` 取可见 `projectID`，按 `entry.ctx` 路由到各自服务器的 `sync.worktrees.list(projectID)`。
  - 不放进 `createSessionInbox`：它同时被 Inbox 视图复用，下沉会连带 Inbox 发请求，或需要新增一个只为绕过该复用的选项。
  - 不挂在 `sync.tsx` / bootstrap：会为服务器上每个项目发请求，违反 CHK-01「按需为可见项目」。
- **D-02:** 「恰好一次」= 组件内 `Set<`${server}\0${projectID}`>` **加上** `worktrees.cached(projectID) === undefined` 双保险。Set 挡住同一次挂载内的重复（包括每次会话更新引发的 effect 重跑），`cached()` 挡住切走再切回 Projects 模式时的重复网络请求（`inventory.list()` 用 `staleTime: 0`，不判空就必然重发）。
- **D-03:** 只用 `list`（读服务器已保存的清单），**永不** 调用 `refresh`（外部发现）。这是 `workspaces/inventory.ts` 的既有契约，也是 STATE.md 记录的 Phase 2 约束。
- **D-04:** 请求失败不重试、不弹 toast。该项目的 `worktrees` 保持 `[canonical]`，分组继续由 `sandboxes` 兜底，属于优雅降级。恢复路径已经存在：重新进入 Projects 模式（Set 是挂载期作用域）、`worktree.updated` 事件、重连失效，三者都会重新 `list`。
- **D-05:** 不新增 loading / Suspense 状态，不阻塞首帧。首帧允许先用 `sandboxes` 分组；清单到达后由 `sync.tsx` 的 `updated` 回调写回 `globalStore.project`，`projects.list()` 更新，`groups()` 自动重算。侧栏不出现 loader，也不改写滚动容器。

### sandboxes 兜底与 key 稳定性（讨论区 ② — agent 决定）

- **D-06:** `sessionProjectDirectory` 的根集合 = `project.worktrees` 的目录 ∪ `project.sandboxes` ∪ `project.worktree`，去重后仍按「最近的包含者」选 owner。`normalizeProjectInfo` 只把 canonical 放进 `worktrees`，缺这条兜底时 checkout 内的会话会退化成按会话目录成行。
- **D-07:** 不冻结、不缓存「目录 → checkout」映射，也不做「清单只能补充不与已有根嵌套的目录」这类过滤。理由：`withWorktreeInventory` 会把 `sandboxes` 重算为「清单目录减去 canonical」，所以清单与 `sandboxes` 表达的是同一份集合的两种视图；集合一致时 key 完全不变。
- **D-08:** 对成功标准 3 的解读（planner 与 verifier 按此对齐）：「不改写已有 group key」指同一份 checkout 的身份不因清单到达而改变。若清单揭示的是一个此前未知的**更深** checkout（例如 `repo/.worktrees/feature`），落在它内部的会话改归该 checkout 是正确行为，不算「把一行拆成多行」——那是它本来就该独立成行。
- **D-09:** 性能：不新增缓存层，先按现状实现（每次 `groups()` 重算时构造根数组）。改动后必须用 strobe 对 `origin/dev` 度量 `groups()` / `entries()`；只有实测出现回归才加分块缓存。

### 空 checkout 行（讨论区 ③ — agent 决定）

- **D-10:** 选成功标准 4 的**不显示**分支：某份 checkout 在会话窗口内没有会话时，不生成空行。行源保持「由会话推导」，避免 Phase 1 刚关闭的幽灵项目回归。
- **D-11:** 在 `docs/designs/project-grouped-sessions-sidebar.md` 记录该选择与理由（空行意味着遍历 projects × checkouts，会重新引入没打开过的项目和已无活动的 checkout），并在本 phase 的验证记录里指明选了哪一支。

### 回归测试归属（讨论区 ④ — agent 决定）

- **D-12:** `projects-groups.test.ts` 是分组契约的唯一 owner。扩充两条路径：有 inventory（`worktrees` 已含 canonical + feature）与只有 canonical + `sandboxes`。两条路径对同一批会话必须产出相同 key——这是修复前会失败的回归点。
- **D-13:** 不为「每个 projectID 只请求一次」抽纯函数或加生产 seam。`createWorktreeInventory` 的「共享在途请求 / 读缓存不重复」已由 `inventory.test.ts` 拥有；组件内的 Set 是单次使用的实现细节，按 `packages/app/AGENTS.md`「一个契约一个 owner、不为测试加 seam」不新开测试，改为在验证记录里用 dev 服务器观察请求次数。

### Agent's Discretion

- effect 的具体形状（先算去重目标 Map 再遍历，还是一次遍历加 Set）由 planner 决定，只要满足 D-02 / D-03。
- 根集合去重的比较方式（`sameDirectory` 还是 `comparablePath` 字符串）由 planner 按现有工具选择。
- 是否在 `projects-groups.ts` 加一句注释解释「为什么 canonical 也要显式入列」由实现者决定。

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 阶段与需求

- `.planning/ROADMAP.md` §Phase 2 — 目标、依赖、四条 requirement 与五条成功标准的原文。
- `.planning/REQUIREMENTS.md` §本地 checkout (CHK) — CHK-01…CHK-04。
- `.planning/PROJECT.md` ¶Core Value / ¶Constraints — 「不出现幽灵项目、不把一个 checkout 拆成多行、不漏掉本地拷贝」与「只改 `packages/app`」。
- `.planning/STATE.md` §Blockers/Concerns — 「未加载是正常状态，不能在渲染中 `refresh`」与 strobe 度量要求。

### 设计文档

- `docs/designs/project-grouped-sessions-sidebar.md` — 目标、约束、接缝清单、已知取舍。本 phase 需要在其「已知取舍」附近补记空 checkout 行的不显示理由（D-11）。

### 代码契约

- `packages/app/src/workspaces/inventory.ts` — `createWorktreeInventory` 的 `cached` / `list` / `refresh` 语义，`staleTime: Infinity`，以及 `withWorktreeInventory` 如何把清单重算成 `sandboxes`。
- `packages/app/src/runtime/server/sync.tsx` — `updated` 回调把清单写回 `globalStore.project`；`worktree.updated` 事件会重新 `list`。
- `packages/app/src/runtime/server/global-sync/utils.ts` — `normalizeProjectInfo` 只把 canonical 放进 `worktrees`（兜底的动机来源）。
- `packages/app/src/shell/layout/helpers.ts` — `projectForSession` 的既有「按 sandbox / 目录解析项目」顺序，可复用其思路。
- `packages/app/src/workspaces/paths.ts` — `sandboxes` 的语义（不含 canonical），`workspaceSelectionDirectories` 的合并去重写法。

### 工程规范

- `packages/app/AGENTS.md` §Tests — 一个契约一个 owner、不为测试加 seam、测试必须能失败。
- `packages/app/AGENTS.md` §Suspense — 渲染期异步读取的 state 守卫；本 phase 选择不引入新的异步读取。
- `packages/app/AGENTS.md` §Priorities 与 `packages/app/perf/README.md` — 热路径改动前的 strobe 基准与调用方式。

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- `ctx.sync.worktrees`（`ServerCtx` 上已导出）：`cached(id)` 读查询缓存，`list(id)` 拉服务器清单并在成功后触发 `updated` 回调。本 phase 直接复用，不新建查询。
- `withWorktreeInventory(project, worktrees)`：把清单转成 `worktrees` + `sandboxes`，已有单测覆盖；不需要修改。
- `comparablePath` / `containsDirectory` / `sameDirectory`（`@opencode/util/path`）：现有分组与去重都基于它们，跨平台大小写与分隔符行为已确定。
- `worktreeInventoryKey(scope, projectID)`：查询键构造器，已按 server 分区。

### Established Patterns

- 每个服务器一个 `ServerCtx`，其 `sync.worktrees` 只服务自己的 scope；跨服务器聚合必须先按 `ServerConnection.key(conn)` 分区。
- 纯函数（`projects-groups.ts`）+ 就地单测是分组逻辑的既有归属；组件只做装配。
- `groups()` 是 `createMemo`，每次会话更新都会重算，是热路径；新增工作要避免每会话重复构造。
- 本项目不新增 lifecycle 状态机：这次请求没有用户可观察的阶段（无 spinner、无错误提示），fire-and-forget 加 Set 守卫即可，符合「只建模用户能看到的阶段」。

### Integration Points

- `packages/app/src/shell/titlebar/titlebar.tsx` 的 `<Match when={settings.appearance.tabLayout() === "projects"}>` 挂载 `SidebarProjects`——挂载即进入模式，卸载即离开，是 D-02 中「挂载期作用域」的来源。
- `sync.tsx` 的 `updated` → `setGlobalStore("project", …)` → `projects.list()` → `groups()` 是清单到达后的唯一回流路径，无需在 `projects.tsx` 里订阅查询。
- `projects.tsx` 的 `groups()` memo 同时驱动 `directoryGroupLabels` 与拖拽顺序匹配（`sidebar.order()`），所以 key 稳定性同时影响行标签与持久化顺序。

</code_context>

<specifics>
## Specific Ideas

- 用户对执行方式的要求（原话）：「按照你认为最优的方式来执行，非必要不要来问我」。含义：优先最小改动、自行完成剩余判断、只在会改变结果且无法从代码与文档推断时才发问。
- 设计文档的排序约束仍然有效：「不出 bug 比功能完整重要」，每个修复都要有在修复前会失败的回归测试。
- 首帧观感要求来自用户的原始抱怨：同时开 4–9 个项目时，侧栏不应该出现「一个 checkout 裂成好几行」的中间态；`sandboxes` 兜底就是为了让这个中间态尽量短。

</specifics>

<deferred>
## Deferred Ideas

- 空 checkout 行的显式展示：已决定不做（D-10），不是延迟项；若要重新考虑，需要先解决「行源仍由会话推导」这条 Phase 1 的保证。
- 根集合的 per-project 缓存：仅当 strobe 实测 `groups()` 回归时才引入（D-09），否则视为不必要的复杂度。

</deferred>

---

*Phase: 2-每个本地 checkout 成行*
*Context gathered: 2026-11-13*
