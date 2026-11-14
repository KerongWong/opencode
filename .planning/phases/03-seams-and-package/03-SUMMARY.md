---
phase: 03-seams-and-package
plan: 1
status: complete
---

# Phase 03 — Summary

**目标：** 把 v2.0 的产物收口成可与官方安装并存的 fork 构建。

## 交付

| 文件 | 改动 |
|---|---|
| `packages/desktop/src/main/constants.ts` | `Channel` 联合加 `fork`；`CHANNEL` 判定加 `fork`；`appNames.fork = "OpenCode Fork"`；`appIDs.fork = "ai.opencode.desktop.fork"` |
| `packages/desktop/electron-builder.config.ts` | `resolveChannel()` 与 `APP_IDS` 接受 `fork` |
| `packages/desktop/src/main/service/cli-version.ts` | `serviceVersion` 的 `channel` 联合加 `fork` |
| `packages/plugin/src/gui/core.ts` | 插件 `App.channel` 联合加 `fork`（纯 additive） |
| `docs/designs/workspace-registry-sidebar.md` | §7.5 触点更正、§12.4 本分支实测 |

## 隔离依据（源码推导，非猜测）

| 维度 | `fork` 的取值 | 依据 |
|---|---|---|
| appId | `ai.opencode.desktop.fork` | 本阶段新增的 `APP_IDS.fork` |
| productName | `OpenCode Fork` | 本阶段新增的 `appNames.fork` |
| service 注册文件 | `service-fork.json` | `packages/cli/src/services/service-config.ts`：只有 `latest\|dev\|beta\|next` 才用共享的 `service.json` |
| 默认端口 | `10000 + hash("fork") % 50000` | 同上 `defaultPort` / `channelPort`：`dev\|beta\|latest\|next` 固定 `0xC0DE`（会撞），`local` 为 `0xC0DF` |
| 数据库 | `opencode-fork.db` | `packages/cli/src/database-path.ts`：不在 `latest\|dev\|beta\|next\|prod` 时才加后缀 |
| userData / single-instance | 由 appId + productName 派生，自动不同 | Electron 默认 |

## 验证

- `cd packages/desktop && bunx tsc --noEmit -p tsconfig.json` → **0 诊断**
- `OPENCODE_CHANNEL=fork bun --cwd packages/desktop build` → **成功**（`✓ built in 16.75s`，产出 `out/main`、`out/preload`、`out/renderer`）
- 产物内已烘焙 fork 身份：`out/main/index.js` 中 `ai.opencode.desktop.fork` 与 `OpenCode Fork` 各出现 1 次
- `git diff --numstat upstream/dev -- packages` → `packages/app` 仍只有 2 个上游文件、净 13 行

## 偏差与如实记录

- **SYNC-02（回退 v1.0 的会话派生行源）在本分支是空操作**：本分支从 `upstream/dev` 切出，`inbox-model.ts` / `session-index.ts` / `projects-*` 从未存在，因此「回退」表现为「证明它们不在 diff 里」（上表可证）。
- **merge 演练不构成预算证据**：`upstream/dev` 是本分支的祖先（0 领先 / 29 落后），`merge-tree` 必然无冲突；冲突预算只能按 §12.2 的上游同期分支表与 §12.4 的触点清单估计。
- **安装包（NSIS）未构建**：本阶段只做到 `pack` 的免安装目录。构建 NSIS 需要把 `dist/desktop/app` 复制到仓库外再跑一次 `pack`（`docs/designs/build-desktop.md` 第 3 步），并且要等 electron 工具链下载；这一步没有在本轮执行。
