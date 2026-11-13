---
phase: 02-checkout
verified: 2026-11-13T09:47:26Z
status: passed
score: 4/5 must-haves verified
covered_files: [".planning/phases/02-checkout/02-01-PLAN.md", ".planning/phases/02-checkout/02-01-SUMMARY.md", ".planning/phases/02-checkout/02-02-PLAN.md", ".planning/phases/02-checkout/02-02-SUMMARY.md", "docs/designs/project-grouped-sessions-sidebar.md", "packages/app/perf/projects-groups.bench.ts", "packages/app/perf/projects-groups.ts", "packages/app/src/shell/titlebar/projects-groups.test.ts", "packages/app/src/shell/titlebar/projects-groups.ts", "packages/app/src/shell/titlebar/projects.tsx"]
covered_digest: "v4:sha256:6bc21b10b2af570c2ebdfae68c89634f150dfc19496067b6c7cf2f4590004117"
behavior_unverified: 1
overrides_applied: 0
behavior_unverified_items:
  - truth: "全新启动直接进入 Projects 时，每个可见 projectID 的 worktree 清单恰好请求一次，并在后续渲染与会话更新中被复用（成功标准 1 / CHK-01）"
    test: "按 AGENTS.md 的 Local Dev 起 `bun dev serve --port 4096` 与 `packages/app` 的 `bun dev -- --port 4444`，不打开任何 Location、Settings › Worktrees 或 Home 项目页，直接进入 Projects，在 Network 面板记录每个 projectID 的 worktree 列表请求次数；随后触发一次会话更新（新建或发送消息），再切到 Inbox 并切回 Projects"
    expected: "首次进入时每个可见 projectID 的 worktree 列表请求恰好 1 次；会话更新后不新增请求；切回 Projects 时不新增请求（缓存复用）"
    why_human: "请求次数是挂载期内的一次性/顺序不变量（Set 先 claim 再请求 + `cached()` 早返回），grep 只能证明形状存在，不能证明组件在某次挂载里真的只发了一次、也不证明 `inbox.entries()` 的重算没有绕过守卫。全仓没有任何测试挂载 `SidebarProjects`（`grep SidebarProjects|requestedWorktrees` 在 `*.test.ts*` 与 `e2e/` 均无命中）；D-13/UI-SPEC I-4 明确该契约不由单测拥有；`WINDOWS.md` #8 记录该观察未执行"
coincidental_reliance_items:
  - truth: "同一 git 根的两份本地拷贝显示为两行（成功标准 2 / CHK-03）"
    reason: undeclared-precondition
    harden: "分组函数在「元数据同时列出两份拷贝」时必然产出两个 key（已有回归钉住）。但生产路径要成立，`project.sandboxes` 必须真的含第二份拷贝：`packages/core/src/project/sql.ts:56` 在创建项目时写入 `sandboxes: []`，客户端只有 `withWorktreeInventory`（`workspaces/inventory.ts:23-25`）在清单到达后把它重算为「清单目录 − canonical」，而清单来自服务器对该仓库已知的 worktree。请把「第二份本地克隆会出现在 sandboxes / 清单里」提升为显式前置条件（或在设计文档写明这一数据来源），否则全新项目里的第二份拷贝仍会按会话目录成行"
