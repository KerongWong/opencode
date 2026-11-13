# Roadmap: OpenCode Desktop 个人 Fork — 工作区侧栏

## Milestones

- ✅ **v1.0 Projects 侧栏正确性** - Phases 1-2（Phase 3 superseded：由 v2.0 接管）
- 🚧 **v2.0 工作区登记侧栏** - Phases 1-3 (in progress)

<details>
<summary>✅ v1.0 Projects 侧栏正确性（Phases 1-2 完成，Phase 3 superseded）</summary>

v1.0 收敛「会话派生项目行」的正确性：行源收敛到单一有界索引窗口，同一 git 根的每份本地 checkout 恰好一行。该模型在 v2.0 被取代——行改由用户登记表决定，因此 v1.0 的 Phase 3（持久化 key 统一与 v1→v2 迁移）作废，其关注点由 `docs/designs/workspace-registry-sidebar.md` 接管。

归档：`.planning/milestones/v1.0-phases/`（`01-row-source-convergence`、`02-checkout`）。

</details>

## Overview

v2.0 把左侧栏的行源从「会话派生的项目 / checkout 分组」换成「用户显式登记的本地文件夹登记表」，并把整块改动收敛成一个自包含模块（`packages/app/src/workspace-sidebar/`），使 `upstream/dev` 的触点降到 5 个文件、约 10 行新增、0 行删除。

三个 phase 按「模型 → 可见性 → 接缝」递进：先让登记表成为纯函数层的唯一真相（每条语义都能在没有 UI、没有网络的前提下断言），再让它驱动行渲染与会话投影（可见性规则与全部交互在这里一次成型），最后把 v1.0 的会话派生行改动全部退回上游，并实测打包隔离与 merge 冲突预算。

**SPEC**：`docs/designs/workspace-registry-sidebar.md`（§8 实施按文件、§11 验证 12 项、§12 冲突预算与演练）。

**硬边界**：只改 `packages/app`（+ `packages/desktop` 打包常量）；不动 `packages/server`、`packages/protocol`、`packages/core` 的 schema、不动 TUI；不新增数据库迁移；不新增协议端点。

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

v2.0 的 phase 编号从 1 重新开始：本里程碑替换 v1.0 的产品模型，v1.0 的 phase 已归档在 `.planning/milestones/v1.0-phases/`，不与本里程碑连续编号。

- [x] **Phase 1: 登记表数据模型与纯函数** - `registry.ts`：路径归一、认领/复用、移除/恢复、order、默认标题，全部由修复前失败的纯单测钉住 (completed 2026-11-14)
- [ ] **Phase 2: 侧栏渲染与会话投影** - 行只来自登记表，行内会话走 `session.list({ directory })`，交付添加/重命名/移除/恢复/排序/空态/不可用态
- [ ] **Phase 3: 上游触点收敛与打包隔离** - 回退 v1.0 的会话派生行改动、5 文件最小接缝、`OPENCODE_CHANNEL=fork`、merge 演练实测并回填预算

## Phase Details

