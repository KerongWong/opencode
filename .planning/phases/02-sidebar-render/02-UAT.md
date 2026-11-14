---
status: complete
phase: 02-侧栏渲染与会话投影
source: [02-01-SUMMARY.md, 02-02-SUMMARY.md]
started: 2026-11-14T01:40:00.000Z
updated: 2026-11-14T03:05:00.000Z
---

## Agent-Run Evidence

由 agent 在真实数据上执行：`bun dev serve --port 4096`（`OPENCODE_DISABLE_CHANNEL_DB=1` → 真实库：34 项目 / 2745 会话）+ `packages/app bun dev -- --port 4444`，用 CDP 读 DOM / localStorage / 触发真实事件，不靠肉眼。设置：`appearance.tabLayout = "vertical"` + `general.sidebarOrganize = "projects"`。

登记表用真实目录播种。两轮 UAT 各抓到一个测试抓不到的真缺陷，均已修：

- **web 平台误判**（`62fb6cbabb`）：web 构建没有 `Platform.os`，`hostPlatform` 回落 `linux`，Windows 路径全被判「非绝对」→ register/remove 在 Windows 浏览器里静默失效，而 86 条单测（都显式传 platform）全绿。
- **采纳的服务端拼写未归一**（本轮）：REG-04 把服务端返回的拼写原样落库，Windows 上可能是反斜杠形式，导致登记表出现两种 key 形状、`defaultTitle` 把整条路径当成一段。已改为先 `normalizeDirectory` 再采纳，并补两条回归。

## Tests

### 1. 行只来自登记表
expected: 未登记目录不出现；登记的目录各一行。
result: pass
requirement: ROW-01
evidence: 播种 4 条 → 恰好 4 行；其余 30 个项目与 2700+ 会话未产生任何行。

### 2. 同一 git 仓库的两份 clone 是两行
expected: 两个目录各自成行、各自展开。
result: pass
requirement: ROW-02
evidence: `pup-android-backup/pup-android` 与 `pup-android-branch/pup-android`（同一 projectID）为两行，展开互不影响。

### 3. 行内只含该目录自身的会话
expected: `session.list({directory})` 精确等值，不含子目录。
result: pass
requirement: ROW-03
evidence: 展开 `opencode` 行列出该仓库 40 条会话，与其它行不交叉。本机没有「会话落在 checkout 子目录」的样本，该分支仍由服务端 `eq(directory)` 语义保证。

### 4. 无兜底分组；移除后会话在侧栏彻底不可见
expected: 侧栏不存在「未分组/其它」；移除后其会话不出现在任何行。
result: pass
requirement: ROW-04
evidence: 全站 `Ungrouped / 未分组` 匹配数为 0；移除 `pup 02-Spain` 后行消失，其 900+ 会话不再出现在侧栏任何位置。

### 5. 重命名只改显示名并持久化
expected: 行名改变，目录名与 git 状态不变，重启后保持。
result: pass
requirement: UX-01
evidence: 「重命名」→ `我的 OpenCode` → 侧栏与持久化文档同时变更，`directory` 未变；刷新后保持。

### 6. 移除只写 `removedAt`
expected: 记录保留、目录与会话不动、重新登记可恢复。
result: pass
requirement: UX-02
evidence: 持久化文档为 `pup 02-Spain [removed]`，其余字段原样；磁盘目录与会话未变。

### 7. 空态
expected: 无登记项时只有「添加本地文件夹」单一动作，不自动创建默认工作区。
result: pass
requirement: UX-04
evidence: 首次进入显示 `No workspaces / Add a local folder to list its sessions here. / Add local folder`。

### 8. 目录不存在 → 不可用态
expected: 该行可见、标记不可用、不可展开。
result: pass
requirement: UX-05
evidence: 不存在目录显示 `Folder unavailable`，`aria-disabled="true"`，点击后仍 `aria-expanded=false`。

### 9. 重启后状态保持
expected: 刷新/重启后列表、显示名、顺序、移除状态不变。
result: pass
requirement: PST-01
evidence: 刷新后行集合、改名结果、移除状态、拖拽顺序全部保持。

### 10. 拖拽排序写 order
expected: 拖动改顺序并持久化。
result: pass
requirement: UX-03
evidence: 用 CDP 真实拖拽把第 2 行拖到第 1 行：持久化文档变为 `AAA:1 / BBB:0`，渲染顺序同步反转，刷新后保持。

### 11. REG-04 服务端拼写校准
expected: 登记后采用服务端返回的拼写。
result: pass
requirement: REG-04
evidence: 以混合大小写路径 `D:/01-PROJECT/01-KERONG/dsh-mcp-manager` 登记，加载后服务端返回的拼写被采纳；采纳结果现在会先归一（本轮修复），不会落库成反斜杠形式。**限制（已记录，不算缺陷）**：`session.list` 的目录过滤是 SQL 等值比较，只有大小写差异的路径查不到会话，因此 `probeSpelling` 学不到拼写——但唯一的登记入口是系统目录选择器，它返回磁盘上的真实大小写，用户无法手打路径，所以这条路径在实际产品里不可达。

### 12. 事件驱动的增量更新（ROW-06）
expected: `session.created` 按 `location.directory` 归行；归档/删除走行级刷新。
result: fail
requirement: ROW-06
blocked_by: other
evidence: 用 `POST /api/session` 在已登记的 `D:/01-project/02-opensource/opencode` 下新建会话（200，`ses_e2834ac80ffe8mZOlESNDZrHGD`），3 秒后该行**没有**出现它（行内按钮数 39 不变）；刷新并展开后它才出现（40）。即 `session.created` 订阅未生效，`archived`/`unarchived`/`deleted` 共用同一订阅块、同样受影响。
reason: 订阅写在 `sessions.ts` 的 `createEffect(() => { onCleanup(ctx.data.on(...)) })` 里；应用控制台长期有 “computations created outside a `createRoot` or `render` will never be disposed” 警告，怀疑该 controller 在 reactive root 之外创建导致订阅没有真正挂上。需要一次带日志的定位，未在本轮完成。

## Summary

total: 12
passed: 11
issues: 1
pending: 0
skipped: 0
blocked: 0

## Gaps

- **GAP-02-01（ROW-06）**：新建/归档/删除会话不会实时反映到侧栏行，需刷新或重新展开。重放步骤见 Test 12。纯逻辑（`matchCreated`、`schedule`、`dropSession`）有单测，缺的是订阅本身。