human_verification:
  - test: "dev 服务器 Network 面板：全新启动直接进入 Projects，记录每个可见 projectID 的 worktree 列表请求次数；触发一次会话更新后再切走切回"
    expected: "每个可见 projectID 恰好一次；会话更新与切回不再发请求"
    why_human: "见 behavior_unverified_items 第 1 条：无测试挂载该组件，只能运行观察"
  - test: "同时开 4–9 个项目进入 Projects，观察清单到达前后的行数与行标签；再选一个 `sandboxes` 已就绪（清单已缓存或已迁移）的项目切走再切回"
    expected: "首帧不出现「一个 checkout 裂成多行」的长中间态；清单到达后行数不减少、不抖动、标签不变；切回时首帧就把子目录会话归到 checkout（UI-SPEC「partial」backstop）"
    why_human: "行抖动/闪烁是渲染时序现象，单测只能证明 key 相等，不能证明画面上不闪"
  - test: "断开 dev 后端后进入 Projects（不重启已安装的 app 与 sidecar）"
    expected: "无 toast、无 loader、无错误文案；行仍按 `sandboxes` 分组"
    why_human: "失败分支的静默降级只能在运行中的 UI 观察（D-04/D-05）"
  - test: "确认 WR-01 的产品决定：把一个含 linked worktree 的项目从侧栏移除，然后重新进入 Projects（此时挂载期会读取清单）"
    expected: "由产品决定：要么「项目已移除」意味着它新发现的 checkout 也留在 Ungrouped，要么「新发现的 checkout 是一行新行」，并在 `docs/designs/project-grouped-sessions-sidebar.md` §已知取舍 记录，同时让 Restore 指向仍然存在的行"
    why_human: "当前实现（`projects.tsx:111`）只按单个 checkout key 匹配 `removed`，清单到达后会话会落到未移除的新 key 上：命名行复现，且 `removedProjects()` 里留着一个 count 0 的幽灵项，其 Restore 是 no-op。根因先于本阶段，本阶段的挂载期读取让它每次启动都会发生，需要产品决定而非验证器裁决（`02-REVIEW-DISPOSITION.md` 保持 open）"
  - test: "确认 WR-02 的取舍：断连状态下首次进入 Projects（首帧读取失败），随后让连接恢复"
    expected: "要么接受「本次挂载不再重试，直到重新挂载或 `worktree.updated`」，并把 `projects.tsx:71-72` 注释里的 reconnect 恢复路径删掉；要么按 `02-REVIEW.md` 的修法在 effect 里跟踪连接状态并在断连时释放 claim"
    why_human: "代码里没有重连重试路径（`sync.tsx:104-118` 用 `refetchType: \"none\"` 失效查询，`loadProjects` 只读缓存），所以计划/注释承诺的「重连恢复」当前不成立；这是设计取舍，不是验证器可自行判定的缺陷"
---

# Phase 02: 每个本地 checkout 成行 Verification Report

**Phase Goal:** 进入 Projects 模式时按需为可见项目加载 worktree 清单，并在清单到达前用项目已有的 `sandboxes` 兜底，使同一 git 根的每份本地 checkout 恰好一行，checkout 内的子目录不再各自成行。
**Verified:** 2026-11-13T09:47:26Z
**Status:** human_needed
**Re-verification:** No — initial verification（本目录此前没有 `02-VERIFICATION.md`）

## Goal Achievement

### Observable Truths

以 ROADMAP §Phase 2 的 5 条 Success Criteria 为权威契约（PLAN frontmatter 的 truths 在下一节单独核对）。

