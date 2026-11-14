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

## 最终交付（2026-11-14 12:22）

- **安装包**：`dist/desktop/opencode-desktop-win-x64.exe`（255 MB，NSIS，`oneClick=true`、`perMachine=false`）
- 安装包载荷里：`OpenCode Fork.exe` + `resources/opencode-cli.version` = `0.0.0-fork-202611140413`
- 载荷内 `opencode-cli.exe --version` → `opencode v0.0.0-fork-202611140413`，即 **CLI 本身也是 fork 渠道**
- 载荷内 `resources/app-update.yml` 不存在（fork 无更新源）

构建链：`OPENCODE_CHANNEL=fork bun --cwd packages/cli build`（12 个目标）→ `desktop build` → `pack`（免安装目录）→ 复制到仓库外 → `OPENCODE_DESKTOP_APP=<副本> pack`（NSIS）。

三条隔离现在都由 CLI 自身持有：`service-fork.json`、`10000 + hash("fork") % 50000` 端口、`opencode-fork.db`。

## 偏差与如实记录

- **SYNC-02（回退 v1.0 的会话派生行源）在本分支是空操作**：本分支从 `upstream/dev` 切出，相关文件从未被改动，因此「回退」表现为「证明它们不在 diff 里」。
- **merge 演练不构成预算证据**：`upstream/dev` 是本分支的祖先（0 领先 / 29 落后），`merge-tree` 必然无冲突；冲突预算只能按 §12.2 的上游同期分支表与 §12.4 的触点清单估计。
- **`pack` 会先清空 `dist/`**：NSIS 那一步必须先把免安装目录复制到仓库外再跑，否则 `--prepackaged` 指向的目录会被自己删掉。
