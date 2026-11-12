---
phase: 01-row-source-convergence
verified: 2026-11-12T09:28:15Z
status: gaps_found
score: 11/14 must-haves verified
covered_files:
  - .planning/phases/01-row-source-convergence/01-01-PLAN.md
  - .planning/phases/01-row-source-convergence/01-01-SUMMARY.md
  - .planning/phases/01-row-source-convergence/01-02-PLAN.md
  - .planning/phases/01-row-source-convergence/01-02-SUMMARY.md
  - .planning/phases/01-row-source-convergence/01-03-PLAN.md
  - .planning/phases/01-row-source-convergence/01-03-SUMMARY.md
  - packages/app/perf/session-index.bench.ts
  - packages/app/perf/session-index.ts
  - packages/app/src/runtime/server/session-index.test.ts
  - packages/app/src/runtime/server/session-index.ts
  - packages/app/src/shell/titlebar/inbox-model.ts
covered_digest: "v4:sha256:0114dae38effc6ab2e74b7fe8af28a62c08faa2ea0c80f0fae80633332af2ed5"
behavior_unverified: 2
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 7/11
  gaps_closed:
    - "Opening a session older than the server index window and returning to Projects leaves the project rows unchanged. — 页面现在请求 `archived: false`（inbox-model.ts:132），merge 只在“没有页面”时回退（session-index.ts:13-14, 25-38）；50 条全归档页经 `parseHomeSessionIndex` 解析为 `[]` 后 merge 返回 `[]`，`srv\\u0000/other` 键不再出现（session-index.test.ts:144）。"
    - "After a restart, Projects shows the same project rows it showed before. — 同一全归档页面状态下 `known: [c]` 与 `known: []` 的 distinct 项目 key 列表相等且都为空（session-index.test.ts:154）。"
    - "The window must not be widened to every session the client happens to know. — 已获取但无存活 root 的页面给出 `Number.POSITIVE_INFINITY` 下限，known 循环的 `info.time.updated < floor` 对全部已知 root 成立，回退不再触发（session-index.ts:25-38；session-index.test.ts:144）。"
  gaps_remaining: []
  regressions:
    - "A session created after the index fetch still gets a project row without waiting for a refetch. — 上一轮为 VERIFIED（空页面会回退到 known-only 列表）。01-03 的 page-or-undefined 规则删除了该回退，因此在“已获取但解析后为空”的页面状态（全新安装、服务器无活跃 root、或最新 root 全归档）下，本进程新建的会话不再出现在 Projects（REVIEW CR-01，见 gaps[0]）。"
