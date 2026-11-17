# OpenCode Desktop 个人 Fork — 工作区侧栏

## What This Is

`anomalyco/opencode`（OpenCode Desktop）的个人 fork，仅供本人日常使用：不向上游推送、不提 PR、不发布。上游代码保持最小接缝，自有功能只有一处——把左侧栏换成一个「本地文件夹工作区」列表（沿用 `tabLayout = "projects"` 这个模式 token）：以用户**显式登记的目录**为行，替代上游的纯标签页与「按项目分组会话」。

## Core Value

侧栏显示什么，完全由我的登记表决定：我登记哪个本地文件夹，就出现哪一行；同一仓库的两份本地拷贝是两行；移除一行只是把它藏起来，目录、git 状态与会话历史分毫不动，重新登记即回来。

## Current Milestone: v2.1 workspace-sidebar 会话行状态与交互增强

**Goal:** 在 `packages/app/src/workspace-sidebar/` 模块内移植 projects-sidebar 蓝本的相对时间标签与会话状态标记两项 UI 能力，并新增 Add-folder 自动开会话、会话列表折叠两项交互，全部改动收敛在模块内（i18n 英文源串除外）。

**Target features:**

- 相对时间标签：基于 `session.time.updated`，<60s 显示 "now"，<60m "Nm"，<24h "Nh"，否则 "Nd"；随时间自动刷新（working 状态秒级、其余分钟级，同蓝本 `age()` 双粒度时钟）。
- 状态标记：行内图标+颜色标记 failed / approval / input / working / unread，优先级 failed > approval/input > working > unread > done/ready；颜色只用 `text-v2-state-fg-*` 语义 token。
- Add folder 后跳转：sidebar Add 注册成功后自动展开该行，已有会话打开最近一个，否则新建会话并打开。
- 会话列表折叠：每 project 行默认显示最近 5 条会话，"Show more" 展开全部 / "Show less" 收起，展开态按 project key 持久化（激活 v2 延期的 UIX-01）。

**蓝本（只读参照，不整文件搬移）：** `origin/projects-sidebar` 分支的 `shell/titlebar/projects.tsx` 的 `age()` 与 `inbox-model.ts` 的 InboxStatus 状态机（approval/input/working/failed/done/ready，纯 transition + driver 管定时器 + attempt 防陈旧）。新行组件 `workspace-sidebar/session-row.tsx` 以 `project-session-row.tsx` 为起点改造；不触碰 `shell/titlebar/` 任何 upstream 共享文件。

**SPEC:** v2.1 无独立设计文档；范围与默认值以 milestone 启动时的任务简报为准（四项改动 + 四条待确认项默认值）。

**Status (2026-11-17):** shipped — Phase 4/5 完成，审计 passed（8/8 需求），归档至 `.planning/milestones/v2.1-*`。

## Next Milestone Goals

<!-- 下一个 milestone 由 /gsd-new-milestone 重新定义；候选种子见 REQUIREMENTS 归档的 v2 延期项（UIX-02 真分页、UIX-03 行级操作、STY-01、STAT-04）。 -->

（待定）

## Requirements

### Validated

<!-- 已实现并在本机使用中观察到的能力。 -->

- ✓ 成为第四种界面模式，与 Top tabs / Side tabs / Inbox 互不干扰，切换与重启正常 — `65f7866b7e`
- ✓ 会话行状态：审批 / 等待输入 / 运行中 / 失败 / 完成，以及相对时间、`dir="auto"` 截断
- ✓ 行拖拽排序、顺序持久化、滚动位置恢复（v2.0 在新模块内重做，行为契约不变）
- ✓ v2.0 Phase 01/02 的实现（登记表模型 + 侧栏渲染与会话投影）；Phase 03（触点收敛与打包隔离）随 v2.1 启动归档，验收状态见 `.planning/milestones/v2.0-phases/03-seams-and-package/`
- ✓ 会话行状态标记（failed/approval/input/working/unread 优先级裁决 + 语义 token 颜色，单一真相 session-status.ts）— Phase 4
- ✓ 会话行相对时间标签（now/Nm/Nh/Nd 分桶 + working 秒级/其余分钟级双粒度时钟）— Phase 4
- ✓ Add folder 后自动展开并打开会话（add-open 状态机 + attempt 防陈旧 + 超时静默）— Phase 5
- ✓ 会话列表折叠（默认 5 条、Show more/less、展开态按 rowKey 持久化到 workspace-sidebar-ui.v1）— Phase 5

### Active

<!-- 无。v2.1 四项改动全部交付（Phase 4/5）。 -->

- （空）

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
- **v2.1 新增持久化**：`workspace-sidebar-ui.v1`（`{ revealed: string[] }`，会话列表 Show more/less 展开态，rowKey = directoryKey）。
- **v2.1 新模块**：`session-status.ts`（状态裁决/时间分桶/标记映射纯函数）、`session-row.tsx`（行组件）、`add-open-machine.ts`（Add 跳转状态机）；`sidebar.tsx` 承载双粒度时钟与机器 driver。
- **状态优先级**（v2.1 产品决定，与蓝本不同）：failed > approval > input > working > unread > idle；failed 不要求 unread；unread 用 check/success 标记。时间标签以 `session.time.updated` 为基准（蓝本 `age()` 同规则）。
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

Last updated: 2026-11-17 — v2.1 Phase 4/5 完成（会话行状态/时间标签 + Add-folder 跳转 + 会话折叠）
