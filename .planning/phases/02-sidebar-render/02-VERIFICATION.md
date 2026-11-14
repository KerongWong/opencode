---
phase: 02-sidebar-render
verified: 2026-11-14T04:09:50Z
status: passed
score: 12/12 must-haves verified
covered_files: [".planning/phases/02-sidebar-render/02-01-PLAN.md", ".planning/phases/02-sidebar-render/02-01-SUMMARY.md", ".planning/phases/02-sidebar-render/02-02-PLAN.md", ".planning/phases/02-sidebar-render/02-02-SUMMARY.md", "packages/app/src/runtime/i18n/en.ts", "packages/app/src/shell/titlebar/titlebar.tsx", "packages/app/src/workspace-sidebar/dialogs.tsx", "packages/app/src/workspace-sidebar/index.ts", "packages/app/src/workspace-sidebar/registry.test.ts", "packages/app/src/workspace-sidebar/registry.ts", "packages/app/src/workspace-sidebar/sessions.test.ts", "packages/app/src/workspace-sidebar/sessions.ts", "packages/app/src/workspace-sidebar/sidebar.tsx", "packages/app/src/workspace-sidebar/store.test.ts", "packages/app/src/workspace-sidebar/store.ts"]
covered_digest: "v4:sha256:fd2bbd35c23e6072916f40461226a261248ab90bec3b2859701d549908bb778d"
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: human_needed
  previous_score: 10/12
  gaps_closed:
    - "拖拽排序只写 order（UAT #10 以 CDP 真实拖拽补测通过，持久化文档变为 AAA:1 / BBB:0）"
    - "ROW-06 改为「首屏加载时取全、不做实时刷新」（2026-11-14 产品决定；UAT #12 改写后 pass，原实时刷新要求撤销）"
    - "REG-04 服务端拼写校准（UAT #11 以混合大小写路径登记补测通过）"
  gaps_remaining: []
  regressions: []
---

# Phase 2: 侧栏渲染与会话投影 验证报告

**Phase Goal:** 侧栏显示什么完全由登记表决定——行 = 未移除的登记项，行内只含与该目录精确相等的会话，重命名/移除/排序/不可用态都在此模型内闭环。
**Verified:** 2026-11-14T04:09:50Z
**Status:** passed
**Re-verification:** Yes — 需求修订后复验（无 `gaps:` 段的 human_needed 报告 → ROW-06 产品决定 + UAT 补测）

## Goal Achievement

### Observable Truths