| #   | Truth   | Status     | Evidence       |
| --- | ------- | ---------- | -------------- |
| 1 | 全新启动直接进入 Projects，每个可见 `projectID` 的 worktree 清单恰好请求一次，并在后续渲染与会话更新中被复用 | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | 代码形状成立：`projects.tsx:73` 组件体内 `requestedWorktrees = new Set<string>()`（挂载期作用域，`<Match>` 会卸载组件）、`:83` 键为 `${entry.server}\u0000${project.id}`、`:85` Set 早返回、`:88` claim 先于请求、`:90` `cached()` 早返回、`:92` 唯一一次 `worktrees.list`；`inventory.ts:47-51` 的 `staleTime: Infinity` / `gcTime: Infinity` 保证结果复用。但没有任何测试挂载 `SidebarProjects`（`*.test.ts*`、`e2e/` 均无命中），请求次数未被任何测试或运行时观察证过；`WINDOWS.md` #8 记录 Network 观察未执行 → 见 Human Verification |
| 2 | 同一 git 根的两份本地拷贝显示为两行；`repo/packages/app` 与 `repo/packages/ui` 的会话归入同一个 checkout 行 | ✓ VERIFIED | `projects-groups.test.ts:81-86`「keeps two clones…」断言 `srv\u0000C:/work/app` 与 `srv\u0000D:/branch/app` 两个不同 key；`:21-29`「falls back to the project's sandboxes」断言 `…/packages/ui → C:/work/app`。两用例在改动前实现上确实失败（见 Behavioral Spot-Checks 的独立复现）。数据前置条件见 `coincidental_reliance_items` |
| 3 | 清单返回前分组已使用 `project.sandboxes`；清单到达后不把已有 checkout 行拆成多行，也不改写已有行的 group key | ✓ VERIFIED | `projects-groups.ts:23-27` 根集合 = `worktrees ∪ sandboxes ∪ worktree`（`sameDirectory` 去重）；`:56` key 表达式 `${server}\u0000${comparablePath(checkout)}` 与改动前逐字一致（`git diff 7a61e6550f..HEAD` 该行不在 hunk 内）；`projects-groups.test.ts:57-79` 双路径同 key 用例断言两输入下 key 数组完全相等。清单揭示更深 checkout 时会话改归该 checkout 是 D-08 明确接受的行为（`:88-106`），canonical 行 key 不变 |
| 4 | 某份 checkout 无会话时：空组可见，或在 `docs/designs/project-grouped-sessions-sidebar.md` 记录不显示的理由（并指明选了哪支） | ✓ VERIFIED | **选择「不显示」分支**。`docs/designs/project-grouped-sessions-sidebar.md:131` 第 4 条 `**不显示空 checkout 行**` 含四点要素：成功标准 4 的「不显示」分支、行源仍「由会话推导」（`groups()` 只遍历 `inbox.entries()`）、理由（会重新引入没打开过的项目与已无活动的 checkout）、改为「显示」前必须先解决行源。代码一致：`projects.tsx:99-126` 的 `groups()` 只遍历 `inbox.entries()`，inventory 不产生行 |
| 5 | `projects-groups` 回归测试同时覆盖「有 inventory」与「只有 canonical + sandboxes」两条路径，且在修复前失败 | ✓ VERIFIED | `projects-groups.test.ts:57-79` 用 `sandboxesOnly` / `inventoried` 两个 fixture 断言 key 数组相等；`:21-29` 与 `:81-86` 覆盖兜底与两份拷贝。**独立复现**：把 `777504be9c`（改动前）的 `projects-groups.ts` 与本测试同置一目录运行 → 3 条实质失败（`falls back to the project's sandboxes` 期望 `…/feature` 实得 `…/feature/src`；双路径 `before` 塌回 `["srv\0C:/work/app","srv\0C:/work/app"]`；两份拷贝实得 `srv\0C:/work/app/packages/ui`） |

**Score:** 4/5 truths verified（1 present, behavior-unverified）

> 成功标准 2 的「两份拷贝两行」还依赖 `project.sandboxes` 真的含第二份拷贝，而 `packages/core/src/project/sql.ts:56` 在建项时写 `sandboxes: []`；该前置条件由 02-02 `<objective>` 显式记录，但本阶段没有端到端证据 → 见 `coincidental_reliance_items`（advisory，不计分、不改状态）。

### PLAN frontmatter must-haves（补充核对，不缩减 ROADMAP 范围）

**02-01**

