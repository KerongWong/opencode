---
phase: 08-fold-persistence
plan: 01
subsystem: workspace-sidebar
tags: [persistence, registry, solid, e2e]
requirements: [FOLD-01, FOLD-02]
provides:
  - workspace-registry.v1 文档新增 expanded 行折叠态
  - 侧栏行展开/折叠跨重启恢复
  - 旧文档与脏数据的解码回退
affects: [workspace-sidebar, persistence]
actuals:
  tokens: 9000
  tasks: 3
  commits: []
tech-stack:
  added: []
  patterns: [schema 字段级恢复, persisted registry store, e2e reload 回归]
key-files:
  created:
    - .planning/phases/08-fold-persistence/08-CONTEXT.md
    - .planning/phases/08-fold-persistence/08-01-PLAN.md
  modified:
    - packages/app/src/workspace-sidebar/registry.ts
    - packages/app/src/workspace-sidebar/registry.test.ts
    - packages/app/src/workspace-sidebar/store.ts
    - packages/app/src/workspace-sidebar/sidebar.tsx
    - packages/app/e2e/regression/home.spec.ts
key-decisions:
  - "折叠态并入 workspace-registry.v1（与 scrollTop 同类视图状态），避免第二个持久化 store 造成首帧折叠闪烁"
  - "只持久化行折叠态；会话水位仍为内存态，COLL-05 不回退"
duration: 25min
completed: 2026-11-22
status: complete
---

# Phase 8: 工作区行折叠状态持久化 Summary

**重启后恢复每个工作区行上次的展开/折叠状态，折叠只由用户操作发起。**

## Performance

- **Duration:** 25min
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments

- `workspace-registry.v1` 新增 `expanded` 字段（按 rowKey 记录），与 `scrollTop` 同文档、同一次水合。
- `sidebar.tsx` 删除组件内 `ui.expanded`，行展开/折叠与 Add 后的自动展开全部走 registry store。
- 旧文档（无 `expanded`）解码后 entries/scrollTop 不丢、折叠态回退为 `{}`；折叠表整体损坏时也只回退折叠态。
- 新增 e2e：真实点击展开 → reload 仍展开、另一行仍折叠 → 点击折叠 → reload 仍折叠。
- 会话水位、折叠重置与 v2.2 COLL-05 语义保持不变。

## Task Commits

未提交（全局规则禁止由 AI 执行 `git commit`）。工作区改动见 `git diff`。

## Files Created/Modified

- `packages/app/src/workspace-sidebar/registry.ts` — schema 增加 `expanded`，initial 增加 `{}`。
- `packages/app/src/workspace-sidebar/registry.test.ts` — round-trip、初始形状、旧文档与脏表回退。
- `packages/app/src/workspace-sidebar/store.ts` — `expanded(key)` / `setExpanded(key, value)`。
- `packages/app/src/workspace-sidebar/sidebar.tsx` — 行折叠读写接 registry。
- `packages/app/e2e/regression/home.spec.ts` — 跨 reload 的折叠态回归。

## Decisions & Deviations

- 折叠表逐条恢复：`expanded` 的每个值用 `Schema.catchDecoding(() => Option.none())` 包裹，单个非法值只丢该条，合法兄弟项保留。
- 折叠即删除 key（不持久化 `false`）；`remove()` 同时清理该目录的折叠 key，文档不会随折叠/移除无限增长。
- `unavailable` 行以 `expanded && !unavailable` 作为唯一的展示折叠态（`aria-expanded`、chevron 与内容三处一致），避免重启恢复后出现「声明展开但内容隐藏且按钮禁用」。
- 原计划的 e2e 断言（会话标题在行按钮内）不符合 DOM 结构，改为在侧栏容器内断言；契约仍为 `aria-expanded` + 会话可见。

## Review Follow-up

`08-REVIEW.md` 的 1 warning + 3 info 已处理，见 `08-REVIEW-FIX.md`：WR-01、IN-01、IN-03 修复；IN-02 以“桌面端复用同一 registry 文档异步水合路径”的既有事实收窄验证声明，并保留用户重启观察项。

## Next Phase Readiness

- FOLD-01/FOLD-02 均有自动化证据。
- 用户在下次自行重启桌面应用时可直接观察该行为（本环境禁止由 AI 重启应用）。
