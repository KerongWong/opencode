---
phase: 02-checkout
plan: 01
subsystem: ui
tags: [solidjs, tanstack-query, worktree-inventory, projects-sidebar, i18n-free]

# Dependency graph
requires:
  - phase: 01-row-source-convergence
    provides: 有界会话行源（`mergeRootSessionIndex` + `inbox-sessions` 只取活跃 root），Projects 的行集合由 `inbox.entries()` 推导
provides:
  - "进入 Projects 模式时的挂载期 worktree 清单读取（每 server+projectID 一次）"
  - "首帧 `sandboxes` 兜底 + 清单到达后经 `updated` 回写并自动重算的端到端路径"
  - "设计文档 §已知取舍 第 4 条：不显示空 checkout 行的选择与理由（D-10 / D-11）"
affects: [02-02, 03-01, 03-02, 03-03]

# Actuals (#2632) — chars/4 over the two files actually changed.
actuals:
  tokens: 9422
  tasks: 2
  commits: 2

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "挂载期一次性读取：组件体内 `Set<string>` + effect 内先 add 再请求"
    - "缓存存在即跳过：`sync.worktrees.cached(id)` 判空，避免 `staleTime: 0` 的重复 fetch"

key-files:
  created: []
  modified:
    - packages/app/src/shell/titlebar/projects.tsx
    - docs/designs/project-grouped-sessions-sidebar.md

key-decisions:
  - "请求集合与渲染集合同源：effect 与 `groups()` 都用 `entry.ctx.projects.forSession(entry.session)`，不另算可见项目"
  - "本地去重键 `${entry.server}\\u0000${project.id}`，跨服务器同名 projectID 不互相压制"
  - "`requestedWorktrees.add` 在 `list` 之前：同一轮遍历里重复出现的 projectID 不会二次请求"
  - "跳过 `!project?.id` 与 `project.id === \"global\"`：伪项目没有清单，请求只会 404"
  - "只调 `list`，`refresh` 在 projects.tsx 中完全不出现（D-03 / T-02-02）"
  - "Phase 2 选择成功标准 4 的「不显示」分支（D-10），理由记入设计文档第 4 条（D-11）"

patterns-established:
  - "挂载期一次性读取：`Set` 挡同挂载期重跑，`cached()` 挡切走再切回，两者缺一不可"
  - "清单只读不刷新：读失败静默降级到 `sandboxes`，不重试、不 toast、不引入 loading"

requirements-completed: [CHK-01, CHK-03]

commits: 2
plan_head_before: 7a61e6550ff5f1302730a88539d4d70ca910bc33
plan_head_after: 777504be9cdfa7a5c2cf5cd9d1afa9ea3b5372d6

coverage:
  - id: D1
    description: "进入 Projects 模式即为每个可见 projectID 读取一次 worktree 清单，同一挂载期内的会话更新与缓存命中后的切回都不再请求"
    requirement: "CHK-01"
    verification:
      - kind: other
        ref: "bun check --no-script src/shell/titlebar/projects.tsx（522 files，无诊断指向 projects.tsx）"
        status: pass
      - kind: unit
        ref: "packages/app: bun run test:unit（2716 pass / 0 fail）"
        status: pass
      - kind: manual_procedural
        ref: "dev 服务器 Network 面板观察请求次数（未执行，见「手工验证未执行」）"
        status: unknown
    human_judgment: false
  - id: D2
    description: "清单读取只读不刷新，失败时静默降级到 `sandboxes` 兜底，无 toast / loader / Suspense"
    requirement: "CHK-01"
    verification:
      - kind: other
        ref: "bun script/lint-changed.ts 7a61e6550f（0 problem(s) in projects.tsx）"
        status: pass
      - kind: manual_procedural
        ref: "断开后端后进入 Projects 的降级观察（未执行，见「手工验证未执行」）"
        status: unknown
    human_judgment: true
    rationale: "「无 toast / 无 loader / 行仍按 sandboxes 分组」只有观察运行中的 UI 才能确认；本环境禁止启动或重启已安装的 app 与 sidecar 进程，无法执行。"
  - id: D3
    description: "设计文档 §已知取舍 记录「不显示空 checkout 行」，并指明 Phase 2 选择的是成功标准 4 的「不显示」分支"
    requirement: "CHK-03"
    verification:
      - kind: other
        ref: "bun -e \"…\" 文档门（`4. **不显示空 checkout 行**` 恰好一处，exit 0）"
        status: pass
    human_judgment: false

