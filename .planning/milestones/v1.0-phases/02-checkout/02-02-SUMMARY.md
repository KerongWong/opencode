---
phase: 02-checkout
plan: 02
subsystem: ui
tags: [solidjs, worktree-inventory, projects-sidebar, grouping, strobe]

# Dependency graph
requires:
  - phase: 01-row-source-convergence
    provides: 行源收敛——Projects 的行集合由 `inbox.entries()` 推导，本计划只改会话归属、不加行
  - phase: 02-checkout
    plan: 01
    provides: 进入 Projects 模式时按需读取一次 worktree 清单（清单到达后 `withWorktreeInventory` 重算 `sandboxes` 的回填路径）
provides:
  - "`sessionProjectDirectory` 的根集合 = `worktrees` ∪ `sandboxes` ∪ `worktree`，按 `sameDirectory` 去重，仍取最近的包含者"
  - "两条清单路径（只有 canonical + `sandboxes` / 清单已到达）对同一批会话产出相同 group key 的回归契约（D-12）"
  - "同一 git 根两份本地拷贝各一行、更深 checkout 按 D-08 独立成行的 key 回归"
  - "`projectGroupFor` 的 strobe 用例（primary `cpu.work`）与按元数据对象记忆的 per-project 根集合缓存（D-09 实测后才加）"
affects: [03-01, 03-02, 03-03]

# Actuals (#2632) — chars/4 over the realized diff, same scale as the plan's estimate.
actuals:
  tokens: 2250
  tasks: 3
  commits: 4

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "根集合 = `worktrees` ∪ `sandboxes` ∪ `worktree`，按 `sameDirectory` 去重；归属仍由 `containsDirectory` + `comparablePath` 长度排序决定"
    - "纯函数热路径的记忆化：`WeakMap<ProjectRoots, readonly string[]>` 按元数据对象缓存根集合（`global-sync/utils.ts` 的 `providerCatalogs` 是同一模式）"
    - "strobe 脚本用例只为已导出的纯函数而建，不为组件内 memo 开测试 seam"

key-files:
  created:
    - packages/app/perf/projects-groups.ts
    - packages/app/perf/projects-groups.bench.ts
  modified:
    - packages/app/src/shell/titlebar/projects-groups.ts
    - packages/app/src/shell/titlebar/projects-groups.test.ts

key-decisions:
  - "根集合显式包含 canonical（`project.worktree`）：`sandboxes` 从不含它，元数据也可能只带它；缺这一项 `repo/packages/ui` 这类会话会退化成按会话目录成行"
  - "key 表达式一字未改（`${server}\\u0000${comparablePath(checkout)}`）：清单到达只改变归属选择，不改写已有 checkout 的身份（D-08）"
  - "没有引入「目录 → checkout」缓存，也没有对清单做嵌套过滤（D-07）；缓存只在实测回归后才加，且只缓存根集合这一层派生"
  - "缓存键用元数据**对象**而不是 `project.id`：`withWorktreeInventory` 会为同一个 id 重写 `sandboxes`，按 id 记忆会让清单揭示的更深 checkout 永远不生效（破坏 D-08）；对象键在元数据被整体替换时自然失效"
  - "strobe 的 `--base origin/dev` 在本文件上无法成立（上游没有 `projects-groups.ts`），改用 `777504be9c`（02-01 的 head，即本文件改动前的确切状态）作为 base"

patterns-established:
  - "分组契约的唯一 owner 是 `projects-groups.test.ts`：新增行为先写修复前会失败的用例，再改实现"
  - "热路径的纯函数改动必须用 strobe 对改动前构建度量；回归成立才加记忆化，并复测同一命令"

requirements-completed: [CHK-02, CHK-03, CHK-04]

commits: 4
plan_head_before: 777504be9cdfa7a5c2cf5cd9d1afa9ea3b5372d6
plan_head_after: 865c92915a8d4cda33229aae005bc93c6acf8b6d

