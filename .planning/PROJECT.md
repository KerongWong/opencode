# OpenCode Desktop 个人 Fork — 工作区侧栏

## What This Is

`anomalyco/opencode`（OpenCode Desktop）的个人 fork，仅供本人日常使用：不向上游推送、不提 PR、不发布。上游代码保持最小接缝，自有功能只有一处——把左侧栏换成一个「本地文件夹工作区」列表（沿用 `tabLayout = "projects"` 这个模式 token）：以用户**显式登记的目录**为行，替代上游的纯标签页与「按项目分组会话」。

## Core Value

侧栏显示什么，完全由我的登记表决定：我登记哪个本地文件夹，就出现哪一行；同一仓库的两份本地拷贝是两行；移除一行只是把它藏起来，目录、git 状态与会话历史分毫不动，重新登记即回来。

## Current Milestone: v2.0 工作区登记侧栏

**Goal:** 把侧栏的行源从「会话派生的项目/checkout 分组」换成「用户显式登记的本地文件夹登记表」，并把整块改动收敛成一个自包含模块，使 `upstream/dev` 的触点降到 5 个文件、约 10 行。

**Target features:**

- 客户端登记表（`directory` 为键，`title` / `order` / `removedAt` 为状态），不需要数据库迁移或新协议端点。
- 侧栏行 = 未移除的登记项；行内会话 = `session.list({ directory })`（精确等值，不含子目录）。
- 添加 / 重命名 / 移除 / 恢复 / 拖拽排序 / 空态 / 目录不可用态。
- 上游触点收敛 + 打包隔离（`OPENCODE_CHANNEL=fork`）。

**SPEC:** `docs/designs/workspace-registry-sidebar.md`（13 节裁决文档，含现状审计、存储核验、冲突预算实测）。

## Requirements

### Validated

<!-- 已实现并在本机使用中观察到的能力。 -->

- ✓ 成为第四种界面模式，与 Top tabs / Side tabs / Inbox 互不干扰，切换与重启正常 — `65f7866b7e`
- ✓ 会话行状态：审批 / 等待输入 / 运行中 / 失败 / 完成，以及相对时间、`dir="auto"` 截断
- ✓ 行拖拽排序、顺序持久化、滚动位置恢复（v2.0 在新模块内重做，行为契约不变）

### Active

<!-- v2.0 待实现。ID 与 REQUIREMENTS.md / ROADMAP.md 对应。 -->

- [ ] 登记表数据模型与纯函数（归一、复用、移除、恢复、排序、默认标题）— WS-01、WS-05、WS-06
- [ ] 登记表驱动的行渲染与会话投影（精确等值、事件增量、空态、不可用态）— WS-02、WS-03、WS-04、WS-07、WS-08、WS-09、WS-11
- [ ] 上游触点收敛与打包隔离 — WS-10、WS-12

### Out of Scope

- 向上游提交 PR、发布构建、维护 CHANGELOG — 个人 fork，明确不参与上游流程
- **从会话历史推导行**（v1.0 的模型）— v2.0 的行只来自登记表；未登记目录即使有会话也不出现
- **兜底分组（未分组 / 其它）** — 与「移除后彻底不可见」互斥，v2.0 不实现任何兜底
- **按 git worktree 清单自动成行** — 数据源从 git inventory 换成用户登记，`sync.worktrees.list` 不再进入侧栏
- 插件承载（`packages/plugin/src/gui` 插槽）— 不减少上游触点，却引入异步加载与跨进程调试成本
- 子目录会话归入父行 — 采用精确等值语义（DSH 同此）
- 自动跟随目录改名 — 改名后进入「不可用」态，由用户重新登记
- 冷启动自动打开最近修改的会话 — 设计文档中的第三提交从未落地，先显式排除
- 修复 `@opencode/ui/activity-ring` 的无 layer CSS 根因 — 会改变所有调用点观感，当前环境无法验证

## Context

- **行源**：客户端登记表，`Persist.serverGlobal(serverScope, "workspace-registry.v1")`；桌面端落 `drafts.sqlite`（经 IPC），Web 落 `localStorage`。
- **会话投影**：`session.list({ directory, limit, order })` 已存在于协议（`packages/schema/src/session.ts` 的 `ListFilter.directory`），服务端按 `eq(directory)` 过滤，默认含归档、支持 cursor 分页。**不要**复用 v1.0 的全局 50 行索引。
- **目录身份**：`session.directory` 只做 `path.normalize` + 去尾分隔符（Windows 上 `\`→`/`），**不做 realpath**；客户端没有 `fs`，归一只做分隔符/尾斜杠/Windows 大小写。符号链接别名会登记成两个工作区（已承认的残余）。
- **项目身份**：git 身份，同一仓库的多份本地拷贝共享 `projectID`（`packages/core/src/project.ts`）。因此标题**不能**写进 `project.name`。
- **副作用禁令**：派发 `location.get` 会创建 project 行（`project.resolve` 的 `persist` 为真），登记流程不得调用它。
- **事件**：`session.created` 带 `location.directory`；`archived` / `unarchived` / `deleted` 只带 `sessionID`，需要 `sessionID → directory` 内存映射 + 行级刷新。
- **SPEC**：`docs/designs/workspace-registry-sidebar.md`；打包细节 `docs/designs/build-desktop.md`。
- **代码库地图**：`.planning/codebase/`（STACK / ARCHITECTURE / STRUCTURE / CONVENTIONS / TESTING / INTEGRATIONS / CONCERNS）。
- **本机环境**：Windows；桌面端 channel 用 `fork`（独立 appId / userData / service 注册 / 端口 / 数据库）；不得重启已安装的应用或服务进程。

## Constraints

- **技术**：只改 `packages/app`（+ 打包所需的 `packages/desktop` 常量）。不动 `packages/server`、`packages/protocol`、`packages/core` 的 schema、TUI。
- **上游合并**：会持续 merge `upstream/dev`，接缝面积是首要成本；优先「只增不改」。触点预算：5 个文件 / 约 10 行 / 0 删除。
- **避免 bug 优先于功能完整**：每个契约都要有能失败的回归测试；纯函数边界优先。
- **验证**：本机 `custom-elements.d.ts` 是符号链接，未开开发者模式时整包 typecheck 会失败——用 `bun check --no-script <files>` 做文件级门，并把该缺陷与本次改动区分开。

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

Last updated: 2026-11-13 — v2.0 milestone started (workspace registry sidebar)
