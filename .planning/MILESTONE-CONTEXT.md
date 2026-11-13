# Milestone Context — v2.0 工作区登记侧栏

> 由 `docs/designs/workspace-registry-sidebar.md`（架构裁决，2026-11-13）提炼。该文档是本次 milestone 的 SPEC：章节号与本文对应，实现时以它为准。

## 为什么要开新里程碑

v1.0 「Projects 侧栏正确性」的核心价值是「会话派生的项目行不要出错」。新需求把行源换成**用户显式登记的本地文件夹**，v1.0 的 Core Value 随之失效：

- v1.0 要求「未归类会话保留在末尾」——新需求要求侧栏**不存在**任何兜底分组。
- v1.0 Phase 3（持久化 key 统一 + v1→v2 迁移）在登记表模型下失去对象。
- v1.0 的「Show more 分页拉取需要服务端接口」这条排除项本身是错的：`session.list({ directory })` 早已存在。

因此 v1.0 在第 2 个 phase 完成后收束，Phase 3 标记为 superseded，新开 v2.0。

## 目标（一句话）

把左侧栏做成「本地文件夹工作区列表」：行只来自用户登记表，重命名只改显示名，移除只隐藏、不动目录与会话，并把整块改动收敛成一个自包含模块，把 `upstream/dev` 的触点压到 5 个文件、约 10 行。

## 已定的语义决定

| 编号 | 决定 | 理由 |
|---|---|---|
| A1 | **子目录会话不算父行**：会话的 `directory` 与登记目录精确相等才归入 | 服务端 `session.list` 的过滤就是 `eq(directory)`，等值是免费的；前缀匹配要客户端自己算，且与「我登记了哪个文件夹」的语义不符（DSH 同此） |
| A2 | 登记表**按 server 存**（`Persist.serverGlobal`），不是全局 | 与多服务器模型一致；跨 server 共享同一路径的登记无意义 |
| A3 | 沿用 `tabLayout = "projects"` 这个模式 token，只换显示文案 | 新增 token 要改持久化联合类型并处理老值迁移，收益为零 |
| A4 | 不新增插件插槽，走 `packages/app` 自包含模块 | 插槽不减少上游触点（宿主仍要渲染它），却引入异步加载与跨进程调试成本 |

## 范围

**做：**

- 客户端登记表：`{ directory, title, order, createdAt, removedAt? }`，key = 归一的绝对路径。
- 侧栏渲染：行 = 未移除的登记项；行内会话 = `session.list({ directory })`。
- 交互：添加（系统目录选择器）、重命名、移除、恢复（重新登记）、拖拽排序、空态、目录不可用态。
- 上游触点收敛 + 打包隔离（`OPENCODE_CHANNEL=fork`）。

**不做：**

- 不新增数据库迁移；不新增 protocol 端点；不改 `packages/server`、`packages/protocol`、`packages/core` 的 schema、不改 TUI。
- 不写 `project.name` / `project.icon`（那是 per-repo，两个 clone 会互相覆盖）。
- 不做「从会话历史推导行」，也不保留任何兜底分组。
- 不向上游提 PR、不发布、不维护 CHANGELOG。

## 需求种子（用于 REQUIREMENTS.md）

控制器/渲染层：

- WS-01 用户可以把一个本地文件夹登记为工作区；同一目录重复登记静默复用。
- WS-02 侧栏行只来自登记表：未登记目录不出现，即使它有历史会话。
- WS-03 同一 git 仓库的两个目录登记后是两行，各自展开本目录会话。
- WS-04 行内会话只包含该目录自身，不含子目录。
- WS-05 重命名只改显示名，默认取目录名；重启后保持。
- WS-06 移除只写 `removedAt`：目录、git 状态、会话历史不动；重新登记恢复原名与原顺序。
- WS-07 被移除登记的工作区，其会话在侧栏任何位置都不出现；Inbox 等其它入口不受影响。
- WS-08 登记列表、显示名、顺序、移除状态在重启后保持。
- WS-09 目录不存在/被改名时该行进入「不可用」态，不静默消失、不自动指向新路径。

工程/同步：

- WS-10 与 `upstream/dev` 的触点不超过 5 个文件 / 约 10 行新增；`titlebar.tsx` 的 27 行缩进重排被消除。
- WS-11 会话与归档/删除事件的增量更新不依赖全局语义索引（行级刷新即可）。
- WS-12 fork 构建与官方安装可同时安装、同时运行：独立 appId/productName/userData/service 注册文件/端口/数据库。

## 建议的阶段切分（roadmapper 可微调，但请保持这个边界）

| Phase | 内容 | 主要验收 |
|---|---|---|
| 1 | 登记表数据模型 + 纯函数（`registry.ts`）：归一、认领/复用、移除/恢复、order、默认标题 | 纯单测，修复前失败 |
| 2 | 侧栏渲染 + 会话投影：`session.list({directory})`、事件映射、空态/不可用态、重命名/移除交互 | typecheck + 目标测试 + 手测脚本 |
| 3 | 上游触点收敛 + 打包隔离：5 处最小 diff、7 处回退、`channel=fork`、merge 演练实测 | 冲突预算实测 + 四条隔离命令 |

## 已知约束（写进计划的硬边界）

- 客户端**没有 `fs`**，无法 `realpath`：归一只做分隔符/尾斜杠/Windows 大小写；符号链接别名会登记成两个工作区（文档已承认的残余）。可选增强：登记后立刻 `session.list({directory})`，用返回项的 `location.directory` 覆盖本地拼写。
- 派发 location（`location.get`）会**创建 project 行**（`project.resolve` 的 `persist` 为真），所以登记流程**不得调用** `location.get`；只需要 `session.list`。
- `session.archived` / `unarchived` / `deleted` 事件只带 `sessionID`，不带目录 → 需要 `sessionID → directory` 内存映射 + 行级刷新。
- 本机 `packages/app/src/custom-elements.d.ts` 是符号链接，未开开发者模式时整包 typecheck 会失败；用 `bun check --no-script <files>` 做文件级门。