gaps:
  - truth: "A session created after the index fetch still gets a project row without waiting for a refetch."
    status: failed
    reason: >-
      非空页面成立，空页面不成立。当已获取的页面经 `parseHomeSessionIndex` 解析后没有
      任何存活的 root（全新安装、服务器没有活跃 root、或 50 条最新 root 全归档）时，
      `floor` 为 `Number.POSITIVE_INFINITY`（session-index.ts:25-34），known 循环里的
      `info.time.updated < floor`（session-index.ts:38）对每一个有限时间戳都成立，于是
      本进程刚创建的会话被丢弃；`inbox-model.ts:198-205` 只有在两个页面都无数据时才传
      `undefined`（已获取的空数组是“有页面”）。之后不会自动恢复：`staleTime: 30_000`
      （inbox-model.ts:135）本身不触发请求，`refetchOnWindowFocus` 全局为 false
      （app.tsx:32），且没有任何 `session.created` 处理器失效
      `["inbox-sessions", conn]`（全部失效点只有 rename-session.ts:24、
      recent-sessions.tsx:680 的归档路径，以及 inbox-model.ts:91/421 的本地写）。客户端
      store 在 `session.created` 时确实把该会话写进 `known()`（packages/client/src/solid/data.ts:747-757），
      所以这是“被 merge 丢弃”，不是“数据没到”。用户可见结果：会话已在主面板打开，
      Projects 却显示空态。01-03 把它记作 “until the page refetches（30s stale time、
      refetchOnMount、window focus）” 的有意取舍（01-03-PLAN.md 第 76 行），但这个恢复前提
      经代码核对不成立；`session-index.test.ts:144` 反而把丢弃固定为 `expect(rows).toEqual([])`。
    artifacts:
      - path: "packages/app/src/runtime/server/session-index.ts"
        issue: "第 25-34 行用 `Number.POSITIVE_INFINITY` 表示“页面没有存活 root”；第 38 行因此丢弃所有时间戳有限的 known root，包括 fetch 之后新建的会话。"
      - path: "packages/app/src/shell/titlebar/inbox-model.ts"
        issue: "第 126-140 行的 `inbox-sessions` 查询没有在 `session.created` 时失效；第 198-205 行把已获取的空页面当作有页面处理，不提供任何恢复路径。"
      - path: "packages/app/src/runtime/server/session-index.test.ts"
        issue: "第 144-152 行断言空页面的 merge 返回 `[]`，把 CR-01 的丢弃行为固定为契约；缺少“空页面 + fetch 后新建会话仍成行”的用例。"
    missing:
      - "在 `session.created`（`parentID` 为空）时失效 `[\"inbox-sessions\", conn]`，让新会话成为最新活跃 root 并重新推高窗口；或在 merge 里用页面抓取时间而不是 `Infinity` 作为空页面的下限，使 `time.updated >= fetchedAt` 的已知 root 仍能加入。"
      - "补一条回归：`mergeRootSessionIndex([], [session(\"new\", { time: { created: 2, updated: 2 } })], { includeArchived: false, boundedKnown: true })` 必须保留 `new`（当前返回 `[]`）。"
      - "若决定保留“空页面 = 无行”，必须更正 01-03-PLAN/SUMMARY 中对 refetch 的陈述，并把“新建会话在有页面但无存活 root 时不出现”记为明确的产品取舍。"
  - truth: "The delivered tree passes the repository's changed-file lint gate (`bun script/lint-changed.ts`, the CI job `Lint changed files`)."
    status: failed
    reason: >-
      在 `db7df8d999` 之上复现：`bun script/lint-changed.ts db7df8d999` 输出 2 条
      `anti-slop(require-readable-spacing)` 警告并退出 1
      （`session-index.ts:35:3`、`session-index.test.ts:99:5`），而 `script/lint-changed.ts`
      对任何 oxlint 诊断（含 warn 级）判失败，`.github/workflows/check.yml` 每个 PR 都运行它。
      计划把 IN-03（lint spacing）列为 out of scope，但 `session-index.ts:35` 正是 01-03 重写的
      `rows` 行、测试文件也由本 phase 编辑，因此这是本 phase 交付树上的可复现 CI gate 失败，
      不是无关的既有噪声（`bunx oxlint` 三文件单跑为 2 warnings / 0 errors，容易漏掉）。
    artifacts:
      - path: "packages/app/src/runtime/server/session-index.ts"
        issue: "第 35 行 `const rows = …` 之前缺少空行。"
      - path: "packages/app/src/runtime/server/session-index.test.ts"
        issue: "第 99 行 `const known = session(\"a\", {` 之前缺少空行。"
    missing:
      - "在两处各补一个空行（REVIEW CR-02 的具体修法），随后 `bun script/lint-changed.ts db7df8d999` 应为 exit 0。"
