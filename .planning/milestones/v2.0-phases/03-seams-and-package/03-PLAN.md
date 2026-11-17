---
phase: 03-seams-and-package
plan: 1
type: execute
wave: 1
depends_on: []
files_modified:
  - packages/desktop/src/main/constants.ts
  - packages/desktop/electron-builder.config.ts
  - packages/desktop/src/main/service/cli-version.ts
  - packages/plugin/src/gui/core.ts
  - docs/designs/workspace-registry-sidebar.md
autonomous: true
requirements: [SYNC-01, SYNC-02, SYNC-03]
estimate:
  tokens: 18000
  raw_tokens: 12000
  tasks: 3
  confidence: low
must_haves:
  truths:
    - 对 upstream/dev 的代码触点保持在上游文件可数、每处可读的范围：本分支没有 v1.0 的会话派生行源可回退，因此 SYNC-02 是「证明它不存在」而不是「删除它」。
    - fork 构建用 OPENCODE_CHANNEL=fork，得到独立 appId / productName / userData / service 注册文件 / 端口 / 数据库，可与官方安装同时运行。
    - merge 演练给出可复核的冲突数，并说明当前 HEAD 与 upstream/dev 的关系（后者是前者的祖先时，merge-tree 的 0 冲突不构成预算证据）。
  artifacts:
    - path: packages/desktop/src/main/constants.ts
      provides: fork 渠道的 Channel 联合、appNames、appIDs
    - path: packages/desktop/electron-builder.config.ts
      provides: resolveChannel 与 APP_IDS 接受 fork
    - path: packages/desktop/src/main/service/cli-version.ts
      provides: serviceVersion 的 channel 联合含 fork
    - path: packages/plugin/src/gui/core.ts
      provides: 插件 App 类型的 channel 联合含 fork（纯 additive）
  key_links:
    - from: packages/desktop/src/main/constants.ts
      to: packages/cli/src/services/service-config.ts
      via: CHANNEL 决定 service 文件名与默认端口（非 latest/dev/beta/next 才隔离）
    - from: packages/desktop/src/main/constants.ts
      to: packages/cli/src/database-path.ts
      via: 自定义 channel 得到 opencode-fork.db
---

<objective>
把 v2.0 的产物收口成「可与官方安装并存」的 fork 构建：登记 fork 渠道身份、验证四条隔离、给出可复核的 merge 预算。

Purpose: 侧栏本身已经是一个自包含模块（Phase 1/2 结束时对 `upstream/dev` 的代码触点只有 `en.ts` + `titlebar.tsx` 两个文件）；本阶段只解决「它能不能作为一个独立应用跑起来而不顶替官方后台服务」。

Output: 四个文件的 additive 改动 + 一次真实的 `OPENCODE_CHANNEL=fork` 构建 + merge 演练记录。
</objective>

<context>
- `packages/cli/src/services/service-config.ts`：`filename(channel)` 对 `latest|dev|beta|next` 返回共享的 `service.json`，其余返回 `service-<channel>.json`；`defaultPort` 对这四个返回 `0xC0DE`，`local` 返回 `0xC0DF`，其余为 `10000 + hash(channel) % 50000`。
- `packages/cli/src/database-path.ts`：channel 不在 `latest|dev|beta|next|prod` 时用 `opencode-<channel>.db`。
- `packages/desktop/src/main/constants.ts`：`Channel` 联合与 `appNames`/`appIDs` 只覆盖 local/dev/beta/prod，`fork` 会回落成 `dev`（即与官方 dev 共用 `service.json` 与端口）。
- `packages/desktop/electron-builder.config.ts`：`resolveChannel()` 与 `APP_IDS` 同样只有四个成员。
- `packages/plugin/src/gui/core.ts:63` 与 `packages/desktop/src/main/service/cli-version.ts:11` 的 `channel` 联合需要同步放宽，否则桌面端 typecheck 失败。
- `docs/designs/build-desktop.md`：构建需要 `packages/cli/dist/cli-windows-x64-baseline/bin/opencode.exe`，且该目录的 `package.json` 版本必须与二进制自报版本一致（本机官方 CLI 为 2.2.7）。
</context>

<tasks>

