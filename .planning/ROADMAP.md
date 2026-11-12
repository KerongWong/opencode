# Roadmap: OpenCode Desktop 个人 Fork — Projects 侧栏

## Milestones

- 🚧 **v1.0 Projects 侧栏正确性** - Phases 1-3 (in progress)

## Overview

本里程碑只解决 Projects 侧栏「显示出哪些项目行」的正确性，不新增交互能力。三个 phase 依次收敛三层身份：会话行源（哪些会话有资格生成行）、checkout 身份（同一 git 根的哪些本地目录算一个项目）、持久化 key（重启后如何认出同一行）。范围严格限定在 `packages/app`，每个修复都配一个在修复前会失败的回归测试，纯函数边界优先。

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

- [ ] **Phase 1: 行源收敛** - 只从单一有界会话窗口生成项目行，归档与进程内临时会话不再造行
- [ ] **Phase 2: 每个本地 checkout 成行** - 进入模式时按需加载 worktree 清单，并用 `sandboxes` 兜底分组
- [ ] **Phase 3: 持久化 key 与接缝文档** - 统一 group key 构造/解析，迁移并裁剪 v1 状态，校准接缝表

## Phase Details

### Phase 1: 行源收敛
**Goal**: Projects 侧栏只从服务器索引的单一有界窗口推导项目行；已归档会话、以及本进程内临时加载但不在窗口内的旧会话，都不再生成或新增项目行。
**Mode:** mvp
**Depends on**: Nothing (first phase)
**Requirements**: SRC-01, SRC-02, SRC-03
**Success Criteria** (what must be TRUE):
  1. 在 Inbox 归档一个会话后切到 Projects，该会话不再出现在任何项目行中；若该组因此没有任何会话，这一行也不再出现。
  2. 本进程内打开一个早于服务器索引窗口的旧会话后，Projects 的项目行集合不变；重启应用后看到的仍是同一组项目。
  3. Projects 与 Inbox 对归档的判断一致：Inbox 的归档分区仍能看到该会话，Projects 的活跃行永远看不到它。
  4. `packages/app` 下运行的测试覆盖 `mergeRootSessionIndex` 的「archived known session」与「known-only（离线）列表」两种契约，并且这些用例在修复前的代码上失败。
**Plans**: 3/3 plans executed (including the 01-03 gap-closure plan)

Plans:
**Wave 1**
- [x] 01-01: 归档会话不再产生项目行——`mergeRootSessionIndex` 增加 `includeArchived` 选项（默认保留归档），`createSessionInbox` 按 `options.archived` 派生并传入；新增 `session-index` 的 archived-known / live-archive / Inbox 默认契约测试（修复前失败）。

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 01-02: 收敛 known 合并窗口——`boundedKnown` 以索引窗口的 `time.updated` 为下限，空索引时回退到 known-only 列表，仅作用于 Projects 视图（Inbox 视图不受限）；补边界、离线、重启一致性与 strobe 基准。

**Wave 3** *(blocked on Wave 2 completion)*
- [x] 01-03: 关闭验证缺口——`inbox-sessions` 只请求活跃 root（`archived: false`）；`mergeRootSessionIndex` 以「页面已获取 / 未获取」区分空页面与离线，floor 仅由可存活行推导；补 50 条全归档页面、重启一致性与混合页面回归，并复用既有 strobe 用例测量。

**UI hint**: yes