behavior_unverified_items:
  - truth: "Inbox's archived section still lists the session after archiving: the Inbox inbox keeps archived rows in its entries."
    test: "在 Inbox 归档一个会话，然后不离开视图直接打开 Archived 搜索（此时 archived 页面尚未缓存/重新拉取）。"
    expected: "该会话仍出现在 Inbox 的归档分区，`sections().archived` 为 true。"
    why_human: "`createSessionInbox` 需要 Solid runtime 与服务器 context，`packages/app` 内没有它的 controller/集成测试；merge 层只用 Inbox 的精确选项证明了数据层行为（session-index.test.ts:118），调用点映射只能读码确认。e2e mock 的 archived 契约与真实服务端相反（e2e/utils/mock-server.ts:1203），因此也构造不出该状态。"
  - truth: "A session archived in this process stays in the Inbox view even when the archived page is not cached and its `time.updated` is below the floor."
    test: "归档一个 `time.updated` 低于窗口下限的会话，且 archived 页从未加载，检查归档搜索是否列出它。"
    expected: "会话保留在 Inbox 条目中（Inbox 视图不传 `boundedKnown`）。"
    why_human: "merge 层用 Inbox 的精确选项（`includeArchived: true, boundedKnown: false`）固定了数据层行为（session-index.test.ts:118、:193），但“归档 -> cache miss -> `sections().archived` 仍为 true”的运行态没有测试驱动调用点；需人工在运行中的应用里确认。"
---

# Phase 1: 行源收敛 验证报告

**Phase Goal:** Projects 侧栏只从服务器索引的单一有界窗口推导项目行；已归档会话、以及本进程内临时加载但不在窗口内的旧会话，都不再生成或新增项目行。
**Verified:** 2026-11-12T09:28:15Z
**Status:** gaps_found
**Re-verification:** Yes — after gap closure (plan 01-03)

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Archiving a session removes its row from every Projects group, and a group left with no sessions disappears. | ✓ VERIFIED | Projects 传 `includeArchived: false`（inbox-model.ts:204），末过滤丢弃 `time.archived` 行（session-index.ts:44-46）；`session-index.test.ts:29`、`:47` 通过。`projects.tsx:72-99` 的 `groups()` 只遍历 `inbox.entries()`，没有额外补行，空组因此自然消失。端到端 UI 仍见人工项 1。 |
| 2 | Inbox's archived section still lists the session after archiving: the Inbox inbox keeps archived rows in its entries. | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | merge 层用 Inbox 精确选项（`includeArchived: true, boundedKnown: false`）在 `session-index.test.ts:118` 通过；controller 映射 `inbox.tsx:53`、`inbox-model.ts:204` 只可读码确认，无 controller/e2e 覆盖。见 `behavior_unverified_items`。 |
| 3 | A live archive event drops the row even when the cached index still lists that session as active. | ✓ VERIFIED | `session-index.test.ts:47` 通过：known 副本覆盖缓存索引行后，末过滤按 known 的 `time.archived` 丢弃。客户端在 `session.archived` 事件写入 `time.archived`（packages/client/src/solid/data.ts:829）。 |
| 4 | Home and the command palette keep the exact row sets they had before the change. | ✓ VERIFIED | 两处仍是两参数调用：`home/sessions/index.ts:42`、`shell/commands/palette.ts:298`，`includeArchived`/`boundedKnown` 都走默认（保留归档、不设窗口）；`src/home/sessions/index.test.ts` 10 pass。 |
| 5 | Opening a session older than the server index window and returning to Projects leaves the project rows unchanged, including when the newest root sessions on the server are all archived. | ✓ VERIFIED | `session-index.test.ts:68`（窗口外 known 不新增项目 key）与 `:144`（50 条全归档页经真实 `parseHomeSessionIndex` 解析为 `[]`，merge 返回 `[]`，无 `srv\u0000/other`）通过。 |
| 6 | After a restart, Projects shows the same project rows it showed before, including when the newest root sessions on the server are all archived. | ✓ VERIFIED | `:75` 与 `:154` 用 distinct 项目 key 列表比较 `known: [c]` 与 `known: []`，两者相等（全归档状态两侧均为空）。 |
| 7 | A session created after the index fetch still gets a project row without waiting for a refetch. | ✗ FAILED | 非空页面成立（`:90`、`:163`）；已获取但无存活 root 的页面不成立：floor 为 `+∞`（session-index.ts:25-34），`:38` 丢弃全部 known root，`:144` 把该丢弃固定为契约；没有任何 `session.created` 失效，`refetchOnWindowFocus: false`（app.tsx:32）。见 Gaps。 |
| 8 | With no page fetched (first paint or offline), Projects still lists the locally known root sessions. | ✓ VERIFIED | `:110` `mergeRootSessionIndex(undefined, [c, child, g], …)` 返回 `["c"]`（子会话与归档仍被过滤）；`inbox-model.ts:198-205` 仅在两个页面都没有数据时传 `undefined`。 |
| 9 | Sessions inside the index are never dropped by the window. | ✓ VERIFIED | `session-index.ts:35-46`：下限只作用于 `!rows.has(info.id)` 的 known 行；已索引行只经 `parentID` 与归档末过滤。 |
| 10 | The bounded window drives the Projects view only: the Inbox view keeps every known row it already had. | ✓ VERIFIED | `inbox-model.ts:204` 传 `boundedKnown: options.archived !== true`；`:118`（两个视图的精确选项）与 `:193`（Inbox 无页面仍保留归档行）通过。 |
| 11 | A session archived in this process stays in the Inbox view even when the archived page is not cached and its `time.updated` is below the floor. | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | 数据层已固定（`boundedKnown: false` 时 `g` 被保留，`:118`）；但“归档 -> archived 页未缓存 -> `sections().archived` 仍为 true”的运行态只能读码（inbox-model.ts:421 仅在缓存存在时 prepend；inbox.tsx:138 依赖 `list.some(inboxArchived)`）。 |
| 12 | The page the Projects row source requests holds active roots only, so archived rows cannot spend the 50 index slots and hide an active session that is inside the active window. | ✓ VERIFIED | `inbox-model.ts:132` 传 `archived: false`；服务端只在参数存在时过滤归档（packages/core/src/session/store.ts:160-161），page 因此为最新活跃 root。与全仓其余 root 列表一致（command-palette.tsx:41、recent-sessions.tsx:224、composer/model.ts:209、voice/tools.ts:87）。 |
| 13 | A fetched page that leaves no active root makes Projects show no row instead of merging every locally known root. | ✓ VERIFIED | `:144`：`[]` 页面 + known `[c, d]` 返回 `[]`；`session-index.ts:25-38` 的 `+∞` 下限与 `rows` 映射。 |
| 14 | The window floor is derived from the rows the merge can keep: an archived or child row in the fetched page does not lower it. | ✓ VERIFIED | `session-index.ts:27-33` 的 reduce 跳过 `parentID` 行与（`includeArchived === false` 时）归档行并 seed `+∞`；`:172-190` 混合页面用例返回恰好 `a`、`b`。 |

