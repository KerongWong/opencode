---
phase: 01-row-source-convergence
verified: 2026-11-13T03:27:11Z
status: passed
score: 13/15 must-haves verified
covered_files:
  - .planning/phases/01-row-source-convergence/01-01-PLAN.md
  - .planning/phases/01-row-source-convergence/01-01-SUMMARY.md
  - .planning/phases/01-row-source-convergence/01-02-PLAN.md
  - .planning/phases/01-row-source-convergence/01-02-SUMMARY.md
  - .planning/phases/01-row-source-convergence/01-03-PLAN.md
  - .planning/phases/01-row-source-convergence/01-03-SUMMARY.md
  - .planning/phases/01-row-source-convergence/01-04-PLAN.md
  - .planning/phases/01-row-source-convergence/01-04-SUMMARY.md
  - packages/app/perf/session-index.bench.ts
  - packages/app/perf/session-index.ts
  - packages/app/src/home/sessions/index.ts
  - packages/app/src/runtime/server/session-index.test.ts
  - packages/app/src/runtime/server/session-index.ts
  - packages/app/src/shell/commands/palette.ts
  - packages/app/src/shell/titlebar/inbox-model.ts
  - packages/app/src/shell/titlebar/inbox.tsx
  - packages/app/src/shell/titlebar/projects.tsx
covered_digest: "v4:sha256:079b862667ee5de1fb003866c4fa4a49100c2558ac587cf7582057c98c6f3d7d"
behavior_unverified: 2
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 11/14
  gaps_closed:
    - "A session created after the index fetch still gets a project row without waiting for a refetch. — `RootSessionIndexOptions.fetchedAt` 现在参与空页面下限：`survivors === undefined ? undefined : Number.isFinite(survivors) ? survivors : options.fetchedAt`（session-index.ts:32-48）；`entries()` 传 `fetchedAt: queries[index]?.dataUpdatedAt`（inbox-model.ts:209）。`session-index.test.ts:147`（空页面 + 无 fetchedAt 保留 `new`）与 `:157`（空页面 + `fetchedAt: 400` 保留 500、丢弃 100）通过。"
    - "The delivered tree passes the repository's changed-file lint gate (`bun script/lint-changed.ts`, the CI job `Lint changed files`). — 本轮独立复跑 `bun script/lint-changed.ts db7df8d999` → `lint:changed: 0 problem(s) in 0 of 3 changed files since db7df8d999`，exit 0。"
  gaps_remaining: []
  regressions: []
behavior_unverified_items:
  - truth: "Inbox's archived section still lists the session after archiving: the Inbox inbox keeps archived rows in its entries."
    test: "在 Inbox 归档一个会话，然后不离开视图直接打开 Archived 搜索（此时 archived 页尚未缓存/重新拉取）。"
    expected: "该会话仍出现在 Inbox 的归档分区，`sections().archived` 为 true。"
    why_human: "`createSessionInbox` 需要 Solid runtime 与服务器 context，`packages/app` 内没有它的 controller/集成测试；merge 层只用 Inbox 的精确选项证明了数据层行为（session-index.test.ts:40、:119），调用点映射只能读码确认。e2e mock 的 archived 契约与真实服务端相反（e2e/utils/mock-server.ts:1203），因此也构造不出该状态。"
  - truth: "A session archived in this process stays in the Inbox view even when the archived page is not cached and its `time.updated` is below the floor."
    test: "归档一个 `time.updated` 低于窗口下限的会话，且 archived 页从未加载，检查归档搜索是否列出它。"
    expected: "会话保留在 Inbox 条目中（Inbox 视图不传 `boundedKnown`，`fetchedAt` 也不生效）。"
    why_human: "merge 层用 Inbox 的精确选项（`includeArchived: true, boundedKnown: false`）固定了数据层行为（session-index.test.ts:119、:222），但“归档 -> cache miss -> `sections().archived` 仍为 true”的运行态没有测试驱动调用点；需人工在运行中的应用里确认。"