| #   | Truth | Status | Evidence |
| --- | ----- | ------ | -------- |
| 1 | 同一 git 仓库两份拷贝 = 两行；行内只含 `directory` 精确相等的会话（子目录不出现） | ✓ VERIFIED | 行源 `sidebar.tsx:83` `visible(registry.entries())`；每行独立 `session.list({ directory, limit:50, parentID:null, order:"desc", archived:false })`（`sessions.ts:170-176`）；返回项按“被查询行”归档（`attributeSessions`）；`rowKeyFor`/`attributeSessions` 单测；UAT #2/#3 pass |
| 2 | 登记后采用服务端 `location.directory` 拼写；列表为空退回本地归一 | ✓ VERIFIED | `sessions.ts:62-72` `serverSpelling`、`:131-135` `adoptSpelling`、`:270-297` `probeSpelling`；`store.ts:57-76` `adoptEntryDirectory` 先 `normalizeDirectory` 再采纳（`bdc8015f93`）；`sidebar.tsx:90,174-178` 接线；UAT #11 以混合大小写路径实测 pass。限制见「Accepted Limitations」 |
| 3 | 有历史会话但未登记的目录完全不出现；无任何「未分组 / 其它」兜底分组 | ✓ VERIFIED | 行只来自 `visible(entries)`；`matchCreated` 对未登记/已移除返回 `undefined`（单测）；全目录 grep `Ungrouped/未分组` 空；UAT #1（4 播种→4 行）、#4（全站 0 匹配） |
| 4 | 被移除工作区的会话侧栏不可见，但仍可从 Inbox / 命令面板访问 | ✓ VERIFIED | `remove` 只写 `removedAt`（`registry.ts:147-159`），`visible()` 过滤；Phase 2 提交范围（`74c0615c7a..07928e4c97`）未触碰 inbox/命令面板；UAT #4/#6（移除后行消失、Inbox 仍可见） |
| 5 | 重命名只改 `title`（`project.name`/`icon` 零写入） | ✓ VERIFIED | `withTitle` 只改 `title`（`store.ts:39-51`）单测；`rg "project\.(update|name|icon)|location\.get\("` 于 workspace-sidebar 空；UAT #5 |
| 6 | 移除只写 `removedAt`；恢复沿用原名原序；新登记不抢手排顺序 | ✓ VERIFIED | `registry.test.ts:165-227`（remove 掩码/首删时间/恢复名序）、`:59-71`（新登记 order = max+1，`registry.ts:140`）；`store.test.ts` `applyOrder`/`withTitle`；UAT #6/#9 |
| 7 | 空态只有「添加本地文件夹」单一动作、不自动建默认工作区 | ✓ VERIFIED | `sidebar.tsx:199-214` 空态仅一个 `sidebar.workspace.add` 按钮；`register` 仅在 picker `onSelect` 内触发（`:160-179`）；UAT #7 |
| 8 | 目录被删/改名 → 行可见、标记不可用、不可展开、不自动指向 | ✓ VERIFIED | 可用性只由只读 `file.list` 决定（`sessions.ts:137-152`，`load` 对每个 ready 行探测）；`sidebar.tsx:141,333-336,342-349,386` 阻止展开且不跟随路径；单测（有历史也判 unavailable）+ UAT #8 |
| 9 | 重启后登记列表、显示名、顺序、移除状态保持 | ✓ VERIFIED | `persisted(registryTarget(scope), WorkspaceRegistrySchema, initialRegistry)` 为唯一调用点（`store.ts:83`，全目录无第二处）；registry 文档往返单测（`registry.test.ts:229-253`）；UAT #9（刷新后行集合/改名/移除/拖拽顺序全部保持） |
| 10 | 拖拽排序只写 `order`，其余字段不动；新登记追加末尾 | ✓ VERIFIED | `sidebar.tsx:228-240` `onDragEnd→arrayMove→registry.reorder`；`applyOrder` 纯契约单测（只改 order、未列/已移除记录不动）；UAT #10 以 CDP 真实拖拽把第 2 行拖到第 1 行，持久化 `AAA:1 / BBB:0` 且刷新后保持 |
| 11 | **ROW-06（2026-11-14 修订）**：行内会话在首屏加载时取全；不做实时刷新——应用开着期间的新增/归档/删除，刷新页面后体现 | ✓ VERIFIED | 首屏由 `sidebar.tsx:137` `createEffect(on(rows, () => sessions.load()))` 驱动；`load` 对每个可见行发一次 `session.list`（`sessions.ts:255-268,170-176`），`archived:false` 使归档会话不进入行；UAT #12 实测：`POST /api/session` 新建后 3 秒行内按钮数 39 不变，刷新后 40。**不把** `sessions.ts:299-347` 的惰性订阅块计为证据（见「Accepted Limitations」） |
| 12 | `bun check --no-script` 对本 phase 文件 0 诊断 + 模块测试全绿 | ✓ VERIFIED | 本轮重跑：`bun test … src/workspace-sidebar` → **87 pass / 0 fail**（130 expect，3 files）；11 个 app 文件 `bun check --no-script` → **No type errors in 600 files**；`lint-changed` → **0 problem(s) in 0 of 17 changed files** |

**Score:** 12/12 truths verified（0 项 present、behavior-unverified）

### Deferred Items