coverage:
  - id: D1
    description: "只有 canonical + `sandboxes` 的项目在清单到达前把 checkout 内子目录的会话归到该 checkout，不再按会话目录成行（CHK-02）"
    requirement: "CHK-02"
    verification:
      - kind: unit
        ref: "packages/app: bun test src/shell/titlebar/projects-groups.test.ts#sessionProjectDirectory > falls back to the project's sandboxes before the inventory arrives"
        status: pass
      - kind: other
        ref: "packages/app: bun check --no-script src/shell/titlebar/projects-groups.ts src/shell/titlebar/projects-groups.test.ts perf/projects-groups.ts perf/projects-groups.bench.ts（No type errors in 5 files）"
        status: pass
    human_judgment: false
  - id: D2
    description: "同一批会话在「只有 canonical + sandboxes」与「清单含全部 checkout」两种输入下产出完全相同的 group key（CHK-04 / D-12）"
    requirement: "CHK-04"
    verification:
      - kind: unit
        ref: "packages/app: bun test src/shell/titlebar/projects-groups.test.ts#projectGroupFor > keys the same sessions the same way before and after the inventory arrives"
        status: pass
    human_judgment: false
  - id: D3
    description: "同一 git 根的两份本地拷贝各一行；清单揭示的更深 checkout 独立成行，而 canonical 行的 key 不变（CHK-03 / D-08）"
    requirement: "CHK-03"
    verification:
      - kind: unit
        ref: "packages/app: bun test src/shell/titlebar/projects-groups.test.ts#projectGroupFor > keeps two clones of one repository on separate rows + moves a session into a deeper checkout the inventory reveals"
        status: pass
    human_judgment: false
  - id: D4
    description: "分组热路径对改动前构建有实测结论：先量到回归、再加最小缓存、复测回归消失（D-09）"
    verification:
      - kind: other
        ref: "bunx strobe bench packages/app/perf/projects-groups.bench.ts --base 777504be9c --head . · exp_53bce8（加缓存前 cpu.work +1499%）→ exp_d99322（加缓存后 +3%，CI −1%…+7%，40 对后不再有判定）"
        status: pass
      - kind: other
        ref: "bunx strobe bench packages/app/perf/projects-groups.bench.ts --check · exp_bd8106 / exp_96366a（两个都 pass，无 refused case）"
        status: pass
    human_judgment: false
  - id: D5
    description: "运行中的侧栏观感：同一 checkout 内的 `packages/app` 与 `packages/ui` 同一行、两份拷贝两行、清单到达前后行数不抖动"
    verification:
      - kind: manual_procedural
        ref: "仓库根 bun dev serve --port 4096 + packages/app bun dev -- --port 4444（未执行）"
        status: unknown
    human_judgment: true
    rationale: "执行环境明确禁止启动/重启已安装的 app 与 sidecar 进程，端口也可能被现有实例占用；首帧与清单到达前后的行抖动只能在运行中的 UI 上观察，不能用单测代替。"

# Metrics
duration: ~48min
completed: 2026-11-13
status: complete
---

# Phase 2 Plan 02: sandboxes 兜底与 checkout 身份回归 Summary

**`sessionProjectDirectory` 的根集合改为 `worktrees` ∪ `sandboxes` ∪ `worktree`（`sameDirectory` 去重、key 构造不变），用会失败的双路径回归钉住「每份本地 checkout 恰好一行」，并按 strobe 实测补了 per-project 根集合缓存**

## Performance

- **Duration:** ~48 min（含两次 strobe 对比与一次缓存前后的实验）
- **Started:** 2026-11-13T16:27:46Z（本地 16:27）
- **Completed:** 2026-11-13T17:16:00Z（本地 17:16，估算自最后一次工具调用）
- **Tasks:** 3
- **Files modified:** 4（2 新增 + 2 修改；`+140 / −13` 行）

## Accomplishments

