# 工作区登记侧栏（Workspace Registry Sidebar）

> 目标：把左侧栏从「git worktree 派生行」改成「用户显式登记的本地文件夹行」，并把整块改动收敛成一个自包含模块，使 `upstream/dev` 的触点降到可审计的个位数。
>
> 本文所有路径均为仓库相对路径，便于换机后直接阅读。写入时间：2026-11-13，基线 `projects-sidebar`。

---

## 0. 一句话结论

**弃用 Phase 1/2 的「会话派生行 + git inventory」模型，从 `upstream/dev` 新开 `workspace-registry`，用一个登记表驱动侧栏；上游触点收敛到 5 个文件、约 10 行新增、0 行删除（对上游而言）。** 现有 21 个代码改动文件里，只有 5 个值得带走。

依据摘要（下文逐条展开）：

- 「按目录取会话」的接口**已经存在**，不需要新增协议：`session.list({ directory, archived, limit, order })`。
- 「行」的来源换成客户端登记表后，**Phase 1 的 50 行索引窗口与归属函数全部失去作用**（`inbox-model.ts` 的 `INDEX_LIMIT = 50`、`session-index.ts` 的 floor、`projects-groups.ts` 的最近包含者）。
- 今天对 `upstream/dev` 的 merge 是**空演练**（`upstream/dev` 完全是 `HEAD` 的祖先，0 commits 落后），真正的冲突预算只能按「后续改到同一批热文件的概率」估算。
- 打包隔离不需要改 server/protocol：把 `OPENCODE_CHANNEL` 设成一个**新的自定义 channel**，就会同时得到独立的 `service-<channel>.json`、独立端口、独立数据库文件。

---

## 1. 需求复述（可测判据）

1. 同一 git 仓库的两个本地目录，登记后在侧栏是**两行**，各自展开该目录下的会话；同一分支也允许。
2. 侧栏行**只来自登记表**：目录没登记就不出现，即使该目录存在历史会话。
3. 重命名只写登记表的 `title`；不写 `project.name` / `project.icon`，不碰任何会话数据；重启后保持。
4. 移除 = 写 `removedAt`（不是删记录）；目录、git 状态、会话历史不动；重新登记回到原记录。
5. 被移除登记的目录，其会话在侧栏**任何位置**都不出现（含任何兜底分组）；Inbox 等其它入口不受影响。
6. 重启后登记列表、显示名、顺序、移除状态全部保持。
7. fork 构建与官方安装可同时存在、同时运行，后台服务互不顶替，数据目录不串。

**仍需确认的歧义（只有 2 条，其余无）：**

- **A1：子目录会话算不算这一行？** DSH 的语义是「会话 cwd 经 realpath 后与工作区 path 字符串相等」才归入，即**只算本目录，不算子目录**。而 OpenCode 现状里 `repo/packages/ui` 的会话会被归到 `repo`（Phase 2 的 `containsDirectory`）。二者不可同时成立。
  - 建议：**采纳 DSH 语义（精确相等）**，因为登记表的语义是「我登记了哪个文件夹」，不是「这段子树」；且 `session.list({directory})` 的服务端过滤就是 `eq(directory)`，等值匹配是**免费**的，前缀匹配反而要客户端自己算。
- **A2：登记表是「每 server」还是「全局」？** 建议**每 server**（`Persist.serverGlobal`），与 `Deps` 的多服务器模型一致；跨 server 共享同一路径的登记没有意义。

---

## 2. 现状审计（21 个代码文件 → 保留 5）

结论：**保留 5 个、重写 4 个、丢弃 12 个。** 丢弃的都可以用 `git checkout upstream/dev -- <file>` 一键回退。

