---
phase: 01-registry-model
verified: 2026-11-13T16:44:41Z
status: passed
score: 6/6 must-haves verified
covered_files:
  - .planning/phases/01-registry-model/01-PLAN.md
  - .planning/phases/01-registry-model/01-SUMMARY.md
  - packages/app/src/workspace-sidebar/registry.test.ts
  - packages/app/src/workspace-sidebar/registry.ts
covered_digest: "v4:sha256:24dcbe9366be778da9328ddf3e3ae526b6d20840d46649807293c66d2eded85d"
behavior_unverified: 0
overrides_applied: 0
---

# Phase 01: 登记表数据模型与纯函数 Verification Report

**Phase Goal:** 把「哪些本地文件夹是工作区」变成可单测的唯一真相——一个零 I/O 纯模块，以归一后的绝对路径为主键，负责认领/复用、移除/恢复、order 与默认标题，并声明按 server 隔离的持久化形状。
**Verified:** 2026-11-13T16:44:41Z
**Status:** passed
**Re-verification:** No — initial verification（本目录此前没有 VERIFICATION.md）

## 判定摘要

`passed`。5 条 ROADMAP 成功标准 + 计划额外钉住的 `hostPlatform` 映射，共 6 条 must-have 全部由代码与独立复跑的测试证明；4 条门禁（目标单测、文件级 type gate、lint-changed、越界 diff）全部亲自执行通过。没有 FAILED / UNCERTAIN 项，也不需要人工验证（纯模块、无 UI、无网络、无真实时钟依赖）。审查遗留的 WR-03 与 REVIEW 的 Info 项属非阻塞观察，其中 WR-03 已按设计归属 Phase 2 的 REG-04。

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | 归一契约逐条可断言：`\`→`/`、折叠重复分隔符、去尾、win32 盘符大写且盘符根保留 `C:/`；仅有 win32 应用 Windows 规则，linux/darwin 保留 `\`；同一路径不同写法归一为同一主键 | ✓ VERIFIED | `registry.test.ts:87-109` 表驱动 17 行（win32 含 `D:\code\app\`、`D:/a//b/`、`c:/x`、`c:/`、`C:`、`C:\`、UNC `\\server\share\x\`、`/a\b`；linux 含 `C:` 原样、`/a\b` 保留、`/`；darwin 同 POSIX）；`directoryKey` 4 条（win32 不敏感、linux/darwin 敏感、POSIX 反斜杠不折叠、win32 折叠）。实现见 `registry.ts:59-83`（`platform === "win32"` 才做 `replaceAll`/`upperDrive`/盘符根修复）。独立复跑 48 pass / 0 fail |
| 2 | 重复登记（含已移除）复用既有记录：不产生第二行、清 `removedAt`、保留 `title`/`order`；两个 serverScope 的存储 key 不同、登记互不可见 | ✓ VERIFIED | `registry.test.ts:26-38`（长度 1、`entry` 即该记录、`removedAt` undefined、title/order/createdAt 保留、directory 仍是首次 `D:/code/app`）、`:40-47`（可见记录复用返回同一 `entries` 引用）；`registry.ts:107-131`。跨 scope 归 `storage.test.ts:59-65`（local key = `notification`，远端 = `scope\0notification`）与 `:67-69`（scope/key 含冒号不碰撞），独立复跑 6 pass / 0 fail；`registry.ts:34-36` 把 `scope` 原样交给 `Persist.serverGlobal`，未做任何 key 拼接 |
| 3 | 移除只写 `removedAt`，记录不删除；无 `fs` / 无 `location.get` / 无 project 写入；再登记回到原名原序 | ✓ VERIFIED | `registry.test.ts:151-200`（只写时间戳、长度不变、重复移除保留首个时间戳并返回同一引用、未登记目录无操作）；`registry.ts:134-145` 只 `map` 写 `removedAt`；`registry.ts:1-5` import 仅 `effect`/`Platform`/`Persistence`/`Persist`/`ServerScope`，全文只有两处 `Date.now()`（`:127`、`:142`），无 `fs`、无 `location`、无 `session`、无 `project`、无 `fetch`/`localStorage`/`await` |
| 4 | 新登记追加 `order` 末尾（含已移除项的比较基准）；默认标题取目录最后一段（根取 `/` 或盘符 `C:`）；用户改名后不再跟随目录名 | ✓ VERIFIED | `registry.test.ts:58-70`（已有 0 与 5、5 已移除 → 新项 6）；`registry.ts:126` `max(existing + 1)`；`registry.test.ts:140-149`（`/`→`/`、`C:/`→`C:`、`D:/code/app`→`app`、`//server/share`→`share`）；`registry.ts:100-105`；`:190-200` 用手工 `title: "Renamed"` 的 fixture 证明再登记保留 `Renamed` 与原 `order: 2` |
| 5 | 持久化 key 落在 `Persist.serverGlobal(serverScope, "workspace-registry.v1")`；`packages/server`、`packages/protocol`、`packages/core` diff 为空（无迁移、无端点） | ✓ VERIFIED | `registry.ts:9,34-36`（`REGISTRY_KEY` + `Persist.serverGlobal(scope, REGISTRY_KEY)`）；`registry.test.ts:236-238` 断言 `registryTarget(ServerScope.local).key === "workspace-registry.v1"`；`git diff --name-only upstream/dev -- packages/server packages/protocol packages/core` 输出为空；`git diff --stat upstream/dev -- packages/` 仅 `registry.ts`（+170）与 `registry.test.ts`（+239），`2 files changed, 409 insertions(+), 0 deletions` |
| 6 | （计划追加）`hostPlatform` 是宿主 OS 的唯一映射：macos→darwin、windows→win32、linux→linux、undefined（Web）→linux，且生产代码没有第二份映射 | ✓ VERIFIED | `registry.test.ts:129-138` 表驱动四行；`registry.ts:43-49` 是唯一映射函数；全文件再无 `"macos"`/`"windows"` 字符串 |

