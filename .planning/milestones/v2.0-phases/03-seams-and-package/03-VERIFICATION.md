---
phase: 03-seams-and-package
verified: 2026-11-14T10:18:12Z
status: gaps_found
score: 2/4 must-haves verified
covered_files:
  - ".planning/phases/03-seams-and-package/03-PLAN.md"
  - ".planning/phases/03-seams-and-package/03-SUMMARY.md"
  - "docs/designs/workspace-registry-sidebar.md"
  - "packages/desktop/electron-builder.config.ts"
  - "packages/desktop/electron.vite.config.ts"
  - "packages/desktop/src/main/constants.ts"
  - "packages/desktop/src/main/service/cli-version.ts"
  - "packages/plugin/src/gui/core.ts"
covered_digest: "v4:sha256:2c21a7f224c728094bd29696044bd1ea2d472e3858f8924f414652ed0dd71612"
behavior_unverified: 0
overrides_applied: 0
gaps:
  - truth: "OPENCODE_CHANNEL=fork 的四条隔离成立（appId / service 注册文件 / 端口 / 数据库），可与官方安装同时运行而互不顶替。"
    status: failed
    reason: "fork 渠道只在两处常量表与两处字面量联合里登记，打包链路没有任何一处真正产出 fork 身份：electron.vite.config.ts 的 resolveChannel 不认识 fork（产物里 CHANNEL 被折成 dev，APP_NAME/APP_ID 为 dev）；electron-builder.config.ts 的 getConfig() 没有 fork 分支（返回 undefined，pack 在配置校验阶段失败）；捆绑进产物的 CLI 二进制 channel 是 dev（service.json / 0xC0DE / opencode.db 与官方共用）；CLI 版本文件又与二进制自报值不一致（后台服务会被反复 replace）。四条互相独立，任何一条都足以否定 SC3。"
    artifacts:
      - path: "packages/desktop/electron.vite.config.ts"
        issue: "resolveChannel() 只接受 local|dev|beta|prod，fork 落到默认值 dev；这是主进程 CHANNEL/APP_NAME/APP_ID 的唯一来源，产物实测被折叠为 appNames.dev。"
      - path: "packages/desktop/electron-builder.config.ts"
        issue: "resolveChannel() 与 APP_IDS 加了 fork，但 getConfig() 的 switch 没有 case \"fork\" 也没有 default，返回 undefined；electron-builder 经 jiti 取到的是模块对象（bun 探针键集 {default, getConfig}；编排记录的报错为 __esModule/getConfig），在 Configuration schema 校验处报 unknown property。"
      - path: "packages/desktop/resources/opencode-cli.exe"
        issue: "与 packages/cli/dist/cli-windows-x64-baseline/bin/opencode.exe 同哈希，版本串 0.0.0-dev-202611120134 → 编译期 channel=dev；运行时 service 文件名、端口、数据库全由该 CLI 的编译期 channel 决定。"
      - path: "packages/desktop/resources/opencode-cli.version"
        issue: "文件写 2.2.7，而同一目录的二进制 `--version` 自报 `0.0.0-dev-202611120134`。桌面端信任该文件（`desktop-cli.ts:107-119`），把 2.2.7 传给 `Service.ensure`；`decide()` 用精确相等比较注册版本（`matchesVersion`），于是每个新起的服务都被判为 version-mismatch 并 replace，直至 'Timed out waiting for the background service to start'——正是 docs/designs/build-desktop.md 第 51 行描述的失败。"
    missing:
      - "在 packages/desktop/electron.vite.config.ts 的 resolveChannel() 接受 fork，并补一条 packaging/identity 契约测试（见 electron-builder.config.test.ts 的 channels 表）。"
      - "在 packages/desktop/electron-builder.config.ts 的 getConfig() 增加 fork 分支（appId/productName/publish/deb/rpm 等），并同步处理 script/pack.ts:68 的 getConfig().publish（fork 下目前会 TypeError）。"
      - "用 OPENCODE_CHANNEL=fork 重新构建包内的 CLI（当前 docs/designs/build-desktop.md 第 1 坑的绕过方式是复制官方安装的 CLI，这直接导致 service.json/0xC0DE/opencode.db 与官方共用），或用等价的显式渠道注入方式让捆绑 CLI 的 channel 为 fork。"
      - "让 resources/opencode-cli.version 与二进制的 `--version` 完全一致（2.2.7 → 实际自报值），再重新出包；否则后台服务会反复被 replace。"
      - "重新出包后按 docs/designs/workspace-registry-sidebar.md §10.4 的四条命令实测隔离。"
  - truth: "merge 演练给出可复核结论，并说明当前是否可作预算证据；lint-changed 0 problem。"
    status: failed
    reason: "merge 演练部分成立（§12.4 有结论且明确说明不构成预算证据，实测 upstream/dev 是祖先、0 领先），但 lint-changed 未达 0 problem：2 个 anti-slop(no-known-value-widening) 命中。"
    artifacts:
      - path: "packages/desktop/src/main/constants.ts"
        issue: "第 15 行 appNames、第 22 行 appIDs 的显式 Record<string, string> 注解触发 anti-slop(no-known-value-widening)；这是上游既有写法，但本阶段触碰了该文件，lint-changed 因此把它算进改动集。"
    missing:
      - "用 satisfies / 推断替代 open dictionary 注解，重跑 bun script/lint-changed.ts upstream/dev 至 0 problem。"