| 文件 | 性质 | fork 加了什么 | 模型 | 处置 |
|---|---|---|---|---|
| `packages/app/src/shell/titlebar/projects.tsx` | fork 新增 | 726 行侧栏（inventory、分组、拖拽、移除） | 旧 | **重写**（约 70% 换成登记表渲染） |
| `packages/app/src/shell/titlebar/projects-groups.ts` | fork 新增 | 会话目录 → 所属 checkout key | 旧 | **丢弃** |
| `packages/app/src/shell/titlebar/projects-groups.test.ts` | fork 新增 | 139 行归属回归 | 旧 | **丢弃** |
| `packages/app/src/shell/titlebar/projects-state.ts` | fork 新增 | `order`/`removed`/`scrollTop` 持久化 | 旧 | **重写**（只剩 `scrollTop`） |
| `packages/app/perf/projects-groups.ts` / `.bench.ts` | fork 新增 | 分组热路径 strobe | 旧 | **丢弃** |
| `packages/app/src/runtime/server/session-index.ts` | 上游 +48/−4 | `includeArchived` / `boundedKnown` / 存活行下限 | 旧 | **丢弃**（回退上游） |
| `packages/app/src/runtime/server/session-index.test.ts` | fork 新增 | 254 行窗口回归 | 旧 | **丢弃** |
| `packages/app/src/shell/titlebar/inbox-model.ts` | 上游 +14/−5 | `archived:false` 分页 + 下限合并 | 旧 | **丢弃**（回退上游） |
| `packages/app/perf/session-index.ts` / `.bench.ts` | fork 新增 | 索引合并 strobe | 旧 | **丢弃** |
| `packages/app/src/shell/titlebar/titlebar.tsx` | 上游 +20/−11 | 挂载 `projects` 模式 | 新 | **重写为 3 行**（见 §7） |
| `packages/app/src/runtime/i18n/en.ts` | 上游 +19 | 18 个 `sidebar.projects.*` 键 | 混合 | **重写**（换一组 `sidebar.workspace.*`，单块连续） |
| `packages/app/src/settings/model.tsx` | 上游 +2/−1 | `tabLayout` 联合类型加 `"projects"` | 新 | **保留**（1 行） |
| `packages/app/src/shell/shell.tsx` | 上游 +5/−1 | `projects` 模式也启用分栏 CSS 变量 | 新 | **保留**（1 个条件） |
| `packages/app/src/settings/general/interface-mode.tsx` | 上游 +21 | `projects` 模式选项 + 预览图 | 新 | **重写**（选项描述移到 fork 模块，文件里只留 ≤3 行） |
| `packages/app/src/shell/titlebar/project-session-row.tsx` | 上游 +5/−4 | ring 颜色 + `RenameDialog` 可选 `label` | 混合 | **部分回退**（`label` 不需要，自建重命名对话框） |
| `packages/app/src/shell/titlebar/inbox.tsx` | 上游 +2/−1 | `ActivityRing` 16px | 无关 | **回退**（纯装饰，零收益） |
| `packages/app/src/home/sessions/view.tsx` | 上游 +2/−1 | `ActivityRing` 16px | 无关 | **回退**（同上） |
| `packages/gui-plugins/src/updater/main.ts` / `renderer.tsx` | 上游 +2/−1 / +3 | dev 渠道跳过更新提示 | 无关 | **保留** |

### 2.1 上游高频文件（冲突预算的真正来源）

按 `git log --since="120 days ago" upstream/dev -- <file>` 统计：

| 文件 | 近 120 天上游提交 | fork 改动 | 风险 |
|---|---|---|---|
| `packages/app/src/shell/titlebar/titlebar.tsx` | **82** | +20/−11（其中 27 行是缩进重排） | **高** |
| `packages/app/src/runtime/i18n/en.ts` | **227** | +19 | 中（字典文件，冲突以块为单位） |
| `packages/app/src/shell/shell.tsx` | **54** | +5/−1 | 中 |
| `packages/app/src/home/sessions/view.tsx` | 23 | +2/−1 | 低（可回退） |
| `packages/app/src/runtime/server/session-index.ts` | 1 | +48/−4 | 低（可回退） |

**关键发现：`titlebar.tsx` 的 27 行是缩进重排，不是逻辑。** 上游原文把三个 `sidebarOrganize` 分支直接写在 `<Switch>` 里；fork 把它整体推进了 `fallback={<Switch …>}` 包裹，导致 20+/11− 的噪声 diff。只要把「模式选择」抽成 fork 自己的组件，上游侧恢复为一个 1 行插槽，冲突面从 27 行降到 1 行。

---

## 3. DSH 参考结论（移植语义，不移植代码）

要移植的：**「登记即身份」「移除即隐藏但不删数据」「标题只影响显示」**。不移植的：它的持久化底座与传输层。

| DSH 语义 | 是否移植 | 理由 |
|---|---|---|
| `path` 为 `fs.realpath` 后的唯一键，永不改写 | **部分**：客户端拿不到 `realpath`，见 §4.3 | 身份必须是路径，不是 projectID/分支/remote |
| `title` 仅显示，允许重名 | 移植 | 正是需求 3 |
| 全局 `workspaceIds` 决定行顺序 | 移植 | 需求 6 的「顺序保持」 |
| `sessionIds` 有序数组为归属真源，按 cwd 校验但不按 cwd 查询 | **反着来**：我们用 `session.list({directory})` 查询 | DSH 的 host 拥有会话日志；我们只能走 HTTP |
| 删除 = 移除登记；目录与会话保留；重新添加是**新记录**、旧标题不保留 | **改**：我们的 `removedAt` 保留记录与标题（需求 4 明确要求「重新登记可复用原记录与显示名」） | DSH 用 uuid 做行 id，路径可重写；我们路径即 id，保留记录成本更低 |
| 目录消失只报 `status: 'missing-dir'`，记录不变 | 移植 | 需求：「目录被删除或改名后进入不可用状态」 |
| `initialized` 一次性 bootstrap 标记 | **不移植** | 那是「从历史会话反推工作区」的迁移；本需求第 2 条明确禁止从会话推导行 |
| 首次运行自动创建 `<Documents>/default-workspace` | **不移植** | 会凭空产生一行；我们改为空态 + 「添加文件夹」 |
| 拖拽排序、右键菜单、重命名/移除对话框的交互形态 | 移植（形态） | 见 §9 |
| 域存储（`defineDomain`）、两阶段写恢复、`@Remote` 动词、视图 store 版本 | **不移植** | 架构特定；我们用 `persisted()` |

