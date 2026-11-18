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

## Evidence（2026-11-18 首次排查，test 渠道 2.3.0 / 后于正式 Projects 2.3.0 复现）

- 点发送后 **零网络请求**（DevTools Network 仅 /api/info 轮询）——客户端在发出 session.create 之前挂起
- DevTools Console **无报错**
- 服务端无新会话（直接查询 sidecar API `/api/session` 为空）
- 代码路径定位：`new-session/composer-adapter.ts` 的 `start()` → effect runner 卡在 `await pending.ready`（= `tabs.prepareSession` 的 `startTransition` 永不 settle）；30s 超时 toast 也被同一 await 堵死，故无任何反馈
- 早前误判修正：曾归因"目录不存在"（pup-android 案例），但真实目录经 Add-folder 打开同样复现 → 根因在 **Add-open 流程本身**，不在目录存在性

## Suspicion（待验证）

Add-folder 打开的草稿与普通新建会话草稿在某处状态不同（location 未在服务端解析？draft 的 composer/pending tab 初始化差异？add-open-machine 的打开路径绕过了某个 ready 信号？），导致 prepare 阶段的 Suspense 资源永不 resolve。

## Solution（待做）

- 对比 add-open 打开草稿 vs 普通新建会话草稿的初始化路径（draft 创建、tab 注册、location 解析）
- 定位 pending 视图中对该 draft 目录永不 resolve 的 Suspense 读取
- 修复 + 回归测试（复现路径：Add local folder → 自动草稿 → 发送 → session 创建成功）

## 关联记录

- STATE.md Blockers/Concerns 中 2026-11-18 那条"上游缺失目录挂起"的结论**部分失效**（真实目录也挂，见本 todo）
- v2.1 NAV-01 需求：Add folder 后自动展开并打开会话（add-open-machine.ts）