**Score:** 6/6 truths verified（0 present-but-behavior-unverified）

> 说明：第 1-5 条是 ROADMAP 的权威成功标准，第 6 条来自 `01-PLAN.md` 的 `must_haves.truths`（计划只做加法）。计划的其余 truth 已被以上 1-5 覆盖，没有缩减 ROADMAP 范围。

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/app/src/workspace-sidebar/registry.ts` | 归一、认领/复用、移除/恢复、order、默认标题、`hostPlatform`、按 server 的持久化目标 | ✓ VERIFIED | 170 行；导出 `HostPlatform`/`REGISTRY_KEY`/两个 schema/`initialRegistry`/`registryTarget`/`hostPlatform`/`normalizeDirectory`/`directoryKey`/`defaultTitle`/`register`/`remove`/`visible`；无 stub、无占位返回；生产签名无 `now`/`delay`/`budget` 参数 |
| `packages/app/src/workspace-sidebar/registry.test.ts` | 上述全部契约的唯一 owner（每条用例实现前失败） | ✓ VERIFIED | 239 行、48 tests / 68 expect；期望值全部是硬编码字面量（不从被测代码推导），26 是删除行之外的纯新增 |

**接线状态说明：** `registry.test.ts` → `registry.ts` 已接线（`:4-17` import，48 用例执行）。`registry.ts` 目前没有生产消费者——这是计划明确的范围边界（`01-PLAN.md:201`「不要把 `persisted(...)` 的调用搬进本模块：Phase 2 在自己的组件里调用」），不是遗漏；因此记为「模块已交付、消费者按计划在 Phase 2」，不视为 ORPHANED gap。

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| `registry.ts` | `src/runtime/persistence/storage.ts` | `Persist.serverGlobal(scope, "workspace-registry.v1")` | ✓ WIRED | `registry.ts:34-36` 是纯转调；`Persist.serverGlobal` 在 `storage.ts:456-460`；其 key 组成由 `storage.test.ts:59-69` 拥有并独立复跑通过（6 pass） |
| `registry.test.ts` | `registry.ts` | 归一矩阵 / hostPlatform 表 / 复用 / 移除/恢复 / order / 默认标题 / 持久化 key 字面量 | ✓ WIRED | `registry.test.ts:4-17`；48 pass / 0 fail |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| `registry.ts`（纯模块） | `entries` / `document` | 调用方传入的 `WorkspaceEntry[]` + `Schema` 编解码 | N/A（无渲染、无 fetch、无 DB） | ✓ N/A |

本阶段没有渲染任何动态数据：模块的每条输出都可以在测试里从输入直接推导。持久化文档形状由 `registry.test.ts:215-234` 的 `Schema.encodeSync` → `Schema.decodeUnknownSync` 往返证明（保留 `entries`/`scrollTop`，无 `removedAt` 的记录编码后不带该键）。`persisted()` 的实际序列化路径也已核对：`storage.ts:543-552` 使用 `Schema.fromJsonString` 的 encode，`undefined` 属性在 JSON 序列化时被丢弃。

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| 登记表全部契约 | `cd packages/app && bun test --conditions=solid --isolate --preload ../ui/test/solid-jsx.ts --preload ./happydom.ts src/workspace-sidebar` | `48 pass / 0 fail / 68 expect() calls` | ✓ PASS |
| 文件级类型门 | `cd packages/app && bun check --no-script src/workspace-sidebar/registry.ts src/workspace-sidebar/registry.test.ts` | `No type errors in 238 files`（exit 0） | ✓ PASS |
| 改动文件 lint | `bun script/lint-changed.ts`（仓库根） | `0 problem(s) in 0 of 2 changed files`（exit 0） | ✓ PASS |
| 越界 diff | `git diff --name-only upstream/dev -- packages/` | 仅 `packages/app/src/workspace-sidebar/registry.test.ts`、`registry.ts` | ✓ PASS |
| 依赖/配置未动 | `git diff --name-only upstream/dev -- '**/package.json' 'bun.lock*' '**/tsconfig*.json'` | 空 | ✓ PASS |
| 被委托的跨 scope owner | `cd packages/app && bun test ... src/runtime/persistence/storage.test.ts` | `6 pass / 0 fail / 20 expect() calls` | ✓ PASS |

### Probe Execution

本阶段未声明任何 probe，也不是迁移/工具阶段，`scripts/*/tests/probe-*.sh` 不适用于纯模型模块。SKIPPED（无 probe 可跑）。

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| REG-01 | `01-PLAN.md` | 可把一个本地文件夹登记为工作区；同一目录重复登记静默复用既有记录（含已移除），不产生第二行 | ✓ SATISFIED（模型层） | `register` + `registry.test.ts:26-47`。用户入口（「添加本地文件夹」）按路线图属 Phase 2 的 UX-04；本 phase 交付的是行源唯一真相，与 Phase Goal 一致 |
| REG-02 | `01-PLAN.md` | 持久化 `{ directory, title, order, createdAt, removedAt? }`，键为归一后的绝对路径；不新增迁移/端点 | ✓ SATISFIED | `WorkspaceEntrySchema`（`registry.ts:11-17`）；`registrable` 保证绝对路径（`:91-97`）；server/protocol/core diff 为空 |
| REG-03 | `01-PLAN.md` | 分隔符统一、去尾、Windows 盘符/大小写不敏感比较；符号链接别名限制显式记录 | ✓ SATISFIED | 归一矩阵 + `directoryKey`；`registry.ts:51-58` 注释记录 symlink/8.3 别名残余（IN-05 的 `.`/`..`、长路径前缀未被列入，属非阻塞文档缺口） |
| PST-02 | `01-PLAN.md` | 状态存 `Persist.serverGlobal(serverScope, "workspace-registry.v1")`，不同 server 互不干扰 | ✓ SATISFIED | `registryTarget` + key 字面量断言；跨 scope 由 `storage.test.ts:59-69` 拥有并通过 |

`REQUIREMENTS.md` 中映射到 Phase 1 的 ID 恰好是这 4 个，无 ORPHANED 需求；REG-04、ROW-*、UX-*、PST-01 归 Phase 2，SYNC-* 归 Phase 3，与本 plan 的 `requirements` 字段一致。

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| — | — | `TBD` / `FIXME` / `XXX` / `TODO` / `HACK` / `PLACEHOLDER` | — | 两个文件均无匹配 |
| — | — | 空实现（`return null` / `return {}` / 空 handler）/ `console.log` 实现 | — | 无匹配；`initialRegistry` 的 `entries: []` 是持久化初值，不是 stub |

未发现 blocker 或 warning 级 anti-pattern。

### 安全性判断（按任务要求明确表态）

`01-SECURITY.md` 以 **ASVS L1（grep/读码深度）自建、未 spawn 独立审计员**。对**本阶段这个零 I/O 纯模块**，L1 是**充分的**：攻击面只有「外部路径字符串」和「持久化 JSON 文档」，模块不读目录、不发请求、不新增依赖、不新增服务端面，注入/认证/会话类风险不存在；威胁表实际覆盖了持久化文档篡改（schema 逐条恢复）、空/相对路径伪造主键（`registrable()`，且有 5 条先红后绿回归）、跨平台键碰撞（平台分支，4 条回归）、跨 server 串表（委托 owner 测试）、DoS（接受）与供应链（diff 为空）。残余说明：`threats_open: 0` 的正确含义是「L1 深度未发现需阻断项」，不是独立审计结论；`01-SECURITY.md` 的 T-01-04 把验证责任委托给 `storage.test.ts`，本次确认该测试确实存在、确实覆盖该机制并通过。

**但有一处来源说明不实：** `01-SECURITY.md:14` 称「本阶段的 `01-PLAN.md` 没有 `<threat_model>` 块（planner 未写）」。实际 `01-PLAN.md:225-241` 一直带有 `<threat_model>`（`git show 8488e1955f:.planning/phases/01-registry-model/01-PLAN.md` 可证，且该文件只有这一个提交）。这不影响本阶段目标达成或威胁覆盖（SECURITY 的注册表事实上更完整，并吸收了 WR-01/WR-02），但建议更正来源说明并把 PLAN 的 T-01-01..03/T-01-SC 与 SECURITY 的编号做一次显式对应，否则后来者会以为 planner 漏写了威胁模型。

### 证据局限与非阻塞观察（不改变判定）

1. **RED 未留存：** 成功标准里的「实现前失败」无法从代码库回溯证明——每个任务提交（`147e80e408`、`0a1a08a7dc`、`281ba0a770`）都同时包含测试与实现，没有保留 RED 运行输出。可确认的替代证据：期望值全部是硬编码字面量（实现无关），且 WR-01/WR-02 的 9 条回归用例在修复提交（`77266b8e7e`、`84065d5195`）中被记录为先红后绿。因此按「契约可断言且逐条通过」判定 VERIFIED，并如实记录 TDD 顺序依赖执行者自述。
2. **`registryTarget` 的 scope 传参没有回归测试：** 现有断言只覆盖 `ServerScope.local`；若把实现改成 `Persist.global(REGISTRY_KEY)`（忽略 scope），本阶段 48 条与 `storage.test.ts` 全部仍会通过。当前代码是正确的（`:35` 原样传 `scope`），跨 scope 机制也已被 owner 测试钉住，故不判 gap；建议 Phase 2 挂载时补一句 `expect(registryTarget(remote).key).not.toBe(registryTarget(local).key)` 或由 Phase 2 的持久化挂载测试覆盖。
3. **REVIEW 的 Info 项未处理（均非阻塞）：** IN-02 恢复项保留 own `removedAt: undefined` 键——不影响持久化字节（`persisted` 走 `fromJsonString` encode，JSON 丢弃 `undefined`；`storage.ts:543-552` 已核对），仅是内存形状差异；IN-04 `visible` 的输入不变性未被断言（实现是 `filter` 后 `sort`，不会改入参）；IN-05 `.`/`..` 段与 Windows 长路径前缀未写入残余注释；IN-03 `REGISTRY_KEY` 导出无消费者。
4. **WR-03 的交接已确认：** 客户端盘符大写与服务端 `session.list` 的精确等值拼写可能不一致，属 REG-04，`REQUIREMENTS.md` 已明确映射到 Phase 2，`01-SECURITY.md:71` 也已记录；不是本阶段 gap。
5. **整包 `bun typecheck`** 因 `packages/app/src/custom-elements.d.ts` 符号链接在本机被物化为文本而失败（`core.symlinks=false`），与本阶段无关，按要求不计分；文件级 gate 0 诊断。

### Human Verification Required

无。本阶段交付物是一个零 I/O 纯模块 + 其单测，所有可观察行为都由自动化用例覆盖（时间用 `setSystemTime` 固定），没有视觉、实时、外部服务或 UX 流程需要人工确认。

### Gaps Summary

无 gap。Phase Goal 在代码库中成立：归一后的绝对路径是唯一主键；重复登记（含已移除）复用既有记录；移除只写 `removedAt`；`order` 追加末尾；默认标题与改名语义正确；持久化落在按 server scope 隔离的 `workspace-registry.v1`；`packages/server`/`protocol`/`core` 零改动。唯一的非阻塞事项是文档准确性与测试密度层面的建议（见上「证据局限与非阻塞观察」）。

---

_Verified: 2026-11-13T16:44:41Z_
_Verifier: the agent (gsd-verifier)_