---

## 4. 存储事实核验

### 4.1 结论

**不需要数据库迁移、不需要新协议端点。** 目录身份与「按目录取会话」都已存在；新增的只有**客户端**登记表。

### 4.2 证据

| 事实 | 证据 |
|---|---|
| 会话带目录 | `packages/core/src/session/sql.ts:41`（`directory` 非空列）；线上类型 `packages/schema/src/location.ts:9-12`（`AbsolutePath`） |
| 写入时的归一 | 只有 `path.normalize` + 去尾分隔符（`packages/core/src/location-service-map.ts:39-48`）；Windows 上 `\`→`/`（`packages/core/src/database/path.ts:50-64`）。**不做 realpath** |
| 两个 clone 可区分 | 目录不同即不同；但**共享 projectID**（`packages/core/src/project.ts:156`「Clones share a project ID」） |
| 按目录列会话 | `Session.ListFilter.directory`（`packages/schema/src/session.ts:104-109`）→ `session.list` / `GET /api/session`（`packages/protocol/src/groups/session.ts:114-145`）→ 服务端 `eq(directory)`（`packages/core/src/session/store.ts:151`） |
| 客户端已这样用 | `packages/app/src/home/sessions/controller.tsx:260-266` 就是 `sdk.api.session.list({ directory, limit, order, parentID })` |
| 默认含归档、可分页 | 省略 `archived` 即含归档（`packages/schema/src/session.ts:90-101`、`store.ts:160-161`）；`cursor.previous/next`，默认 `limit: 50`（`packages/core/src/session.ts:403-427`） |
| 全局索引窗口不够用 | `INDEX_LIMIT = 50`（`packages/app/src/shell/titlebar/inbox-model.ts:41`），只取「最新 50 个 root 会话」，**没有 directory 过滤**（`:130-133`） |
| 直播事件够用 | `session.created` 携带 `location: Location.Ref`（`packages/schema/src/session-event.ts:39-46`） |
| 归档/删除事件不够用 | `session.archived` / `unarchived` / `deleted` 只带 `sessionID`（`session-event.ts:133-145`） |

### 4.3 登记表设计

落地位置：**新增 fork 模块** `packages/app/src/workspace-sidebar/registry.ts`，不碰 core。

```ts
// 逻辑形状（非最终代码）
type WorkspaceEntry = {
  directory: string   // 归一后的绝对路径，即主键
  title: string       // 仅显示名；默认 = 目录最后一段
  order: number
  createdAt: number
  removedAt?: number  // 存在即隐藏，不删记录
}
```

- 存储：`persisted(Persist.serverGlobal(serverScope, "workspace-registry.v1"), schema, { entries: [], scrollTop: 0 })`。
  - 先例：`packages/app/src/settings/models/models.tsx:55-59`（serverGlobal）、`packages/app/src/runtime/server/global-sync/child-store.ts:87,94`（serverWorkspace）。
- 桌面端真实后端：渲染进程 → IPC → `drafts.sqlite`（`packages/desktop/src/renderer/platform/storage.ts:50-58`、`packages/desktop/src/main/storage/index.ts:22-26`）；Web 退回 `localStorage`（`packages/app/src/runtime/persistence/storage.ts:571-573`）。
- **为什么不需要迁移**：这是**新增的客户端 key**，与 SQLite schema、protocol 均无关；旧 `projects-sidebar.v1`（`order`/`removed`）在新分支上不存在，因此也没有 v1→v2 迁移动机——这正是取消 Phase 3 的直接理由。

### 4.4 路径归一（唯一真实的限制）

客户端**没有 `fs`**，无法 `realpath`。因此：

1. 取值来自系统目录选择器返回的绝对路径（桌面端为 Electron 原生对话框，通常是解析后的真实路径）。
2. 归一步骤固定为：`\`→`/` → 折叠重复分隔符 → 去尾分隔符 → Windows 下盘符大写、比较时大小写不敏感（其余平台保持大小写敏感）。
3. **已知限制（写进文档，不假装解决）**：符号链接别名会登记成第二个工作区；8.3 短名同理。
4. 可选增强（推荐做，成本极低）：登记后立刻 `session.list({ directory })`，若返回非空，则取第一条的 `location.directory` 作为**服务端拼写**覆盖本地拼写——服务端已经做过 `normalize`，这样两端字符串必然一致。目录为空时退回本地归一。

### 4.5 为什么不是另外两种做法

- **不新增 DB 表**：要写 server 迁移，违反硬约束；而 `session.directory` 已足够分组。
- **不写 `project.name`**：那是 per-repo（`project.ts:156`），两个 clone 会互相覆盖，需求 3 明确禁止。

---

## 5. 会话可见性方案

### 5.1 结论

**侧栏只渲染登记项，因此「移除后彻底不可见」是模型自带的，不需要过滤兜底分组。** 前提是：**删掉任何「未分组 / 其它」分组**。

### 5.2 三个过滤点

| 点 | 规则 | 位置 |
|---|---|---|
| 行 | 只遍历 `entries.filter(e => !e.removedAt).sort(by order)` | 新模块的 rows memo |
| 行内会话 | `session.list({ directory: entry.directory })`，服务端等值过滤 | 新模块的 per-row resource |
| 未登记目录 | **完全不出现**：没有兜底分组，也没有「从会话推导行」的路径 | 全局：不实现 |

### 5.3 为什么这样做而不是「过滤掉移除项的会话」

如果保留兜底分组，就必须在每个兜底桶里再过滤一次「该会话的目录是否属于某个被移除的登记」——这是**双重真相来源**：一旦事件流漏一条，会话就会漏进兜底分组，正是需求 5 禁止的形态。**让兜底分组根本不存在的成本是 0，鲁棒性是满分。**

### 5.4 Inbox 是否受影响

**不受影响，且必须回退 fork 对 Inbox 的改动。** `packages/app/src/shell/titlebar/inbox-model.ts` 的 +14/−5 是 Phase 1 为「会话派生行」服务的分页与下限逻辑；登记表模型不再需要它。回退后 Inbox 恢复上游行为，被移除工作区的会话在那里照常可见——正好满足需求 5 的后半句。

### 5.5 会话仍可从哪些入口访问

1. Inbox（上游默认入口，含归档）；
2. 命令面板的会话搜索（`packages/app/src/commands/palette.ts`）；
3. 会话深链接 / 恢复上次会话的路由；
4. 若 `session.list` 的目录被重新登记，侧栏行自动回来（`removedAt` 清空）。

### 5.6 事件流的缺口（必须处理）

`session.created` 带 `location.directory`，可以增量判断「这条会话属于哪个已登记行」；但 `archived` / `unarchived` / `deleted` **只带 `sessionID`**。因此：

- 维护 `sessionID → directory` 的**内存**映射（来自 `session.list` 与 `session.created`）；
- 收到这三类事件时若映射未命中，**只重取受影响的行**（按行粒度 refetch，不做全局重扫）；
- 映射不持久化，重启后靠首次 `session.list` 重建。

---

## 6. 分支决策

### 6.1 结论

**从 `upstream/dev` 新开 `workspace-registry`（3 个词、连字符、无前缀）。** 不在 `projects-sidebar` 上继续。

### 6.2 对比

| 维度 | 在 `projects-sidebar` 继续 | 从 `upstream/dev` 新开 |
|---|---|---|
| 需要删除的 fork 代码 | 约 700 行（`projects-groups.ts` + 测试 + `session-index.ts` 改动 + `inbox-model.ts` 改动 + 两个 perf 文件 + `projects-state.ts` 大部分 + `projects.tsx` 70%） | 0（不存在） |
| 代码 diff 面（vs 上游） | 21 文件 / 约 1500 代码行 | **5 文件 / 约 10 行新增 + 1 个新目录** |
| 冲突候选（热文件） | titlebar、en.ts、shell、inbox-model、project-session-row、inbox、home/view | titlebar、en.ts、shell（`interface-mode` 若也能外移则 3 个） |
| 需要搬移的代码量 | 无需搬移，但要逐文件删 | 约 200 行（登记表 + 渲染骨架，本就要新写） |
| 失去的已做工作 | — | Phase 1 的窗口收敛与 Phase 2 的归属逻辑不进主线；但**它们的目标在新模型下不再成立**（行不再从会话推导） |
| 历史可追溯性 | 就在分支历史里 | 用 `.planning/` 与 `docs/designs/project-grouped-sessions-sidebar.md` 保留 |
| 后续 phase 计划 | Phase 3（持久化 key）**作废** | Phase 3 就地取消，改由本文档接管 |

### 6.3 为什么不是「留在原分支上原地重写」

- 留在原分支上重写，最终 diff 与「新分支」几乎相同，但过程中会保留 **21 个文件的 merge 面**至少一次提交的时间窗，而且极易漏删（例如 `projects-groups.ts` 的 import 仍被别处引用）。
- 更重要的是：原分支的 Phase 1/2 已通过验证与 UAT，一旦原地重写，`01-VERIFICATION.md` / `02-VERIFICATION.md` 会被打成 stale，触发两轮 re-verify。新分支没有这个包袱。

### 6.4 必须显式记录的代价

Phase 1 的「50 行有界索引」与 Phase 2 的「每 checkout 一行」在**本需求下不再是目标**；如果未来回退到「从会话推导行」的模型，需要重新取回这两块工作（提交仍在 git 历史里：`projects-sidebar` 分支）。

---

## 7. 集成点决策

### 7.1 结论

**选 (a)：`packages/app` 内的自包含模块 + 极少触点。** 不新增插件插槽。

### 7.2 三种方案的触点预算

| 方案 | 上游文件数 | 上游新增行 | 上游删除行 | 新增 slot 类型 | 备注 |
|---|---|---|---|---|---|
| **(a) 自包含模块** | **5** | **≈10** | **0** | 否 | `titlebar.tsx`(1) + `en.ts`(1 块) + `settings/model.tsx`(1) + `shell/shell.tsx`(1) + `interface-mode.tsx`(≤3) |
| (b) 先加插件插槽 | 6（多 `packages/plugin/src/gui/registries.ts`） | ≈10 + slot 定义 | 0 | **是**（`sidebar.workspaces`） | 还要在 `titlebar.tsx` 里渲染插槽，触点不降反升 |
| (c) 混合（先内置再迁移） | 同上，且两套并存一段时间 | ≈10 | 0 | 是 | 开发期要维护两条渲染路径 |

### 7.3 为什么不是 (b)

1. **插槽本身不减少上游触点**：`SlotMap` 目前只有 `window.bottom` / `session.header` / `session.location.menu` / `session.panel.end`（`packages/plugin/src/gui/registries.ts`），新增一个侧栏插槽是 additive，但**宿主仍要在 `titlebar.tsx` 里渲染它**，等于把「3 行挂载」换成「1 行渲染 + 1 处 slot 定义 + 1 个插件包」。
2. **插件加载是异步的**（`AGENTS.md` §Plugin Loading），侧栏首帧会空一帧；而本需求正好对「首帧就正确」敏感。
3. **调试成本**：插件路径下要跨进程看日志，纯 `packages/app` 改动只需要 vite HMR。
4. 插件化的收益（第三方可替换侧栏）不是本需求的目标；需求写的是「自包含模块」。

### 7.4 为什么不是 (c)

(c) 的唯一合理性是「先内置验证，再迁插件收口」。但没有外部消费者时，迁移只会增加一次无收益的搬运；若将来真要插件化，插槽可以再加，(a) 的模块边界已经为它留好了。

---

### 7.5 修订（2026-11-14，实现前核对）

本节的假设在切到 `upstream/dev` 后被实际代码更正：**上游已经有 `general.sidebarOrganize === "projects"` 这个模式**（`packages/app/src/settings/model.tsx`、`packages/app/src/shell/titlebar/sidebar-organized.tsx`、`shell.tsx` 的 `organizedSidebar()`），v1.0 的「Projects 侧栏」本来就是挂在它上面的。

因此 §7.2 的触点数比预算更小：

| 方案 | 上游文件数 | 上游新增行 | 说明 |
|---|---|---|---|
| (a) 自包含模块（**采纳**） | **2** | **≈4** | `titlebar.tsx`（1 import + 1 行 `SidebarWorkspaces`，替换上游 `SidebarOrganized`）+ `en.ts`（1 个连续键块） |
| — `settings/model.tsx` | 0 | 0 | 不需要：`sidebarOrganize` 的 `"projects"` 字面量上游已有 |
| — `shell/shell.tsx` | 0 | 0 | 不需要：`organizedSidebar()` 已覆盖该模式 |

§9.7 的结论不变（沿用既有模式 token、只换显示名），但 token 是 `general.sidebarOrganize = "projects"`，不是 `appearance.tabLayout`。

---

## 8. 实施计划（按文件）

新增目录 `packages/app/src/workspace-sidebar/`：

| 文件 | 性质 | 内容 | 为什么必须新增 |
|---|---|---|---|
| `registry.ts` | 新增 | 登记表（增删改、`removedAt`、order、路径归一、默认标题） | 语义核心；必须是唯一真相来源 |
| `registry.test.ts` | 新增 | 归一等值、重复登记复用、移除→再登记、目录缺失、标题默认值 | 契约唯一 owner |
| `row-sessions.ts` | 新增 | `session.list({directory})` 的行级 resource + `sessionID→directory` 映射 + 事件接线 | 把 HTTP 与会话索引封在一处 |
| `sidebar.tsx` | 新增 | 渲染：行、展开、拖拽排序、空态、不可用态、右键菜单 | 自包含 UI |
| `dialogs.tsx` | 新增 | 重命名 / 移除确认 / 添加 | 不往上游 `RenameDialog` 加 `label` 参数 |
| `index.ts` | 新增 | 对外的唯一入口（`SidebarWorkspaces` + 一个 `WorkspaceMode` 描述符） | 上游只 import 这一个符号 |

上游文件的最小 diff：

| 文件 | 行数 | 为什么必须动 |
|---|---|---|
| `packages/app/src/shell/titlebar/titlebar.tsx` | +1 import，+1 行 `<SidebarWorkspaces />` | 唯一挂载点；同时删除 27 行缩进重排（恢复上游 `<Switch>` 形态） |
| `packages/app/src/settings/model.tsx` | ±1 | `tabLayout` 联合类型加回 `"projects"`（沿用旧 token，见 §9.7） |
| `packages/app/src/shell/shell.tsx` | +1 条件 | 分栏 CSS 变量需要该模式也生效 |
| `packages/app/src/settings/general/interface-mode.tsx` | ≤3 | 模式选项：描述符从 `workspace-sidebar/index.ts` import，文件里只 append |
| `packages/app/src/runtime/i18n/en.ts` | 1 个连续块（约 10 键） | 文案；集中成块 = 一个冲突单位 |

需要**回退**的文件（不留任何 fork 改动）：`inbox-model.ts`、`session-index.ts`、`session-index.test.ts`、`perf/session-index*`、`inbox.tsx`、`home/sessions/view.tsx`、`project-session-row.tsx`。

---

## 9. 语义与交互规格

| 场景 | 规则 |
|---|---|
| 登记 | 系统目录选择器 → 归一 → 若已存在（含已移除）则**复用它**（清 `removedAt`、保留 `title`），否则追加到 `order` 末尾 |
| 默认名 | 目录最后一段；根目录取盘符或 `/`；用户改过名后不再自动跟随目录改名 |
| 重命名 | 只写 `title`；trim 后为空则禁用确认；允许与其它行重名（DSH 也允许） |
| 移除 | 二次确认 → 写 `removedAt`。**不删记录、不动目录、不动会话** |
| 恢复 | 再次登记同一目录 = 清 `removedAt`，`title` 与 `order` 都保留 |
| 排序 | 拖拽写 `order`；新登记追加末尾（不抢占用户手排顺序） |
| 空态 | 无登记项时显示「添加本地文件夹」单一动作；**不自动创建默认工作区** |
| 同一目录重复登记 | 静默复用（与 DSH 一致：返回既有记录） |
| 目录不存在 | 行仍显示，标记「不可用」，禁用展开；不自动指向新路径、不静默消失 |
| 大小写 / 盘符差异 | Windows 下归一后大小写不敏感比较；Linux/macOS 敏感 |
| 目录被改名 | 旧登记变「不可用」，用户移除后重新添加（不做自动跟随，避免猜错） |
| 行内会话为空 | 行保留（登记即存在），显示 0 条 |

### 9.7 模式 token 为什么沿用 `"projects"`

新增 `"workspaces"` 需要改持久化联合类型并处理老值迁移（1 行变 3 行 + 一个 fallback），而用户可见文案由 i18n 决定，与 token 无关。**沿用旧 token、只改显示名**，把上游 diff 保持在 1 行。

---

## 10. 打包与运行隔离

### 10.1 结论

**用一个自定义 channel（建议 `fork`）构建，四个隔离维度全部自动获得**；需要补的只有 `appNames` / `appIDs` 两张表各一项。

### 10.2 取值

| 维度 | 现值（dev 渠道） | fork 取值 | 来源 |
|---|---|---|---|
| channel | `dev` | **`fork`** | `OPENCODE_CHANNEL` |
| appId | `ai.opencode.desktop.dev` | **`ai.opencode.desktop.fork`** | `packages/desktop/src/main/constants.ts`（需新增一行） |
| productName | `OpenCode Dev` | **`OpenCode Fork`** | 同上 |
| userData | 由 productName 派生 | 自动不同 | Electron 默认 |
| service 注册文件 | `service.json`（**与官方 dev/beta 共用**） | **`service-fork.json`** | `packages/cli/src/services/service-config.ts:41-45`（非 latest/dev/beta/next 才隔离） |
| 服务端口 | `0xC0DE`（固定，**会撞**） | `10000 + hash("fork") % 50000` | 同上 `defaultPort` / `channelPort` |
| 数据库文件 | `opencode.db`（官方共用） | **`opencode-fork.db`** | `packages/cli/src/database-path.ts:6-11` |
| single-instance | 按 appId | 自动不同 | Electron 默认 |

**这条是本方案里最重要的打包结论：如果 fork 用 `dev` 渠道构建，它会与官方 dev 安装共用 `service.json` 和同一个端口——也就是「后台服务互相顶替」。换成自定义 channel 是唯一不改 server 的解法。**

### 10.3 必须显式接受的后果

独立数据库意味着 **fork 首次启动看不到官方安装的历史会话**。这是「用户数据不串」的直接代价。
若确实需要共享历史，只能用 `OPENCODE_DISABLE_CHANNEL_DB=1` 指回 `opencode.db`——但那会让两个进程共写同一个 SQLite，并破坏隔离承诺。**默认不这么做，且不在构建脚本里设置该变量。**

### 10.4 验证命令

```powershell
# 1) 身份
(Get-Item "$env:LOCALAPPDATA\Programs\opencode-fork\OpenCode Fork.exe").VersionInfo.ProductName