无。本 phase 的 13 个需求均已在本阶段闭环；`UIX-02`（真正的游标分页）属 v2 需求，不是后续 milestone phase 的覆盖项。

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `packages/app/src/workspace-sidebar/store.ts` | 唯一 `persisted()` 调用点 + 纯 `applyOrder`/`withTitle`/`adoptEntryDirectory` | ✓ VERIFIED | 118 行，实质实现，`commit` 仅在引用变化时写；被 `sidebar.tsx` 导入使用 |
| `packages/app/src/workspace-sidebar/sessions.ts` | 每行 `session.list`、REG-04 校准、`file.list` 可用性、行级事件接线（惰性，见限制） | ✓ VERIFIED | 370 行；`load/fetchRow/probeSpelling/refreshRow` 单飞+标脏；`archived:false` 已生效（CR-01 修复） |
| `packages/app/src/workspace-sidebar/sidebar.tsx` | 行渲染、展开、拖拽、空态、不可用态、滚动恢复 | ✓ VERIFIED | 417 行；全部交互接真实 store/API |
| `packages/app/src/workspace-sidebar/dialogs.tsx` | 自有重命名/移除对话框（不改上游 `RenameDialog`） | ✓ VERIFIED | 95 行；trim 空禁用保存；移除文案说明目录/git/会话不动 |
| `packages/app/src/workspace-sidebar/index.ts` | 唯一导出面 `SidebarWorkspaces` | ✓ VERIFIED | 1 行 `export { SidebarWorkspaces } from "./sidebar"` |
| `packages/app/src/runtime/i18n/en.ts` | 连续 `sidebar.workspace.*` 文案块 | ✓ VERIFIED | 902-914 单块 12 键（含 2 条跨行 description），位于 `sidebar.view.*` 之后，未改既有文案 |
| `packages/app/src/shell/titlebar/titlebar.tsx` | 唯一挂载点（2/2 行） | ✓ VERIFIED | `:22` 新 import、`:816` `<SidebarWorkspaces />` 于 `sidebarOrganize === "projects"` Match；`SidebarOrganized` 已无引用；numstat 2/2 |
| `packages/app/src/workspace-sidebar/store.test.ts` | 排序/重命名/拼写纯契约 owner | ✓ VERIFIED | 107 行，4+3+4 用例 |
| `packages/app/src/workspace-sidebar/sessions.test.ts` | 行键/归属/事件归行/拼写校准/可用性谓词 + 工厂级 load/probeSpelling | ✓ VERIFIED | 287 行，纯契约 + 假 server API 的工厂测试 |
| `packages/app/src/workspace-sidebar/registry.test.ts` | Phase 1 登记表契约（含 web 平台探测修复） | ✓ VERIFIED | 253 行，含 `detectHostPlatform` 表驱动 |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| `store.ts` | `runtime/persistence/storage.ts` | `persisted(registryTarget(scope), WorkspaceRegistrySchema, initialRegistry)` | ✓ WIRED | `store.ts:83`，全仓唯一 registry 持久化组装点（`rg "persisted\(|registryTarget\("` 仅此一处实现调用） |
| `sessions.ts` | `runtime/server/runtime.tsx` | `ctx.sdk.api.session.list` / `file.list` / `ctx.data.on` | ✓ WIRED | `sessions.ts:170,145,305-346`；`ctx.data.on` 同 `runtime/server/data.ts:44-72` 的既有用法 |
| `sessions.ts` | `workspace-sidebar/registry.ts` | `directoryKey(entry.directory, platform)` 作行键/比较 | ✓ WIRED | `rowKeyFor/rowKeyOf/matchCreated/queryDirectoryFor` 均走 `directoryKey` |
| `titlebar.tsx` | `workspace-sidebar/index.ts` | `<SidebarWorkspaces />` 于 `projects` Match | ✓ WIRED | import `:22` + JSX `:816` |
| `sidebar.tsx` | `workspace-sidebar/store.ts` | `createWorkspaceRegistry(servers.scope(serverKey), host)` | ✓ WIRED | `sidebar.tsx:81` |
| `sidebar.tsx` | `workspace-sidebar/sessions.ts` | `createWorkspaceSessions({…})` | ✓ WIRED | `sidebar.tsx:85-91` |
| `sidebar.tsx` | `workspaces/selection/picker.tsx` | `useDirectoryPicker({ server, …, onSelect })` | ✓ WIRED | `sidebar.tsx:69,160-179` |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| `sidebar.tsx` 会话行 | `sessionsOf(sessions.rows(), key).sessions` | `ctx.sdk.api.session.list({ directory, archived:false })` → `state.rows[key].sessions` | 是（真实 API，非静态 return） | ✓ FLOWING |
| `sidebar.tsx` 不可用标记 | `sessions.availability()[key]` | `ctx.sdk.api.file.list({ location:{directory} })`（目录不存在→FileNotFound→unavailable） | 是 | ✓ FLOWING |
| `sidebar.tsx` 行列表 | `visible(registry.entries())` | `persisted(registryTarget(scope), …)` 的 `state.entries` | 是（持久化文档，非硬编码） | ✓ FLOWING |