### Phase 2: 每个本地 checkout 成行
**Goal**: 进入 Projects 模式时按需为可见项目加载 worktree 清单，并在清单到达前用项目已有的 `sandboxes` 兜底，使同一 git 根的每份本地 checkout 恰好一行，checkout 内的子目录不再各自成行。
**Mode:** mvp
**Depends on**: Phase 1
**Requirements**: CHK-01, CHK-02, CHK-03, CHK-04
**Success Criteria** (what must be TRUE):
  1. 在未打开任何 Location、Settings › Worktrees 或 Home 项目页的全新启动中直接进入 Projects，每个可见 `projectID` 的 worktree 清单恰好请求一次，并在后续渲染与会话更新中被复用。
  2. 同一 git 根的两份本地拷贝显示为两行；`repo/packages/app` 与 `repo/packages/ui` 中的会话归入同一个 checkout 行，而不是两个项目。
  3. worktree 清单返回前，分组已经使用 `project.sandboxes`；清单到达后不会把已有的 checkout 行拆成多行，也不会改写已有行的 group key。
  4. 若某份 checkout 在会话窗口内没有任何会话，该行要么以空组可见，要么在 `docs/designs/project-grouped-sessions-sidebar.md` 中记录不显示它的理由（二选一，并在验证记录中指明选了哪个）。
  5. `projects-groups` 的回归测试同时覆盖「有 inventory」与「只有 canonical + sandboxes」两条路径，且在修复前失败。
**Plans**: 2 plans

Plans:
- [ ] 02-01: 在 `projects.tsx` 为可见项目按需请求 worktree inventory（优先 `cached`、每个 `projectID` 一次、渲染期间不 `refresh`），符合 `workspaces/inventory.ts` 的 `staleTime: Infinity` 约定。
- [ ] 02-02: 在 `projects-groups.ts` 的 `sessionProjectDirectory` 增加 `project.sandboxes` 兜底，并补两条路径的回归测试（inventory / canonical + sandboxes）。

**UI hint**: yes

### Phase 3: 持久化 key 与接缝文档
**Goal**: 项目行身份只有一个 key 构造/解析入口；`projects-sidebar.v1` 的历史异构 key 迁移到 v2 并按当前行裁剪；接缝文档与实测 diff 一致，使拖拽顺序、已移除状态和 merge 成本在重启与上游同步后仍然可信。
**Mode:** mvp
**Depends on**: Phase 2
**Requirements**: PSK-01, PSK-02, PSK-03, DOC-01
**Success Criteria** (what must be TRUE):
  1. `groupKey(server, checkout)` 与 `parseGroupKey(key)` 是唯一实现：`projects-groups.ts`、`projects.tsx`、`inbox-model.ts` 中不再有内联 `\u0000` 拼接或按 NUL 切片（可用 grep 验证）。
  2. 带着 `projects-sidebar.v1` 升级后首次启动，仍然有效的 `order` 与 `removed` 被保留，原来的拖拽顺序和已移除项目不丢失；不再匹配的旧 key、反斜杠变体与改名前 key 被丢弃。
  3. 状态写入 `projects-sidebar.v2`，其中 `order`/`removed` 按当前存在的 key 加有界最近集合裁剪，不再随会话历史无限增长。
  4. key 往返与 v1→v2 迁移的单元测试覆盖 legacy 反斜杠 key，且在实现前失败。
  5. 设计文档的接缝表与 `git diff --stat origin/dev...HEAD -- packages/app/src` 的实测一致（12 文件 +76/−19），`SEAMS.md` 要么存在，要么文档中对该文件的承诺已删除。
**Plans**: 3 plans

Plans:
- [ ] 03-01: 在 `projects-groups.ts` 增加 `groupKey`/`parseGroupKey` 并替换 `projects.tsx`、`inbox-model.ts` 的内联拼接/切片，附 key 往返测试。
- [ ] 03-02: 在 `projects-state.ts` 实现 `projects-sidebar.v1` → v2 迁移与裁剪（保留有效 `order`/`removed`、丢弃失效 key），补 legacy 反斜杠 key 的迁移测试。
- [ ] 03-03: 用实测 diff 更新 `docs/designs/project-grouped-sessions-sidebar.md` 的接缝表，并补上 `SEAMS.md` 或删除该承诺。

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. 行源收敛 | 3/3 | In Progress | - |
| 2. 每个本地 checkout 成行 | 0/2 | Not started | - |
| 3. 持久化 key 与接缝文档 | 0/3 | Not started | - |
