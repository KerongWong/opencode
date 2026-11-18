---
quick: 20261118-queue-slow-class
date: 2026-11-18
status: complete
---

# Quick Task: 请求队列慢分类补全（/api/location、/api/file）

## 背景（根因见 .planning/todos/pending/add-open-draft-hang.md）

Add local folder 打开的草稿发送挂起：新目录首次同步风暴中，`/api/location`（首次项目解析要跑 git）与 `/api/file`（可用性探测遍历文件系统）这类**秒级慢请求没有被 `classifyRequest` 归类为 slow**，它们占住普通槽位（REQUEST_QUEUE_LIMIT=4），把用户发送的 `session.create`（POST 已是 priority 2，但 priority 只影响排队顺序，拿不到槽位仍要等）堵到数分钟。慢分类的机器注释（request-queue-machine.ts L6-8）写明 slow 的语义就是"shell out to git / walk the filesystem 的端点"。

## 改动（最小）

`packages/app/src/runtime/server/request-queue-machine.ts`：

```ts
const slowRequestPaths = ["/api/vcs", "/api/worktree"]
```
→ 加入 `/api/location` 与 `/api/file`（沿用现有的 `pathname === path || pathname.startsWith(`${path}/`)` 前缀匹配）。

效果：首次 location 解析与文件探测被约束在 slow 槽（上限 2），普通槽位始终可为发送等用户操作所用；与 vcs/worktree 同等待遇，符合机器既有设计意图。

## 任务（TDD）

1. **RED**：在 `packages/app/src/runtime/server/request-queue.test.ts` 增加 `classifyRequest` 表测试：
   - `GET /api/location`、`GET /api/location?location[directory]=...` → `{ bypass: false, slow: true, ... }`
   - `GET /api/file/list?...`（/api/file 前缀）→ slow
   - 负例保持：`GET /api/session` → slow: false；`POST /api/worktree` → setup: true 且 slow: true；`/api/event` → bypass
2. **实现**：扩展 `slowRequestPaths`。
3. **验证**：`cd packages/app && bun test --conditions=solid --isolate --preload ../ui/test/solid-jsx.ts --preload ./happydom.ts src/runtime/server/request-queue.test.ts` 全绿；`bun check --no-script src/runtime/server/request-queue-machine.ts src/runtime/server/request-queue.test.ts` 零错误。

## 边界与非目标

- 不改队列限流数值（4/2）、不改 priority 语义、不加 UI 反馈（另案）
- 服务端项目解析本身的慢属上游，不在本任务
