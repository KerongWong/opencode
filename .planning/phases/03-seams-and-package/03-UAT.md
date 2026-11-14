---
status: complete
phase: 03-上游触点收敛与打包隔离
source: [03-SUMMARY.md]
started: 2026-11-14T03:20:00.000Z
updated: 2026-11-14T12:25:00.000Z
---

## Agent-Run Evidence

本阶段的可观察行为全部是「构建与身份」，由命令直接判定。第一版实现被独立验证器判为 `gaps_found`（2/4），四处断点修复后重跑；下表是最终读数。

## Tests

### 1. 上游触点在上限内
expected: `packages/app` 的上游文件只有 `en.ts` 与 `titlebar.tsx`（无缩进重排块）；`packages/server|protocol|core` 零改动。
result: pass
requirement: SYNC-01
evidence: `git diff --numstat upstream/dev -- packages` → `en.ts +13/−0`、`titlebar.tsx +2/−2`、`workspace-sidebar/*` 7 个新文件；`server/protocol/core` 无条目。

### 2. v1.0 的会话派生行源在本分支无 fork 侧改动
expected: `inbox-model.ts` / `session-index.ts` / `projects-*` / `perf/session-index*` 对上游零差异。
result: pass
requirement: SYNC-02
evidence: 上述路径不在 `git diff --name-only upstream/dev` 里。措辞更正：它们并非「从未存在」，而是「本分支对它们零改动」。

### 3. fork 渠道可以构建
expected: `OPENCODE_CHANNEL=fork bun --cwd packages/desktop build` 成功。
result: pass
requirement: SYNC-03
evidence: build 成功，`out/{main,preload,renderer}` 齐全。

### 4. fork 渠道身份真的生效
expected: 打包产物的可执行文件名、productName、appId 都是 fork。
result: pass
requirement: SYNC-03
evidence: `dist/win-unpacked/OpenCode Fork.exe`；`resources/app-update.yml` 不存在（fork 无更新源）。第一版此条为 fail：`electron.vite.config.ts` 自己的 `resolveChannel()` 不认识 `fork`。

### 5. 四条隔离的取值成立
expected: appId / productName / service 文件 / 端口 / 数据库 与官方不同。
result: pass
requirement: SYNC-03
evidence: `APP_IDS.fork = "ai.opencode.desktop.fork"`、`appNames.fork = "OpenCode Fork"`；CLI 侧 `service-config.filename("fork")` → `service-fork.json`、`defaultPort("fork")` → `10000 + hash%50000`、`database-path` → `opencode-fork.db`。

### 6. 免安装目录
expected: `pack` 产出 `dist/win-unpacked`。
result: pass
requirement: SYNC-03
evidence: `pack` 走完 `@electron/rebuild` → `packaging` → `signing`，无 error。

### 7. 版本一致性
expected: `resources/opencode-cli.version` 与捆绑二进制自报版本相同。
result: pass
requirement: SYNC-03
evidence: 安装包载荷中 `resources/opencode-cli.version` = `0.0.0-fork-202611140413`，载荷内 `opencode-cli.exe --version` 自报 `opencode v0.0.0-fork-202611140413`，两者一致。

### 8. 捆绑 CLI 的渠道
expected: 捆绑的 `opencode-cli.exe` 本身以 `OPENCODE_CHANNEL=fork` 构建。
result: pass
requirement: SYNC-03
evidence: `OPENCODE_CHANNEL=fork bun --cwd packages/cli build` 编出 12 个目标；`cli-windows-x64-baseline/bin/opencode.exe` 自报 `opencode v0.0.0-fork-202611140413`；重新 pack 后安装包载荷里的二进制自报同一版本。**这是「不和官方互相顶替」真正成立的前提**：此前捆绑的是 dev 构建，会打开 `opencode.db`。

### 9. NSIS 安装包
expected: 产出可双击安装的 exe。
result: pass
requirement: SYNC-03
evidence: `pack` 先产出免安装目录 → 复制到仓库外 → `OPENCODE_DESKTOP_APP` 指向副本再跑 `pack`；输出 `target=nsis file=dist\opencode-desktop-win-x64.exe archs=x64 oneClick=true perMachine=false`，产物落在 `dist/desktop/opencode-desktop-win-x64.exe`（255 MB，2026-11-14 12:22）。

## Summary

total: 9
passed: 9
issues: 0
pending: 0
skipped: 0
blocked: 0
failed: 0

## Gaps

无。