human_verification:
  - test: "在 Inbox 归档一个会话，随即（不离开视图、让 archived 页保持未加载）打开 Archived 搜索。"
    expected: "该会话出现在归档分区，归档入口可见。"
    why_human: "`createSessionInbox` 需要 Solid runtime/服务器 context；e2e mock 的 archived 契约与真实服务端相反（e2e/utils/mock-server.ts:1203）。"
  - test: "在 Inbox 归档一个项目唯一的会话，切到 Projects。"
    expected: "该会话不在任何项目行；只剩它的项目行消失。"
    why_human: "merge 与分组各自有单测，但“归档 -> 视图”的完整链路未被测。"
  - test: "记录 Projects 行；打开一个 Projects 未显示的旧会话，返回 Projects；随后重启应用再看 Projects。"
    expected: "前后行集一致。"
    why_human: "需要真实桌面应用与 sidecar；验证过程不得重启应用。"
  - test: "空页面状态（全新安装，或把最新 root 全部归档）下打开 Projects：先新建一个会话，确认项目行无需 remount/rename/archive 就出现；再在同一状态、创建任何会话之前，打开一个 Projects 未列出的旧会话，返回确认没有新增项目行。"
    expected: "新建会话出现行（`fetchedAt` 已由 `entries()` 传入）；打开旧会话不新增行（窗口未被放宽）。若任一方向相反，说明调用点未传/错传 `fetchedAt`。"
    why_human: "merge 级用例自带 `fetchedAt`，观察不到调用点；01-04 计划要求的两条手工检查均未执行（01-04-SUMMARY.md:221-226），运行态只能人工确认。"
---

# Phase 1: 行源收敛 验证报告