**Score:** 11/14 truths verified（2 个 present、行为未验证；1 个 FAILED）

### Deferred Items

无。Phase 2（checkout 身份）与 Phase 3（持久化 key / 接缝文档）的成功标准都不覆盖“空页面下新建会话的行可见性”或 lint gate；`roadmap.analyze` 中两个后续 phase 的 goal 均与 `session-index` 的行源无关。

### Advisory (New Scope, Unevidenced)

| # | Finding | Category | Why Advisory |
|---|---------|----------|--------------|
| 1 | 无 | — | 本轮 re-verification 的所有发现都有可复现证据（测试、`tsc`、`lint:changed` 退出码、精确代码行），因此没有 advisory 项。 |

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `packages/app/src/runtime/server/session-index.ts` | `mergeRootSessionIndex(indexed: readonly SessionInfo[] \| undefined, known, options)`；`RootSessionIndexOptions`（includeArchived / boundedKnown）；幸存行下限 | ✓ VERIFIED | 47 行（计划下限 40）；`undefined`=无页面、数组=有页面；被 3 个调用点导入使用（inbox-model、home、palette）。 |
| `packages/app/src/runtime/server/session-index.test.ts` | archived-known、live-archive、Inbox 默认、Projects 行组合、窗口边界/离线/重启一致性、全归档页、幸存行下限、Inbox 无页面行 | ✓ VERIFIED | 203 行（下限 150），15 个用例全部通过；`fetched page` 块自带 fixtures，并真实经过 `parseHomeSessionIndex`。 |
| `packages/app/src/shell/titlebar/inbox-model.ts` | `inbox-sessions` 请求 `archived: false`；`entries()` 传页面或 `undefined`，并按视图传 `includeArchived`/`boundedKnown` | ✓ VERIFIED | 525 行（下限 520）；索引数组、query key、`forget`/`move`/`archive`/`unarchive`、状态/年龄推导均未改动。 |
| `packages/app/perf/session-index.ts` | 50 行索引页 + 5000 known 的 script-case harness | ✓ VERIFIED | 36 行（下限 25）；构建一次 fixtures，导出 `merge(count)`；仅被 bench 通过 `script()` 加载。 |
| `packages/app/perf/session-index.bench.ts` | strobe script case | ✓ VERIFIED | 14 行（下限 10）；本轮重跑 `bunx strobe bench packages/app/perf/session-index.bench.ts --check` → `pass merge the session index · app`，`exp_bcafb5`。 |

