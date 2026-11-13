# Phase 1 Context — 登记表数据模型与纯函数

> 里程碑 v2.0「工作区登记侧栏」的第 1 个 phase。SPEC：`docs/designs/workspace-registry-sidebar.md`（§4.3 登记表、§4.4 路径归一、§9 语义规格）。本文件只补 planner 需要的取舍，不重复 SPEC。

## 本 phase 的范围

**只做纯函数与持久化形状，不渲染、不发请求。**

- 新建 `packages/app/src/workspace-sidebar/registry.ts`（含 `registry.test.ts`）。
- 契约：归一、认领/复用、移除/恢复、order、默认标题、server 作用域。
- 映射需求：REG-01、REG-02、REG-03、PST-02。

**不做**（属 Phase 2）：`session.list`、事件映射、行渲染、任何 UI、`row-sessions.ts`。

## 已锁的取舍

| 决定 | 内容 |
|---|---|
| 键 | 归一后的绝对路径（`directory`），不是 projectID、不是 git remote、不是分支名 |
| 归一 | `\`→`/` → 折叠重复分隔符 → 去尾分隔符 → Windows 盘符大写；比较时 Windows 不区分大小写，其余平台区分 |
| realpath | **不做**。客户端没有 `fs`；符号链接别名会登记成两个工作区，这是已承认的残余，必须写进注释 |
| 存储 | `Persist.serverGlobal(serverScope, "workspace-registry.v1")` —— 不同 server 互不干扰 |
| 重复登记 | 静默复用既有记录（含已移除的）：不新增行、清 `removedAt`、保留 `title` 与 `order` |
| 移除 | 只写 `removedAt`；**不删记录**、不动目录、不碰会话 |
| 默认标题 | 目录最后一段；根目录取盘符（`C:`）或 `/`；用户改过名后不再跟随 |
| order | 单调递增序号；新登记追加到末尾，不重排既有项 |
| 副作用 | 本 phase **零 I/O**：不调用 `location.get`、不调用 `session.list`、不写 `project` |

## 硬边界

- 不改 `packages/server`、`packages/protocol`、`packages/core` 的 schema；不新增迁移或端点。
- 不写 `project.name` / `project.icon`。
- 纯函数：所有输入显式传入（含 `platform` 与 `serverScope`），不在模块里读全局。

## 验收形状

每个契约都要有**修复前能失败**的单测。门：

- `cd packages/app && bun test --conditions=solid --isolate --preload ../ui/test/solid-jsx.ts --preload ./happydom.ts src/workspace-sidebar`
- `bun check --no-script`（整包 typecheck 因 `custom-elements.d.ts` 符号链接缺陷不可用）
- `bun script/lint-changed.ts <base>`

## 现状前提（执行前重读，不要凭记忆）

- 这个分支从 `upstream/dev` 切出，v1.0 的 `projects.*` 文件**不存在**，不要引用它们。
- `Persist.serverGlobal` 的先例：`packages/app/src/settings/models/models.tsx`；`persisted()` 在 `packages/app/src/runtime/persistence/storage.ts`。
- `packages/app/AGENTS.md` §Tests：一个契约一个 owner；不为测试加生产 seam；测试必须能失败。