**Phase Goal:** Projects 侧栏只从服务器索引的单一有界窗口推导项目行；已归档会话、以及本进程内临时加载但不在窗口内的旧会话，都不再生成或新增项目行。
**Verified:** 2026-11-13T03:27:11Z
**Status:** human_needed
**Re-verification:** Yes — after gap closure (plan 01-04)

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Archiving a session removes its row from every Projects group, and a group left with no sessions disappears. | ✓ VERIFIED | Projects 传 `includeArchived: false`（inbox-model.ts:207），末过滤丢弃 `time.archived` 行（session-index.ts:55-57）；`session-index.test.ts:29`、`:47` 通过。`projects.tsx:72-99` 的 `groups()` 只遍历 `inbox.entries()`，没有额外补行，空组自然消失。端到端 UI 仍见人工项 2。 |
| 2 | Inbox's archived section still lists the session after archiving: the Inbox inbox keeps archived rows in its entries. | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | merge 层用 Inbox 精确选项（`includeArchived: true, boundedKnown: false`）在 `session-index.test.ts:40`、`:119` 通过；controller 映射 `inbox.tsx:53`、`inbox-model.ts:207` 只可读码确认，无 controller/e2e 覆盖。见 `behavior_unverified_items`。 |
| 3 | A live archive event drops the row even when the cached index still lists that session as active. | ✓ VERIFIED | `session-index.test.ts:47` 通过：known 副本覆盖缓存索引行后，末过滤按 known 的 `time.archived` 丢弃。客户端在 `session.archived` 事件写入 `time.archived`（packages/client/src/solid/data.ts）。 |
| 4 | Home and the command palette keep the exact row sets they had before the change. | ✓ VERIFIED | 两处仍是两参数调用走默认值：`home/sessions/index.ts:42`、`shell/commands/palette.ts:298`；`home/sessions/index.test.ts` 10 pass（含在 29 pass 的定向运行内）。 |
| 5 | Opening a session older than the server index window and returning to Projects leaves the project rows unchanged, including when the newest root sessions on the server are all archived. | ✓ VERIFIED | `session-index.test.ts:68`（窗口外 known 不新增项目 key）与 `:169`（50 条全归档页经真实 `parseHomeSessionIndex` 解析为 `[]`，带 `fetchedAt: 1_001_000` 仍返回 `[]`）通过。 |
| 6 | After a restart, Projects shows the same project rows it showed before, including when the newest root sessions on the server are all archived. | ✓ VERIFIED | `:75` 与 `:183` 用 distinct 项目 key 列表比较 `known: [c]` 与 `known: []`，两者相等（全归档状态两侧均为空）。 |
| 7 | A session created after the index fetch still gets a project row without waiting for a refetch. | ✓ VERIFIED | 非空页面：`:90`、`:192`（400 > 存活下限 200 的 known root 加入）；空页面 + 无 fetch 时间：`:147` 返回 `["new"]`；空页面 + 生产形态 `fetchedAt: 400`：`:157` 保留 `after`（500）并丢弃 `c`（100）。调用点 `inbox-model.ts:209` 确实传 `fetchedAt: queries[index]?.dataUpdatedAt`，`useQueries` 结果代理转发该字段（`@tanstack/solid-query/src/useQueries.ts:330`）。残余风险（`dataUpdatedAt` 非严格“抓取时间”，见 Advisory WR-01）不影响本契约的主路径。 |
| 8 | With no page fetched (first paint or offline), Projects still lists the locally known root sessions. | ✓ VERIFIED | `:111` `mergeRootSessionIndex(undefined, [c, child, g], …)` 返回 `["c"]`；`:234` 证明即使带一个陈旧 `fetchedAt`，无页面分支仍返回 `["c"]`；`inbox-model.ts:200-204` 仅在两个页面都没有数据时传 `undefined`。 |
| 9 | Sessions inside the index are never dropped by the window. | ✓ VERIFIED | `session-index.ts:49`：下限只作用于 `!rows.has(info.id)` 的 known 行；已索引行只经 `parentID` 与归档末过滤。 |
| 10 | The bounded window drives the Projects view only: the Inbox view keeps every known row it already had. | ✓ VERIFIED | `inbox-model.ts:208` 传 `boundedKnown: options.archived !== true`；`session-index.ts:44` 先判 `survivors === undefined`，`boundedKnown: false` 时 `fetchedAt` 完全不参与；`:119`（两个视图的精确选项）与 `:222`（Inbox 无页面仍保留归档行）通过。 |
| 11 | A session archived in this process stays in the Inbox view even when the archived page is not cached and its `time.updated` is below the floor. | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | 数据层已固定（`boundedKnown: false` 时 `g` 被保留，`:119`）；但“归档 -> archived 页未缓存 -> `sections().archived` 仍为 true”的运行态只能读码（inbox-model.ts:426 仅在缓存存在时 prepend；inbox.tsx:138 依赖 `list.some(inboxArchived)`）。 |
| 12 | The page the Projects row source requests holds active roots only, so archived rows cannot spend the 50 index slots and hide an active session that is inside the active window. | ✓ VERIFIED | `inbox-model.ts:132` 传 `archived: false`；服务端只在参数存在时过滤归档（packages/core/src/session/store.ts:160-161），因此 page 为最新活跃 root。 |
| 13 | A fetched page that leaves no active root makes Projects show no row instead of merging every locally known root. | ✓ VERIFIED | `:169`：真实解析出的 `[]` 页面 + known `[c, d]` + `fetchedAt: 1_001_000` 返回 `[]`，且项目 key 不含 `srv\u0000/other`；`session-index.ts:44-48` 的下限与映射。 |
| 14 | The window floor is derived from the rows the merge can keep: an archived or child row in the fetched page does not lower it. | ✓ VERIFIED | `session-index.ts:32-41` 的 reduce 跳过 `parentID` 行与（`includeArchived === false` 时）归档行并 seed `+∞`；`:201-219` 混合页面用例返回恰好 `a`、`b`。 |
| 15 | The delivered tree passes the repository's changed-file lint gate (`bun script/lint-changed.ts`, the CI job `Lint changed files`). | ✓ VERIFIED | 本轮独立运行 `bun script/lint-changed.ts db7df8d999` → `0 problem(s) in 0 of 3 changed files`，exit 0；`git status` 中三个源文件无未提交修改。 |

**Score:** 13/15 truths verified（2 个 present、行为未验证）

### Deferred Items

无。Phase 2（checkout 身份）与 Phase 3（持久化 key / 接缝文档）的 goal 与成功标准都不覆盖本 phase 的行源契约。

### Advisory (Code Review Findings — Non-Blocking)

`01-REVIEW.md`（2026-11-13T11:20:19Z）对 01-04 的三个文件记录 5 warnings / 4 info / 0 critical。逐条判断：**没有一条构成 must-have 失败**，均为完整度、文档准确性或测试维护性问题；CR-01/CR-02 已在代码中关闭。`01-REVIEW-DISPOSITION.md` 将 10 条记为 open、2 条 critical 记为 fixed。