- `packages/app/src/shell/titlebar/projects-groups.ts`：新增文件内类型 `ProjectRoots`（三个字段都可选），`sessionProjectDirectory` / `projectGroupFor` 的参数从「只有 `worktrees`」加宽到「`worktrees` ∪ `sandboxes` ∪ `worktree`」，按 `sameDirectory` 去重后仍取最近的包含者。`projectGroupFor` 的 key 表达式 `${server}\u0000${comparablePath(checkout)}` 一字未改，导出面仍是原来三个函数。
- `packages/app/src/shell/titlebar/projects-groups.test.ts`：新增四条用例（1 条 `sessionProjectDirectory` + 3 条 `projectGroupFor`），覆盖 D-12 的双路径同 key、两份拷贝各一行、更深 checkout 的 D-08 解读。前两条在修复前会失败，失败输出已留档（见下）。
- `packages/app/perf/projects-groups.ts` + `.bench.ts`：`group(count)` 每轮遍历 200 条会话目录（21 个根 = canonical + 20 份 checkout，两种视图一致），case「group the sidebar sessions」primary `cpu.work`。
- D-09 有了实测结论：**加缓存前 `cpu.work` +1499%**（16.7 ms → 268 ms），补上按元数据对象记忆的根集合缓存后复测 **+3%（CI −1%…+7%）**，40 对后 strobe 不再有判定（`underpowered`），即无可见回归。

## Task Commits

Each task was committed atomically:

1. **Task 1: sandboxes 兜底让 checkout 内子目录归到该 checkout** - `4dd2dc0e5b` (feat)
2. **Task 2: 钉住双路径同 key、两份拷贝与更深 checkout** - `663ae139b8` (test)
3. **Task 3: strobe 度量 + 按实测加根集合缓存** - `865c92915a` (perf)，其中被 lint 门要求的两行空行单独成 `a66acf8219` (style)

**Plan metadata:** 未提交 — `.planning/config.json` 的 `commit_docs: false`，SDK 会返回 `skipped_commit_docs_false`（有意跳过，非失败）。

## Files Created/Modified

- `packages/app/src/shell/titlebar/projects-groups.ts`（95 行，plan 估 ≥84）：`ProjectRoots`、`rootsByProject` WeakMap、`projectRoots()`、加宽后的 `sessionProjectDirectory`；`projectGroupFor` / `directoryGroupLabels` 逻辑未动。
- `packages/app/src/shell/titlebar/projects-groups.test.ts`（139 行，plan 估 ≥110）：4 条新用例，原 8 条一字未改。
- `packages/app/perf/projects-groups.ts`（32 行，plan 估 ≥25）：`group(count)` 是唯一导出；无 DOM / Solid / timer / 随机性。
- `packages/app/perf/projects-groups.bench.ts`（14 行，plan 估 ≥12）：单个 case，`ctx.call("group", 50)`。

## 修复前失败证据（plan 的 `<verification>` 第 8 条）

命令：`cd packages/app && bun test --conditions=solid --isolate --preload ../ui/test/solid-jsx.ts --preload ./happydom.ts src/shell/titlebar/projects-groups.test.ts`

1. `sessionProjectDirectory > falls back to the project's sandboxes before the inventory arrives`
   `Expected: "C:/work/app/.worktrees/feature"` / `Received: "C:/work/app/.worktrees/feature/src"`（现状只读 `worktrees`，返回会话目录自身）。
2. `projectGroupFor > keys the same sessions the same way before and after the inventory arrives`
   `expect(before).toEqual(after)` 的 diff：`before`（只有 canonical + sandboxes）= `["srv\0C:/work/app", "srv\0C:/work/app"]`，`after`（清单已到达）= `["srv\0C:/work/app", "srv\0C:/work/app/.worktrees/feature"]`。修复前两条会话都塌到 canonical 上，这正是用户看到的「一个 checkout 裂成好几行 / 粘成一行」。
