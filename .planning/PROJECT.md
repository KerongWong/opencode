# OpenCode Desktop 个人 Fork — Projects 侧栏

## What This Is

`anomalyco/opencode`（OpenCode Desktop）的个人 fork，仅供本人日常使用：不向上游推送、不提 PR、不发布。上游代码保持最小接缝，自有功能只有一处——按本地 checkout 分组的 **Projects 侧栏**（`tabLayout = "projects"`），用「项目 → 最近会话」替代纯标签页管理，让同时进行 4–9 个项目时不用先回 Home 找会话。

## Core Value

无论启动顺序、仓库布局、服务器 URL 如何变化，Projects 侧栏都稳定显示「我的项目 × 本地 checkout」及其会话：不出现没打开过的幽灵项目，不把一个 checkout 拆成多行，也不漏掉一份本地拷贝。

## Requirements

### Validated

<!-- 已实现并在本机使用中观察到的能力。 -->

- ✓ Projects 成为第四种界面模式，与 Top tabs / Side tabs / Inbox 互不干扰，切换与重启正常 — `65f7866b7e`
- ✓ 按项目分组会话，项目内按更新时间倒序，每组默认 5 条 + Show more — `shell/titlebar/projects.tsx`
- ✓ 按本地 checkout 分组：同一 git 根的不同目录分成不同行 — `shell/titlebar/projects-groups.ts`（`65aaf126b0`）
- ✓ 拖拽排序、顺序持久化、滚动位置恢复 — `shell/titlebar/projects-state.ts`
- ✓ 项目行操作：重命名、在文件管理器中显示、从侧栏移除并在 toast 中恢复
- ✓ 会话行状态：审批 / 等待输入 / 运行中 / 失败 / 完成，以及相对时间
- ✓ 未归类会话（`ungrouped`）保留在列表末尾，不会消失

### Active

- [ ] 侧栏行源收敛：没打开过的项目、已归档会话、只在内存里出现过的会话不再生成项目行
- [ ] 同一 git 根的不同本地 checkout 都能成行：进入 Projects 模式时按需加载 worktree 清单，并用项目已有的 `sandboxes` 兜底
- [ ] 持久化 key 规范化：引入统一的 group key 构造/解析，迁移并裁剪 `projects-sidebar.v1` 的历史与异构 key
- [ ] 上述行为各有能失败的回归测试（纯函数边界优先）

### Out of Scope

- 向上游提交 PR、发布构建、维护 CHANGELOG — 个人 fork，明确不参与上游流程
- 项目级新建会话、归档会话、项目右键菜单 — 设计文档 `docs/designs/project-grouped-sessions-sidebar.md` 记录的取舍
- Show more 的分页拉取 — 需要服务端「按项目查会话」的接口，属于上游能力
- 冷启动自动打开最近修改的会话 — 设计文档中的第三提交从未落地，先显式排除
- 修复 `@opencode/ui/activity-ring` 的无 layer CSS 根因 — 会改变所有调用点观感，当前环境无法验证
- 折叠/展开状态持久化 — 不在本里程碑的风险收益比内

## Context

- **数据源**：`createSessionInbox()`（`shell/titlebar/inbox-model.ts`）返回服务器最新 50 条未归档根会话（`INDEX_LIMIT`）与客户端内存 `data.session.known()` 的并集，合并逻辑在 `runtime/server/session-index.ts`。
- **项目身份**：git 身份（remote 或 root commit 哈希），不是路径；同一仓库的多份本地拷贝共享同一个 `projectID`（`packages/core/src/project.ts`）。
- **分组 key**：`${server}\u0000${comparablePath(checkout)}`，checkout 由 `sessionProjectDirectory` 从项目已知目录里挑最近的包含者（`projects-groups.ts`）。
- **worktree 清单**：`normalizeProjectInfo` 总是给出 `worktrees: [canonical]`，完整清单只有 `sync.worktrees.list(projectID)` 被调用后才有（Home 选项目、Settings › Worktrees、Location 提供者）。
- **设计文档**：`docs/designs/project-grouped-sessions-sidebar.md`（目标、约束、接缝清单、已知取舍）。
- **代码库地图**：`.planning/codebase/`（STACK / ARCHITECTURE / STRUCTURE / CONVENTIONS / TESTING / INTEGRATIONS / CONCERNS）。
- **本机环境**：Windows；桌面端 `ai.opencode.desktop.dev`（Electron，sidecar 服务器）；数据在 `~/.local/share/opencode/opencode.db`；不得重启应用或服务进程。

## Constraints

- **技术**：只改 `packages/app`；不动 `packages/server`、`packages/protocol`、数据库 schema、TUI（设计文档约束 3）。
- **上游合并**：会持续 merge `upstream/dev`，接缝面积是首要成本；优先「只增不改」，不顺手重构上游文件。
- **避免 bug 优先于功能完整**：设计文档把「不出 bug」排在「功能完整」之前；每个修复都要有能失败的回归测试。
- **测试规范**：遵循 `packages/app/AGENTS.md`——一个契约一个 owner、测试必须能失败、不 mock 被断言的行为、不给生产代码加测试专用参数。
- **性能**：会话/时间线热路径改动前要用 strobe 对 `origin/dev` 做基准；侧栏分组目前在每次会话更新时重算。
- **提交**：本仓库默认不自动 `git commit`；规划文档只保存在本地 `.planning/`（已加入 `.git/info/exclude`）。

## Key Decisions

<!-- 约束后续工作的决定。 -->

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| 做成第四种界面模式，而不是扩展现有三种 | 不动 tab 状态机，冲突面最小 | ✓ Good |
| 不复用上游 `SidebarOrganized` | 数据源（inbox 索引）与交互（替换整条 tab 栏）不同 | ⚠️ Revisit（上游若成熟可整体替代，冲突面归零） |
| 分组按本地 checkout 而不是 `projectID` | 同一 git 根的多份拷贝共享 projectID，按 ID 会合并成一行 | ✓ Good |
| 复用 inbox 索引，不另建数据源 | 避免副本与不一致 | ⚠️ Revisit（`known` 无界合并导致行源不可复现） |
| 上游文件只加最小接缝 | 上游 `shell/` 是最热目录 | ⚠️ Revisit（实际接缝已从 8 文件 +61 漂到 12 文件 +76/−19） |

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

---
*Last updated: 2026-11-12 after initialization*
