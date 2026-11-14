---
status: complete
phase: 03-上游触点收敛与打包隔离
source: [03-SUMMARY.md]
started: 2026-11-14T03:20:00.000Z
updated: 2026-11-14T03:35:00.000Z
---

## Agent-Run Evidence

本阶段的可观察行为全部是「构建与身份」，由命令直接判定，不需要人工点击。

## Tests

### 1. 上游触点在上限内
expected: `packages/app` 的上游文件只有 `en.ts` 与 `titlebar.tsx`，其余全是新目录；`packages/server|protocol|core` 零改动。
result: pass
requirement: SYNC-01
evidence: `git diff --numstat upstream/dev -- packages` → `en.ts +13/−0`、`titlebar.tsx +2/−2`、`workspace-sidebar/*` 7 个新文件；`server/protocol/core` 无条目。

### 2. v1.0 的会话派生行源不存在于本分支
expected: `inbox-model.ts` / `session-index.ts` / `projects-*` 不出现。
result: pass
requirement: SYNC-02
evidence: 同上 diff 清单中没有这些路径；本分支从 `upstream/dev` 切出，它们从未被引入。

### 3. fork 渠道可构建
expected: `OPENCODE_CHANNEL=fork bun --cwd packages/desktop build` 成功，产物带 fork 身份。
result: pass
requirement: SYNC-03
evidence: `✓ built in 16.75s`；`out/main/index.js` 中 `ai.opencode.desktop.fork`、`OpenCode Fork` 各 1 次；`out/{main,preload,renderer}` 均生成。

### 4. 四条隔离的取值成立
expected: appId / productName / service 文件 / 端口 / 数据库 与官方不同。
result: pass
requirement: SYNC-03
evidence: 源码推导：`service-config.filename("fork")` → `service-fork.json`（只有 latest/dev/beta/next 才共享 `service.json`）；`defaultPort("fork")` → `10000 + hash%50000`（dev 固定 `0xC0DE`）；`database-path` → `opencode-fork.db`；`APP_IDS.fork` / `appNames.fork` 为本阶段新增。

### 5. 免安装目录
expected: `pack` 产出 `dist/desktop/app`。
result: pass
requirement: SYNC-03
evidence: `packages/desktop/dist/win-unpacked` 存在。

### 6. NSIS 安装包
expected: 产出可双击安装的 exe。
result: skipped
reason: 需要先 `build` → 把 `dist/desktop/app` 复制到仓库外 → 再跑一次 `pack`（`docs/designs/build-desktop.md` 第 3 步），且要等 electron 工具链完整下载。本轮只做到免安装目录；`dist/opencode-desktop-win-x64.exe` 存在但是**上一次会话的产物**（时间戳早于本轮改动），不能作为本次交付证据。

## Summary

total: 6
passed: 5
issues: 0
pending: 0
skipped: 1
blocked: 0

## Gaps