audit_acknowledged:
  milestone: v2.1
  at: 2026-11-17
  status: gaps_found
---

# Phase 3: 上游触点收敛与打包隔离 Verification Report

**Phase Goal:** 把 v2.0 的产物收口成可与官方安装并存的 fork 构建——登记 fork 渠道身份、验证隔离、给出可复核的 merge 预算。
**Verified:** 2026-11-14T10:18:12Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `git diff --stat upstream/dev` 只剩承诺的触点；`packages/app` 的上游文件只有 `en.ts` 与 `titlebar.tsx`，且没有缩进重排块 | ✓ VERIFIED | `git diff --numstat upstream/dev -- packages` 15 条：`en.ts +13/−0`、`titlebar.tsx +2/−2`、`workspace-sidebar/*` 9 个新增、desktop 3 个、plugin 1 个；`git diff --name-status upstream/dev -- packages/app` 只有 2 个 `M` + 9 个 `A`；titlebar 的 diff 仅 import 与挂载两行，无重排 hunk |
| 2 | v1.0 的会话派生行源（`inbox-model.ts`、`session-index.ts`、`projects-*`、`perf/session-index*`）在本分支上不存在，回退是空操作 | ✓ VERIFIED | 这些路径在 `upstream/dev` 与 `HEAD` 都存在且 `git diff --stat upstream/dev -- <paths>` 为空；`perf/session-index*` 两边都不存在；本分支没有任何 fork 侧的派生行源 diff，回退确实是空操作（见下方 W-2 对 SUMMARY 措辞的更正） |
| 3 | `OPENCODE_CHANNEL=fork` 的四条隔离成立（appId / service 注册文件 / 端口 / 数据库），可与官方安装同时运行而互不顶替 | ✗ FAILED | 产物 `out/main/index.js` 中 `APP_NAME/APP_ID` 被折叠为 `j.dev`/`ue.dev`；`getConfig()` 在 fork 下返回 `undefined`；捆绑 CLI 的编译期 channel 为 `dev`（`0.0.0-dev-202611120134`）。详见 Gaps G-1 与 Data-Flow |
| 4 | merge 演练给出可复核结论，并说明当前是否可作预算证据；`lint-changed` 0 problem | ✗ FAILED | merge 部分成立：§12.4 有"不构成预算证据"判断，`rev-list` 实测 `0 30`、`merge-base --is-ancestor` 退出码 0（祖先）。lint 部分失败：`bun script/lint-changed.ts upstream/dev` → 2 problem(s)，退出码 1 |