| Truth | Status | Evidence |
| --- | --- | --- |
| 每个可见 projectID 在该次挂载内恰好请求一次；会话更新不重复请求 | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | 同成功标准 1 |
| 切走再切回，缓存存在时不再请求 | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | `projects.tsx:90` 的 `cached()` 早返回 + `inventory.ts:47-51` 的 `staleTime/gcTime: Infinity`；无测试、无观察 |
| 只读已保存清单，不发现/写入外部 worktree | ✓ VERIFIED | 全文件 `projects.tsx` 中 `refresh` 仅出现在注释；唯一调用点是 `:92` 的 `list`。全仓 `worktrees.refresh(` 的调用点只有 `home/model.ts:70`、`location.tsx:92`、`settings/workspaces/queries.ts:35`（均非本阶段新增） |
| 读取失败不重试、不 toast、不 loading/Suspense；失败继续由 `sandboxes` 兜底 | ✓ VERIFIED | effect 内无 `try/catch`、无 `showToast`（`:275` 的 toast 属既有移除流程）、无重试；`inventory.ts:50,57` `retry: false` + `.catch(() => undefined)`；JSX 未改（`git diff` 只新增 effect 段 27 行） |
| 清单到达经 `sync.tsx` 的 `updated` 写回并自动重算；`projects.tsx` 不订阅查询、不写 store | ✓ VERIFIED | `sync.tsx:56-74` `updated → setGlobalStore("project", withWorktreeInventory)`；`sync.tsx:151-161` 另在 `worktree.updated` 时 list；`projects.tsx` 无 `setGlobalStore`、无 worktree `useQuery` |
| inventory 不是行源，不生成空行 | ✓ VERIFIED | `projects.tsx:99-126` 只遍历 `inbox.entries()` |
| 两份拷贝在清单到达后各自一行且 key 不同 | ✓ VERIFIED | `projects-groups.test.ts:81-86` |
| 请求按服务器分区，不用 `global.serverCtx(...)` 解析 | ✓ VERIFIED | `projects.tsx` 无 `serverCtx(`；逐 entry 走 `entry.ctx.sync.worktrees`，键含 `entry.server` |

**02-02**

| Truth | Status | Evidence |
| --- | --- | --- |
| 根集合 = `worktrees ∪ sandboxes ∪ worktree`，`sameDirectory` 去重 | ✓ VERIFIED | `projects-groups.ts:23-27` |
| 同一批会话两输入产出相同 group key | ✓ VERIFIED | `projects-groups.test.ts:57-79` |
| canonical 即使不在 `sandboxes` 也参与归属 | ✓ VERIFIED | `projects-groups.ts:26` 显式追加；`:28` 断言 `packages/ui → C:/work/app` |
| 两份拷贝各自一行、互不覆盖 | ✓ VERIFIED | `:81-86` |
| 更深 checkout 改归该 checkout，其它行 key 不变 | ✓ VERIFIED | `:88-106`（注：该用例在改动前即通过，属 D-08 的 characterization 而非回归护栏，见 IN-02） |
| 最近包含者归属、key 格式不变、不迁移 key | ✓ VERIFIED | `projects-groups.ts:40-41,56`；diff 中 key 行未变 |
| 根集合构造不做缓存、不对清单做嵌套过滤 | ✓ VERIFIED（D-09 授权的分支） | **字面有偏差**：新增 `rootsByProject = new WeakMap`（`:14-32`）。这是 02-02 Task 3 明确授权的分支（「verdict 显示分组回归：才加缓存」），实测 `cpu.work` +1499%（`exp_53bce8`）→ 加缓存后 +3%/无判定（`exp_d99322`）。prohibitions 中「不得引入『目录 → checkout』缓存」与「不得做嵌套过滤」均满足：缓存的是元数据对象上的根集合，不是目录映射 |
| 热路径已用 strobe 对 `origin/dev` 度量，只有回归才加缓存 | ✓ VERIFIED（有记录的替代） | **独立确认**：`git ls-tree origin/dev:packages/app/src/shell/titlebar` 中没有 `projects.tsx` / `projects-groups.ts`（整个 Projects 侧栏是 fork 内工作），`--base origin/dev` 在定义上不可度量；改用 `777504be9c` 是唯一可行 base，SUMMARY 记录充分 |

## Required Artifacts