### Phase 1: 登记表数据模型与纯函数
**Goal**: 登记表成为行源的唯一真相，且它的每条语义都能在没有 UI、没有网络的前提下用纯单测断言：归一后的绝对路径即主键，重复登记复用既有记录，移除只是一个时间戳，顺序与默认标题可预测。
**Depends on**: Nothing (first phase)
**Requirements**: REG-01, REG-02, REG-03, PST-02
**Success Criteria** (what must be TRUE):
  1. `registry.ts` 的归一契约可被单测逐条断言：`\`→`/`、折叠重复分隔符、去尾分隔符、Windows 下盘符大写且比较大小写不敏感、其余平台保持大小写敏感；同一路径的不同写法归一到同一个主键。这些用例在实现前失败、实现后全绿。
  2. 同一目录重复登记（含已标记移除的记录）返回既有记录：不产生第二行，`removedAt` 被清空，`title` 与 `order` 原样保留；两个 serverScope 生成的存储 key 不同，各自的登记互不可见。
  3. 移除只写 `removedAt`，记录不删除；登记表的任何操作都不读写目录内容（无 `fs`、无 `location.get`、无 project 写入）；移除后再登记回到原显示名与原顺序。
  4. 顺序与默认标题可预测：新登记追加到 `order` 末尾而不插进已有序列；默认标题取目录最后一段（根目录取盘符或 `/`），用户改名后不再随目录改名。
  5. 持久化落在 `Persist.serverGlobal(serverScope, "workspace-registry.v1")`；`packages/server`、`packages/protocol`、`packages/core` 的 diff 为空（无迁移、无端点）。
**Plans**: 1/1 plans complete
- [x] 01-PLAN.md

### Phase 2: 侧栏渲染与会话投影
**Goal**: 侧栏显示什么完全由登记表决定：每一行是一个未移除的登记项，行内只出现 `directory` 与该行精确相等的会话；添加、重命名、移除、恢复、排序、空态、不可用态全部可用，且没有任何入口能凭空造出一行或漏掉一条会话。
**Depends on**: Phase 1
**Requirements**: REG-04, ROW-01, ROW-02, ROW-03, ROW-04, ROW-05, ROW-06, UX-01, UX-02, UX-03, UX-04, UX-05, PST-01
**Success Criteria** (what must be TRUE):
  1. 同一 git 仓库的两份本地拷贝各自登记后是两行，行内只显示 `directory` 与该行精确相等的会话（子目录会话不出现）；登记后若该目录已有会话，行键采用服务端返回的 `location.directory` 拼写，目录为空时退回本地归一。
  2. 有历史会话但未登记的目录在侧栏完全不出现，侧栏不存在任何「未分组 / 其它」兜底分组；被移除登记的目录，其会话在侧栏任何位置都不出现，但仍可从 Inbox 与命令面板访问。
  3. 重命名只改登记表 `title`（`project.name` / `project.icon` 无写入、目录名与会话标题不变），移除只写 `removedAt`（目录与 `.git` 未动），重新登记回到原显示名与原顺序，新登记追加末尾不抢占手排顺序。
  4. 无登记项时只显示「添加本地文件夹」这一个动作，不自动创建默认工作区；目录被删除或改名后该行可见、标记不可用、不可展开，且不自动指向新路径。
  5. 重启后登记列表、显示名、顺序、移除状态全部保持；`session.created` 按 `location.directory` 归行，`archived` / `unarchived` / `deleted` 只带 `sessionID` 时靠 `sessionID → directory` 内存映射做行级刷新，不重扫全局索引；`bun check --no-script` 对本里程碑新增/改动的 app 文件 0 诊断、`bun test src/workspace-sidebar` 全绿（整包 `bun typecheck` 因 `custom-elements.d.ts` 符号链接缺陷单独记录，不计入本 phase 判定）。
**Plans**: TBD
**UI hint**: yes

### Phase 3: 上游触点收敛与打包隔离
**Goal**: 对上游只剩一个可审计的接缝：v1.0 的会话派生行改动全部退回 `upstream/dev`，接入点收敛成 5 个文件、约 10 行新增、0 行删除（其中 `titlebar.tsx` 的 27 行缩进重排消失），并且 fork 构建与官方安装能在同一台机器上同时运行、后台服务互不顶替。
**Depends on**: Phase 2
**Requirements**: SYNC-01, SYNC-02, SYNC-03
**Success Criteria** (what must be TRUE):
  1. `git diff --stat upstream/dev` 只剩 §8 承诺的 5 个文件（`titlebar.tsx`、`settings/model.tsx`、`shell/shell.tsx`、`general/interface-mode.tsx`、`runtime/i18n/en.ts`），新增合计约 10 行、删除 0 行；`titlebar.tsx` 恢复上游 `<Switch>` 形态，模式选择收进 fork 模块，上游侧只留 1 行插槽。
  2. §8 列出的回退对象与 `upstream/dev` 零差异：`inbox-model.ts`、`session-index.ts`、`session-index.test.ts`、`perf/session-index*`、`inbox.tsx`、`home/sessions/view.tsx`、`project-session-row.tsx`；v1.0 独有的 `projects-groups*`、`perf/projects-groups*` 已删除且全仓 grep 无悬空 import；回退完成后 Inbox 仍能访问被移除工作区的会话（ROW-05 在新基线上重新确认）。
  3. `OPENCODE_CHANNEL=fork` 构建出的应用满足四条隔离实测：`OpenCode Fork` / `ai.opencode.desktop.fork` 身份、独立 `service-fork.json`、独立端口（`10000 + hash("fork") % 50000`）、独立 `opencode-fork.db`；与官方安装同时运行时后台服务互不顶替、单实例互不干扰。
  4. 真实 merge 演练有记录：`git merge-tree --write-tree --name-only upstream/dev workspace-registry` 的冲突文件数 ≤5 且全部为 1–3 行级，结果回填 SPEC §12.3；`bun script/lint-changed.ts <base>` 只含改动文件且 0 problem。
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. 登记表数据模型与纯函数 | 1/1 | Complete    | 2026-11-14 |
| 2. 侧栏渲染与会话投影 | 0/TBD | Not started | - |
| 3. 上游触点收敛与打包隔离 | 0/TBD | Not started | - |
