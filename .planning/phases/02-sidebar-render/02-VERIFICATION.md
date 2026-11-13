---
phase: 02-sidebar-render
verified: 2026-11-13T18:09:11Z
status: human_needed
score: 10/12 must-haves verified
covered_files: [".planning/phases/02-sidebar-render/02-01-PLAN.md", ".planning/phases/02-sidebar-render/02-01-SUMMARY.md", ".planning/phases/02-sidebar-render/02-02-PLAN.md", ".planning/phases/02-sidebar-render/02-02-SUMMARY.md", "packages/app/src/runtime/i18n/en.ts", "packages/app/src/shell/titlebar/titlebar.tsx", "packages/app/src/workspace-sidebar/dialogs.tsx", "packages/app/src/workspace-sidebar/index.ts", "packages/app/src/workspace-sidebar/registry.test.ts", "packages/app/src/workspace-sidebar/registry.ts", "packages/app/src/workspace-sidebar/sessions.test.ts", "packages/app/src/workspace-sidebar/sessions.ts", "packages/app/src/workspace-sidebar/sidebar.tsx", "packages/app/src/workspace-sidebar/store.test.ts", "packages/app/src/workspace-sidebar/store.ts"]
covered_digest: "v4:sha256:9fb13888ca9fb111c081a8cad140b95bb1cb2df88f04add88bab54d03edd9ee3"
behavior_unverified: 2
overrides_applied: 0
behavior_unverified_items:
  - truth: "拖拽排序只写 order：拖动两行交换后，序列按新位置持久化，其余字段（title/directory/createdAt/removedAt）不动"
    test: "在 Projects 模式把两行拖到新顺序，刷新/重启后确认顺序保持；再登记一个新目录，确认追加在末尾而非插进手排序列"
    expected: "重排后持久化 order 反映拖动顺序；新登记 order = max+1；拖动不发生任何非 order 写入"
    why_human: "dnd-kit 的真实指针拖拽只能在浏览器触发；`applyOrder` 纯契约已由单测钉住，但 onDragEnd→registry.reorder 的接线没有任何测试或浏览器证据（UAT #10 skipped）"
  - truth: "session.created 按 location.directory 归行；archived/unarchived/deleted 靠 sessionID→行键内存映射做行级刷新，未命中不重扫全局索引"
    test: "运行中在某个已登记目录里新建一条会话（行应原地出现）、归档/取消归档/重命名/删除一条（只该行刷新）；另在未登记目录新建会话（侧栏不应增行）"
    expected: "仅目标行发生增量变化，无全局重扫、无兜底分组、未登记目录不出现新行"
    why_human: "接线（sessions.ts:299-347）存在且与 schema/recent-sessions 同形，但 Bun 下 solid-js 解析为 server build，`createEffect` 是 no-op，订阅从未在测试中执行；UAT #12 skipped"
human_verification:
  - test: "拖拽两行交换顺序后重启；再登记一个新目录"
    expected: "顺序持久化保持；新目录追加末尾、不抢占手排顺序；拖动只改 order"
    why_human: "真实指针拖拽无法在单测/CDP 合成事件中稳定触发 dnd-kit sortable 传感器"
  - test: "运行中在已登记目录新建/归档/取消归档/重命名/删除会话；再在未登记目录新建会话"
    expected: "只有目标行增量刷新，无全局重扫，未登记目录不长出新行"
    why_human: "createEffect 在 Bun 测试环境是 no-op，会话事件接线只能在浏览器观察"
  - test: "添加一个服务端拼写与本地登记拼写不同的目录（例如首次以小写盘符打开），确认行键采用 location.directory"
    expected: "非空 session.list 返回后采用服务端拼写；空列表退回本地归一"
    why_human: "本机目标目录盘符全为大写，校准前后字符串相同，浏览器侧观察不到差异（UAT #11 skipped）；当前仅有单测级证据"