# Metrics
duration: ~6min
completed: 2026-11-13
status: complete
---

# Phase 2 Plan 01: 进入 Projects 模式按需加载 worktree 清单 Summary

**`SidebarProjects` 挂载时用「Set + cached」双保险为每个可见项目读取一次 worktree 清单，只读不刷新、失败静默降级；并在设计文档记录「不显示空 checkout 行」取舍**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-11-13T16:17:00+08:00（本地，估算自首次工具调用）
- **Completed:** 2026-11-13T16:23:00+08:00
- **Tasks:** 2
- **Files modified:** 2（+27 / +1 行，无删除）

## Accomplishments

- `packages/app/src/shell/titlebar/projects.tsx` 新增一个挂载期守卫 effect：遍历 `inbox.entries()`，按 `entry.ctx.projects.forSession(entry.session)` 取项目，跳过缺失 / 无 id / `"global"`，用 `Set<`${server}\u0000${projectID}`>` 挡住同挂载期重跑，再用 `worktrees.cached()` 挡住切走再切回，其余 `void …worktrees.list(projectID)`。
- 请求只经 `entry.ctx.sync.worktrees` 发出（按 `ServerScope` 分区），`projects.tsx` 中不存在 `global.serverCtx(` 与 `worktrees.refresh`；渲染路径零写入副作用。
- 设计文档 §已知取舍 追加第 4 条 `**不显示空 checkout 行**`，写明：成功标准 4 选「不显示」分支、行源仍「由会话推导」、理由（空行要遍历 projects × checkouts，会重新引入没打开过的项目与已无活动的 checkout）、以及改为「显示」前必须先解决行源保证。
- 首帧行为未变：仍由 `sandboxes` 分组；清单到达后经 `sync.tsx` 的 `updated` → `setGlobalStore("project", …)` → `projects.list()` → `groups()` 重算，`projects.tsx` 不订阅查询、不写 store。

## Task Commits

Each task was committed atomically:

1. **Task 1: 进入 Projects 模式为每个可见项目读取一次 worktree 清单** - `8f98340daf` (feat)
2. **Task 2: 在设计文档记录「不显示空 checkout 行」** - `777504be9c` (docs)

**Plan metadata:** 未提交 — `.planning/config.json` 的 `commit_docs: false`，SDK 会返回 `skipped_commit_docs_false`（有意跳过，非失败）。

## Files Created/Modified

- `packages/app/src/shell/titlebar/projects.tsx` - `SidebarProjects` 内新增 `requestedWorktrees` Set 与一个 `createEffect`（+27 行；JSX / 滚动容器 / 折叠状态 / 拖拽 / 文案零改动）
- `docs/designs/project-grouped-sessions-sidebar.md` - §已知取舍 第 4 条（+1 行；§实测接缝清单及其余章节未变）

## Decisions Made

- **请求集合 = 渲染集合**：effect 用与 `groups()` 第 77 行完全相同的 `entry.ctx.projects.forSession(entry.session)`，不另算「可见项目」，避免两处定义漂移。
- **先 add 再 list**：`requestedWorktrees.add(key)` 放在 `cached()` 判空与 `list()` 之前，因此同一轮遍历里重复出现的 projectID 也不会二次请求。
- **跳过伪项目**：`!project?.id || project.id === "global"`（与 `renameProject` 第 214 行同一判定），避免为没有清单的伪项目打必然失败的请求。
- **不做 Decide 之外的形状优化**：`cached()` 保持非响应式读，未包 `createMemo`（TanStack `getQueryData` 不产生失效信号）。
- **Phase 2 选择「不显示」分支**（D-10）：依据为 `docs/designs/project-grouped-sessions-sidebar.md` §已知取舍 第 4 条（D-11 要求的记录位置）。

## Deviations from Plan

None - plan executed exactly as written. 两处 `files_modified` 之外零改动，未新增 i18n 键、未动 `packages/server` / `packages/protocol`。

## Issues Encountered

**整包 `bun typecheck` 在本机无法完成（环境问题，与本次改动无关）。**

```
<error file="src/custom-elements.d.ts" line="1" column="1" code="TS1128">Declaration or statement expected.
1 | ../../ui/src/custom-elements.d.ts
Found 2 errors in 1 file, checked 0 files across 1 project
```

`packages/app/src/custom-elements.d.ts` 在 git 里是符号链接（`git ls-files -s` → mode `120000`），本机 `core.symlinks=false` 把它检出成只含目标路径文本的普通文件；无 Developer Mode / 管理员权限，`New-Item -ItemType SymbolicLink` 失败，无法恢复。这是检出层面的既有问题，`origin/dev` 同样如此，不是本次改动引入。