| # | Finding | Category | 为何不阻断 |
|---|---------|----------|-----------|
| 1 | WR-01：`dataUpdatedAt` 会被本文件 `forget()`/`move()` 的 `setQueryData` 推进，floor 实际是“最后一次页面写入时间”而非严格抓取时间（inbox-model.ts:91、:426） | 正确性/文档 | 影响面限于“空页面 + 之后又发生本地写”；该场景下 01-03 旧代码同样丢弃这些行，不是相对基线的回归。truth 7 的主路径（fetch -> create）仍成立。 |
| 2 | WR-02：`time.updated`（服务端时钟）与 `dataUpdatedAt`（客户端墙钟）跨时钟比较，注释未声明 | 正确性/文档 | 01-04-PLAN T-01-11 已明确接受；本 phase 目标是本地 sidecar，两钟一致。 |
| 3 | WR-03：Inbox 现也传 `fetchedAt`，但两个 Inbox 用例未带该字段 | 测试完整度 | 仅是“未来重构可能静默收紧 Inbox”的守卫缺口；当前 `survivors === undefined` 守卫正确，行为通过 `:119`/`:222` 断言。 |
| 4 | WR-04：`entries()` 的接线行没有自动化回归，两条手工检查未执行 | 测试完整度 | 代码存在且类型检查通过；已在 `human_verification` 第 4 项列为人工确认。 |
| 5 | WR-05：`session-index.test.ts:192-197` 与 `:90-95` 完全重复 | 测试维护性 | 无行为影响；违反 “one contract, one owner”，不改变覆盖。 |
| 6 | IN-01：空页面 + 无 fetch 时间的回退在本栈不可达，用例名与注释过度声明 | 文档/必要性 | 该回退由 01-04 计划要求并固定为契约；`02-` 结论不受影响。 |
| 7 | IN-02：`includeArchived` 注释仍与唯一调用方相反（session-index.ts:4） | 文档 | 调用方实际传 `false`（inbox-model.ts:207），行为正确；误读风险。 |
| 8 | IN-03：请求失败仍回退到“无页面 = 全部 known” | 正确性（既有） | 与 01-02 已声明的 offline 回退同类，非本 plan 引入。 |
| 9 | IN-04：全归档 fixture 的注释描述 `archived: false` 已不可能返回的页面 | 文档/测试前提 | `:157` 的空 `[]` 页用例覆盖了同一可达状态；用例本身仍通过。 |

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `packages/app/src/runtime/server/session-index.ts` | `RootSessionIndexOptions.fetchedAt?: number`；空页面以抓取时间为下限 | ✓ VERIFIED | 58 行（计划下限 48）；`gsd query verify.artifacts` 3/3 passed；diff 618fbc20..HEAD 仅本文件 +15/−4，known 循环 / `passive` 分支 / 末过滤未改。 |
| `packages/app/src/runtime/server/session-index.test.ts` | 空页面 post-fetch join、fetch-time 下限、两个优先级分支、保留的空页面丢弃 | ✓ VERIFIED | 254 行（下限 210），19 个用例全通过、无 skip；新增 `:147`、`:157`、`:234`、`:245`，更新 `:169`、`:183`。 |
| `packages/app/src/shell/titlebar/inbox-model.ts` | `entries()` 传 `fetchedAt: queries[index]?.dataUpdatedAt` | ✓ VERIFIED | 531 行（下限 520）；`:209` 已接线；query、`INDEX_LIMIT`、query key、`selectSessions`、各 handler 未改（diff 仅 +10/−3 的注释与选项行）。 |
| `packages/app/perf/session-index.ts` / `session-index.bench.ts` | strobe script-case harness | ✓ VERIFIED | 01-04 未改动；本轮 `bunx strobe bench … --check` → `pass merge the session index · app`，`exp_caa8ca`。 |

### Key Link Verification