3. `projectGroupFor > keeps two clones of one repository on separate rows`
   `Expected: "srv\0C:/work/app"` / `Received: "srv\0C:/work/app/packages/ui"`（`sandboxes` 里的第二份拷贝完全没参与归属）。

运行汇总：`9 pass / 3 fail`（修复前）→ `12 pass / 0 fail`（修复后）。第 3 条 D-08 用例在修复前即通过，它守的是「清单到达后 canonical 行的 key 不变」，属于回归护栏而非本次行为变化。

证明方式：把 `projects-groups.ts` 临时回退到 `777504be9c` 的版本运行同一命令取上述输出，再 `git checkout 4dd2dc0e5b -- …` 恢复（未使用 stash，未整树重置）。

## Strobe 结果（D-09）

| 运行 | 命令 | Experiment | 结果 |
| --- | --- | --- | --- |
| 用例校验（加缓存前） | `--check` | `exp_bd8106` | `pass group the sidebar sessions · app`，`cpu.work` 331 ms |
| 对比（加缓存前） | `--base 777504be9c --head .` | `exp_53bce8` | `cpu.work` **16.7 ms → 268 ms，+1499%（CI +1318%…+1676%），verdict `more`** |
| 用例校验（加缓存后） | `--check` | `exp_96366a` | `pass group the sidebar sessions · app` |
| 对比（加缓存后） | `--base 777504be9c --head .` | `exp_d99322` | `cpu.work` **16.5 ms → 17.1 ms，+3%（CI −1%…+7%），40 对后 `underpowered`（无判定）** |

- **为什么会有回归**：`sameDirectory` 是「双向 `containsDirectory`」，每次调用 ≈ 4 次 `comparablePath` + 2 次小写化。按 `findIndex` 去重 21 个根是 O(n²) ≈ 210 次 `sameDirectory`，而改动前整个归属选择只有 21 次 `containsDirectory`。独立微基准（10k 次调用，21 个根）复现同一比例：**18.3 ms → 120.2 ms**。
- **为什么加缓存而不是换比较方式**：`ProjectRoots` 的同一对象会被同一项目的所有会话共享（`projects.tsx` 每个会话都调一次 `projectGroupFor`），而项目元数据在本仓库里始终是**整体替换**（`withWorktreeInventory` / `normalizeProjectInfo` / `updateProjectInfo` 都返回新对象），所以按对象记忆是正确的，且比「按根集合内容拼键」少一次每调用的 join。
- **为什么不用 `project.id`**：同一个 id 的 `sandboxes` 会在清单到达时被重写；按 id 记忆会让 D-08（清单揭示的更深 checkout 改归该 checkout）永远不生效——那是本阶段要保住的行为。
- **为什么 `--base origin/dev` 无法成立**：`git ls-tree origin/dev packages/app/src/shell/titlebar/` 里没有 `projects-groups.ts`（整个 Projects 分组是 fork 内的工作），strobe 在 base 工作树里报 `Cannot find module '../src/shell/titlebar/projects-groups'`，实验 `exp_eedb3c` 因此没有 verdict。改用 `777504be9c`（02-01 的 head，即本文件改动前的确切状态）作为 base，两侧输入与 harness 完全相同，verdict 可归因于本次改动。
- **`--head .` 包含哪些改动**：head 是 `865c92915a` 的工作树，含 02-01 已提交的 `projects.tsx` 清单 effect。脚本用例只加载 `projects-groups.ts` 的依赖链（`@opencode/util/path`），不加载 `projects.tsx`，因此不影响本实验。
- **环境警告（照录，不改判定）**：`Background`（14% 的 CPU 在运行前就忙，80 个 block 都有其它进程占用被测 CPU）、`NotSteady`（4 个 block 的 10 次预热里工作量来回摆动）、`Outliers`（`cpu.work` 2 个点越过 Tukey 栅栏，保留，秩检验对它们稳健）、`StaleCalibration`（本机还没有热节流基线）、`OverheadBudget`（strobe 自身在部分 block 超预算）。加缓存前后的两次对比在同样的背景噪声下给出了截然不同的结论（+1499% vs +3%），差异不是噪声。