### Behavioral Spot-Checks

本轮不重启 app/server（`packages/app/AGENTS.md` 明令禁止），自动检查均离线执行；浏览器行为引用 2026-11-14 已完成的 agent-run UAT，不冒充本轮复跑。

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| 模块单测（行键/归属/拼写/可用性/工厂 load/归档过滤） | `cd packages/app && bun test --conditions=solid --isolate --preload ../ui/test/solid-jsx.ts --preload ./happydom.ts src/workspace-sidebar` | **87 pass / 0 fail**（130 expect，3 files，15.5s） | ✓ PASS |
| 改动文件 type gate（9 个 workspace-sidebar 文件 + `en.ts` + `titlebar.tsx`） | `cd packages/app && bun check --no-script <11 files>` | **No type errors in 600 files** | ✓ PASS |
| 改动文件 lint | `bun script/lint-changed.ts upstream/dev` | **0 problem(s) in 0 of 17 changed files** | ✓ PASS |
| 边界（无 server/protocol/core 改动） | `git diff --name-only upstream/dev -- packages/server packages/protocol packages/core` | 空 | ✓ PASS |
| 边界（改动面） | `git diff --name-only upstream/dev -- packages/` | 17 文件：11 个本 phase app 文件 + 6 个 Phase 3 的 desktop/plugin 文件（`349211ff0e`、`2b65f5e5d2`，超出本 phase 范围） | ✓ PASS（见说明） |
| titlebar 接缝 | `git diff --numstat upstream/dev -- … titlebar.tsx` | `2 2` | ✓ PASS |
| 无未使用上游符号 | `rg -n "SidebarOrganized" titlebar.tsx` | 无匹配 | ✓ PASS |
| 债务标记 / 占位 / 危险 API | `rg -n "TBD\|FIXME\|XXX"`、placeholder 文案、`project.update`、`location.get`、`Ungrouped` | 全部空 | ✓ PASS |

**记录在案的浏览器 UAT（2026-11-14，`02-UAT.md`，未在本轮重跑）：**

| Behavior | Evidence | Status |
| -------- | -------- | ------ |
| 真实指针拖拽排序（UX-03 / 真值 10） | UAT #10：CDP 拖拽第 2 行到第 1 行，持久化 `AAA:1 / BBB:0`，刷新保持 | ✓ PASS（recorded） |
| 混合大小写路径的 REG-04 校准（真值 2） | UAT #11：`D:/01-PROJECT/01-KERONG/dsh-mcp-manager` 加载后采纳服务端拼写并归一 | ✓ PASS（recorded） |
| 首屏取全 + 不实时刷新（ROW-06 / 真值 11） | UAT #12：新建会话 3 秒后行内仍 39，刷新后 40 | ✓ PASS（recorded） |

### Probe Execution