<task type="auto">
  <name>登记 fork 渠道身份（四处 additive）</name>
  <files>packages/desktop/src/main/constants.ts, packages/desktop/electron-builder.config.ts, packages/desktop/src/main/service/cli-version.ts, packages/plugin/src/gui/core.ts</files>
  <action>
    给 `Channel` 联合、`CHANNEL` 的判定、`appNames`、`appIDs`、`resolveChannel()`、`APP_IDS`、以及两处 `channel` 字面量联合各加一个 `fork` 成员：`appNames.fork = "OpenCode Fork"`，`appIDs.fork = "ai.opencode.desktop.fork"`。不要改动任何既有成员的行为。
  </action>
  <verify>
    <automated>cd packages/desktop && bunx tsc --noEmit -p tsconfig.json</automated>
    <fails_when>non-zero exit or any diagnostic naming the four files</fails_when>
  </verify>
  <acceptance_criteria>
    - `CHANNEL` 在 `OPENCODE_CHANNEL=fork` 时等于 `"fork"`，不再回落 `"dev"`。
    - 四个文件之外没有新增改动；`packages/app` 的代码触点不增加。
    - 桌面端 `tsc --noEmit` 0 诊断。
  </acceptance_criteria>
  <done>fork 渠道有独立身份，类型层面没有遗漏的联合。</done>
</task>

<task type="auto">
  <name>用 fork 渠道真实构建一次</name>
  <files>—（构建产物，不入库）</files>
  <action>
    按 `docs/designs/build-desktop.md` 准备 CLI 目录（`packages/cli/dist/cli-windows-x64-baseline` 的 `package.json` 版本写成二进制自报的 `2.2.7`），然后 `OPENCODE_CHANNEL=fork bun --cwd packages/desktop build`，必要时设置 electron 镜像。构建失败要如实记录失败点与输出尾巴，不得声称成功。
  </action>
  <verify>
    <automated>测试 -f packages/desktop/out/main/index.js 且构建日志无 error</automated>
    <fails_when>构建非零退出、或产物缺失</fails_when>
  </verify>
  <acceptance_criteria>
    - 构建产物的 `APP_NAME`/`APP_ID` 为 `OpenCode Fork` / `ai.opencode.desktop.fork`。
    - 构建日志显示 channel 为 `fork`（而不是 `dev`）。
    - 失败时：失败阶段、错误摘要、是否与本次改动相关，都写进 SUMMARY。
  </acceptance_criteria>
  <done>要么有可安装的 fork 构建，要么有一条精确的失败记录。</done>
</task>

<task type="auto">
  <name>隔离核验与 merge 预算</name>
  <files>docs/designs/workspace-registry-sidebar.md</files>
  <action>
    1. 记录 `service-config.filename("fork")` / `defaultPort("fork")` / `databasePath("fork")` 的实际取值（用 node 直接调用对应模块或用源码推断并注明依据）。
    2. 跑 `git merge-tree --write-tree --name-only upstream/dev HEAD` 与 `git rev-list --left-right --count upstream/dev...HEAD`，把结果与「upstream/dev 是否为 HEAD 祖先」一起写进文档 §12，明确说明该次演练是否构成预算证据。
    3. 把 `git diff --numstat upstream/dev -- packages` 的实际触点写进文档 §7.5。
  </action>
  <verify>
    <automated>git diff --name-only upstream/dev -- packages | Measure-Object -Line -le 20</automated>
    <fails_when>触点文件数超过 ROADMAP/SYNC-01 的承诺</fails_when>
  </verify>
  <acceptance_criteria>
    - 文档记录了四条隔离的取值与依据。
    - merge 演练记录包含「是否可作证据」的判断。
    - 代码触点清单可复核。
  </acceptance_criteria>
  <done>隔离与同步成本都有可复核的书面结论。</done>
</task>

</tasks>

<verification>
- `cd packages/desktop && bunx tsc --noEmit -p tsconfig.json` → 0 诊断
- `OPENCODE_CHANNEL=fork bun --cwd packages/desktop build` → 产物存在或失败被精确记录
- `git diff --name-only upstream/dev -- packages` → 只含 workspace-sidebar/*、i18n/en.ts、titlebar.tsx、desktop 三处、plugin 一处
- `git merge-tree --write-tree --name-only upstream/dev HEAD` → 记录结果与前提
</verification>

<success_criteria>
- fork 渠道独立身份成立，四条隔离有依据。
- 构建成功或失败被如实记录。
- merge 预算有书面结论且不夸大。
- `packages/app` 的上游触点没有增加。
</success_criteria>