### Key Link Verification

`gsd_run query verify.key-links 01-03-PLAN.md` 对该计划的 3 条 link 全部返回 `verified: false`（理由均为 "Target not referenced in source"）。这是该检查对路径别名（`@/runtime/server/session-index`）和外部目标（"packages/sdk session list"）的朴素文本匹配所致，不是接线缺失；逐条人工核对结果如下。

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| `shell/titlebar/inbox-model.ts` | `runtime/server/session-index.ts` | `entries()` 以“页面或 `undefined`”作为第一个 merge 参数 | ✓ WIRED | 导入在 inbox-model.ts:15，调用在 :201-205；第一个参数是 `active === undefined && archived === undefined ? undefined : [...]`。 |
| `shell/titlebar/inbox-model.ts` | `packages/sdk` session list | `inbox-sessions` 请求上的 `archived: false` | ✓ WIRED | `item.ctx.sdk.api.session.list({ limit: INDEX_LIMIT, order: "desc", parentID: null, archived: false }, { signal })`（:131-133）；`typecheck:tsc` 通过，证明该参数在 SDK 类型中存在。 |
| `runtime/server/session-index.ts` | `shell/titlebar/projects.tsx` | 有界行经 `groups()` 成为项目行 | ✓ WIRED | projects.tsx:57 `createSessionInbox()`（无 `archived` 选项）→ :76 `inbox.entries().forEach(...)` 建组；没有第二处行源或额外过滤。 |
| `shell/titlebar/inbox-model.ts` | `shell/titlebar/inbox.tsx` | Inbox 视图保留归档条目，使归档分区仍可打开 | ✓ WIRED | inbox.tsx:53 `createSessionInbox({ archived: true })`；:110 过滤活跃行，:138 `archived: list.some(inboxArchived)`；merge 侧由 :118/:193 固定。 |
| `runtime/server/session-index.ts` | `home/sessions/index.ts`、`shell/commands/palette.ts` | 两参数调用走默认值 | ✓ WIRED | home/sessions/index.ts:42、palette.ts:298 仍为两参数；`home/sessions/index.test.ts` 10 pass，行为未变。 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| `SidebarProjects` 行 | `inbox.entries()` | `useQueries` → `sdk.api.session.list({ limit: 50, order: "desc", parentID: null, archived: false })` → `parseHomeSessionIndex` + `data.session.known()` → `mergeRootSessionIndex(page \| undefined, known, options)` | 是（真实 SDK 查询 + live store） | ✓ FLOWING |
| 进程内新建会话 → Projects 行（已获取页面无存活 root 时） | `data.session.known()` | `packages/client/src/solid/data.ts:747-757` 写入 known，但 merge 的 `+∞` 下限丢弃它，且没有任何失效让页面重新拉取 | 否 | ✗ DISCONNECTED（Gaps #1 / REVIEW CR-01） |
| `SidebarInbox` 归档分区 | `sections().archived` | 同一 active 页（`archived: false`）+ `inbox-archived-sessions` 页（`archived: true`）+ known（无 bound） | 是 | ✓ FLOWING（无 controller 测试，见人工项 1） |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| merge 的归档/有界/页面状态契约 | `cd packages/app && bun test --conditions=solid --isolate --preload ../ui/test/solid-jsx.ts --preload ./happydom.ts src/runtime/server/session-index.test.ts src/home/sessions/index.test.ts` | 25 pass / 0 fail（15 + 10） | ✓ PASS |
| 应用单元套件无回归 | `cd packages/app && bun run test:unit` | 2712 pass / 0 fail（275 文件，49.7s；同一既有的 `ECONNRESET 127.0.0.1:*` 噪声出现在通过的服务端测试内部） | ✓ PASS |
| 编译门（按计划记录的方式解掉符号链接） | 临时写入 `packages/ui/src/custom-elements.d.ts` 内容 → `bun run typecheck:tsc` → 还原 33 字节指针 | `tsc -b` exit 0；指针恢复 33 字节；`git status --porcelain` 为空 | ✓ PASS |
| strobe 用例有效 | `bunx strobe bench packages/app/perf/session-index.bench.ts --check` | `pass merge the session index · app cpu.work 22.9 ms`，`exp_bcafb5` | ✓ PASS |
| changed-file lint gate（CI 同款） | `bun script/lint-changed.ts db7df8d999` | 2 problems in 2 of 3 files，exit 1（`session-index.ts:35`、`session-index.test.ts:99`） | ✗ FAIL（Gaps #2） |
| `bun typecheck`（`bun check`） | `cd packages/app && bun typecheck` | 未运行：`src/custom-elements.d.ts` 在本 Windows checkout 是 33 字节的 git 符号链接指针，`bun check` 会在检查前报 TS1128（既有环境问题，非本 phase 引入；已用上面的 `tsc` 路径替代） | ? SKIP（记录原因） |
| 禁用测试扫描 | 人工检查两个测试文件 | 无 `.skip` / `.todo` / 条件跳过 | ✓ PASS |