---

# Phase 2: 侧栏渲染与会话投影 验证报告

**Phase Goal:** 侧栏显示什么完全由登记表决定——行 = 未移除的登记项，行内只含与该目录精确相等的会话，重命名/移除/排序/不可用态都在此模型内闭环。
**Verified:** 2026-11-13T18:09:11Z
**Status:** human_needed
**Re-verification:** No — initial verification（本 phase 无既往 VERIFICATION.md）

## Goal Achievement

### Observable Truths

| #   | Truth | Status | Evidence |
| --- | ----- | ------ | -------- |
| 1 | 同一 git 仓库两份拷贝 = 两行；行内只含 `directory` 精确相等的会话（子目录不出现） | ✓ VERIFIED | `sidebar.tsx:83,243` 行源 `visible(entries)`；每行发 `session.list({ directory, limit:50, parentID:null, order:"desc" })`（`sessions.ts:170-175`），返回项按“被查询行”归档（`attributeSessions`）；`rowKeyFor`/`attributeSessions` 单测；UAT #2/#3 pass |
| 2 | 登记后采用服务端 `location.directory` 拼写；列表为空退回本地归一 | ✓ VERIFIED（单测级） | `sessions.ts:62-72` `serverSpelling`、`:131-135` `adoptSpelling`、`:270-296` `probeSpelling` + `store.ts:109` `adoptDirectory`，经 `sidebar.tsx:90` `onServerSpelling` 接线；`queryDirectoryFor` 拒绝跨行拼写。注：浏览器观测 skipped（本机盘符全大写），仅有单测证据（`serverSpelling`/`queryDirectoryFor`/`adoptEntryDirectory`/`probeSpelling`/self-heal） |
| 3 | 有历史会话但未登记的目录完全不出现；无任何「未分组 / 其它」兜底分组 | ✓ VERIFIED | 行只来自 `visible(entries)`；`matchCreated` 未登记/已移除返回 `undefined` 单测；UAT #1（4 播种→4 行）、#4（全站 `Ungrouped` 0 匹配） |
| 4 | 被移除工作区的会话侧栏不可见，但仍可从 Inbox / 命令面板访问 | ✓ VERIFIED | `remove` 只写 `removedAt`（`registry.ts:148-159`），`visible()` 过滤移除项；`git diff` 未触碰 inbox/命令面板；UAT #4/#6（移除后行消失、Inbox 仍可见） |
| 5 | 重命名只改 `title`（`project.name`/`icon` 零写入） | ✓ VERIFIED | `withTitle` 只改 `title`（`store.ts:39-50`）单测；workspace-sidebar 内无 `project` import/写入（grep 空）；UAT #5 |
| 6 | 移除只写 `removedAt`；恢复沿用原名原序；新登记不抢手排顺序 | ✓ VERIFIED | `registry.test.ts:165-227`（remove 掩码/首删时间/恢复名序）、`:59-71`（新登记 order = max+1）；`store.test.ts` `applyOrder`/`withTitle`；UAT #6 |
| 7 | 空态只有「添加本地文件夹」单一动作、不自动建默认工作区 | ✓ VERIFIED | `sidebar.tsx:199-214` 空态仅一个 `sidebar.workspace.add` 按钮；`register` 仅在 picker `onSelect` 内触发（`:160-179`）；UAT #7 |
| 8 | 目录被删/改名 → 行可见、标记不可用、不可展开、不自动指向 | ✓ VERIFIED | 可用性只由只读 `file.list` 决定（`sessions.ts:137-152`，`needsAvailabilityProbe` 对每个 ready 行探测）；`sidebar.tsx:141,334,342,386`；单测（有历史也判 unavailable）+ UAT #8 |
| 9 | 重启后登记列表、显示名、顺序、移除状态保持 | ✓ VERIFIED | `persisted(registryTarget(scope), WorkspaceRegistrySchema, initialRegistry)`（`store.ts:78`）为唯一调用点；registry 文档往返单测（`registry.test.ts:229-253`）；UAT #9 |
| 10 | 拖拽排序只写 `order`，其余字段不动；新登记追加末尾 | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | `applyOrder` 纯契约单测通过；`sidebar.tsx:228-240` `onDragEnd→arrayMove→registry.reorder` 接线存在且与 `sidebar-organized.tsx` 同形；但真实指针拖拽无测试、UAT #10 skipped（见 `behavior_unverified_items`） |
| 11 | `session.created` 按 `location.directory` 归行；`archived`/`unarchived`/`deleted` 靠内存映射做行级刷新，不重扫全局索引 | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | 接线存在（`sessions.ts:299-347`），字段与 `session-event.ts`（`location: Location.Ref`、`parentID`、`sessionID`、`title`）匹配，同 `recent-sessions.tsx:404-448` 的 `onCleanup(ctx.data.on(...))` 形态；纯决策 `matchCreated` 有单测；但 Bun 下 `createEffect` no-op，订阅从未执行；UAT #12 skipped（见 `behavior_unverified_items`） |
| 12 | `bun check --no-script` 对本 phase 文件 0 诊断 + 模块测试全绿 | ✓ VERIFIED | 重跑：`bun test … src/workspace-sidebar` → **86 pass / 0 fail**；11 个改动文件 `bun check --no-script` → “No type errors in 600 files”；`lint-changed` → 0 problem |