`gsd query verify.key-links 01-04-PLAN.md` 对两条 link 均返回 `verified: false`（"Target not referenced in source"），与上一轮相同，是路径别名（`@/runtime/server/session-index`）文本匹配所致，不是接线缺失。逐条人工核对：

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| `shell/titlebar/inbox-model.ts` | `runtime/server/session-index.ts` | `entries()` 在 merge options 传 `fetchedAt: queries[index]?.dataUpdatedAt` | ✓ WIRED | 导入在 :15；调用在 :203-211；`fetchedAt` 与 `boundedKnown` 同一 options 字面量（:209），因此只有 Projects 视图供给。 |
| `runtime/server/session-index.test.ts` | `runtime/server/session-index.ts` | 空页面 post-fetch join 与 fetch-time 丢弃用例 | ✓ WIRED | `:147-153` 断言 `["new"]`；`:157-167` 断言 `["after"]`；19 pass / 0 fail。 |
| `shell/titlebar/inbox-model.ts` | `packages/sdk` session list | `inbox-sessions` 请求上的 `archived: false` | ✓ WIRED | `:132` `item.ctx.sdk.api.session.list({ limit: INDEX_LIMIT, order: "desc", parentID: null, archived: false }, { signal })`；服务端 store.ts:160-161 仅在参数存在时过滤。 |
| `runtime/server/session-index.ts` | `shell/titlebar/projects.tsx` | 有界行经 `groups()` 成为项目行 | ✓ WIRED | projects.tsx:57 `createSessionInbox()`（无 `archived`）→ :76 `inbox.entries().forEach(...)` 建组；无第二处行源或额外过滤。 |
| `shell/titlebar/inbox-model.ts` | `shell/titlebar/inbox.tsx` | Inbox 视图保留归档条目 | ✓ WIRED | inbox.tsx:53 `createSessionInbox({ archived: true })`；:110 过滤活跃行，:138 `archived: list.some(inboxArchived)`；merge 侧由 :119/:222 固定。 |
| `runtime/server/session-index.ts` | `home/sessions/index.ts`、`shell/commands/palette.ts` | 两参数调用走默认值 | ✓ WIRED | home/sessions/index.ts:42、palette.ts:298 仍为两参数；home 测试 10 pass。 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| `SidebarProjects` 行 | `inbox.entries()` | `useQueries` → `sdk.api.session.list({ limit: 50, order: "desc", parentID: null, archived: false })` → `parseHomeSessionIndex` + `data.session.known()` + `queries[index].dataUpdatedAt` → `mergeRootSessionIndex(page \| undefined, known, options)` | 是（真实 SDK 查询 + live store） | ✓ FLOWING |
| 进程内新建会话 → Projects 行（已获取页面无存活 root 时） | `data.session.known()` + `query.dataUpdatedAt` | 客户端在 `session.created` 时同步 info（packages/client/src/solid/data.ts:747-757）→ known；merge 以 fetch 时间为空页面下限，`time.updated >= fetchedAt` 的新会话加入 | 是（`:157` 用例；调用点已接线） | ✓ FLOWING（残余：本地 `setQueryData` 会推进 `dataUpdatedAt`，见 Advisory WR-01） |
| `SidebarInbox` 归档分区 | `sections().archived` | 同一 active 页（`archived: false`）+ `inbox-archived-sessions` 页（`archived: true`）+ known（无 bound） | 是 | ✓ FLOWING（无 controller 测试，见人工项 1） |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| merge 的归档/有界/页面状态/fetch-time 契约 + Home 行集 | `cd packages/app && bun test --conditions=solid --isolate --preload ../ui/test/solid-jsx.ts --preload ./happydom.ts src/runtime/server/session-index.test.ts src/home/sessions/index.test.ts` | 29 pass / 0 fail（19 + 10） | ✓ PASS |
| changed-file lint gate（CI 同款） | `bun script/lint-changed.ts db7df8d999` | `0 problem(s) in 0 of 3 changed files`，exit 0 | ✓ PASS |
| strobe 用例仍可运行 | `bunx strobe bench packages/app/perf/session-index.bench.ts --check` | `pass merge the session index · app`，`exp_caa8ca`，cpu.work 25.6 ms | ✓ PASS |
| 应用单元套件无回归 | `cd packages/app && bun run test:unit` | 本轮未重跑：orchestrator 记录 2716 pass / 0 fail（275 文件）；本报告独立复核了受影响的两个测试文件 | ? SKIP（接受 orchestrator 记录） |
| 编译门（`tsc`，symlink 变通） | `bun run typecheck:tsc`（需临时替换 33 字节指针） | 本轮未重跑：不得修改源文件；`packages/app/src/custom-elements.d.ts` 仍是 33 字节指针，01-04 SUMMARY 记录 exit 0 | ? SKIP（记录原因） |
| 禁用测试扫描 | 人工检查两个测试文件 | 无 `.skip` / `.todo` / 条件跳过 | ✓ PASS |
| 债务标记扫描 | `TBD|FIXME|XXX` 于三个改动文件 | 0 处 | ✓ PASS |

### Probe Execution