### Probe Execution

不适用。仓库没有 `scripts/*/tests/probe-*.sh`，PLAN / SUMMARY 也未声明任何 probe；本 phase 的可执行验证由上面的 `bun test`、`tsc`、`strobe --check` 承担。

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| SRC-01 | 01-01 | 已归档会话不再出现在 Projects 侧栏（按 `time.archived === undefined` 过滤，或在 inbox 构建层过滤） | ✓ SATISFIED | merge 末过滤 + Projects 传 `includeArchived: false`；`session-index.test.ts:29`、`:47` 通过，`projects.tsx` 无第二条行源。注意 REQUIREMENTS.md 的复选框仍为 `[ ]`/Pending，与实现不一致（文档滞后，不影响代码结论）。 |
| SRC-02 | 01-02, 01-03 | 行源单一、有界；本进程新加载的会话不会凭空新增项目行；重启前后显示同一组项目 | ✓ SATISFIED | 单一页面 `archived: false` + 幸存行下限；`:68`（窗口外旧会话不新增 key）、`:75`/`:154`（重启一致性，含全归档页）通过。CR-01 是反方向的缺口（新会话被过度隐藏），不改变本条的字面契约，但改变了相邻的 must-have（truth 7）。 |
| SRC-03 | 01-01, 01-02, 01-03 | `mergeRootSessionIndex` 合并契约有单元测试，至少覆盖「已归档的 known 会话」「只有 known 没有索引」 | ✓ SATISFIED | `session-index.test.ts:29`（archived known）、`:110`（无页面 -> known-only，取代原空索引用例）均有 value-level 断言；两个契约在同一 co-located 文件，无跳过。 |

无 ORPHANED requirement：REQUIREMENTS.md 中映射到 Phase 1 的三个 ID 都出现在 PLAN frontmatter（SRC-01 在 01-01；SRC-02 在 01-02、01-03；SRC-03 在三个计划）。

### Test Quality Audit