N/A — 本 phase 未声明 probe 脚本，仓库也无被本 phase 引用的 `scripts/*/tests/probe-*.sh`。

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ---------- | ----------- | ------ | -------- |
| REG-04 | 02-01/02-02 | 登记后采用服务端 `location.directory` 拼写 | ✓ SATISFIED | `probeSpelling`+`adoptSpelling`+`adoptDirectory`（先归一）；UAT #11 + 5 条单测 |
| ROW-01 | 02-01/02-02 | 行只来自登记表，未登记目录不出现 | ✓ SATISFIED | `visible(entries)` 行源；UAT #1 |
| ROW-02 | 02-01/02-02 | 同一仓库两个目录 = 两行 | ✓ SATISFIED | 每行独立行键 + 独立 `session.list`；UAT #2 |
| ROW-03 | 02-01/02-02 | 行内只含 `directory` 精确相等的会话 | ✓ SATISFIED | `session.list({ directory })` 服务端 `eq(directory)`；UAT #3 |
| ROW-04 | 02-01/02-02 | 无兜底分组；移除后侧栏不可见 | ✓ SATISFIED | 无 fallback 分组代码（grep 空）；UAT #4 |
| ROW-05 | 02-02 | Inbox/命令面板不受登记表影响 | ✓ SATISFIED | Phase 2 提交范围未触碰 inbox/命令面板；UAT #4/#6 |
| ROW-06 | 02-01/02-02 | **修订后**：首屏加载时取全；不做实时刷新 | ✓ SATISFIED | `load` 每行一次 `session.list`；UAT #12（39→40 刷新后体现）。惰性订阅块不计入，见「Accepted Limitations」 |
| UX-01 | 02-01/02-02 | 重命名只写 `title` | ✓ SATISFIED | `withTitle` 单测；无 project 写入；UAT #5 |
| UX-02 | 02-01/02-02 | 移除只写 `removedAt`；重新登记恢复 | ✓ SATISFIED | `remove`/`register` 单测；UAT #6 |
| UX-03 | 02-01/02-02 | 拖拽排序写 `order`；新登记追加末尾 | ✓ SATISFIED | `applyOrder` + `register` order=max+1 单测；UAT #10 真实拖拽 |
| UX-04 | 02-02 | 空态单一动作、不自动建工作区 | ✓ SATISFIED | `sidebar.tsx:199-214`；UAT #7 |
| UX-05 | 02-01/02-02 | 目录不存在 → 可见、不可用、不可展开 | ✓ SATISFIED | `file.list` 探测 + 行级 `unavailable`；UAT #8 |
| PST-01 | 02-01/02-02 | 重启全保持 | ✓ SATISFIED | `persisted()` 唯一调用点 + 文档往返单测；UAT #9 |

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
**说明:** `createEffect` 在 Bun 下为 no-op，事件订阅接线仍无单测；按修订后的 ROW-06，实时刷新已不在验收范围，因此不再作为缺口。

### Decision Coverage

本 phase 目录无 `*-CONTEXT.md`，决策覆盖门不适用（未评估，非“0 决策”）。

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| — | — | 无 `TBD/FIXME/XXX` 债务标记 | — | grep 空 |
| — | — | 无 `createResource` / `location.get(` / `session.apply` / `project.update` / `dangerouslySetInnerHTML` | — | grep 空 |
| — | — | 无 `placeholder` / `coming soon` / `not yet implemented` 占位文案 | — | grep 空 |
| — | — | 无 `Ungrouped` / 未分组兜底分组 | — | grep 空 |

未发现 🛑 Blocker 或 ⚠️ Warning 级反模式。

### Open Review Warnings (non-blocking)

`02-REVIEW.md` 的 1 个 critical + 5 个 warning 逐条复核：

| Finding | 当前状态 | 是否阻断本 phase |
| ------- | -------- | ---------------- |
| CR-01 `session.list` 缺 `archived` | **已修复**：`sessions.ts:175` 传 `archived: false`；首屏刷新后归档会话不进入行（UAT #12 的刷新后行为成立） | 否（已关闭） |
| WR-01 在途响应无 generation guard | 仍存在：移除行时在途 `session.list` 可写回已 `forget` 的 store 记录。渲染只读 `visible(entries)`，ROW-04 的“移除即不可见”不受影响；事件路径按决定已惰性，`renameSession` 竞态在正常交互中不可达 | 否 |
| WR-02 任意 `file.list` 失败都判 unavailable | 仍存在：瞬时 401/5xx 会把有效行标记不可用，直到下一次 load/重连恢复。UX-05 指定的“目录不存在/改名”场景仍正确（UAT #8） | 否 |
| WR-03 `failed` 行无提示、展开不重试（**与修订后判据的关系**） | 仍存在：首屏 `session.list` 失败时行内留白且无法重试。它影响的是**失败路径**，不否定 ROW-06 的“成功首屏取全、无实时刷新”契约（UAT #12 走成功路径）；属错误处理缺口，建议单独跟踪 | 否 |
| WR-04 web 客户端 Windows 主机无法登记 | **已修复**：`sidebar.tsx:75` 改用 `detectHostPlatform(navigator.platform)`（`62fb6cbabb`），UAT #1 在 Windows 浏览器实测 4 播种→4 行 | 否（已关闭） |
| WR-05 `needsAvailabilityProbe` 恒真守卫 | 仍存在：`sessions.ts:186` 的检查在同步写入 `ready` 后恒真，属冗余谓词，不是缺陷 | 否 |
| IN-07 `SidebarOrganized` 死代码 / verticalTabStrip 消失 | 已知：本 phase 挂载替换后该模块仅剩 `createSidebarActivityListener` 被使用；属上游触点收尾（Phase 3）与产品呈现决定 | 否 |
| IN-09 桌面 hydration 前闪现空态 | 仍存在：`rows()` 为空的首帧会渲染空态；不影响“无登记项才显示空态”的最终状态 | 否 |