不适用。仓库没有 `scripts/*/tests/probe-*.sh`，PLAN / SUMMARY 也未声明任何 probe；本 phase 的可执行验证由上面的 `bun test`、`lint:changed`、`strobe --check` 承担。

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ---------- | ----------- | ------ | -------- |
| SRC-01 | 01-01, 01-04 | 已归档会话不再出现在 Projects 侧栏 | ✓ SATISFIED | merge 末过滤（session-index.ts:55-57）+ Projects 传 `includeArchived: false`（inbox-model.ts:207）；`session-index.test.ts:29`、`:47` 通过；projects.tsx 无第二条行源。REQUIREMENTS.md 的 SRC-01 复选框/追踪行仍为 Pending（文档滞后，与本轮代码结论不一致）。 |
| SRC-02 | 01-02, 01-03, 01-04 | 行源单一、有界；本进程新加载的会话不会凭空新增项目行；重启前后显示同一组项目 | ✓ SATISFIED | 单一页面 `archived: false` + 存活行下限 + 空页面 fetch-time 下限；`:68`（窗口外旧会话不新增 key）、`:75`/`:183`（重启一致性）、`:147`/`:157`（fetch 后新建会话加入、旧 known 仍被排除）通过。 |
| SRC-03 | 01-01…01-04 | `mergeRootSessionIndex` 合并契约有单元测试，至少覆盖「已归档的 known 会话」「只有 known 没有索引」 | ✓ SATISFIED | `session-index.test.ts:29`（archived known）、`:111`/`:234`（无页面 -> known-only）均有 value-level 断言；同文件 19 个用例无跳过。 |

无 ORPHANED requirement：REQUIREMENTS.md 中映射到 Phase 1 的三个 ID 都出现在对应 PLAN frontmatter（SRC-01 在 01-01、01-04；SRC-02 在 01-02、01-03、01-04；SRC-03 在四个计划）。

### Test Quality Audit

| Test File | Linked Req | Active | Skipped | Circular | Assertion Level | Verdict |
| --------- | ---------- | ------ | ------- | -------- | --------------- | ------- |
| `packages/app/src/runtime/server/session-index.test.ts` | SRC-01/02/03 | 19 | 0 | 无 | Value（精确 id 列表、distinct group key、`toEqual`/`toMatchObject`） | 通过；`:192-197` 与 `:90-95` 重复同一契约（Advisory WR-05），属维护性问题。 |
| `packages/app/src/home/sessions/index.test.ts` | 回归（Home/palette 行集） | 10 | 0 | 无 | Value | 通过，证明默认值未改变 Home 与 palette 的行集。 |

覆盖局限：`entries()` 的 `fetchedAt` 接线没有自动化测试（调用点是 Solid runtime），本轮以读码 + 类型检查 + 两条待运行的人工检查补足；`createSessionInbox` 的视图选项映射也没有 controller 级测试。

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| `packages/app/src/shell/titlebar/inbox-model.ts` | 91、426 | `setQueryData` 推进 `dataUpdatedAt`，使空页面下限变成“最后一次页面写入时间”（REVIEW WR-01） | ⚠️ WARNING | 空页面 + 本地删除/归档后，fetch 后新建但早于该写入的 known root 可能被丢弃，直到页面重取；不是相对基线的回归，不影响 truth 7 主路径。 |
| `packages/app/src/runtime/server/session-index.ts` | 8-12、43-44 | 客户端墙钟与服务端 `time.updated` 跨时钟比较，注释未声明（REVIEW WR-02） | ⚠️ WARNING | 计划 T-01-11 已接受；远程时钟偏移时行集差异可由 remount/reconnect 重新推导。 |
| `packages/app/src/runtime/server/session-index.test.ts` | 192-197 | 与 `:90-95` 完全重复的用例（REVIEW WR-05） | ℹ️ INFO | 违反 “one contract, one owner”，无行为影响。 |
| `packages/app/src/runtime/server/session-index.ts` | 4 | `includeArchived` 注释仍说 “the Projects rows leave it unset”，实际传 `false`（REVIEW IN-02） | ℹ️ INFO | 后续调用方照注释省略选项会重新引入归档行。 |
| `packages/app/e2e/utils/mock-server.ts` | 1203 | mock 对省略 `archived` 只返回非归档，与真实 store 相反（REVIEW WR-02 继承） | ℹ️ INFO | 本 phase 的核心修复缺少 e2e 级回归；已由人工项覆盖。 |
| `packages/app/src/shell/titlebar/inbox-model.ts` | 200-211 | 请求失败与“没有页面”无法区分（REVIEW IN-03） | ℹ️ INFO | `retry: false` 下一次错误会让 known-only 回退持续到 remount/reconnect；与计划声明的 offline 回退同类。 |
| `packages/app/src/runtime/server/session-index.test.ts` | 136-143 | 全归档 fixture 的注释仍描述修复前“归档行占满 50 槽位”的请求状态（REVIEW IN-04） | ℹ️ INFO | 用例仍有效（`:157` 的空页用例覆盖同一可达状态），注释误导。 |