| Test File | Linked Req | Active | Skipped | Circular | Assertion Level | Verdict |
| --------- | ---------- | ------ | ------- | -------- | --------------- | ------- |
| `packages/app/src/runtime/server/session-index.test.ts` | SRC-01/02/03 | 15 | 0 | 无 | Value（精确 id 列表、distinct group key、`toEqual`/`toMatchObject`） | 通过；无 disabled/circular。`:163-168` 与 `:90-95` 重复同一契约（REVIEW WR-01），属测试维护性问题，不改变覆盖。 |
| `packages/app/src/home/sessions/index.test.ts` | 回归（Home/palette 行集） | 10 | 0 | 无 | Value | 通过，证明默认值未改变 Home 与 palette 的行集。 |

覆盖局限（非测试质量问题，而是缺口）：merge 层无法表达“已获取但无存活 root 的页面 + fetch 后新建会话”，所以 truth 7 的失败没有被任何用例拦住；`createSessionInbox` 的选项映射没有 controller 级测试。

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| `packages/app/src/runtime/server/session-index.ts` | 25-38 | `Number.POSITIVE_INFINITY` 下限 + `time.updated < floor` 丢弃 fetch 后的 known root（REVIEW CR-01） | ⚠️ WARNING | truth 7 回归；全新安装/无活跃 root 时 Projects 显示空态，直到 remount/reconnect/rename/archive。已作为 gap 记录。 |
| `packages/app/src/runtime/server/session-index.ts` | 35 | lint: `anti-slop(require-readable-spacing)` | ⚠️ WARNING | `Lint changed files` CI 失败；已作为 gap 记录。 |
| `packages/app/src/runtime/server/session-index.test.ts` | 99 | lint: `anti-slop(require-readable-spacing)` | ⚠️ WARNING | 同上。 |
| `packages/app/e2e/utils/mock-server.ts` | 1203 | mock 对省略 `archived` 只返回非归档，与真实 store 相反（REVIEW WR-02） | ⚠️ WARNING | `archived: false` 这个本 phase 的核心修复没有自动化回归；e2e 无法构造“归档行在活跃页内”的生产状态。 |
| `packages/app/src/runtime/server/session-index.ts` | 4 | `includeArchived` 注释说 “the Projects rows leave it unset”，唯一调用方实际传 `false`（REVIEW IN-01，计划已 descope） | ℹ️ INFO | 后续调用方若照注释省略选项会重新引入归档行。 |
| `packages/app/src/shell/titlebar/inbox-model.ts` | 198-205 | 请求失败与“没有页面”无法区分（REVIEW IN-02） | ℹ️ INFO | `retry: false` 下一次错误会让 known-only 回退持续到 remount/reconnect，窗口被临时放宽；与计划声明的 offline 回退同类，故不定为违规。 |
| `packages/app/src/runtime/server/session-index.test.ts` | 163-168 | 与 `:90-95` 完全重复的用例（REVIEW WR-01） | ℹ️ INFO | 违反 “one contract, one owner”，无行为影响。 |
| `packages/app/src/runtime/server/session-index.test.ts` | 135-142 | 注释仍描述修复前的“归档行占满 50 槽位”请求状态（REVIEW IN-05） | ℹ️ INFO | 用例仍有效（无活跃 root 的服务器同样产生空页面），注释误导。 |
| `packages/app/perf/README.md` | 8-20 | bench 清单未收录 `session-index.bench.ts`（REVIEW IN-03） | ℹ️ INFO | 跑文档所列 `--check` 的人不会知道该用例存在。 |
| `packages/app/src/shell/titlebar/inbox-model.ts` | 43 | “The index excludes archived sessions” 注释 | ✓ 已修复 | 加入 `archived: false` 后注释与请求一致，上一轮的 INFO 不再成立。 |

债务标记扫描：5 个 phase 文件内 `TBD`/`FIXME`/`XXX` = 0，无 🛑 债务标记。

### Human Verification Required

1. **Inbox 归档分区仍列出刚归档的会话（cache miss）**
   **Test:** 在 Inbox 归档一个会话，随即（不离开视图、让 archived 页保持未加载）打开 Archived 搜索。
   **Expected:** 该会话出现在归档分区，归档入口可见。
   **Why human:** `createSessionInbox` 需要 Solid runtime/服务器 context；e2e mock 的 archived 契约与真实服务端相反（e2e/utils/mock-server.ts:1203）。