改用等价的范围化门禁（同一 tsconfig、同一 bun 类型检查器，只检查该文件及其导入）：

```
$ bun check --no-script src/shell/titlebar/projects.tsx
No type errors in 522 files
```

这不覆盖整包，但覆盖了本次**全部**改动代码及其传递依赖；SUMMARY 在此明确记录，未声称整包 typecheck 通过。

## Verification

| 门 | 命令 | 结果 |
| --- | --- | --- |
| 类型（范围化） | `packages/app`: `bun check --no-script src/shell/titlebar/projects.tsx` | **pass** — `No type errors in 522 files`，无诊断指向 `projects.tsx` |
| 类型（整包） | `packages/app`: `bun typecheck` | **blocked（环境）** — 见「Issues Encountered」，0 files checked，无诊断指向 `projects.tsx` |
| 单测 | `packages/app`: `bun run test:unit` | **pass** — `2716 pass / 0 fail`，275 files（并行计划 02-02 的 `projects-groups*` 当时无改动，无跨计划失败可归因） |
| 改动文件 lint | 仓库根: `bun script/lint-changed.ts 7a61e6550f` | **pass** — `0 problem(s) in 0 of 1 changed files` |
| 文档门 | `bun -e "…"`（`4. **不显示空 checkout 行**` 恰好一处） | **pass** — exit 0 |
| 手工 dev 服务器观察 | 见下 | **未执行** |

### 手工验证未执行（记录，不声称通过）

计划第 5–10 条要求 `bun dev serve --port 4096` + `packages/app` 的 `bun dev -- --port 4444`，并在浏览器 Network 面板核对请求次数、切走切回、断连降级与首帧中间态。本次执行环境明确禁止启动 / 重启 / 停止已安装的 app 与 sidecar 服务器进程，且无法在不触碰现有实例的前提下安全取得 Network 观察，因此**未执行**，结论留待人工或后续验证：

- **成功标准 4 选择的是「不显示」分支** —— 依据 `docs/designs/project-grouped-sessions-sidebar.md` §已知取舍 第 4 条（唯一记录位置）。
- 「每个可见 `projectID` 恰好一次」当前证据为**源码断言**：`requestedWorktrees`（组件体内 Set，挂载期作用域）+ `cached(project.id) !== undefined` 早返回 + `add` 先于 `list`。D-13 明确该契约不由单测拥有（`inventory.test.ts` 拥有共享在途请求与缓存复用），故运行时次数仍缺一次 Network 观察。
- 首帧「一个 checkout 裂成多行」的中间态长度同样只缺观察，代码层面未新增任何等待或 loading。

## Known Stubs

无。本次改动不引入占位数据、空态文案或未接线的数据源。

## Threat Flags

无新增威胁面。改动只读取既有 `worktree` 接口（`list`），未新增端点、鉴权路径或文件访问模式；T-02-02（禁止 `refresh`）由源码断言满足：`projects.tsx` 中 `refresh` 一次都不出现。

## Next Phase Readiness

- **02-02（并行、同 wave）**：本计划不碰 `projects-groups.ts` / `projects-groups.test.ts` / `perf/projects-groups*`，其 `sandboxes` 兜底与 key 回归仍待其完成；本计划的 effect 是它「清单到达后两行」的输入端。
- **Phase 3**：行源仍由 `inbox.entries()` 推导（D-10 的选择），`projects.tsx` 的 key 构造未改，`groupKey` / `parseGroupKey` 统一仍是 03-01 的范围。
- **待补的一次观察**：若后续有人能安全启动 dev 服务器，请补记「首次进入 Projects 后每个可见 projectID 各一次请求、切回复用缓存、断连无 toast/loader」三项结论。

---
*Phase: 02-checkout*
*Completed: 2026-11-13*

## Self-Check: PASSED

- `FOUND: .planning/phases/02-checkout/02-01-SUMMARY.md`
- `FOUND: packages/app/src/shell/titlebar/projects.tsx`
- `FOUND: docs/designs/project-grouped-sessions-sidebar.md`
- `FOUND: 8f98340daf`（Task 1 提交，在 HEAD 祖先链上）
- `FOUND: 777504be9c`（Task 2 提交，在 HEAD 祖先链上）
- 计划元数据提交：`skipped_commit_docs_false`（`.planning/config.json` 的 `commit_docs: false`，有意跳过）
