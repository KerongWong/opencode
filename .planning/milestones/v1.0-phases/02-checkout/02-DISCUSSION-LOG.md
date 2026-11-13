# Phase 2: 每个本地 checkout 成行 - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-11-13
**Phase:** 2-每个本地 checkout 成行
**Areas discussed:** 清单加载时机

---

## 讨论范围

首轮给出 4 个灰区（① 清单加载时机 / ② 兜底与 key 稳定 / ③ 空 checkout 行 / ④ 回归测试落点），用户只选 ①。完成 ① 的第一个问题后用户表示「按照你认为最优的方式来执行，非必要不要来问我」，因此 ②③④ 由 agent 依据代码与文档定案并记入 CONTEXT.md。

---

## ① 清单加载时机

### 问题 1：清单请求写在哪一层？

| Option | Description | Selected |
|--------|-------------|----------|
| SidebarProjects 内的 effect | 组件挂载即「进入模式」；从 `inbox.entries()` 取可见 projectID，调 `entry.ctx.sync.worktrees.list(id)`。`sync.tsx` 的 `updated` 回调把结果写回 `globalStore.project`，`groups()` 自动重算。不碰 Inbox 视图，上游接缝 0 行。 | ✓ |
| 下沉到 createSessionInbox | 分组在首帧前就拿到清单，`repo/packages/ui` 不会瞬时单独成行。代价：网络请求下沉到 Phase 1 刚收敛的行源层；`createSessionInbox` 还被 Inbox 视图复用，不加开关会连带请求。 | |
| 挂在 sync.tsx / bootstrap | 只需一个 effect，逻辑最少。但违反 CHK-01「按需为可见项目」：冷启动会为服务器上每个项目发一次请求。 | |

**User's choice:** SidebarProjects 内的 effect
**Notes:** 用户未补充理由；与 CHK-01 的「按需」及「最小接缝」一致。

### 问题 2–4（未逐条发问，由 agent 定案）

用户在同一轮请求「非必要不要来问我」，因此以下判断未经逐条确认，按代码事实定案：

- **「恰好一次」的判据** → 组件内 `Set<server\0projectID>` + `cached()` 判空。理由：`inventory.list()` 用 `staleTime: 0`，单靠缓存判空无法阻止同一挂载内的重复；单靠 Set 无法阻止切走再切回模式时的重复请求。
- **失败语义** → 静默降级到 `sandboxes`，不重试、不弹 toast；恢复依赖重进模式 / `worktree.updated` / 重连。
- **首帧** → 不引入 loading，接受 `sandboxes` 的临时分组。

---

## ② 兜底与 key 稳定（未讨论，agent 定案）

- 根集合 = `worktrees` ∪ `sandboxes` ∪ `worktree`，最近的包含者胜出。
- 不冻结映射、不做嵌套过滤。依据：`withWorktreeInventory` 把 `sandboxes` 重算为「清单目录减 canonical」，两者是同一集合的两种视图。
- 成功标准 3 的解读：同一 checkout 身份不变即可；清单揭示的更深的 checkout 合法地接管其内部会话。

## ③ 空 checkout 行（未讨论，agent 定案）

- 选成功标准 4 的「不显示」分支，并在设计文档记录理由。依据：显示空行需要遍历 projects × checkouts，等于新开行源，与 Phase 1 的「无幽灵项目」冲突。

## ④ 回归测试落点（未讨论，agent 定案）

- `projects-groups.test.ts` 扩充「有 inventory」与「canonical + sandboxes」两条路径，并断言两者对同一批会话产出相同 key。
- 「每个 projectID 只请求一次」不新增自动化测试：`inventory.test.ts` 已拥有缓存与共享在途请求契约，组件内的 Set 是单次使用的实现细节；按 `packages/app/AGENTS.md` 不为测试加 seam。
- 请求次数改为在验证记录里用 dev 服务器观察。

---

## Agent's Discretion

- effect 的具体形状与去重比较方式。
- 是否为「canonical 也要显式入列」加注释。
- 是否引入 per-project 根集合缓存（仅当 strobe 实测回归）。

## Deferred Ideas

- 空 checkout 行的显式展示：已明确不做，重新考虑前需先解决行源问题。
- 根集合缓存：条件性依赖 strobe 结果，不作为本 phase 的默认工作。