2. **归档后 Projects 行消失且空组消失**
   **Test:** 在 Inbox 归档一个项目唯一的会话，切到 Projects。
   **Expected:** 该会话不在任何项目行；只剩它的项目行消失。
   **Why human:** merge 与分组各自有单测，但“归档 -> 视图”的完整链路未被测。

3. **窗口外旧会话不改变 Projects 行集，且重启后一致（含全归档状态）**
   **Test:** 记录 Projects 行；打开一个 Projects 未显示的旧会话，返回 Projects；随后重启应用（用户操作）再看 Projects。另外把 50 条以上最新 root 批量归档后重复一次。
   **Expected:** 前后行集一致；全归档状态下活跃窗口内的项目仍按窗口显示，打开窗口外旧会话不新增行。
   **Why human:** 需要真实桌面应用与 sidecar；本次验证不得重启应用。

4. **CR-01：空页面状态下新建会话的可见性（当前预期为“不显示”）**
   **Test:** 在服务器没有活跃 root 的状态（全新安装，或把最新 root 全部归档）打开 Projects，然后新建一个会话（不刷新、不重连、不改名）。
   **Expected（当前代码）：** Projects 不显示该行，直到 remount/reconnect/rename/archive 之一触发 `inbox-sessions` 重新拉取；会话本身在主面板、Home 与 Inbox 可见。
   **Why human:** 需要真实运行态确认影响面与可接受性；代码层面已确定该行会被丢弃（Gaps #1）。

### Gaps Summary

上一轮的三条 gap 都已真实关闭：`inbox-sessions` 现在请求 `archived: false`（inbox-model.ts:132），归档行不再占用 50 个槽位；`mergeRootSessionIndex` 用 `undefined`/数组区分“没有页面”与“已获取的页面”，并从最终能存活的行推导下限（session-index.ts:20-38）。50 条全归档页经真实 `parseHomeSessionIndex` 解析为空后，Projects 不再合并全量 known，重启前后行集一致；融合页面与幸存行下限也各有可执行用例。`bun test`（25 pass）、`bun run test:unit`（2712 pass）、`tsc -b`（exit 0）、`strobe --check` 均通过，5 个目标 artifact 全部存在且接线完整。SRC-01/02/03 的实现证据成立，Home 与 palette 行集未变。

但 phase 仍未达到可交付状态：

1. **truth 7 回归（CR-01）。** 01-03 的规则用 `Number.POSITIVE_INFINITY` 表示“页面没有存活 root”，于是“已获取但解析为空”的页面会丢弃**所有**本进程已知 root，包括 fetch 之后新建的会话；而 `inbox-sessions` 不会因此重新拉取（`staleTime` 不自触发、`refetchOnWindowFocus: false`、没有 `session.created` 失效）。这在全新安装或服务器无活跃 root 时是普通状态，结果就是会话已打开而 Projects 显示空态。计划声称的“等页面重新拉取”并不存在，`session-index.test.ts:144` 反而把这个丢弃固定为契约。修复方向二选一：在 `session.created` 时失效 `["inbox-sessions", conn]`，或让空页面使用抓取时间而不是 `Infinity` 作为下限；并补一条“空页面 + fetch 后新建会话仍成行”的回归。

2. **CI lint gate 失败（CR-02）。** `bun script/lint-changed.ts db7df8d999` 在交付树上 exit 1，两条 `require-readable-spacing` 警告分别位于 01-03 重写的 `rows` 行与新测试文件；`Lint changed files` 是每个 PR 的必需 job。修法是各补一个空行。计划把 IN-03 列为 out of scope，但这两处都是本 phase 编辑过的位置，因此记录为交付完整性问题，交由规划者决定是否在本 phase 内关闭。

另有 2 条行为未验证（Inbox 归档分区在 cache miss 下的可见性）与 4 条人工检查，需要在运行中的应用里确认；它们不影响上面的失败结论。

---

_Verified: 2026-11-12T09:28:15Z_
_Verifier: gsd-verifier (adversarial)_