**Score:** 10/12 truths verified（2 项 present、behavior-unverified）

### Deferred Items

无。2 项 behavior-unverified 均属本 phase 自身验收范围，未被后续 Phase 3（SYNC-01..03 上游触点收敛/打包隔离）覆盖。

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `packages/app/src/workspace-sidebar/store.ts` | 唯一 `persisted()` 调用点 + 纯 `applyOrder`/`withTitle`/`adoptEntryDirectory` | ✓ VERIFIED | 113 行，实质实现，`commit` 仅在引用变化时写；被 `sidebar.tsx` 导入使用 |
| `packages/app/src/workspace-sidebar/sessions.ts` | 每行 `session.list`、`sessionID→行键` 映射、事件接线、REG-04 校准、`file.list` 可用性 | ✓ VERIFIED | 369 行；`load/fetchRow/probeSpelling/refreshRow` 单飞+标脏；被 `sidebar.tsx` 使用 |
| `packages/app/src/workspace-sidebar/sidebar.tsx` | 行渲染、展开、拖拽、空态、不可用态、滚动恢复 | ✓ VERIFIED | 417 行；全部交互接真实 store/API |
| `packages/app/src/workspace-sidebar/dialogs.tsx` | 自有重命名/移除对话框（不改上游 `RenameDialog`） | ✓ VERIFIED | 95 行；trim 空禁用保存；移除文案说明目录/git/会话不动 |
| `packages/app/src/workspace-sidebar/index.ts` | 唯一导出面 `SidebarWorkspaces` | ✓ VERIFIED | 1 行 `export { SidebarWorkspaces } from "./sidebar"` |
| `packages/app/src/runtime/i18n/en.ts` | 连续 `sidebar.workspace.*` 文案块 | ✓ VERIFIED | 902-914 单块 11 键，位于 `sidebar.view.*` 之后，未改既有文案 |
| `packages/app/src/shell/titlebar/titlebar.tsx` | 唯一挂载点（2/2 行） | ✓ VERIFIED | `:22` 新 import、`:816` `<SidebarWorkspaces />` 于 `sidebarOrganize === "projects"` Match；`SidebarOrganized` 已无引用；numstat 2/2 |
| `packages/app/src/workspace-sidebar/store.test.ts` | 排序/重命名/拼写纯契约 owner | ✓ VERIFIED | 99 行，4+3+3 用例 |
| `packages/app/src/workspace-sidebar/sessions.test.ts` | 行键/归属/事件归行/拼写校准/可用性谓词 + 工厂级 load/probeSpelling | ✓ VERIFIED | 287 行，纯契约 + 假 server API 的工厂测试 |
| `packages/app/src/workspace-sidebar/registry.test.ts` | Phase 1 登记表契约（含 web 平台探测修复） | ✓ VERIFIED | 253 行，含 `detectHostPlatform` 6 行表驱动 |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| `store.ts` | `runtime/persistence/storage.ts` | `persisted(registryTarget(scope), WorkspaceRegistrySchema, initialRegistry)` | ✓ WIRED | `store.ts:78`，全仓唯一 registry 持久化组装点（grep 无第二处） |
| `sessions.ts` | `runtime/server/runtime.tsx` | `ctx.sdk.api.session.list` / `file.list` / `ctx.data.on` | ✓ WIRED | `sessions.ts:170,145,305-346`；`on` 即 `sdk.event.on`（`runtime.tsx:213`） |
| `sessions.ts` | `workspace-sidebar/registry.ts` | `directoryKey(entry.directory, platform)` 作行键/比较 | ✓ WIRED | `rowKeyFor/rowKeyOf/matchCreated` 均走 `directoryKey` |
| `titlebar.tsx` | `workspace-sidebar/index.ts` | `<SidebarWorkspaces />` 于 `projects` Match | ✓ WIRED | import `:22` + JSX `:816` |
| `sidebar.tsx` | `workspace-sidebar/store.ts` | `createWorkspaceRegistry(servers.scope(serverKey), host)` | ✓ WIRED | `sidebar.tsx:81` |
| `sidebar.tsx` | `workspace-sidebar/sessions.ts` | `createWorkspaceSessions({…})` | ✓ WIRED | `sidebar.tsx:85-91` |
| `sidebar.tsx` | `workspaces/selection/picker.tsx` | `useDirectoryPicker({ server, …, onSelect })` | ✓ WIRED | `sidebar.tsx:69,160-179` |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| `sidebar.tsx` 会话行 | `sessionsOf(sessions.rows(), key).sessions` | `ctx.sdk.api.session.list({ directory })` → `state.rows[key].sessions` | 是（真实 API，非静态 return） | ✓ FLOWING |
| `sidebar.tsx` 不可用标记 | `sessions.availability()[key]` | `ctx.sdk.api.file.list({ location:{directory} })`（目录不存在→FileNotFound→unavailable） | 是 | ✓ FLOWING |
| `sidebar.tsx` 行列表 | `visible(registry.entries())` | `persisted(registryTarget(scope), …)` 的 `state.entries` | 是（持久化文档，非硬编码） | ✓ FLOWING |

