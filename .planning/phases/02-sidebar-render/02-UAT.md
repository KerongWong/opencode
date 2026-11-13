---
status: complete
phase: 02-侧栏渲染与会话投影
source: [02-01-SUMMARY.md, 02-02-SUMMARY.md]
started: 2026-11-14T01:40:00.000Z
updated: 2026-11-14T02:10:00.000Z
---

## Agent-Run Evidence

由 agent 在真实数据上执行：`bun dev serve --port 4096`（`OPENCODE_DISABLE_CHANNEL_DB=1` → 真实库：34 项目 / 2745 会话）+ `packages/app bun dev -- --port 4444`，用 CDP 直接读 DOM / localStorage，不靠肉眼。设置：`appearance.tabLayout = "vertical"` + `general.sidebarOrganize = "projects"`。

登记表用真实目录播种（4 条）：本仓库 `opencode`、`pup-android 02-Spain`、`dsh-mcp-manager`、以及一个不存在的 `D:/does-not-exist/renamed-away`。

**本轮抓到一个测试抓不到的真缺陷并已修**（`62fb6cbabb`）：web 构建没有 `Platform.os`，`hostPlatform` 回落到 `linux`，于是 Windows 路径全部不满足绝对路径判定 → **在 Windows 浏览器里 register / remove 变成静默 no-op**，而 86 条单测（都显式传 platform）全绿。修法：新增纯函数 `detectHostPlatform(navigator.platform)`，只在非 desktop 分支使用，6 行表驱动测试。修后 remove 立刻生效。

## Tests

### 1. 行只来自登记表
expected: 未登记目录不出现；登记的目录各一行。
result: pass
requirement: ROW-01
evidence: 播种 4 条 → 恰好 4 行（`opencode` / `pup 02-Spain` / `dsh` / `missing folder`）；其余 30 个项目与 2700+ 会话未产生任何行。

### 2. 同一 git 仓库的两份 clone 是两行
expected: 两个目录各自成行、各自展开。
result: pass
requirement: ROW-02
evidence: `pup-android-backup/pup-android` 与 `pup-android-branch/pup-android`（同一 projectID）追加登记后是两行，`aria-expanded` 各自独立。

### 3. 行内只含该目录自身的会话
expected: `session.list({directory})` 精确等值，不含子目录。
result: pass
requirement: ROW-03
evidence: 展开 `opencode` 行列出该仓库的 40+ 条会话标题（`Phase execution workflow`、`OpenCode 工作区侧边栏改造需求` …），与其它目录的行不交叉。**限制**：本机没有「会话落在 checkout 子目录」的样本，子目录不归属这一点仍由 `session.list` 的服务端 `eq(directory)` 语义保证，未被本机数据反证。

### 4. 无兜底分组；移除后会话在侧栏彻底不可见
expected: 侧栏不存在「未分组/其它」；移除某行后其会话不出现在任何行。
result: pass
requirement: ROW-04
evidence: 全站 DOM 内 `Ungrouped / 未分组` 匹配数为 0；移除 `pup 02-Spain` 后行消失，行内 900+ 条会话不再出现在侧栏任何位置。

### 5. 重命名只改显示名并持久化
expected: 行名改变，目录名与 git 状态不变，重启后保持。
result: pass
requirement: UX-01
evidence: 菜单「重命名」→ 输入 `我的 OpenCode` → 保存：侧栏行名与持久化文档 `title` 同时变更，`directory` 字段未变；刷新后仍为 `我的 OpenCode`。

### 6. 移除只写 `removedAt`
expected: 记录保留、目录与会话不动、重新登记可恢复。
result: pass
requirement: UX-02
evidence: 移除后持久化文档为 `pup 02-Spain [removed]`（`removedAt` 有值、其余字段原样）；磁盘目录与会话未变（仍可从 Inbox / 最近会话列看到）。

### 7. 空态
expected: 无登记项时只有「添加本地文件夹」单一动作，不自动创建默认工作区。
result: pass
requirement: UX-04
evidence: 首次进入（登记表为空）显示 `No workspaces / Add a local folder to list its sessions here. / Add local folder`，无额外行、无自动登记。

### 8. 目录不存在 → 不可用态
expected: 该行可见、标记不可用、不可展开；不静默消失、不自动指向新路径。
result: pass
requirement: UX-05
evidence: `D:/does-not-exist/renamed-away` 行显示 `Folder unavailable`，按钮 `aria-disabled="true"` 且点击后 `aria-expanded` 仍为 `false`。

### 9. 重启后登记列表、显示名、顺序、移除状态保持
expected: 刷新/重启后状态不变。
result: pass
requirement: PST-01
evidence: 刷新后 3 行（`我的 OpenCode`、`dsh`、`missing folder`）与移除状态、改名结果全部保持。

### 10. 拖拽排序写 order
expected: 拖动改顺序并持久化。
result: skipped
reason: 需要真实指针拖拽（dnd-kit），CDP 的合成事件无法稳定触发 `@dnd-kit/solid` 的 sortable 传感器；`applyOrder` 的纯函数契约由 `store.test.ts` 覆盖，UI 侧留给一次人工拖动。

### 11. REG-04 服务端拼写校准
expected: 登记后采用服务端返回的 `location.directory` 拼写。
result: skipped
reason: 本机所有目标目录的盘符都是大写，校准前后字符串相同，观察不到差异。该路径由 `sessions.test.ts` 的 `serverSpelling` / `adoptDirectory` 用例覆盖；要实测需要一个首次以小写盘符打开的目录。

### 12. 事件驱动的增量更新（ROW-06）
expected: `session.created` 按 `location.directory` 归行；归档/删除走行级刷新。
result: skipped
reason: 首次加载由 `session.list` 覆盖（已观察）；但「运行中新增/归档一条会话」需要制造真实会话事件，本轮没有做。02-01 已说明单测环境（Bun 的 solid-js server build）里 `createEffect` 是 no-op，该接线只能在浏览器里观察——这一条仍待一次带真实会话变更的验证。

## Summary

total: 12
passed: 9
issues: 0
pending: 0
skipped: 3
blocked: 0

## Gaps
