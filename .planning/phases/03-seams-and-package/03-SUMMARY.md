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
- `bun script/lint-changed.ts upstream/dev` → **0 problem / 16 files**
- `OPENCODE_CHANNEL=fork bun --cwd packages/desktop build` → 成功
- `OPENCODE_CHANNEL=fork bun --cwd packages/desktop pack` → 成功，产出 `dist/win-unpacked/OpenCode Fork.exe`
- `dist/win-unpacked/resources/app-update.yml` **不存在**（fork 故意没有更新源）
- `git diff --numstat upstream/dev -- packages` → `packages/app` 仍只有 2 个上游文件、净 13 行

## 验证器回归（2026-11-14，gaps_found → 逐条修复）

独立验证器判定 `gaps_found`（2/4），抓到我第一版实现里的四处真问题。它们不是措辞问题，是功能不生效：

| # | 断点 | 修复 |
|---|---|---|
| 1 | `packages/desktop/electron.vite.config.ts` 有**自己**的 `resolveChannel()`，不认识 `fork` → 构建时 `CHANNEL` 回落 `dev`，产物里的 `APP_NAME/APP_ID` 折叠成 dev | 该 `resolveChannel()` 加 `fork` |
| 2 | `electron-builder.config.ts` 的 `getConfig()` 没有 `fork` 分支 → 返回 `undefined` → schema 校验报 `unknown property '__esModule'/'getConfig'` | 加 `case "fork"`（`OpenCode Fork`，**无 publish**） |
| 3 | `script/pack.ts` 无条件读 `getConfig().publish` → fork 没有 publish 时崩 | `publish` 缺失时跳过写 `app-update.yml` |
| 4 | `appNames`/`appIDs` 用开放字典类型 → `anti-slop(no-known-value-widening)` 两条 | 改 `satisfies Record<string, string>` 并补 `local` 键 |

**第一版 SUMMARY 曾写「产物已烘焙 fork 身份」，那是错的**：`out/main/index.js` 里出现 `ai.opencode.desktop.fork` 只说明表项在包里，不代表被使用；`electron.vite.config.ts` 的 `resolveChannel()` 才是决定 `CHANNEL` 的地方。上面的修复之后 `dist/win-unpacked/OpenCode Fork.exe` 才真正带上 fork 身份。

## 仍未完成

- **捆绑 CLI 是 dev 渠道构建**（自报 `0.0.0-dev-202611120134`）。桌面端在服务注册时传的是 `channel: "fork"`，因此 `service-fork.json` / 独立端口 / `opencode-fork.db` 来自桌面侧的参数；但 CLI 自身编译期烘焙的 channel 仍是 `dev`。要彻底消除「顶替官方后台」的可能，需要用 `OPENCODE_CHANNEL=fork` 重新构建 `packages/cli` 的二进制。这一步没有做。
- **NSIS 安装包未产出**：本轮只到 `dist/win-unpacked`。生成安装包要把该目录复制到仓库外、设 `OPENCODE_DESKTOP_APP` 再跑一次 `pack`。
- `resources/opencode-cli.version` 与二进制自报版本的一致性：已把 `packages/cli/dist/.../package.json` 改回二进制自报的 `0.0.0-dev-202611120134`（此前被我误写成 `2.2.7`，会让后台服务反复重启）。

## 偏差与如实记录

- **SYNC-02（回退 v1.0 的会话派生行源）在本分支是空操作**：本分支从 `upstream/dev` 切出，`inbox-model.ts` / `session-index.ts` / `projects-*` 从未存在，因此「回退」表现为「证明它们不在 diff 里」（上表可证）。
- **merge 演练不构成预算证据**：`upstream/dev` 是本分支的祖先（0 领先 / 29 落后），`merge-tree` 必然无冲突；冲突预算只能按 §12.2 的上游同期分支表与 §12.4 的触点清单估计。
- **安装包（NSIS）未构建**：本阶段只做到 `pack` 的免安装目录。构建 NSIS 需要把 `dist/desktop/app` 复制到仓库外再跑一次 `pack`（`docs/designs/build-desktop.md` 第 3 步），并且要等 electron 工具链下载；这一步没有在本轮执行。