`gsd-tools query verify.artifacts` 对两个 PLAN 均返回 `all_passed: true`（02-01: 2/2；02-02: 4/4）；行数下限逐项复核通过。

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `packages/app/src/shell/titlebar/projects.tsx` | SidebarProjects 内挂载期 Set 守卫 + 一个 `createEffect` | ✓ VERIFIED | 726 行（≥715）。`requestedWorktrees` 在组件体内（`:73`），effect 只有一处（`:75-94`）；JSX/滚动/拖拽/文案零改动（`git diff --stat`：+27 行） |
| `docs/designs/project-grouped-sessions-sidebar.md` | §已知取舍 第 4 条 | ✓ VERIFIED | 186 行（≥186）；`:131` 恰一处 `4. **不显示空 checkout 行**`，§实测接缝清单未改（+1 行） |
| `packages/app/src/shell/titlebar/projects-groups.ts` | `ProjectRoots` + 根集合去重，key 不变 | ✓ VERIFIED | 95 行（≥84）；`ProjectRoots` 未导出，导出面仍为三个函数 |
| `packages/app/src/shell/titlebar/projects-groups.test.ts` | 双路径 / 两份拷贝 / 更深 checkout 回归 | ✓ VERIFIED | 139 行（≥110）；12 用例（原 8 + 新 4），无人为 mock |
| `packages/app/perf/projects-groups.ts` | strobe 宿主，`group(count)` | ✓ VERIFIED | 32 行（≥25）；仅导出 `group`，无 DOM/Solid/timer/随机性 |
| `packages/app/perf/projects-groups.bench.ts` | 单 case，`primary: "cpu.work"` | ✓ VERIFIED | 14 行（≥12）；`ctx.call("group", 50)`，已 tracked（`git ls-files` 可识别） |

## Key Link Verification

`gsd-tools query verify.key-links` 对两份 PLAN 均报 `all_verified: false`（6/6「Target not referenced in source」）。**这是工具的静态启发式误报**：这些接缝都是通过上下文对象、store 回流或同一对象的纯函数消费连接，不是直接的 `import`。逐条人工核对如下：

| From | To  | Via | Status | Details |
| ---- | --- | --- | ------ | ------- |
| `projects.tsx` | `runtime/server/sync.tsx` | `entry.ctx.sync.worktrees.list(projectID)` → `updated` → `withWorktreeInventory` 写回 `globalStore.project` | ✓ WIRED | `runtime.tsx:255` 把 `createServerSyncContext` 的返回值挂到 `ServerCtx.sync`，`sync.tsx:191-199` 导出 `worktrees`；`list` 在 `inventory.ts:56-57` 内 `.then` 调 `updated`（`sync.tsx:60-73`） |
| `sync.tsx` | `projects.tsx` | `setGlobalStore("project", …)` → `ctx.projects.list()` → `groups()` 重算 | ✓ WIRED | `runtime.tsx:269` `list = createMemo(() => sync.data.project.map(withLocalMeta))`；`projects.tsx:104` 用 `entry.ctx.projects.forSession(entry.session)`（`runtime.tsx:350` 基于同一个 `list()`），因此写回必然触发 `groups()` 重算 |
| `projects.tsx` | `inbox-model.ts` | effect 遍历 `inbox.entries()`（`createMemo`，可追踪） | ✓ WIRED | `projects.tsx:24` 导入 `createSessionInbox`，`:57` 创建，`:76` 在 effect 内调用；`inbox-model.ts:158` `entries` 是 `createMemo` |
| `projects.tsx` | `projects-groups.ts` | `projectGroupFor(entry.server, project, entry.session.location.directory)` 是唯一分组调用点 | ✓ WIRED | import 在 `:26`，调用在 `:108`（唯一一处） |
| `workspaces/inventory.ts` | `projects-groups.ts` | `withWorktreeInventory` 把清单重算成 `sandboxes`，两种视图根集合一致 | ✓ WIRED | `inventory.ts:22-25`：`worktrees = items`，`sandboxes = items − canonical`；推论：`roots(inventoried) = roots(sandboxesOnly)`（`projects-groups.test.ts:57-79` 直接断言） |
| `global-sync/utils.ts` | `projects-groups.ts` | `normalizeProjectInfo` 只把 canonical 放进 `worktrees` | ✓ WIRED | `utils.ts:148-156`：无 wire worktrees 时 `worktrees = [{ directory: worktree }]`；这就是必须显式追加 `project.worktree` 的动机 |

## Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| `SidebarProjects` 的 `groups()` memo | `project`（`entry.ctx.projects.forSession`） | `sync.data.project` ← bootstrap `loadProjects` ← 服务器 project 列表；清单到达后由 `withWorktreeInventory` 整体替换该对象 | 是（真实服务器数据，非静态回退） | ✓ FLOWING |
| 同上 | `entry`（`inbox.entries()`） | `mergeRootSessionIndex` 的服务器索引窗口（Phase 01 已收敛） | 是 | ✓ FLOWING |
| 同上 | 分组 key 的 checkout 目录 | `projects-groups.ts:projectRoots` ← `project.worktrees/sandboxes/worktree` | 是；`sandboxes` 在全新项目上为空，清单到达后被填（见上文数据前置条件） | ✓ FLOWING |
| `worktrees.list` 请求 | 请求参数 `projectID` | `entry.ctx.projects.forSession(entry.session)?.id`，跳过 `!id` 与 `"global"` | 是 | ✓ FLOWING |

无 HOLLOW / STATIC / DISCONNECTED 项。

## Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| 分组契约（12 用例） | `cd packages/app && bun test --conditions=solid --isolate --preload ../ui/test/solid-jsx.ts --preload ./happydom.ts src/shell/titlebar/projects-groups.test.ts` | 12 pass / 0 fail（24 expect） | ✓ PASS |
| Phase 01 行源回归 | 同上，`src/runtime/server/session-index.test.ts src/home/sessions/index.test.ts` | 29 pass / 0 fail（50 expect） | ✓ PASS |
| 整包单测 | `cd packages/app && bun run test:unit` | **2720 pass / 0 fail**，275 files（与预期一致；输出中的 `ECONNRESET 127.0.0.1:8288` 是网络类用例的重试噪声，无失败） | ✓ PASS |
| 改动文件 lint | `bun script/lint-changed.ts 7a61e6550f` | `0 problem(s) in 0 of 5 changed files` | ✓ PASS |
| 修复前失败（成功标准 5） | 把 `777504be9c` 的 `projects-groups.ts` 与现测试同置临时目录运行 | `7 pass / 5 fail`，其中 3 条为实质失败（sandboxes 兜底、双路径同 key、两份拷贝），另 2 条是我用 PowerShell 管道写文件时把 `·` 写成乱码造成的伪失败；临时目录已删除 | ✓ PASS |

## Probe Execution

SKIPPED（Step 7c 不适用）：本阶段不是迁移/CLI/工具阶段，PLAN/SUMMARY 与 success criteria 均未声明 probe，`scripts/` 下无 `tests/probe-*.sh`。

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ---------- | ----------- | ------ | -------- |
| CHK-01 | 02-01 | 进入 Projects 时按需为可见项目加载 worktree 清单（每个 projectID 一次、缓存复用、不在渲染中 refresh） | ✓ SATISFIED（代码）/ ⚠️ 运行时观察缺 | `projects.tsx:73-94`；无 `refresh`、无 `serverCtx`；请求次数待人工观察 |
| CHK-02 | 02-02 | 清单到达前 `sessionProjectDirectory` 用 `sandboxes` 兜底，分组不退化为按会话目录 | ✓ SATISFIED | `projects-groups.ts:23-27`；`projects-groups.test.ts:21-29`（修复前失败） |
| CHK-03 | 02-01, 02-02 | 同一 git 根两份本地拷贝各一行；无窗口内会话的拷贝仍可见或显式说明为何不显示 | ✓ SATISFIED（选择「不显示」并记录） | `projects-groups.test.ts:81-86`；`docs/designs/project-grouped-sessions-sidebar.md:131` |
| CHK-04 | 02-02 | 分组逻辑有回归测试，覆盖有 inventory 与只有 canonical + sandboxes 两条路径 | ✓ SATISFIED | `projects-groups.test.ts:57-79`；修复前失败已独立复现 |