### Behavioral Spot-Checks

未启动服务器（verifier 不重启 app/server），仅做可离线执行的检查：

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| 模块单测（含行键/归属/拼写/可用性/工厂 load） | `cd packages/app && bun test --conditions=solid --isolate --preload ../ui/test/solid-jsx.ts --preload ./happydom.ts src/workspace-sidebar` | 86 pass / 0 fail（129 expect，3 files） | ✓ PASS |
| 改动文件 type gate | `cd packages/app && bun check --no-script <11 files>` | No type errors in 600 files | ✓ PASS |
| 改动文件 lint | `bun script/lint-changed.ts upstream/dev` | 0 problem(s) in 0 of 11 changed files | ✓ PASS |
| 边界（无 server/protocol/core 改动） | `git diff --name-only upstream/dev -- packages/server packages/protocol packages/core` | 空 | ✓ PASS |
| 边界（改动面） | `git diff --name-only upstream/dev -- packages/` | 仅 `workspace-sidebar/*` + `titlebar.tsx` + `i18n/en.ts` | ✓ PASS |
| titlebar 接缝 | `git diff --numstat upstream/dev -- … titlebar.tsx` | `2 2`（删 1 import / 加 1 import / 换 1 JSX） | ✓ PASS |
| 无未使用上游符号 | `rg -n "SidebarOrganized" titlebar.tsx` | 无匹配（exit 1） | ✓ PASS |
| 拖拽真实交互 | — | 需浏览器指针拖拽 | ? SKIP（→ 人工 UAT） |
| 会话事件行级刷新 | — | 需运行中制造真实会话事件 | ? SKIP（→ 人工 UAT） |

