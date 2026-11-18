---
created: 2026-11-18
title: Add-local-folder 自动打开的草稿发送消息挂起（无 session.create、无报错）
area: workspace-sidebar / new-session
status: open
files:
  - packages/app/src/shell/tabs/tabs.tsx
  - packages/app/src/session/route.tsx
  - packages/app/src/new-session/composer-adapter.ts
  - packages/app/src/runtime/server/request-queue.ts
---

# Add-local-folder 自动打开的草稿发送消息挂起

## Correction（2026-11-18 晚，第一次修复无效后更正）

**先前的队列饱和根因判断错误。** 证据：

- 服务端实测无罪：POST /api/session 对**不存在的目录**也只需 68ms（projects sidecar 实测）；首次解析后 /api/location 3ms
- "server thrashing detected" 只出现在草稿挂载时（14:15:53），早于发送（14:18:51）数分钟——是挂载时同步风暴的瞬时 burst，发送时队列已空
- 补 slow 分类（commit a3f18c8d5f，/api/location + /api/file）是真实缺陷修复但**未治愈本 bug**：新安装包复现依旧（用户验证 2026-11-18）
- 因 /api/info 轮询在所谓"卡死"期间持续正常返回，队列从未全局 wedge——session.create 从未到达队列

**已确认的事实**：

- hang 在客户端、发出 fetch 之前：`new-session/composer-adapter.ts` effect runner 的 `await pending.ready`（= `tabs.prepareSession` 的 `startTransition`）永不 settle
- 机器路径已排除：worktree create（默认 "last-used"→"main"）、MCP phase（草稿未动 MCP 时 states 为空直达 create）
- 与普通草稿的唯一差异是 draft tab 的 `directory` 值；newDraft 创建路径两者相同
- 复现目录：不存在的（pup-android 两个变体）、真实 git 仓库（opencode-usage-document）——均复现
- 附带发现：文件夹选择器允许登记不存在的路径（应为独立待修项）

## 下一步（运行时取证）

静态阅读已到极限，需运行时证据定位 Suspense 读取点：

1. 用 `--remote-debugging-port` 启动便携版 Projects，自行复现并检查 pending 组件树中哪个资源未 resolve
2. 或用户在挂起态执行 DevTools 检查（Network 有无新行 / Console 有无新输出）

## Workaround（给用户）

从 Add-folder 自动打开的草稿发送会挂：发送前先**点侧栏"新建会话"**（或任何普通入口），从普通草稿发送即正常。

## 复现步骤（用户 2026-11-18 确认）

1. 侧栏 **Add local folder** 登记一个新工程文件夹
2. v2.1 NAV-01 行为触发：自动展开该行并打开草稿（"No sessions yet"）
3. 该草稿输入文字 → 发送 → 永远转圈、零网络请求、零报错

关键限定：**只有 Add-folder 自动打开的这个草稿会挂**；普通"新建会话"草稿发送正常（同应用、同服务）。

## 历史记录（首次排查，含已失效推断）

- 初判"目录不存在"（pup-android 案例）→ 被真实目录复现推翻
- 次判"请求队列饱和"（thrashing 日志 + 排队不可见）→ 被服务端 68ms 实证 + 修复无效推翻
- 两次教训：无运行时证据的静态推断不可靠；修复必须经真实复现验证
