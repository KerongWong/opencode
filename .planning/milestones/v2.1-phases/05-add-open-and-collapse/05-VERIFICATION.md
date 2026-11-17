---
phase: 05-add-open-and-collapse
verified: 2026-11-17T11:00:00Z
status: passed
score: 6/6 must-haves verified
covered_files: [".planning/phases/05-add-open-and-collapse/05-01-PLAN.md", ".planning/phases/05-add-open-and-collapse/05-01-SUMMARY.md", "packages/app/src/workspace-sidebar/add-open-machine.ts", "packages/app/src/workspace-sidebar/add-open-machine.test.ts", "packages/app/src/workspace-sidebar/ui-state.ts", "packages/app/src/workspace-sidebar/ui-state.test.ts", "packages/app/src/workspace-sidebar/sessions.ts", "packages/app/src/workspace-sidebar/sessions.test.ts", "packages/app/src/workspace-sidebar/store.ts", "packages/app/src/workspace-sidebar/sidebar.tsx", "packages/app/src/runtime/i18n/en.ts"]
covered_digest: "v4:sha256:8c7a8d576863853816a769dc1218cabf9d98344fef558c4dc1386f28846da763"
behavior_unverified: 0
overrides_applied: 0
---

# Phase 5: Add-folder 跳转与会话列表折叠 验证报告

**Phase Goal:** Add 注册 folder 成功后自动展开该行并打开一个会话（有历史则最近一个，无则新建 draft）；每行会话列表默认显示 5 条，Show more/less 展开收起，展开态按 project key 持久化。
**Verified:** 2026-11-17T10:45:00Z
**Status:** passed（端到端与观感人工项见文末）

## Goal Achievement

### Observable Truths

| #   | Truth | Status | Evidence |
| --- | ----- | ------ | -------- |
| 1 | 机器迁移序列：registered→awaiting(attempt1)→opening/ failed；attempt 不匹配忽略；超时静默；dispose 清理 watch；**failed 不吸收后续 Add**（review F-01 修复） | ✓ VERIFIED | `add-open-machine.ts`；11 用例（含陈旧 ready 忽略、二次 registered supersede、failed+registered 重启、opened/open.failed、disposed） |
| 2 | driver：watch 定时器与行 watch 在边缘，机器无 I/O/定时器；open.recent 从就绪行回查全量会话；open.new 走既有 draft action | ✓ VERIFIED | `add-open-machine.ts` 无 setTimeout/setInterval（rg 验证）；`sidebar.tsx` runAddOpenEffect + 状态驱动嵌套 effect |
| 3 | 注册成功后行展开 + dispatch registered；失败路径（无目录/无会话匹配/异常）静默落到 failed 不阻塞侧栏 | ✓ VERIFIED | `sidebar.tsx` add()；机器 `failed` 态为终态无副作用 |
| 4 | 折叠：默认 5 条（SESSIONS_PER_PROJECT）；≤5 条无折叠 UI；>5 条 Show N more（plural key）；revealed 显全部 + Show less | ✓ VERIFIED | `sessions.ts` shownSessions/hiddenSessionCount + 用例（5/6/0 边界）；`sidebar.tsx` 渲染分支 |
| 5 | 展开态持久化：Persist.serverGlobal(scope, "workspace-sidebar-ui.v1")；reveal/conceal 幂等引用稳定；重启保持 | ✓ VERIFIED | `ui-state.ts`（key/schema/target）；`store.ts` createWorkspaceUiState；`ui-state.test.ts` |
| 6 | EN 只增三个 key；shell/titlebar 零改动（本里程碑）；type gate 0 诊断；单测全绿 | ✓ VERIFIED | `git diff upstream/dev -- en.ts` 仅新增行；`git status --porcelain -- packages/app/src/shell` 自 v2.1 起为空（shell.tsx/titlebar.tsx 触点属 v2.0 提交 92eaa5ae9e）；132 pass / 0 fail；lint 0 problem |

**Score:** 6/6 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `packages/app/src/workspace-sidebar/add-open-machine.ts` | 纯状态机 | ✓ VERIFIED | 124 行；INITIAL state、命名 AddOpenResult、attempt 单调 |
| `packages/app/src/workspace-sidebar/ui-state.ts` | schema + 纯 reveal/conceal | ✓ VERIFIED | UI_STATE_KEY 稳定有用例 |
| `packages/app/src/workspace-sidebar/sidebar.tsx` | driver + 折叠 UI | ✓ VERIFIED | add() 接线、状态驱动 watch、Show more/less |
| `packages/app/src/runtime/i18n/en.ts` | 只增 3 key | ✓ VERIFIED | more.one/more.other/less |

### 人工确认项（不阻塞，日常使用即验证）

1. Add local folder 端到端：注册 → 行展开 → 自动打开最近会话 / 无会话时新建 draft。
2. >5 条会话的折叠 UI 观感与 Show less 行为。

## Verification Commands Run

```
cd packages/app && bun test --conditions=solid --isolate --preload ../ui/test/solid-jsx.ts --preload ./happydom.ts src/workspace-sidebar
# 132 pass / 0 fail（本 phase 新增 20 用例）

cd packages/app && bun check --no-script src/workspace-sidebar/add-open-machine.ts src/workspace-sidebar/add-open-machine.test.ts src/workspace-sidebar/ui-state.ts src/workspace-sidebar/ui-state.test.ts src/workspace-sidebar/sessions.ts src/workspace-sidebar/sessions.test.ts src/workspace-sidebar/store.ts src/workspace-sidebar/sidebar.tsx
# No type errors

bun script/lint-changed.ts upstream/dev
# 0 problem(s)

git diff upstream/dev -- packages/app/src/runtime/i18n/en.ts   # 仅新增行
git status --porcelain -- packages/app/src/shell               # 空（v2.1 期间）
```
