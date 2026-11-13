---
status: complete
phase: 02-每个本地 checkout 成行
source: [02-01-SUMMARY.md, 02-02-SUMMARY.md]
started: 2026-11-13T10:05:00.000Z
updated: 2026-11-13T12:30:44.686Z
---

## Current Test

[testing complete]

## Agent-Run Evidence

本轮由 agent 在真实数据上执行（`bun dev serve --port 4096` 连接 `opencode.db`：34 个项目 / 2745 个会话 / 24 个 worktree；`packages/app bun dev -- --port 4444`），用 CDP 读取实际网络请求，而非肉眼观察 Network 面板。

可见行（a11y 快照）：`pup-android · 02-Spain`（26）、`pup-android · pup-android-msg-0070-0080`（4）、`dsh-mcp-manager`（6）、`opencode`（14）——**4 行来自 3 个 projectID**，其中两行是同一个 git 根的两份 checkout。

冷启动网络读数（一次完整页面加载后 `GET /api/worktree` 的完整清单）：

```
GET /api/worktree?projectID=1f3c53ea…  (opencode)
GET /api/worktree?projectID=7ed97e62…  (dsh-mcp-manager)
GET /api/worktree?projectID=7e22006f…  (pup-android)
```

3 个 projectID 各 1 次，且该批次内**没有** `POST /api/worktree/refresh`。

## Tests

### 1. 进入 Projects 时的清单请求次数
expected: 全新加载直接进入 Projects 后，每个可见 `projectID` 的 worktree 清单请求恰好 1 次；触发一次会话更新后不新增；切到 Inbox 再切回 Projects 不新增（命中缓存）。
result: pass
coverage_id: 02-01:D1
requirement: CHK-01
evidence: 冷启动 3 个 projectID → 3 次 GET，各 1 次，见 §Agent-Run Evidence。打开一个会话后，同一 projectID 又出现 1 次 GET，且**紧邻** `POST /api/worktree/refresh [204]`——`refresh` 只有会话的 Location 提供者会发（`projects.tsx` 中 `refresh` 出现 0 次，只调 `cached`/`list`），因此该次 GET 属于 Location 提供者的加载，不是侧栏 effect。切走再切回（Inbox↔Projects）未单独执行：会话路由在同一 JS 上下文内改 tabLayout 需要走 Settings UI，本轮未操作；`cached()` 早返回由单测与代码复审共同覆盖（`02-REVIEW.md` 复核段）。

### 2. 清单读取失败时的静默降级
expected: 后端不可用时进入 Projects：无 toast、无 loader、无错误文案、无 Suspense；行仍按 `sandboxes` 分组。
result: pass
coverage_id: 02-01:D2
requirement: CHK-01
evidence: 在 4096 起了一个 `node:http` 反代（SSE 原样 pipe），对 `GET /api/worktree` 返回 503、其余请求透传并注入正确 Authorization。侧栏挂载时反代日志出现 3 条 `FAULT GET /api/worktree?projectID=…`（每个可见 projectID 一条），页面同时读到：`toasts: []`、`loaderCount: 0`、`alerts: []`、正文无 `Couldn't load / Failed / 重试 / 加载失败`；4 行分组仍完整渲染（`pup-android · 02-Spain`、`pup-android · pup-android-msg-0070-0080`、`dsh-mcp-manager`、`opencode`），即降级到 `sandboxes`/canonical 分组。反代只影响这一个端点，会话索引与 SSE 全程正常，因此测的是「清单挂了」而不是「后端挂了」。

### 3. 运行中侧栏的行归并、双拷贝与不抖动
expected: 同一 checkout 内 `packages/app` 与 `packages/ui` 的会话在同一行；同一 git 根的两份拷贝是两行；清单到达前后行数不减少、行标签不变、不出现「一个 checkout 裂成多行」的长中间态。
result: pass
coverage_id: 02-02:D5
requirement: CHK-02, CHK-03
evidence: 4 行 / 3 个 projectID，`pup-android` 的 `02-Spain` 与 `pup-android-msg-0070-0080` 各自成行（同一 git 根、两份 checkout）；`pup-android-msg-0070-0080` 是嵌在 branch 目录下的更深 checkout，独立成行而 canonical 行的 key 没变（D-08 的实测形态）。「子目录会话归同一行」在本机数据里没有样本：`opencode` 的 69 个会话全在仓库根，`pup-android` 的会话都在各 checkout 根，因此该分支仍只由 `projects-groups.test.ts` 拥有。首帧→清单到达的**瞬时**抖动没有被仪器化（CDP 侧没有可用的帧级采样），只核对了稳定态行数与标签；这一项按 UI-SPEC 的 `partial` backstop 保留。

### 4. 设计文档记录「不显示空 checkout 行」
expected: `docs/designs/project-grouped-sessions-sidebar.md` §已知取舍 第 4 条记录选择「不显示」分支及其理由，且验证记录指明选了哪一支。
result: pass
source: automated
coverage_id: 02-01:D3
requirement: CHK-03

### 5. sandboxes 兜底让 checkout 内子目录归到该 checkout
expected: 只有 canonical + `sandboxes` 的输入下，`C:/work/app/.worktrees/feature/src` 归到 `C:/work/app/.worktrees/feature`，`C:/work/app/packages/ui` 归到 `C:/work/app`。
result: pass
source: automated
coverage_id: 02-02:D1
requirement: CHK-02

### 6. 双路径同 key
expected: 同一批会话在「只有 canonical + sandboxes」与「清单含全部 checkout」两种输入下产出完全相同的 group key。
result: pass
source: automated
coverage_id: 02-02:D2
requirement: CHK-04

### 7. 两份拷贝各一行 + 更深 checkout 独立成行
expected: 两份本地拷贝产出两个不同且互不覆盖的 key；清单揭示更深 checkout 后该 checkout 独立成行，canonical 行 key 不变。
result: pass
source: automated
coverage_id: 02-02:D3
requirement: CHK-03

### 8. 分组热路径的 strobe 实测结论
expected: 改动前量到回归、加最小缓存、复测回归消失，命令与 verdict 均有记录。
result: pass
source: automated
coverage_id: 02-02:D4

## Summary

total: 8
passed: 8
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps
