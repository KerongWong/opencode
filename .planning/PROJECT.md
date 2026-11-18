# OpenCode Desktop 个人 Fork — 工作区侧栏

## What This Is

`anomalyco/opencode`（OpenCode Desktop）的个人 fork，仅供本人日常使用：不向上游推送、不提 PR、不发布。上游代码保持最小接缝，自有功能只有一处——把左侧栏换成一个「本地文件夹工作区」列表（沿用 `tabLayout = "projects"` 这个模式 token）：以用户**显式登记的目录**为行，替代上游的纯标签页与「按项目分组会话」。

## Core Value

侧栏显示什么，完全由我的登记表决定：我登记哪个本地文件夹，就出现哪一行；同一仓库的两份本地拷贝是两行；移除一行只是把它藏起来，目录、git 状态与会话历史分毫不动，重新登记即回来。

## Current Milestone: v2.2 dsh 交互对齐：@ 引用短路径与会话列表水位线

**Goal:** 对齐 dsh（`D:\01-project\02-opensource\deepseek-harness`，只读参照）的两项交互——App composer 与已发消息中的 @ 文件引用短路径显示（wire/正文层保持全路径，缩短只发生在渲染层），以及 workspace-sidebar 会话列表从二元持久化展开改为 dsh 式分批水位线（内存态、+5 增量、剩余 ≤5 一步全展开、注意力自动抬升、折叠行重置）。

**Target features:**

- **MENT-01 @ 引用短路径（composer）**：输入框内 file mention chip 显示 basename（同名冲突时最短区分后缀），hover/title 保留全路径；提交序列化仍写全路径进正文与 wire（对齐 dsh `Occurrence`/`serializeReference` 双轨策略）。
- **MENT-02 @ 引用短路径（已发消息）**：session-ui 渲染 `data-highlight="file"` segment 时显示 basename（重名时最短区分后缀），title/hover 为原始全路径；正文与 wire 不变。
- **COLL-01 会话列表水位线**：替换二元 `revealed: string[]` 持久化展开为每组内存数字水位：基线 5，点击 +5，剩余 ≤5 一步到全展开并变 "Show less"（一步回基线）；running/待交互/当前/未读完成（index ≤ 50 内）自动抬水位且只升不降；折叠工作区行重置该行水位；不持久化（卸载即重置，对齐 dsh）。

**事实复核修正（2026-11-17，动手前扫描）：** 任务简报原定 A（消息级"撤销+复制"入口）**不成立**——App 端（session-ui `message-content.tsx` 菜单 + App `region.tsx`/`revert.ts` 接线 + e2e 覆盖）已存在完整 Revert/Undo/Copy 入口，故 A 剔除并记入 Out of Scope（理由：能力已存在，重复实现违反最小改动）。

**蓝本（只读参照，不整文件搬移）：** dsh `packages/client/ui-conversation`（`apply.ts` Occurrence 双轨、`draft.ts`）、`packages/client/ui-reference`（`user-text-rules.ts` 的 basename 提取 + `FileReference.tsx` title=raw）、`packages/client/ui-workspace/src/client/rows/WorkspaceBrowser.tsx`（水位语义）与 `path-suffix.ts`（`distinguishingPathSuffixes()`）。只移植纯函数与交互语义，不 fork dsh 基础设施。

**SPEC:** v2.2 无独立设计文档；范围与默认值以 milestone 启动时的任务简报 + 事实复核结论为准。

## Next Milestone Goals

<!-- 下一个 milestone 由 /gsd-new-milestone 重新定义。 -->

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
- ✓ @ 引用短路径（MENT-01 composer chip 短名 + hover 全路径、MENT-02 已发消息渲染短名 + title 全路径；wire/正文层全路径不变；复制/粘贴/撤销回读双回路保持）— Phase 6
- ✓ 会话列表水位线（COLL-03 "Show N more" +5 分批/剩余≤5 一步全展开/无 Show less；COLL-04 running/待交互/当前自动抬升、未读不抬、只升不降；COLL-05 内存水位不持久化、折叠重置到 max(5, 注意力要求)）— Phase 7

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
- **消息级"撤销+复制"入口（v2.2 任务简报原 A 项）** — 事实复核确认 App 端已存在完整实现：session-ui `message-content.tsx` 的 Revert to here/Undo 菜单与 Copy 按钮、App `region.tsx`/`session/revert.ts` 接线、`e2e/regression/session-header.spec.ts` 覆盖。能力已存在，重复实现违反最小改动原则
- **dsh `distinguishingPathSuffixes()` 的全局 workspace 消歧** — dsh 该函数服务 WorkspacePicker 同名工作区消歧；v2.2 仅在同一 composer draft/同一条消息内做重名消歧，不引入全局消歧

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

Last updated: 2026-11-18 — v2.2 完成（Phase 6 @ 引用短路径 + Phase 7 会话列表水位线，两阶段均人验通过）