## Decisions Made

- **canonical 显式入列**：`sandboxes` 从不含 canonical，`normalizeProjectInfo` 又只把 canonical 放进 `worktrees`，因此只靠 `sandboxes` 兜底会漏掉项目根下的会话（`repo/packages/ui`）。根集合三者取并集，去重后不排除 canonical（与 `workspaces/paths.ts` 的 `workspaceSelectionDirectories` 有意不同——那里排除 canonical 是为了「新建会话的目标目录」，这里需要它参与归属）。
- **key 格式不动**：`projectGroupFor` 仍拼 `${server}\u0000${comparablePath(checkout)}`，`order` / `removed` 的持久化 key 因此完全不变（Phase 3 才统一 key）。
- **缓存只缓存根集合，不缓存「目录 → checkout」**：D-07 的禁令针对后者；前者是元数据的纯函数，对象变了缓存自然失效。
- **不为测试加 seam**：`ProjectRoots` 保持文件内类型不导出，没有测试专用参数；strobe 用例只调用已导出的 `projectGroupFor`。

## Deviations from Plan

### 1. [Rule 3 - Blocking] 用 `777504be9c` 代替 `origin/dev` 作为 strobe 的 base

- **Found during:** Task 3（strobe 对比）
- **Issue:** plan 的 `<verify>` 与 D-09 都指定 `--base origin/dev --head .`，但 `origin/dev` 没有 `packages/app/src/shell/titlebar/projects-groups.ts` 这个文件（`git ls-tree -r origin/dev | grep projects-groups` 为空），base 构建加载 harness 时直接 `Cannot find module`（`exp_eedb3c`，无 verdict）。对一个上游不存在的文件，「相对 origin/dev 的回归」在定义上不可度量。
- **Fix:** 改用 `777504be9c`（02-01 的 head，`projects-groups.ts` 在本计划改动前的确切提交）作为 base，命令其余部分不变。
- **Verification:** `exp_53bce8` 与 `exp_d99322` 两次都给出可判定/可归因的结果；base 侧跑的就是改动前的实现。
- **Committed in:** 不涉及代码（实验记录在本文档）

### 2. [Plan branch taken] 加缓存（D-09 的回归分支）

- **Found during:** Task 3（第一次 `--base/--head`）
- **Issue:** 根集合的 `sameDirectory` 去重是 O(n²)，实测 `cpu.work` +1499%。
- **Fix:** 在 `projects-groups.ts` 加 `rootsByProject = new WeakMap<ProjectRoots, readonly string[]>()` 与 `projectRoots()`，让同一元数据对象的根集合只构造一次。
- **Files modified:** `packages/app/src/shell/titlebar/projects-groups.ts`（本计划 `files_modified` 的 Task 1 条目，不是新文件）
- **Verification:** 复测 `exp_d99322`：+3%（CI −1%…+7%），无判定；12 条单测、范围化 typecheck、`typecheck:e2e` 都不受影响。
- **Committed in:** `865c92915a`

### 3. [Rule 1 - Bug] changed-file lint 门要求的两行空行

- **Found during:** Task 3（`bun script/lint-changed.ts 7a61e6550f`）
- **Issue:** `anti-slop(require-readable-spacing)` 在两条新用例的第二个 fixture 前要求空行（`projects-groups.test.ts:67`、`:93`）。
- **Fix:** 各补一行空行；用例语义与断言未改。
- **Committed in:** `a66acf8219`

---

**Total deviations:** 1 auto-fixed（lint 空行）、1 阻断性替代（strobe base）、1 由 D-09 授权的计划内分支（缓存）
**Impact on plan:** 无范围外改动。唯一需要复核的判断是缓存键的选择（对象 vs `project.id`）：按 id 记忆会破坏 D-08，故按对象。