**Score:** 2/4 truths verified (0 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/desktop/src/main/constants.ts` | `Channel` 联合、`CHANNEL`、`appNames`、`appIDs` 含 fork | ✓ VERIFIED（表层） | 四处 additive 齐全；但 `APP_NAME/APP_ID` 在产物里解析为 dev（见 Data-Flow），该文件本身不是 fork 身份的充分条件 |
| `packages/desktop/electron-builder.config.ts` | `resolveChannel` 与 `APP_IDS` 接受 fork | ⚠️ PARTIAL | 两处已接受 fork，但 `getConfig()` 没有 fork 分支 → 对 fork 返回 `undefined`；`script/pack.ts:68` 的 `getConfig().publish` 在 fork 下会抛 TypeError |
| `packages/desktop/src/main/service/cli-version.ts` | `serviceVersion` 的 channel 联合含 fork | ✓ VERIFIED | 字面量联合加 `fork`，无行为分支改动 |
| `packages/plugin/src/gui/core.ts` | 插件 `App.channel` 联合含 fork | ✓ VERIFIED | 纯 additive，一处字面量 |
| `docs/designs/workspace-registry-sidebar.md` | §7.5 触点、§12.4 本分支实测与证据判断 | ✓ VERIFIED | 两节均存在；§12.4 明确"不构成预算证据"（数字有轻微过期，见 W-3） |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `packages/desktop/src/main/constants.ts` | `packages/cli/src/services/service-config.ts` | CHANNEL 决定 service 文件名与默认端口 | ✗ NOT_WIRED | 桌面端 `CHANNEL` 在产物中被 `electron.vite.config.ts` 的 `resolveChannel()` 折成 `dev`；即使不折，运行时文件名/端口也由捆绑 CLI 的编译期 channel 决定，而该 CLI 是 `dev` |
| `packages/desktop/src/main/constants.ts` | `packages/cli/src/database-path.ts` | 自定义 channel 得到 `opencode-fork.db` | ✗ NOT_WIRED | 同上：`databasePath()` 读的是 CLI 的 `OPENCODE_CHANNEL` 编译期常量；捆绑 CLI 为 `dev` → `opencode.db` |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|-------------------|--------|
| `out/main/index.js` | `APP_NAME` / `APP_ID` | `import.meta.env.OPENCODE_CHANNEL` ← `electron.vite.config.ts:resolveChannel()` | 否；fork 落到 `"dev"`，产物实测 `M=g.isPackaged?j.dev:...`、`N=g.isPackaged?ue.dev:...` | ⚠️ HOLLOW |
| 后台服务注册 | service 文件名 / 端口 | 捆绑 CLI 的 `OPENCODE_CHANNEL` 编译期常量 | 否；二进制版本串为 `0.0.0-dev-202611120134`，`filename("dev")="service.json"`、端口 `0xC0DE` | ✗ DISCONNECTED |
| 数据库 | `databasePath()` | 同上 | 否；`dev` 走 `opencode.db`，不是 `opencode-fork.db` | ✗ DISCONNECTED |

直接探针（各自独立进程）：

```text
getConfig(): dev  → object  appId=ai.opencode.desktop.dev
getConfig(): fork → undefined
jiti.import(config, {default:true}): dev  → Configuration 对象（16 个键）
jiti.import(config, {default:true}): fork → { default: undefined, getConfig: fn }
filename("fork") → service-fork.json; defaultPort("fork","linux") → 40986; defaultPort("fork","win32") → 28698
```

即：`filename`/`defaultPort` 的纯函数对 `fork` 的取值确实隔离，但打包与运行时没有任何一处把 `fork` 送进这两个函数。

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| 打包配置对 dev 可用 | `OPENCODE_CHANNEL=dev` 独立进程调用 `getConfig()` | object，`appId=ai.opencode.desktop.dev` | ✓ PASS |
| 打包配置对 fork 可用 | `OPENCODE_CHANNEL=fork` 独立进程调用 `getConfig()` | `undefined` | ✗ FAIL |
| electron-builder 实际加载路径 | 用 electron-builder 自带的 jiti `import(config,{default:true})` | dev → Configuration；fork → `["default","getConfig"]` 模块对象 | ✗ FAIL（fork） |
| fork 的 service/port 取值 | 直接调用 `service-config.ts` | `service-fork.json` / 40986 / 28698 | ✓ PASS（纯函数层） |
| 捆绑 CLI 的渠道 | 扫描 `packages/cli/dist/.../opencode.exe` | `0.0.0-dev-202611120134` ×3；无 fork 串；与 `resources/opencode-cli.exe` 同哈希 | ✗ FAIL（dev） |
| CLI 版本文件与二进制一致 | `Get-Content resources/opencode-cli.version`；`resources/opencode-cli.exe --version` | 文件 `2.2.7`；二进制 `opencode v0.0.0-dev-202611120134` | ✗ FAIL（版本不一致） |
| 产物主进程渠道 | 扫描 `out/main/index.js` | `j={dev,beta,prod,fork}` 表存在，但 `APP_NAME=appNames.dev` | ✗ FAIL（fork 身份未生效） |
| 桌面端类型检查 | `cd packages/desktop && bunx tsc --noEmit -p tsconfig.json` | 无输出，退出 0 | ✓ PASS |
| 改动文件 lint | `bun script/lint-changed.ts upstream/dev` | `constants.ts:15/22 anti-slop(no-known-value-widening)`，2 problem(s)，退出 1 | ✗ FAIL |
| merge 演练前提 | `git rev-list --left-right --count upstream/dev...HEAD` / `git merge-base --is-ancestor upstream/dev HEAD` | `0 30` / 退出 0（祖先） | ✓ PASS（但不是预算证据） |
| merge-tree | `git merge-tree --write-tree --name-only upstream/dev HEAD` | `4a7a75c5…`，无冲突行 | ✓ PASS（祖先前提下无信息量） |

### Probe Execution

N/A — 本阶段未声明 probe 脚本，无 `scripts/*/tests/probe-*.sh`。

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| SYNC-01 | 03-PLAN | 触点收敛；`titlebar.tsx` 重排消除 | ✓ SATISFIED（按 ROADMAP SC1 措辞） | 见 Truth 1；原始"≤5 文件 / 约 10 行新增 / 0 删除"的量化合同已被超出（6 个修改文件 / +27 / −7），见 W-6 |
| SYNC-02 | 03-PLAN | v1.0 会话派生行源回退为空操作 | ✓ SATISFIED | 见 Truth 2 |
| SYNC-03 | 03-PLAN | `OPENCODE_CHANNEL=fork` 四条隔离、可与官方并存 | ✗ BLOCKED | 见 Gaps G-1 |

### Test Quality Audit

| Test File | Linked Req | Active | Skipped | Circular | Assertion Level | Verdict |
|-----------|-----------|--------|---------|----------|-----------------|---------|
| `packages/desktop/electron-builder.config.test.ts` | SYNC-03（间接） | 有 | 0 | 无 | Value | ⚠️ 渠道表只有 `dev/beta/prod`，没有 `fork` 行；`packages/desktop/AGENTS.md` 要求打包契约按渠道成表 |

**Disabled tests on requirements:** 0
**Circular patterns detected:** 0
**Insufficient assertions:** 0（SYNC-03 是根本没有对应的 fork 契约测试，属于覆盖缺口而非断言强度问题）

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `packages/desktop/src/main/constants.ts` | 15, 22 | `anti-slop(no-known-value-widening)`：显式 `Record<string, string>` 字典注解 | 🛑 Blocker（针对 SC4 的 0-problem 门） | 上游既有写法，本阶段触碰文件后被计入改动集；需改成 `satisfies`/推断 |
| `03-SUMMARY.md` / `03-UAT.md` | — | 结论与产物不符（"已烘焙 fork 身份"、"`packages/desktop/dist/win-unpacked` 存在"） | ⚠️ Warning | 见 W-1；不参与计分，但下游会据此误判 |

无 `TBD`/`FIXME`/`XXX`，无空实现/占位返回。

### Warnings（不改变 gaps_found 判定）

- **W-1 产物陈述不实。** SUMMARY 称"产物内已烘焙 fork 身份：`out/main/index.js` 中 `ai.opencode.desktop.fork` 与 `OpenCode Fork` 各出现 1 次"——这两个串只是 `appNames`/`appIDs` 表的表项；同一文件里 `APP_NAME/APP_ID` 已由打包器折叠为 `j.dev`/`ue.dev`。UAT #3 据此记 pass 不成立。UAT #5 的 `packages/desktop/dist/win-unpacked` 路径也不存在（`Test-Path packages/desktop/dist` → False）；`script/pack.ts` 的输出根是仓库根的 `dist/desktop`，该目录当前为空，时间戳 10:12:20 与本轮 pack 失败一致。
- **W-2 SYNC-02 措辞。** 三个文件名在 `upstream/dev` 与 `HEAD` 都存在（`runtime/server/session-index.ts`、`shell/titlebar/inbox-model.ts`、`shell/titlebar/project-session-row.tsx`），零 diff。SUMMARY 说"从未存在"不准确；正确的表述是"本分支没有任何 fork 侧改动，回退是空操作"。
- **W-3 §12.4 数字过期。** 文档写 `0 29`，现值 `0 30`；`merge-tree` 树哈希写 `c3c93bcd…`，实测 `4a7a75c5…`；`constants.ts` 写 `+8/−3`，实测 `+8/−2`。判断（不构成预算证据）不受影响。
- **W-4 安全台账前提不成立。** `03-SECURITY.md` 的 T-03-01（顶替官方后台服务）以"fork 得到 `service-fork.json` 与非 `0xC0DE` 端口"闭环；但捆绑 CLI 的 channel 是 `dev`，闭环前提在运行时不存在。
- **W-5 类型检查范围。** `packages/desktop/tsconfig.json` 的 `include` 只有 `["src","perf","package.json"]`，不覆盖 `electron-builder.config.ts` 与 `script/**`；计划里的 `tsc` 门因此永远看不到 `getConfig()` 返回 `undefined` 这个问题。
- **W-6 SYNC-01 原始量化合同。** REQUIREMENTS 写"≤5 个文件 / 约 10 行新增 / 0 删除"；实际 6 个修改文件、+27/−7（`en.ts` 单文件 +13）。按 ROADMAP 的 SC1 措辞（承诺触点、`en.ts`+`titlebar.tsx`、无重排）判定通过，但需求文本本身已不成立。
- **W-7 CLI 版本文件与二进制不一致。** `packages/desktop/resources/opencode-cli.version` 为 `2.2.7`，同目录二进制自报 `0.0.0-dev-202611120134`。`packages/desktop/script/utils.ts:107-120` 直接把 `package.json` 的版本写进该文件、从不启动二进制核对；`desktop-cli.ts` 信任它，`decide()`（`packages/client/src/service-probe.ts:22-24`）用精确相等比较注册版本，因此打包后的后台服务会被反复 replace。该问题与 G-1 同属"fork 不可运行"，修复方式已列入 G-1 的 `missing`。

### Human Verification Required

N/A — 本阶段是打包/构建基础设施，无用户可直接观察的界面或交互。SC3 中"可与官方同时运行"是运行时行为，但当前**没有可运行的构建产物**，它是缺口（G-1）而不是待人工确认项。

### Gaps Summary

阶段交付了 4 处 additive 的渠道登记、一次 `out/` 构建、一份判断正确的 merge 预算说明；但"fork 构建"的吹口（packaging seam）没有接通：

1. **打包器不认 fork**（`electron.vite.config.ts`）：主进程 `CHANNEL` 在产物里被折成 `dev`，`APP_NAME/APP_ID` 也是 dev。这是"fork 身份"是否生效的唯一开关，计划与 SUMMARY 都漏掉了这个文件。
2. **electron-builder 配置对 fork 为空**：`getConfig()` 缺 `case "fork"`，返回 `undefined`；`jiti.import` 取到 `{default, getConfig}`，schema 校验报 unknown property。该失败是**本阶段引入的**，不是预置工具链缺陷：同一探针下 `dev`/`prod` 返回合法 Configuration，只有 `fork` 返回 `undefined`；改动前的 `resolveChannel("fork")` 会回落 `"dev"` 并返回合法配置。`script/pack.ts:68` 的 `getConfig().publish` 是同一根因的第二处爆点。因此 NSIS 未产出、`dist/desktop` 为空都可以归因到本阶段的改动。
3. **捆绑 CLI 的 channel 是 dev**：运行时 service 文件名、端口、数据库都由该二进制的编译期 `OPENCODE_CHANNEL` 决定，`docs/designs/build-desktop.md` 第 1 坑的绕过方式（复制官方安装的 CLI）使 `service.json` / `0xC0DE` / `opencode.db` 与官方共用——正是 SC3 要防的"互不顶替"。
4. **CLI 版本文件与二进制不一致**：`opencode-cli.version` 写 2.2.7，二进制自报 `0.0.0-dev-202611120134`；桌面端按精确匹配换服务，打包后的后台服务会被反复 replace 直至超时。
5. **lint 门未过**：`constants.ts` 两处 open dictionary 注解，2 problem。

第 5 条是门槛型小修；前四条互不依赖，需要一起修才能重新声明 SC3。建议按 Gap 的 `missing` 顺序修复，并用真实 `pack` + §10.4 四条命令复验，而不是只再跑一次 `build`。

---

_Verified: 2026-11-14T10:18:12Z_
_Verifier: the agent (gsd-verifier)_