债务标记扫描：三个 phase 改动文件内 `TBD`/`FIXME`/`XXX` = 0，无 🛑 债务标记。无 `placeholder` / `not implemented` / 空实现模式。

### Human Verification Required

1. **Inbox 归档分区仍列出刚归档的会话（cache miss）**
   **Test:** 在 Inbox 归档一个会话，随即（不离开视图、让 archived 页保持未加载）打开 Archived 搜索。
   **Expected:** 该会话出现在归档分区，归档入口可见。
   **Why human:** `createSessionInbox` 需要 Solid runtime/服务器 context；e2e mock 的 archived 契约与真实服务端相反（e2e/utils/mock-server.ts:1203）。

2. **归档后 Projects 行消失且空组消失**
   **Test:** 在 Inbox 归档一个项目唯一的会话，切到 Projects。
   **Expected:** 该会话不在任何项目行；只剩它的项目行消失。
   **Why human:** merge 与分组各自有单测，但“归档 -> 视图”的完整链路未被测。

3. **窗口外旧会话不改变 Projects 行集，且重启后一致**
   **Test:** 记录 Projects 行；打开一个 Projects 未显示的旧会话，返回 Projects；随后重启应用（用户操作）再看 Projects。
   **Expected:** 前后行集一致。
   **Why human:** 需要真实桌面应用与 sidecar；本次验证不得重启应用。

4. **空页面状态下新建会话可见、旧会话不新增行（01-04 计划的两条手工检查）**
   **Test:** 在服务器没有活跃 root 的状态（全新安装，或把最新 root 全部归档）打开 Projects，新建一个会话（不刷新、不重连、不改名），确认行出现；再在同一状态、创建任何会话之前打开一个 Projects 未列出的旧会话，返回确认没有新增行。
   **Expected:** 新建会话的项目行无需 remount/rename/archive 就出现；打开旧会话不新增行。若任一方向相反，说明 `entries()` 未正确传 `fetchedAt`。
   **Why human:** merge 级用例自带 `fetchedAt`，无法观察调用点（REVIEW WR-04）；01-04 执行者因 `packages/app/AGENTS.md` 禁止重启应用而未运行。

### Gaps Summary

上一轮记录的两条 gap 都已真实关闭，且在本轮独立复跑中确认：

1. **truth 7 / REVIEW CR-01（已关闭）。** `mergeRootSessionIndex` 保留 `+∞` 作为“页面无存活 root”的内部哨兵，但公开下限改为 `survivors === undefined ? undefined : Number.isFinite(survivors) ? survivors : options.fetchedAt`（session-index.ts:32-48）。`entries()` 在同一个 options 字面量上传 `fetchedAt: queries[index]?.dataUpdatedAt`（inbox-model.ts:209）。空页面且无 fetch 时间时 known root 全部加入（`:147` 返回 `["new"]`）；生产形态带 `fetchedAt: 400` 时只保留 500 的 `after`、丢弃 100 的 `c`（`:157`）；全归档空页在 `fetchedAt: 1_001_000` 下仍返回 `[]`（`:169`），truth 13 未回退。

2. **changed-file lint gate / REVIEW CR-02（已关闭）。** `bun script/lint-changed.ts db7df8d999` → `0 problem(s) in 0 of 3 changed files`，exit 0。

行为与交付证据：定向测试 29 pass / 0 fail（session-index 19 + home 10）；strobe `--check` → `pass merge the session index · app`（`exp_caa8ca`）；`git status` 中三个源文件无未提交修改；`618fbc206c..HEAD` 仅改动计划声明的三个源文件（+74/−6）；五个目标 artifact 全部存在且接线完整；无债务标记。

剩余项全部是人工验证（2 条行为未验证 truth + 4 条运行态检查），以及 01-REVIEW 的 9 条非阻断性 warning/info。没有 must-have 失败，也没有必须阻断下一 phase 的缺口。

---

_Verified: 2026-11-13T03:27:11Z_
_Verifier: gsd-verifier (adversarial)_