## Issues Encountered

**1. 整包 `bun typecheck` 在本机仍无法完成（既有环境问题，非本次改动）。**

```
<error file="src/custom-elements.d.ts" line="1" column="1" code="TS1128">Declaration or statement expected.
Found 2 errors in 1 file, checked 0 files across 1 project
```

`packages/app/src/custom-elements.d.ts` 在 git 里是符号链接（`git ls-files -s` → `120000`），本机 `core.symlinks=false` 把它检出成只含目标路径的文本文件。02-01 已诊断并留档，本次未重复修复。改用同 tsconfig、同检查器的范围化门禁：

```
$ bun check --no-script src/shell/titlebar/projects-groups.ts src/shell/titlebar/projects-groups.test.ts perf/projects-groups.ts perf/projects-groups.bench.ts
No type errors in 5 files
```

**2. `bun run typecheck:e2e` 有 184 条既有错误，没有一条指向本计划的文件。**

- 与 01-02-SUMMARY 记录的 184 条完全同源（`../ui/src/**` 的 CSS 副作用 import、`ImportMeta.glob`、主题类型）：`e2e/tsconfig.json` 的 `include` 指向不存在的 `../src/types.ts`，`vite/client` 的环境类型因此缺失。
- 证明两个新文件确实在 program 内且类型干净：临时在 `perf/projects-groups.ts` 末尾加 `const probe: number = "not a number"`，命令随即报 `perf/projects-groups.ts(33,7): error TS2322` + `TS6133`，总数从 184 变 186；移除后回到 184，最小注入已删净。

**3. 手工 UI 验证未执行**（见下），环境禁止启动/重启 app 与 sidecar 进程。

## Verification

| 门 | 命令（工作目录） | 结果 |
| --- | --- | --- |
| 单测 | `packages/app`: `bun test --conditions=solid --isolate --preload ../ui/test/solid-jsx.ts --preload ./happydom.ts src/shell/titlebar/projects-groups.test.ts` | **pass** — 12 pass / 0 fail（修复前 9 pass / 3 fail） |
| 类型（范围化） | `packages/app`: `bun check --no-script <4 个改动文件>` | **pass** — `No type errors in 5 files` |
| 类型（整包） | `packages/app`: `bun typecheck` | **blocked（既有环境）** — 仅 `custom-elements.d.ts` 的 TS1128，0 files checked |
| 单测（整包） | `packages/app`: `bun run test:unit` | **pass** — 2720 pass / 0 fail，275 files |
| e2e 类型门 | `packages/app`: `bun run typecheck:e2e` | **184 条既有错误，0 条指向本计划文件**；probe 证明两个新 perf 文件在 program 内 |
| strobe 用例校验 | 仓库根: `bunx strobe bench packages/app/perf/projects-groups.bench.ts --check` | **pass** — `exp_bd8106`（前）/ `exp_96366a`（后），无 refused case |
| strobe 对比 | 仓库根: `bunx strobe bench … --base 777504be9c --head .` | `exp_53bce8` `more` +1499% → `exp_d99322` +3%（无判定） |
| 改动文件 lint | 仓库根: `bun script/lint-changed.ts 7a61e6550f` | **pass** — `0 problem(s) in 0 of 5 changed files` |
| 新增文件已被 git 跟踪 | `git ls-files --error-unmatch packages/app/perf/projects-groups.ts packages/app/perf/projects-groups.bench.ts` | **pass** — 两个都返回路径 |
| prettier | `packages/app`: `bunx prettier --check <4 个改动文件>` | **pass** |
| 手工 UI 验证 | 见下 | **未执行** |

### 手工验证未执行（记录，不声称通过）