### Probe Execution

N/A — 本 phase 未声明 probe 脚本，仓库也无约定 `scripts/*/tests/probe-*.sh` 路径被本 phase 引用。

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| REG-04 | 02-01/02-02 | 登记后采用服务端 `location.directory` 拼写 | ✓ SATISFIED（单测级） | `probeSpelling`+`adoptSpelling`+`adoptDirectory`；浏览器观测 skipped |
| ROW-01 | 02-01/02-02 | 行只来自登记表，未登记目录不出现 | ✓ SATISFIED | `visible(entries)` 行源；UAT #1 |
| ROW-02 | 02-01/02-02 | 同一仓库两个目录 = 两行 | ✓ SATISFIED | 每行独立行键 + 独立 `session.list`；UAT #2 |
| ROW-03 | 02-01/02-02 | 行内只含 `directory` 精确相等的会话 | ✓ SATISFIED | `session.list({ directory })` 服务端 `eq(directory)`；UAT #3 |
| ROW-04 | 02-01/02-02 | 无兜底分组；移除后侧栏不可见 | ✓ SATISFIED | 无 fallback 分组代码；UAT #4 |
| ROW-05 | 02-02 | Inbox/命令面板不受登记表影响 | ✓ SATISFIED（结构性） | diff 未触碰 inbox/命令面板；UAT #4/#6 |
| ROW-06 | 02-01/02-02 | 事件按 `location.directory` 归行、映射行级刷新不重扫 | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | 接线存在，无测试/浏览器证据；纯决策 `matchCreated` 有单测 |
| UX-01 | 02-01/02-02 | 重命名只写 `title` | ✓ SATISFIED | `withTitle` 单测；无 project 写入；UAT #5 |
| UX-02 | 02-01/02-02 | 移除只写 `removedAt`；重新登记恢复 | ✓ SATISFIED | `remove`/`register` 单测；UAT #6 |
| UX-03 | 02-01/02-02 | 拖拽排序写 `order`；新登记追加末尾 | ✓ SATISFIED（写入逻辑）/⚠️ 拖拽 UI 未验 | `applyOrder` + `register` order=max+1 单测；拖拽 UI skipped |
| UX-04 | 02-02 | 空态单一动作、不自动建工作区 | ✓ SATISFIED | `sidebar.tsx:199-214`；UAT #7 |
| UX-05 | 02-01/02-02 | 目录不存在 → 可见、不可用、不可展开 | ✓ SATISFIED | `file.list` 探测 + 行级 `unavailable`；UAT #8 |
| PST-01 | 02-01/02-02 | 重启全保持 | ✓ SATISFIED | `persisted()` + 文档往返单测；UAT #9 |

无孤立需求：ROADMAP/REQUIREMENTS 映射到本 phase 的 13 个 ID 全部被计划认领。

### Test Quality Audit

| Test File | Linked Req | Active | Skipped | Circular | Assertion Level | Verdict |
| --------- | ---------- | ------ | ------- | -------- | --------------- | ------- |
| `sessions.test.ts` | ROW-01/02/03/06, REG-04, UX-05 | 全活跃（含工厂级 load/probeSpelling） | 0 | 无（假 server API，期望值手写） | Value / Behavioral | ✓ 充分 |
| `store.test.ts` | UX-01/02/03, REG-04 | 全活跃 | 0 | 无 | Value | ✓ 充分 |
| `registry.test.ts` | REG-01/02/03, UX-02/03, PST-02（Phase 1 契约，本 phase 复用） | 全活跃 | 0 | 无 | Value（含文档往返） | ✓ 充分 |

