---
created: 2026-11-18
resolved: 2026-11-18
title: Add-local-folder 自动打开的草稿发送消息挂起（无 session.create、无报错）+ 分支名不显示
area: workspace-sidebar / new-session / packages/client
status: resolved
files:
  - packages/client/src/solid/data.ts
  - packages/client/test/solid-data.test.ts
debug_session: .planning/debug/add-local-folder-draft-hang.md
---

# Add-local-folder 草稿发送挂起 + 分支不显示（已解决）

## 结论（2026-11-18 晚，gsd-debug 会话 3+1 轮定位并修复）

**根因（两个症状同一根源）：客户端对同一目录持两种拼写** —— workspace registry 规范化的正斜杠拼写（`C:/Users/...`，`normalizeDirectory` 刻意折叠）与服务端 canonical 反斜杠拼写（`C:\Users\...`，实测 `/api/agent`、`/api/vcs` 响应 `location.directory`）。SDK `packages/client/src/solid/data.ts` 的 `locationResource` 默认只把同步响应发布到服务端 canonical key，只有 `alias: true` 才同时发布到请求的 key：`model`/`provider` 有 alias，`agent` 与 `vcs` 没有。

1. **发送挂死**：`agent` 无 alias → add-folder 草稿（正斜杠 key）永远读不到 agent 列表 → `composer/selection.ts loading()` 永真 → composer submit 机器永久停在 `held`（运行时实证：`agentMissing=true` 永不翻转）→ 零网络请求转圈。先前记录中"hang 在 `tabs.prepareSession` 的 startTransition"是下游表象，冻结点更早（提交闸门）。
2. **分支不显示**：`vcs` 无 alias，且首次 sync 返回空 `{branch:{}}`，后续带分支数据的刷新走反斜杠 key，正斜杠 key 永远陈旧。

**修复**（工作区未提交）：
- `vcs`、`agent` 的 `locationResource` 加 `{ alias: true }`
- `locationResource` 新增 canonical→requested-key 注册表：alias 资源在 canonical≠requested 时登记，之后任何拼写下的 sync 刷新所有已登记别名（解决跨拼写陈旧）
- 回归测试 `packages/client/test/solid-data.test.ts`（无修复时失败、有修复时通过）

**验证**：web 端到端复现→修复→复验（add-folder 草稿发送晋升真实 session、草稿栏显示分支 `main`）；`bun test` 259 pass / 0 fail；`bun check` 干净。完整证据链见 debug_session。

**遗留（独立待修，本次未动）**：
- 其它无 alias 的 location 资源（`command`、`integration`、`mcpServer`、`reference`、`shell`、`usageLimits`、`config`、`websearch`）存在同类 latent 风险，无症状未动（最小变更）
- `location.syncInfo` 的 `info` 仍只发布 canonical key
- 文件夹选择器允许登记不存在的路径（旧记录中的附带项）

## 历史排查记录（保留原始过程）

### Correction（2026-11-18 晚，第一次修复无效后更正）

**先前的队列饱和根因判断错误。** 证据：

- 服务端实测无罪：POST /api/session 对**不存在的目录**也只需 68ms（projects sidecar 实测）；首次解析后 /api/location 3ms
- "server thrashing detected" 只出现在草稿挂载时（14:15:53），早于发送（14:18:51）数分钟——是挂载时同步风暴的瞬时 burst，发送时队列已空
- 补 slow 分类（commit a3f18c8d5f，/api/location + /api/file）是真实缺陷修复但**未治愈本 bug**：新安装包复现依旧（用户验证 2026-11-18）
- 因 /api/info 轮询在所谓"卡死"期间持续正常返回，队列从未全局 wedge——session.create 从未到达队列

**当时已确认的事实**：

- hang 在客户端、发出 fetch 之前：`new-session/composer-adapter.ts` effect runner 的 `await pending.ready`（= `tabs.prepareSession` 的 `startTransition`）永不 settle（后被证明是下游表象）
- 机器路径已排除：worktree create（默认 "last-used"→"main"）、MCP phase（草稿未动 MCP 时 states 为空直达 create）
- 与普通草稿的唯一差异是 draft tab 的 `directory` 值；newDraft 创建路径两者相同
- 复现目录：不存在的（pup-android 两个变体）、真实 git 仓库（opencode-usage-document）——均复现

### Workaround（已随修复作废）

从 Add-folder 自动打开的草稿发送会挂：发送前先**点侧栏"新建会话"**（或任何普通入口），从普通草稿发送即正常。

### 复现步骤（用户 2026-11-18 确认）

1. 侧栏 **Add local folder** 登记一个新工程文件夹
2. v2.1 NAV-01 行为触发：自动展开该行并打开草稿（"No sessions yet"）
3. 该草稿输入文字 → 发送 → 永远转圈、零网络请求、零报错

关键限定：**只有 Add-folder 自动打开的这个草稿会挂**；普通"新建会话"草稿发送正常（同应用、同服务）。

### 历史教训

- 初判"目录不存在"（pup-android 案例）→ 被真实目录复现推翻
- 次判"请求队列饱和"（thrashing 日志 + 排队不可见）→ 被服务端 68ms 实证 + 修复无效推翻
- 第三次（成功）：运行时插桩取证（提交机器 `submit -> held`、`agentMissing=true` 永不翻转）→ 锁定 agent 目录目录拼写分叉
- 三次教训：无运行时证据的静态推断不可靠；修复必须经真实复现验证