# 2) 服务隔离：两个安装各自注册，互不覆盖
opencode      service status     # 官方
opencode-fork service status     # fork（若 CLI 以 channel 区分，则看 service-fork.json 是否存在）
Get-ChildItem "$env:USERPROFILE\.local\state\opencode" -Filter "service*.json"

# 3) 端口不撞
Get-NetTCPConnection -State Listen | Where-Object LocalPort -in 0xC0DE, (<fork 端口>)

# 4) 数据不串
Get-ChildItem "$env:USERPROFILE\.local\share\opencode" -Filter "opencode*.db"
```

### 10.5 与 `docs/designs/build-desktop.md` 的一致性

- 构建步骤不变（`bun --cwd packages/desktop build` → `pack`），只是 `OPENCODE_CHANNEL=fork`。
- 坑 1（CLI 版本必须与二进制自报一致 2.2.5）**依然成立且更危险**：`versionBelongsToChannel`（`service-config.ts:82+`）用 `0.0.0-<channel>-` 前缀或版本全等判断，`fork` 不在前缀白名单里，所以必须靠「版本号完全相等」通过。验证项：安装后确认后台服务不会反复重启。
- 坑 2（ELECTRON_MIRROR）不变。

---

## 11. 验证计划

| # | 检查 | 通过判据 |
|---|---|---|
| 1 | `cd packages/app && bun typecheck` | 无诊断指向新模块（注意：本机 `custom-elements.d.ts` 符号链接缺陷会让整包 typecheck 失败，用 `bun check --no-script <files>` 替代，并把该缺陷与本次改动区分开） |
| 2 | `cd packages/app && bun test ... src/workspace-sidebar` | 全绿；归一等值、重复登记、移除→再登记、目录缺失四类用例在实现前能失败 |
| 3 | `bun script/lint-changed.ts <base>` | 0 problem（只含改动文件） |
| 4 | 两个 clone 上行 | 两个目录登记后是两行；各自展开只显示本目录会话（不含子目录） |
| 5 | 未登记目录 | 有历史会话的未登记目录**不出现**；侧栏无任何「未分组/其它」分组 |
| 6 | 重命名 | 侧栏名变；`git status`、目录名、会话标题均不变；重启后保持 |
| 7 | 移除 | 行消失；Inbox 仍可见该目录的会话；目录与 `.git` 未动 |
| 8 | 重新登记 | 行回来，显示名与顺序**沿用**，会话列表完整 |
| 9 | 目录改名 | 行变「不可用」，不消失、不自指新路径 |
| 10 | 重启持久化 | 顺序、标题、移除状态全部保持（桌面端落 `drafts.sqlite`） |
| 11 | 打包隔离 | §10.4 四条命令全部符合预期 |
| 12 | 无副作用 | `git diff --stat upstream/dev` 只有 §8 承诺的文件；`project.name`/`icon` 无写入（在 DB 里核对 `project` 表） |

---

## 12. 上游同步演练

### 12.1 今天做不了真正的演练（必须说清）

```
git rev-list --left-right --count upstream/dev...HEAD   →  0    42
git merge-base --is-ancestor upstream/dev HEAD          →  0（是祖先）
```

`upstream/dev` 完全被 `HEAD` 包含，落后 0 个提交。**此刻的 merge 是快进，冲突数必然为 0，不能当作预算证据。**

### 12.2 用「上游同期分支」做替代演练（已执行）

`git merge-tree --write-tree --name-only HEAD upstream/<branch>`（不落盘、不动工作区）：

| 上游分支 | 日期 | 冲突文件数 | 冲突位置 |
|---|---|---|---|
| `upstream/sidebar-section-slot` | 2026-11-06 | **1** | `packages/app/src/shell/titlebar/titlebar.tsx` |
| `upstream/workspace-placement` | 2026-11-05 | 4 | 全在 `packages/client` + `packages/core` + `packages/schema`，**无 app 侧** |
| `upstream/sidebar-fade` | 2026-10-21 | 7 | `shell/shell.tsx` 等 6 个 app 文件 |
| `upstream/session-list-index` | 2026-08-25 | 4 | `packages/core`（迁移/生成类型），无 app 侧 |
| `upstream/workspace-deletion` | 2026-08-30 | 2 | 已删除的 console 包 |
| `upstream/workspace-plan` | 2026-08-06 | 64 | 大量 cli/core 漂移（7 月分支，噪声为主） |

**读法**：这些数字是**上界**（分支越老，无关漂移越多），但有方向性结论——冲突集中在 **`titlebar.tsx`** 和 **`shell.tsx`**，恰好是本方案里仅有的两个「必须动」的 UI 文件；而 8 月以来上游的 workspace 系列改动**没有一次落在 `packages/app`**。

### 12.3 承诺的冲突预算

| 文件 | 预算 | 依据 |
|---|---|---|
| `titlebar.tsx` | ≤1 处冲突 / 单次同步 | 1 行插槽；27 行缩进重排被消除 |
| `en.ts` | ≤1 处 | 单块连续键 |
| `shell.tsx` | ≤1 处 | 1 个条件 |
| `settings/model.tsx` | ≤1 处 | 1 个联合类型成员 |
| `interface-mode.tsx` | ≤1 处 | ≤3 行 append |
| **合计** | **≤5 处，且全部是 1–3 行级** | |

### 12.4 本分支实测（2026-11-14）

```
git rev-list --left-right --count upstream/dev...HEAD   →  0    29
git merge-base --is-ancestor upstream/dev HEAD          →  0（是祖先）
git merge-tree --write-tree --name-only upstream/dev HEAD → c3c93bcd…（无 CONFLICT 行）
```

同样**不构成预算证据**：上游零领先时 merge-tree 必然干净。可用的证据是下面这份触点清单。

```
git diff --numstat upstream/dev -- packages
```

| 文件 | 增/删 |
|---|---|
| `packages/app/src/runtime/i18n/en.ts` | +13 / −0 |
| `packages/app/src/shell/titlebar/titlebar.tsx` | +2 / −2 |
| `packages/app/src/workspace-sidebar/*`（7 个新文件） | +1453 / −0 |
| `packages/desktop/src/main/constants.ts` | +8 / −3 |
| `packages/desktop/electron-builder.config.ts` | +2 / −1 |
| `packages/desktop/src/main/service/cli-version.ts` | +1 / −1 |
| `packages/plugin/src/gui/core.ts` | +1 / −1 |

`packages/app` 的上游文件仍然只有 2 个、净 13 行；其余是打包身份（`packages/desktop`）与一处 additive 类型放宽（`packages/plugin`，仅把 `channel` 联合加上 `fork`）。

### 12.5 真正的演练步骤（每次上游推进后执行）

```powershell
git fetch upstream
git merge-tree --write-tree --name-only upstream/dev workspace-registry   # 只算冲突，不改工作区
git switch -c sync/<date> workspace-registry
git merge --no-commit --no-ff upstream/dev      # 冲突多于预算就 --abort，先收口再重试
git merge --abort
```

---

## 13. 风险清单

### 功能正确性

| 风险 | 触发条件 | 缓解 |
|---|---|---|
| 行内会话滞后 | 归档/删除事件只带 sessionID | `sessionID→directory` 内存映射 + 行级 refetch；未命中时只重取该行 |
| 子目录会话不归属被当作 bug | 用户在 `repo/sub` 里开过会话 | 明确写入文档与空态提示；这是 DSH 语义，不是缺陷（A1） |
| 目录别名重复登记 | 符号链接 / 8.3 短名 | 归一规则 + 「登记后学习服务端拼写」；文档承认残余 |
| 首帧空 | 登记表在异步 storage 之后才到 | 与 `Settings` 同样的 `persisted()` 同步初值；架构上不引入 Suspense |

### 数据安全

| 风险 | 触发条件 | 缓解 |
|---|---|---|
| 误写 `project.name`/`icon` | 有人顺手「复用」project 元数据来存标题 | 登记表只读 `Project`，不调用 `project.update`；测试断言无写调用 |
| 误删会话 | 把「移除」实现成删除 | `removedAt` 语义 + 单测断言移除后 `session.list` 仍在 |
| 两个 fork 实例并发写同一登记表 | 多窗口 | `persisted()` 默认无 BroadcastChannel（`storage.ts:678-681`），需显式加 `sync` 或接受最后写入者胜 |

### 同步成本

| 风险 | 触发条件 | 缓解 |
|---|---|---|
| `titlebar.tsx` 冲突 | 上游改模式选择区 | 1 行插槽 + 不重排上游结构（§12.3） |
| `en.ts` 冲突 | 上游改文案 | 单块连续键，插在文件末尾附近 |
| 重新引入会话派生行 | 为了「未登记目录也显示」而加兜底分组 | 架构上不实现兜底（§5.3）；需求第 2 条即护栏 |
| Phase 3 计划复活 | 有人按旧 ROADMAP 继续做 key 统一 | 取消 Phase 3，改由本文档接管（§6.2） |

---

## 14. 下一步（可执行）

1. `git switch -c workspace-registry upstream/dev`
2. 按 §8 建 `packages/app/src/workspace-sidebar/`，先写 `registry.ts` 与 `registry.test.ts`（红）。
3. 按 §7 打 5 处上游最小 diff，同时回退 §8 列出的 7 个文件。
4. 跑 §11 的 1–3（自动门），再跑 4–10（手工脚本）。
5. 打包：`OPENCODE_CHANNEL=fork`，按 §10.4 验证四条。
6. 按 §12.4 做一次真实 merge 演练并记录实际冲突数，回填 §12.3。