### Accepted Limitations (recorded, not counted as pass)

1. **事件订阅块是惰性代码。** `sessions.ts:299-347` 的 `createEffect` + `ctx.data.on("session.created"/"archived"/"unarchived"/"deleted"/"renamed")` 在真实 app 中未生效（UAT #12 实测 3 秒无增量；控制台有 “computations created outside a `createRoot` or `render`” 警告）。按 2026-11-14 产品决定，实时刷新已移出 ROW-06，因此**这段代码不作为任何验收证据**。若日后恢复实时刷新，正确改法是在组件 owner 内订阅，而不是修复现有代码。副作用是：归档/删除会话在当前会话期间仍留在行内，刷新后按 `archived:false` 过滤。
2. **每行上限 50 条会话。** `SESSION_LIST_LIMIT = 50`（`sessions.ts:88,172`），没有游标翻页；`REQUIREMENTS.md` 的 v2 `UIX-02` 明确把“真正分页拉取”推迟。UAT #12 的行内数量为 39/40，未验证超过 50 条的目录。本轮按既有设计决定（SPEC：`session.list` 默认 limit 50；UIX-02 延迟）判定 ROW-06 的“首屏取全”为“首屏一次性快照（当前页大小）”，**不是**无限全量。
3. **REG-04 的浏览器可观测性受 SQL 等值过滤限制。** 仅大小写不同的路径查不到会话，`probeSpelling` 学不到拼写；唯一登记入口是系统目录选择器，用户无法手打路径，实际不可达（UAT #11 已记录，不算缺陷）。
4. **设计文档尚未随产品决定更新。** `docs/designs/workspace-registry-sidebar.md` §4/§7 仍描述 `session.created` 增量更新；`REQUIREMENTS.md` 与 `ROADMAP.md` 已改。属文档漂移，不影响代码验收，建议随 Phase 3 收尾同步。

### Human Verification Required

无。UAT 12/12 pass（含上一轮 skipped 的 #10 拖拽、#11 拼写，以及改写后的 #12 首屏快照），自动化门禁本轮全部重跑通过。

### Gaps Summary

无阻断性 gap。所有 must-have 的实体产物存在、实质、被接线；关键链路全部 WIRED；数据流从真实 API / 持久化加载，无 stub、无孤儿、无未接线。本轮重跑的三条门禁（模块单测 **87 pass / 0 fail**、11 个 app 文件 `bun check --no-script` **No type errors in 600 files**、`lint-changed` **0 problem(s)**）全部通过；`packages/server|protocol|core` diff 为空，`titlebar.tsx` 仍为 2/2 接缝。`bun typecheck` 的 `custom-elements.d.ts` 符号链接缺陷按约定未计分。

ROW-06 的产品修订是本轮复验的关键：实时刷新不再被承诺，验收改为“首屏加载时取全 + 刷新后体现”。UAT #12 用真实后端与 CDP 观测（39→40）覆盖了该行为；`sessions.ts` 的订阅块是惰性代码，已在「Accepted Limitations」中显式记录，**没有**被当作实时更新通过的证据。上一轮的三条人工项（拖拽、REG-04 浏览器观测、事件刷新）现已分别由 UAT #10、#11、#12 关闭或撤销。

---

_Verified: 2026-11-14T04:09:50Z_
_Verifier: the agent (gsd-verifier)_