**Disabled tests on requirements:** 0 → 非阻断
**Circular patterns detected:** 0 → 非阻断
**Insufficient assertions:** 0 → 非阻断
**Event 接线（ROW-06）说明:** `createEffect` 在 Bun 下 no-op，订阅接线无法被单测观察——这是本 phase 唯一“有契约、无行为测试”的自动化缺口，已归入 `behavior_unverified_items`。

### Decision Coverage

本 phase 目录无 `*-CONTEXT.md`，决策覆盖门不适用（未评估，非“0 决策”）。

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| — | — | 无 `TBD/FIXME/XXX` 债务标记 | — | grep 空 |
| — | — | 无 `createResource` / `location.get(` / `session.apply` / `project.update` / `dangerouslySetInnerHTML` | — | grep 空 |
| — | — | 无 `placeholder` / `coming soon` / `not yet implemented` 占位文案 | — | grep 空 |

未发现 🛑 Blocker 或 ⚠️ Warning 级反模式。

### Human Verification Required

1. **拖拽排序（UX-03 / 判据 3）**
   - Test: 在 Projects 模式把两行拖到新顺序，刷新/重启确认顺序保持；再登记一个新目录。
   - Expected: 顺序持久化；新目录追加末尾、不抢占手排顺序；拖动只改 `order`，其余字段不变。
   - Why human: 真实指针拖拽无法在单测/CDP 合成事件中稳定触发 dnd-kit sortable 传感器（UAT #10 skipped）。

2. **会话事件行级刷新（ROW-06 / 判据 5）**
   - Test: 运行中在已登记目录新建一条会话；归档/取消归档/重命名/删除一条；再在未登记目录新建会话。
   - Expected: 仅目标行增量刷新，无全局重扫、无兜底分组；未登记目录不长出新行。
   - Why human: Bun 下 `createEffect` 为 no-op，订阅接线只能在浏览器观察（UAT #12 skipped）。

3. **REG-04 服务端拼写实测（REG-04 / 判据 1 后半）**
   - Test: 添加一个服务端返回拼写与本地登记不同的目录（如首次以小写盘符打开）。
   - Expected: 非空 `session.list` 后行键采用 `location.directory`；空列表退回本地归一。
   - Why human: 本机盘符全大写，校准前后字符串相同、观察不到差异（UAT #11 skipped）；当前仅有单测级证据。

### Gaps Summary

无阻断性 gap：所有 must-have 的实体产物存在、实质、被接线；关键链路全部 WIRED；数据流从真实 API / 持久化加载，无 stub、无孤儿、无未接线。三条检查命令（模块单测 86 pass、改动文件 0 类型诊断、lint-changed 0 problem）与边界检查（仅 `workspace-sidebar/*` + `titlebar.tsx` + `i18n/en.ts`，`server/protocol/core` 为空）均复跑通过，`62fb6cbabb` 的 web 平台探测修复确实存在。

未达标的是**行为证据**而非实现：`拖拽排序` 与 `会话事件行级刷新` 两条状态转移型 must-have 的代码已存在并接线，但没有任何测试或浏览器证据实际执行该路径（UAT 三条 skipped 中的两条），因此按规则判为 ⚠️ PRESENT_BEHAVIOR_UNVERIFIED 并转人工；REG-04 的服务端拼写校准由单测钉住、按约束以“单测级”计入 VERIFIED，其浏览器观测同样 skipped 并在人工项中列明。整包 `bun typecheck` 的 `custom-elements.d.ts` 符号链接缺陷为既有问题，按约定未计分。

---

_Verified: 2026-11-13T18:09:11Z_
_Verifier: the agent (gsd-verifier)_
