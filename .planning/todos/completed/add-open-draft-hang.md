---
created: 2026-11-18
title: Add-local-folder 自动打开的草稿发送消息挂起（无 session.create、无报错）
area: workspace-sidebar / new-session
files:
  - packages/app/src/workspace-sidebar/add-open-machine.ts
  - packages/app/src/workspace-sidebar/sidebar.tsx
  - packages/app/src/new-session/composer-adapter.ts
  - packages/app/src/shell/tabs/tabs.tsx
---

# Add-local-folder 自动打开的草稿发送消息挂起

## Problem（复现步骤，用户 2026-11-18 确认）

1. 侧栏 **Add local folder** 登记一个新工程文件夹（真实存在的目录，如 `D:/01-project/01-kerong/opencode-usage-document`）
2. v2.1 NAV-01 行为触发：自动展开该行并打开一个草稿（目录 = 新工程路径，"No sessions yet"）
3. 在该草稿输入任意文字 → 发送 → **永远转圈，无响应**

关键限定：**只有 Add-folder 自动打开的这个草稿会挂**；普通"新建会话"草稿发送正常（同应用、同服务）。

## Evidence（2026-11-18 排查）

- 点发送后 **零网络请求**（DevTools Network 仅 /api/info 轮询）——客户端在发出 session.create 之前挂起
- DevTools Console **无报错**
- 代码路径初判：`new-session/composer-adapter.ts` 的 `start()` → `await pending.ready`（startTransition）——**此判断后被推翻**
- **决定性证据（正式 Projects 2.3.0 复现，2026-11-18 14:15）**：
  - renderer.log：`[server-request-queue] server thrashing detected`（14:15:53），紧邻 Add-folder + 发送操作
  - 新目录 `D:\01-project\01-kerong\opencode-usage-document` 为真实 git 仓库；默认目的地 "last-used" 无记录 → 解析为 "main"（无 worktree.create 分支）
  - 事后查询 projects 服务：该目录已有 **1 个会话**——挂起的发送在队列排空后**最终落地**

## Root Cause（根因，已确认）

客户端全局限流请求队列（`packages/app/src/runtime/server/request-queue.ts`）：所有 API 请求先取槽位才真正发出（`request.arrived` → `waitForSlot`），**排队中的请求在 DevTools Network 不可见**（解释了零请求现象），也不产生报错（解释了无 console 错误）。

Add local folder 打开的草稿指向**全新目录**：workspace controller 的一次性同步风暴（`location.syncInfo` / `project.sync` / `vcs.sync`，controller.ts L181-187）叠加服务端**首次项目解析**（git 探测，慢盘/杀软下可达数十秒）→ 慢请求占满槽位 → thrashing → 用户点击发送时 `session.create` 在队列中等槽位 → 永远转圈；数分钟至 60s 头超时后槽位释放，请求才落地。

普通"新建会话"不复现：默认项目的同步早已 settle，队列空闲。

## Solution（待做）

- 让发送路径有界可见：composer 提交感知队列等待（spinner 旁的状态/超时反馈），而不是裸转圈
- 评估 `session.create` 的队列优先级（`classifyRequest` 支持 priority）或对发送请求 bypass 限流
- 根治方向：新目录首次同步的合并/去重（debounce），减少风暴；服务端项目解析慢属上游
- 回归测试：复现路径 Add local folder（git 仓库）→ 自动草稿 → 发送 → 会话及时创建

## 关联记录

- STATE.md Blockers 中 2026-11-18"上游缺失目录挂起"条目**已被本根因取代**（目录不存在只是极端情况，机制是请求队列饱和）
- v2.1 NAV-01：Add folder 后自动展开并打开会话（add-open-machine.ts）
- 代码：`packages/app/src/runtime/server/request-queue.ts`（+ machine）、`new-session/workspace/controller.ts` L181-187
