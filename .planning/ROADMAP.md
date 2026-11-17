# Roadmap: OpenCode Desktop 个人 Fork — 工作区侧栏

## Milestones

- ✅ **v1.0 Projects 侧栏正确性** - Phases 1-2（Phase 3 superseded：由 v2.0 接管）
- ✅ **v2.0 工作区登记侧栏** - Phases 1-3（Phase 03 验收随 v2.1 启动归档；见 `.planning/milestones/v2.0-phases/`）
- 🚧 **v2.1 workspace-sidebar 会话行状态与交互增强** - Phases 4-5 (in progress)

<details>
<summary>✅ v2.0 工作区登记侧栏（Phases 1-2 完成；Phase 3 归档未验收）</summary>

v2.0 把左侧栏的行源换成「用户显式登记的本地文件夹登记表」，收敛成自包含模块 `packages/app/src/workspace-sidebar/`。v2.1 启动时 Phase 03（上游触点收敛与打包隔离）尚未正式验收即归档，验收状态见 `.planning/milestones/v2.0-phases/03-seams-and-package/`。SPEC：`docs/designs/workspace-registry-sidebar.md`。

</details>

## Overview

v2.1 在 v2.0 的模块内增强会话行：移植 `origin/projects-sidebar` 蓝本的相对时间标签（`age()` 规则 + 双粒度时钟）与状态标记（InboxStatus 状态机风格），并新增两个交互——Add folder 后自动打开会话、会话列表折叠（默认 5 条 + 持久化展开态）。全部改动收敛在 `packages/app/src/workspace-sidebar/`（i18n 英文源串除外），不触碰 `shell/titlebar/` 任何 upstream 共享文件。

**蓝本（只读参照）：** `origin/projects-sidebar` 的 `shell/titlebar/projects.tsx`（`age()`、`SessionStatusMark`、`SESSIONS_PER_PROJECT`）与 `shell/titlebar/inbox-model.ts`（状态机风格：纯函数 + driver 管定时器 + attempt 防陈旧）。

**硬边界**：只改 `packages/app/src/workspace-sidebar/` + `packages/app/src/runtime/i18n/en.ts` 新增 key；状态优先级以本里程碑默认值为准（failed > approval > input > working > unread > idle），与蓝本不同处已在 REQUIREMENTS.md 记录。

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

v2.1 延续 v2.0 编号，从 Phase 4 开始。

- [x] **Phase 4: 会话行状态与时间标签** - 新行组件 `session-row.tsx` + 纯函数 `session-status.ts`（状态裁决 + 时间桶）+ 双粒度时钟 driver；全部语义修复前失败的纯单测钉住 (completed 2026-11-17)
- [x] **Phase 5: Add-folder 跳转与会话列表折叠** - `add-open-machine.ts`（注册→等待会话→打开/新建）+ 会话列表默认 5 条与 Show more/less + 展开态持久化 (completed 2026-11-17)

## Phase Details

### Phase 4: 会话行状态与时间标签
**Goal**: 每个会话行显示一个状态标记（failed/approval/input/working/unread，idle 无标记）与相对时间标签（now/Nm/Nh/Nd）；状态裁决与时间分桶是纯函数，双粒度时钟由 driver 管，无 working 行时不跑秒级定时器。
**Depends on**: Nothing（v2.1 首个 phase；与 Phase 5 文件面不相交，可独立实施）
**Requirements**: TIME-01, TIME-02, STAT-01, STAT-02, STAT-03
**Success Criteria** (what must be TRUE):
  1. `session-status.ts` 的纯函数被单测逐条断言：状态优先级 failed > approval > input > working > unread > idle 的代表性组合；时间分桶 <60s→now、<3600s→minutes、<86400s→hours、否则 days（含边界值 59/60、3599/3600、86399/86400）。这些用例在实现前失败、实现后全绿。
  2. 行渲染：working→ActivityRing（`--v2-state-fg-info` 内联色，理由同蓝本：ring 的无 layer CSS 盖不过 utility class）、approval→circle-exclamation/warning、input→help/warning、failed→close/danger、unread→check/success；颜色只用 `text-v2-state-fg-*` 语义 token；时间标签 11px tabular-nums muted。
  3. 时钟：任一可见行 working 时秒级刷新时间标签，否则分钟级；没有 working 行时不存在秒级 interval。visible 文案全部走 i18n key（复用 `sidebar.inbox.time.now` / `sidebar.inbox.elapsed.*` / `sidebar.inbox.status.*`，不新增）。
  4. `bun check --no-script` 对本 phase 新增/改动的 app 文件 0 诊断、`bun test src/workspace-sidebar` 全绿；不触碰 `shell/titlebar/` 任何文件（`git diff --name-only origin/dev -- packages/app/src/shell` 在 v2.1 合入前后不变，除 v2.0 已留触点）。
**Plans**: TBD

### Phase 5: Add-folder 跳转与会话列表折叠
**Goal**: Add 注册 folder 成功后自动展开该行并打开一个会话（有历史则最近一个，无则新建）；每行会话列表默认显示 5 条，Show more/less 展开收起，展开态按 project key 持久化。
**Depends on**: Nothing（与 Phase 4 文件面不相交；顺序执行仅因编号）
**Requirements**: NAV-01, COLL-01, COLL-02
**Success Criteria** (what must be TRUE):
  1. `add-open-machine.ts` 纯 transition 被单测断言：register 完成 → 等待会话 → 有会话开最近一个 / 无会话新建 draft；attempt 不匹配的结果事件被忽略；disposed 终止；driver 的副作用（等待 rows、打开/新建）不进入 machine。
  2. Add 成功后：行 expanded、行数据加载完成即打开目标会话；打开失败落到 failed 态并静默停止（不弹错、不阻塞侧栏）。
  3. 会话列表：≤5 条无折叠 UI；>5 条默认显示 5 条 + "Show N more"（language.plural）；展开后显示全部 + "Show less"；展开态按 rowKey 写入 `Persist.serverGlobal` 并在重启后保持（持久化 schema 缺字段/损坏时回退初始值）。
  4. `bun check --no-script` 对本 phase 新增/改动的 app 文件 0 诊断、`bun test src/workspace-sidebar` 全绿；EN 源串只增不改（新增 `sidebar.workspace.sessions.more` / `sidebar.workspace.sessions.less`）。
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 4 → 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 4. 会话行状态与时间标签 | 1/1 | Complete    | 2026-11-17 |
| 5. Add-folder 跳转与会话列表折叠 | 1/1 | Complete    | 2026-11-17 |