plan 第 9 条要求 `bun dev serve --port 4096`（仓库根）+ `bun dev -- --port 4444`（`packages/app`），在 Projects 里核对「同一 checkout 内 `packages/app` 与 `packages/ui` 同一行、两份拷贝两行、清单到达前后行数与标签不抖动」。执行环境禁止启动/重启/停止已安装的 app 与 sidecar 服务器，且 4096 可能已被现有实例占用，故**未执行**，结论留待人工或后续验证（已作为 coverage D5 记入 `human_judgment: true`）。

### CHK-02 的数据来源与首帧边界（照 plan 的 `<objective>` 写明，不放大结论）

- `sandboxes` 不是独立数据源：`upsertProject` 只在创建项目时写 `sandboxes: []`，客户端只有 `withWorktreeInventory` 在清单到达后把它重算为「清单目录 − canonical」。
- 因此 CHK-02 的「不退化成按会话目录成行」由**清单到达**兑现，而**不是**由冷启动首帧兑现：全新且未迁移的项目在首个清单返回前 `sandboxes` 为空，那一帧里 checkout 内子目录的会话仍会各自成行，直到 02-01 的 `list` 到达。本计划只保证「`sandboxes` 一旦有值就立刻生效」，可观察路径是「清单已缓存或已迁移的项目切走再切回 Projects 时首帧即归到 checkout」。

## Known Stubs

无。改动是纯函数与基准，不引入占位数据、空态文案、未接线数据源或跳过的测试。

## Threat Flags

无新增威胁面。只加宽了一个纯函数的输入类型并加了一层内存记忆化：没有新端点、没有鉴权路径、没有文件访问、没有持久化 key 变更。T-02-05（行身份被篡改）由双路径同 key 用例守住；T-02-06（前缀误匹配）仍完全依赖 `@opencode/util/path` 的 `containsDirectory` / `comparablePath` / `sameDirectory`；T-02-07（热路径 DoS）由 `exp_d99322` 的实测结论覆盖。

## Next Phase Readiness

- **Phase 3（key 统一/迁移）**：本计划把「哪一份 checkout 拥有一个会话」钉死为由 `worktrees ∪ sandboxes ∪ worktree` 决定，但 key 的拼接与解析仍是 `projects-groups.ts` 里的就地字符串，`groupKey` / `parseGroupKey` 的抽取按计划属于 03-01。`projects-sidebar.v1` 里的 key 因此与本次改动兼容（格式未变），迁移可以直接以当前 key 为输入。
- **待补的一次观察**：若后续有人能安全启动 dev 服务器，请补记「同一 checkout 内两个子目录同一行 / 两份拷贝两行 / 清单到达前后不抖动」三项结论，并把 D5 的状态从 `unknown` 改掉。
- **缓存的不变量**：`rootsByProject` 的正确性依赖「项目元数据整体替换、不原地编辑」。若将来有代码在 store 里原地改 `project.sandboxes` / `worktrees`，分组会读到旧根集合；改动那些写入路径时需要同时看这里（注释已写明）。

---
*Phase: 02-checkout*
*Completed: 2026-11-13*

## Self-Check: PASSED

- `FOUND: .planning/phases/02-checkout/02-02-SUMMARY.md`
- `FOUND: packages/app/src/shell/titlebar/projects-groups.ts`
- `FOUND: packages/app/src/shell/titlebar/projects-groups.test.ts`
- `FOUND: packages/app/perf/projects-groups.ts`
- `FOUND: packages/app/perf/projects-groups.bench.ts`
- `FOUND: 4dd2dc0e5b`（Task 1 提交，在 HEAD 祖先链上）
- `FOUND: 663ae139b8`（Task 2 提交，在 HEAD 祖先链上）
- `FOUND: a66acf8219`（Task 3 的 lint 空行提交，在 HEAD 祖先链上）
- `FOUND: 865c92915a`（Task 3 提交，在 HEAD 祖先链上）
- 计划元数据提交：`skipped_commit_docs_false`（`.planning/config.json` 的 `commit_docs: false`，有意跳过）