孤儿需求：无。REQUIREMENTS.md 映射到 Phase 2 的 CHK-01..CHK-04 全部被 PLAN 的 `requirements` 字段认领（02-01: CHK-01, CHK-03；02-02: CHK-02, CHK-03, CHK-04）。

## Anti-Patterns Found

债务标记 `TBD|FIXME|XXX|HACK|PLACEHOLDER` 在本阶段 6 个改动文件中**零命中**。

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| `packages/app/src/shell/titlebar/projects.tsx` | 111（配 `projects-groups.ts:23-27`、`projects-state.ts:9-11,28-37`） | 移除态按单个 checkout key 匹配；本阶段的挂载期清单读取会让 canonical 被移除的项目在清单到达后把会话落到未移除的新 checkout key 上（WR-01） | ⚠️ Warning | 已移除的项目可能在每次启动时以新行复现；`removedProjects()` 保留 count 0 的幽灵项，其 Restore 是 no-op。根因先于本阶段，`02-REVIEW-DISPOSITION.md` 保持 `open`；ROADMAP Phase 3 的 `projects-sidebar.v2` 迁移（成功标准 2）覆盖「失效 key 丢弃」那一半 |
| `packages/app/src/shell/titlebar/projects.tsx` | 70-72（配 `:85-92`） | 注释与 D-04 都承诺「下次挂载、`worktree.updated` 或**重连**」可恢复，但 claim 一旦加入便永不释放，effect 也不跟踪连接状态（WR-02） | ⚠️ Warning | 断连首读失败后，本次挂载内不再重试（重新挂载 / `worktree.updated` 仍可恢复）。对 `sandboxes` 为空的未迁移新项目，整轮挂载都会停在「按会话目录成行」的中间态，与本阶段目标相悖。`02-REVIEW.md` 给了修法（在 effect 内读连接状态并在断连时 `delete` claim） |
| `packages/app/src/shell/titlebar/projects-groups.ts` | 63-89 | 两个服务器暴露同一 checkout 路径时标签仍可能相同（IN-01） | ℹ️ Info | 仅标签歧义，不影响 key/行数 |
| `packages/app/src/shell/titlebar/projects-groups.test.ts` | 88-106 | 「moves a session into a deeper checkout」在改动前即通过，且三条断言与相邻用例重复（IN-02） | ℹ️ Info | 属 D-08 的 characterization，非回归护栏；不降低成功标准 5 的覆盖（双路径用例才是 owner） |
| `packages/app/perf/projects-groups.ts` | 8-9 | 注释暗示每轮都付根集合去重成本，实际 WeakMap 让后续 49 轮走缓存（IN-03） | ℹ️ Info | 基准无法监管 `projectRoots` 构建本身；不影响本阶段验收 |
| `packages/app/src/shell/titlebar/projects-groups.ts` | 21-22 | 「`sandboxes` 从不含 canonical」是未被强制的断言（IN-04） | ℹ️ Info | 正确性由 `sameDirectory` 去重兜住；注释措辞可能误导后人删掉 canonical 显式入列 |

（以上 4 条 Info 与 2 条 Warning 与 `02-REVIEW.md` 一致，处置仍为 `open`。）

## Human Verification Required

### 1. 每个可见 projectID 的清单请求恰好一次（成功标准 1）

