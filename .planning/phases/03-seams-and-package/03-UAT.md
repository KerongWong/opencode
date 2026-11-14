---
status: complete
phase: 03-上游触点收敛与打包隔离
source: [03-SUMMARY.md]
started: 2026-11-14T03:20:00.000Z
updated: 2026-11-14T04:10:00.000Z
---

## Agent-Run Evidence

本阶段的可观察行为全部是「构建与身份」，由命令直接判定。第一版实现被独立验证器判为 `gaps_found`（2/4），四处断点已修复后重跑；下表是修复后的读数。

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
evidence: 上述路径不在 `git diff --name-only upstream/dev` 里。**措辞更正**：它们并非「从未存在」，而是「本分支对它们零改动」——验证器指出了这个区别。

### 3. fork 渠道可以构建
expected: `OPENCODE_CHANNEL=fork bun --cwd packages/desktop build` 成功。
result: pass
requirement: SYNC-03
evidence: build 成功，`out/{main,preload,renderer}` 齐全。

### 4. fork 渠道身份真的生效
expected: 打包产物的可执行文件名、productName、appId 都是 fork。
result: pass
requirement: SYNC-03
evidence: `dist/win-unpacked/OpenCode Fork.exe` 存在；`dist/win-unpacked/resources/app-update.yml` 不存在（fork 无更新源，`pack.ts` 已加守卫）。**第一版此条为 fail**：`electron.vite.config.ts` 自己的 `resolveChannel()` 不认识 `fork`，`CHANNEL` 折叠成 `dev`；修复后重打包才成立。

### 5. 四条隔离的取值成立
expected: appId / productName / service 文件 / 端口 / 数据库 与官方不同。
result: pass
requirement: SYNC-03
evidence: `APP_IDS.fork` / `appNames.fork` 已登记；桌面端在服务注册时传 `channel: "fork"`，因此 `service-config.filename("fork")` → `service-fork.json`、`defaultPort` → `10000 + hash%50000`、`database-path` → `opencode-fork.db`。**限制**：捆绑的 CLI 二进制仍是 dev 渠道构建（见 Test 7）。

### 6. `pack` 能出免安装目录
expected: `pack` 产出 `dist/win-unpacked`。
result: pass
requirement: SYNC-03
evidence: `pack` 走完 `@electron/rebuild` → `packaging` → `signing`，无 error；`dist/win-unpacked` 内有 `OpenCode Fork.exe`。

### 7. 版本一致性
expected: `resources/opencode-cli.version` 与捆绑二进制自报版本相同。
result: pass
requirement: SYNC-03
evidence: 捆绑二进制自报 `opencode v0.0.0-dev-202611120134`；`bun --cwd packages/desktop build` 后 `resources/opencode-cli.version` 与 `dist/win-unpacked/resources/opencode-cli.version` 均为 `0.0.0-dev-202611120134`。此前我曾把它误写成 `2.2.7`，那会让后台服务反复 replace 到超时。

### 9. 捆绑 CLI 的渠道
expected: 捆绑的 `opencode-cli.exe` 本身以 `OPENCODE_CHANNEL=fork` 构建。
result: fail
requirement: SYNC-03
blocked_by: other
evidence: 二进制自报 `0.0.0-dev-202611120134`，即 dev 渠道构建。桌面端在服务注册时传的是 `channel: "fork"`，所以 `service-fork.json` / 独立端口 / `opencode-fork.db` 这些**由桌面侧参数决定**的部分已经隔离；但 CLI 编译期烘焙的 channel 仍是 `dev`。
reason: CLI 的 channel 在编译期烘焙进二进制，没有运行期覆盖入口；重建 CLI（`packages/cli` 的二进制构建）不在本轮预算内。

### 8. NSIS 安装包
expected: 产出可双击安装的 exe。
result: skipped
reason: 需要把 `dist/desktop/app` 复制到仓库外、设 `OPENCODE_DESKTOP_APP` 再跑一次 `pack`（`docs/designs/build-desktop.md` 第 3 步）。本轮止于免安装目录。

## Summary

total: 9
passed: 6
issues: 1
pending: 0
skipped: 1
blocked: 0
failed: 1

## Gaps

- **GAP-03-01（SYNC-03）**：捆绑 CLI 是 dev 渠道构建。要让「与官方共存、后台互不顶替」在 CLI 侧也成立，需 `OPENCODE_CHANNEL=fork` 重建 `packages/cli` 二进制，并让 `resources/opencode-cli.version` 跟随它。
- **GAP-03-02**：NSIS 安装包未产出（免安装目录已可用）。