**Test:** 起 `bun dev serve --port 4096` 与 `packages/app` 的 `bun dev -- --port 4444`，用全新会话打开 `http://localhost:4444`，不打开任何 Location、Settings › Worktrees 或 Home 项目页，直接切到 Projects；记录 Network 里每个 `projectID` 的 worktree 列表请求次数，然后新建/发送一条消息，再切到 Inbox 并切回 Projects。
**Expected:** 首次进入每个可见 `projectID` 恰好 1 次；会话更新与切回都不新增请求。
**Why human:** 全仓没有挂载 `SidebarProjects` 的测试；D-13 / UI-SPEC I-4 明确该契约不由单测拥有；`WINDOWS.md` #8 记录该观察未执行。

### 2. 清单到达前后的行稳定性（成功标准 3 的可观察部分）

**Test:** 同时开 4–9 个项目进入 Projects，观察清单到达前后行数与标签；再选一个 `sandboxes` 已就绪（清单已缓存或已迁移）的项目切走再切回。
**Expected:** 首帧不出现「一个 checkout 裂成多行」的长中间态；行数不减少、不抖动、标签不变；切回时首帧即归到 checkout。
**Why human:** UI-SPEC「partial」backstop；单测只能证明 key 相等，不能证明画面不闪。

### 3. 失败/降级路径（CHK-01 的静默降级）

**Test:** 断开 dev 后端后进入 Projects（不重启已安装的 app 与 sidecar）。
**Expected:** 无 toast、无 loader、无错误文案；行仍按 `sandboxes` 分组。
**Why human:** 只能在运行中的 UI 观察。

### 4. WR-01：移除项目 + 清单到达的产品决定

**Test:** 移除一个含 linked worktree 的项目，重新进入 Projects（触发挂载期清单读取）。
**Expected:** 二选一并记录到设计文档 §已知取舍：移除意味着新发现的 checkout 也留在 Ungrouped；或新 checkout 是新行且 Restore 指向仍然存在的行。
**Why human:** 当前实现会让命名行复现且 Restore no-op；需要产品决定（`02-REVIEW-DISPOSITION.md` 保持 `open`）。

### 5. WR-02：断连首读失败后的恢复语义

**Test:** 断连状态下首次进入 Projects，然后恢复连接。
**Expected:** 接受「本次挂载不再重试」并删掉注释里的 reconnect 承诺，或按 `02-REVIEW.md` 在 effect 内跟踪连接状态并在断连时释放 claim。
**Why human:** 承诺的恢复路径当前不存在（`sync.tsx:104-118` 只用 `refetchType: "none"` 失效查询）；属设计取舍。

## Gaps Summary

**没有 BLOCKER 级 gap。** 5 条成功标准里 4 条有代码 + 测试/文档证据并经独立复跑确认；第 1 条（请求恰好一次 + 缓存复用）在代码层面结构完整、但没有测试或运行时观察能证明「恰好一次」，按 present-but-behavior-unverified 处理，不记为失败也不记入通过分。

三点需要在推进 Phase 3 前知晓：

1. **成功标准 2 的数据前置条件**：分组函数在「元数据列出两份拷贝」时必然两行，但全新项目的 `sandboxes` 是 `[]`（`packages/core/src/project/sql.ts:56`），第二份克隆是否会出现在 `sandboxes`/清单里取决于服务器数据，本阶段既未产生也未验证。02-02 `<objective>` 已如实记录，建议提升为显式前置条件或写进设计文档。
2. **WR-02 让「清单未到达」的中间态可能持续整轮挂载**：这不是请求次数问题，而是失败路径的恢复路径缺失；对未迁移的新项目，该中间态正是 Phase 2 想缩短的症状。
3. **WR-01 与本阶段的挂载期读取叠加**：已移除项目的命名行可复现、Restore no-op。根因是「按 checkout key 记忆移除」，Phase 3 的 v2 迁移只覆盖失效 key 丢弃那一半，另一半需要产品决定。

无 `deferred` 项：Phase 3 的成功标准 2 覆盖的只是 WR-01 的失效 key 一半，其余两项不属「已排期到后续 phase」，故不列入 deferred。

---

_Verified: 2026-11-13T09:47:26Z_
_Verifier: the agent (gsd-verifier)_
