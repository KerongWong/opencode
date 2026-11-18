---
phase: quick-261114-lht
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - packages/app/src/settings/model.tsx
  - packages/app/src/settings/model.test.ts
  - packages/app/src/settings/general/interface-mode.tsx
  - packages/app/src/shell/titlebar/titlebar.tsx
  - packages/app/src/shell/shell.tsx
  - packages/app/src/runtime/i18n/en.ts
  - packages/app/src/env.d.ts
  - packages/app/vite.js
  - packages/desktop/src/main/constants.ts
  - packages/desktop/electron.vite.config.ts
  - packages/desktop/electron-builder.config.ts
  - packages/desktop/script/utils.ts
  - packages/desktop/script/copy-icons.ts
  - packages/desktop/src/main/service/cli-version.ts
  - packages/desktop/src/main/service/registration-file.ts
  - packages/desktop/src/main/service/registration-file.test.ts
  - packages/desktop/src/main/service/background-service.ts
  - packages/plugin/src/gui/core.ts
autonomous: true
requirements: [QUICK-261114-lht]

must_haves:
  truths:
    - Interface layout 选择器出现第四个选项 "Projects"，选中后 titlebar 侧栏区域渲染 SidebarWorkspaces（packages/app 内）
    - 本渠道（VITE_OPENCODE_CHANNEL === "projects"）构建的桌面端新装/重置后 tabLayout 默认落在 "projects"；其他渠道默认仍为 "horizontal"
    - tabLayout === "projects" 与 sidebarOrganize === "projects" 两个 Match 不会同时独立渲染（Switch 首个命中，且两者渲染同一组件）
    - 打包渠道标识为 projects：appId ai.opencode.desktop.projects、显示名 OpenCode Projects、协议名 OpenCode Projects
    - 桌面端与 CLI 的注册文件契约一致：channel "projects" → service-projects.json（registrationFile 表测试通过）
  artifacts:
    - packages/app/src/settings/model.tsx（tabLayout 含 "projects" + 渠道相关默认）
    - packages/app/src/settings/general/interface-mode.tsx（第四个选项卡）
    - packages/app/src/shell/titlebar/titlebar.tsx（tabLayout "projects" 渲染分支）
    - packages/app/src/runtime/i18n/en.ts（settings.general.row.interfaceMode.projects 键）
    - packages/desktop/src/main/constants.ts（Channel/projects 身份）
    - packages/desktop/electron-builder.config.ts（projects 分支）
  key_links:
    - desktop 主进程 CHANNEL（constants.ts）→ serviceVersion/registrationFile/background-service 探测链路
    - electron.vite.config.ts 的 define VITE_OPENCODE_CHANNEL → model.tsx 默认 tabLayout 判定
    - titlebar.tsx Switch 的 Match 顺序（tabLayout projects 在 sidebarOrganize projects 之前）
---

<objective>
两件事（CONTEXT 锁定决策，不再讨论）：
1. 把 `packages/app/src/workspace-sidebar/` 提升为 Interface layout 第四模式：选项显示名 "Projects"（接受与上游实验开关撞名）；本渠道桌面端默认启用（新装/重置即见侧栏）；接缝只增不改（tabLayout 加值 + 选项卡 + titlebar 渲染分支）。
2. 打包渠道标识 fork → projects：appId `ai.opencode.desktop.projects`、显示名 `OpenCode Projects`；隔离语义不变（service-projects.json / hash("projects") 端口 / opencode-projects.db 由 CLI 编译期渠道自动派生，无需改 CLI 源码）；旧 fork 标识退役。

Purpose: 摆脱 "Fork" 命名，workspace 侧栏成为本渠道的一等界面。
Output: 2 个代码任务 + 1 个编排器收尾步骤（重打包与装机验证）。
</objective>

<execution_context>
@C:/Users/theso/.config/opencode/gsd-core/workflows/execute-plan.md
</execution_context>

<context>
@.planning/STATE.md
@docs/designs/build-desktop.md
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Interface layout 第四模式 "projects"（app 侧接缝）</name>
  <files>packages/app/src/settings/model.tsx, packages/app/src/settings/model.test.ts, packages/app/src/settings/general/interface-mode.tsx, packages/app/src/shell/titlebar/titlebar.tsx, packages/app/src/shell/shell.tsx, packages/app/src/runtime/i18n/en.ts, packages/app/src/env.d.ts, packages/app/vite.js</files>
  <behavior>
    - Test 1（新增到 model.test.ts，参照现有 sidebarOrganize 的 test.each 写法）：`decode({ appearance: { tabLayout: "projects" } })` 往返后 `appearance.tabLayout === "projects"`；表驱动覆盖 "horizontal"/"vertical"/"inbox"/"projects" 四个值。
    - Test 2（既有测试必须保持绿）：`decode({})` 空文档默认在 bun test 环境（import.meta.env.VITE_OPENCODE_CHANNEL 为 undefined）仍落在 "horizontal"。
  </behavior>
  <action>
    按 CONTEXT 决策「第四模式的命名」与「默认行为」实施，只增不改：
    1. model.tsx：tabLayout 的 Schema.Literals 加 "projects"（约 152 行，仿照上方 "inbox" 的实验注释风格加一行注释说明本渠道语义）；在 defaultSettings 附近新增 `const defaultTabLayout: TabLayout = import.meta.env.VITE_OPENCODE_CHANNEL === "projects" ? "projects" : "horizontal"`，defaultSettings.appearance.tabLayout 改用该常量（约 317 行）。bun test 下 import.meta.env 存在且该键为 undefined（本机已验证），默认自然回落 "horizontal"，既有 model.test.ts 断言不用改。
    2. env.d.ts：`VITE_OPENCODE_CHANNEL` 联合类型加 "projects"（现有四值保留不动）。
    3. vite.js：channel 解析（约 85-93 行）放行 "projects"，使 app 源码经 desktop renderer 管线打包时 define 与 electron.vite.config.ts 一致（两处都 define 同一键，必须同值，否则默认判定结果取决于合并顺序）。
    4. interface-mode.tsx：modes 数组加 `{ id: "projects", layout: "projects" }`；预览图 Switch 加 `<Match when={mode.id === "projects"}>`：复用现有 `preview-rail`/`preview-tab` slot 画 3 行（首行 data-active），不加新 CSS（预览样式属 the agent's Discretion，保持与 side 模式同构）。
    5. titlebar.tsx：约 815 行现有 `<Match when={settings.general.sidebarOrganize() === "projects"}>` 之前插入新 Match：`when={settings.appearance.tabLayout() === "projects"}` 渲染 `<SidebarWorkspaces />`。Switch 首个命中生效，两个条件命中时行为一致（同一组件），满足 CONTEXT「避免两个 Match 同时命中」的协调要求。
    6. shell.tsx：218 行 `--sidebar-divider-bleed` 条件加 `preferences.appearance.tabLayout() === "projects"`（与 inbox 并列），保证 projects 布局侧栏分隔线留白与 inbox 一致。
    7. en.ts：在 settings.general.row.interfaceMode.inbox 之后加 `"settings.general.row.interfaceMode.projects": "Projects"`。只增键，不改任何现有英文文案；非英文 locale 不加（运行时回落英文）。
    8. model.test.ts：按 behavior 块加 tabLayout 往返表测试。
    注意：sidebarOrganize 相关逻辑、SettingsProjects/SettingsWorkspaces 两个设置 tab 一律不碰。
  </action>
  <verify>
    <automated>cd packages/app && bun test src/settings/model.test.ts</automated>
    <automated>cd packages/app && bun check --no-script src/settings/model.tsx src/settings/model.test.ts src/settings/general/interface-mode.tsx src/shell/titlebar/titlebar.tsx src/shell/shell.tsx src/runtime/i18n/en.ts src/env.d.ts vite.js</automated>
  </verify>
  <done>
    - tabLayout 往返表测试通过且既有 defaults 测试不变绿；
    - `rg -c '"projects"' packages/app/src/settings/model.tsx packages/app/src/settings/general/interface-mode.tsx` ≥ 各 2；
    - en.ts 含 `settings.general.row.interfaceMode.projects` 恰好 1 处；
    - `bun check --no-script` 对 8 个改动文件 0 诊断（vite.js 若不被 bun check 接受，则由 lint-changed 门覆盖并在此说明）。
  </done>
</task>

<task type="auto">
  <name>Task 2: 渠道标识 fork → projects（desktop/plugin 常量与打包配置）</name>
  <files>packages/desktop/src/main/constants.ts, packages/desktop/electron.vite.config.ts, packages/desktop/electron-builder.config.ts, packages/desktop/script/utils.ts, packages/desktop/script/copy-icons.ts, packages/desktop/src/main/service/cli-version.ts, packages/desktop/src/main/service/registration-file.ts, packages/desktop/src/main/service/registration-file.test.ts, packages/desktop/src/main/service/background-service.ts, packages/plugin/src/gui/core.ts</files>
  <action>
    按 CONTEXT 决策「渠道改名 fork → projects」实施；隔离语义（注册文件/端口/数据库）由 CLI 编译期渠道派生，CLI 源码不改：
    1. constants.ts：Channel 联合与 raw 校验中的 "fork" 改为 "projects"；appNames 键 fork→projects、值 "OpenCode Projects"；appIDs 键 fork→projects、值 "ai.opencode.desktop.projects"；头部注释同步改渠道名（隔离解释保留）。
    2. electron.vite.config.ts：resolveChannel 的 raw 校验 "fork"→"projects"（57 行 `channel === "local" ? "dev" : channel` 逻辑不动，projects 会原样流入 define）。
    3. electron-builder.config.ts：resolveChannel 同步；APP_IDS 键 fork→projects（值 ai.opencode.desktop.projects）；`case "fork"` 改 `case "projects"`：productName "OpenCode Projects"、protocols `{ name: "OpenCode Projects", schemes: ["opencode-projects"] }`（scheme 随身份一并改名，保持旧 fork scheme 的隔离意图；主进程 argv 过滤只认 `opencode://` 是既有行为，不在本任务改动）；无 update feed 的注释保留并改渠道名。
    4. script/utils.ts：Channel 类型与 resolveChannel 增加 "projects" 放行（此前自定义渠道整体落到 "dev"，导致 build.ts 渠道感知失效；放行后 copy-metainfo 才能按模板生成 ai.opencode.desktop.projects 的元数据）。
    5. script/copy-icons.ts：channel 为 "projects" 时图标源目录映射到 dev（`./icons/projects` 不存在；fork 时代即回落 dev 图标，保持同一行为），加一行注释说明。
    6. cli-version.ts：serviceVersion 输入 channel 联合 "fork"→"projects"。
    7. registration-file.ts 与 background-service.ts：注释中 fork/service-fork.json 的举例改为 projects/service-projects.json（registrationFile 函数本身是渠道泛型，不动逻辑）。
    8. registration-file.test.ts：表行 `["fork", "service-fork.json"]` 改 `["projects", "service-projects.json"]`；注释同步（保持单表跨渠道，符合 desktop AGENTS.md 契约表规范）。
    9. plugin/src/gui/core.ts：App.channel 联合 "fork"→"projects"（渠道退役；host-apis.tsx 的 cast 依赖 env.d.ts 联合，Task 1 已加）。
    不改：service-config.ts / database-path.ts / server-process.ts 等 CLI 侧（渠道来自编译期注入，OPENCODE_CHANNEL=projects 构建自动得到 service-projects.json、hash("projects") 端口、opencode-projects.db）；windows-installer.test.ts（渠道泛型表，无 fork 字面量）。
  </action>
  <verify>
    <automated>cd packages/desktop && bun test src/main/service/registration-file.test.ts</automated>
    <automated>cd packages/desktop && bun check --no-script src/main/constants.ts src/main/service/cli-version.ts src/main/service/registration-file.ts electron.vite.config.ts electron-builder.config.ts script/utils.ts script/copy-icons.ts</automated>
    <automated>cd packages/plugin && bun check --no-script src/gui/core.ts</automated>
  </verify>
  <done>
    - registration-file 表测试通过且含 projects 行；
    - `rg '"fork"' packages/desktop/src/main/constants.ts packages/desktop/src/main/service/cli-version.ts packages/plugin/src/gui/core.ts packages/desktop/electron.vite.config.ts packages/desktop/electron-builder.config.ts` 0 匹配（当前基线各 ≥1，任务后必须为 0）；
    - `rg -c 'ai\.opencode\.desktop\.projects' packages/desktop/src/main/constants.ts packages/desktop/electron-builder.config.ts` 各 ≥1；
    - 所有 bun check 门 0 诊断。
  </done>
</task>

</tasks>

<orchestrator>
重机械收尾步骤（刻意不放在任务里，代码任务不依赖它即可验证）：
1. 卸载本机已装的 OpenCode Fork（旧 appId ai.opencode.desktop.fork）。
2. 用 `OPENCODE_CHANNEL=projects` 重建全部 12 个目标的捆绑 CLI（packages/cli/dist），再按 docs/designs/build-desktop.md 打包：`bun --cwd packages/desktop build` → 复制 `dist/desktop/app` 到仓库外 → `$env:OPENCODE_DESKTOP_APP=<外部路径>` `bun --cwd packages/desktop pack`（坑 1 的版本核对、坑 2 的镜像照常）。跳过本步会重现坑 3：桌面端探测的注册文件与 CLI 写入的不一致。
3. 安装新包后验证：应用显示 OpenCode Projects；`%USERPROFILE%\.local\state\opencode\service-projects.json` 存在；`%APPDATA%\ai.opencode.desktop.projects\logs\<最新>\main.log` 出现 `v2 CLI background service ready`；与官方安装并存互不顶替。
4. 界面人工验证：Settings → General → Interface layout 出现 Projects 选项卡；新装/重置后打开应用直接落在 workspace 侧栏（本渠道默认）。
</orchestrator>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| 安装包 ↔ 系统 | NSIS 安装包以新 appId 注册协议与卸载项，身份常量写错会顶替/混淆官方安装 |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-q-01 | Tampering | electron-builder.config.ts / constants.ts 渠道常量 | medium | mitigate | appId/appName/scheme 三处同源（APP_IDS 单表），registration-file 契约测试钉死桌面端与 CLI 的注册文件名一致性 |
| T-q-02 | Information Disclosure | CLI 数据库/注册文件隔离 | high | mitigate | 隔离语义保持：注册文件、端口、数据库全部由编译期 OPENCODE_CHANNEL=projects 派生（service-config.ts/database-path.ts 泛型逻辑不改），编排器步骤 2 重建全部目标防止渠道串用 |
| T-q-SC | Tampering | bun/pip/cargo installs | high | mitigate | 本计划不新增任何依赖，无安装步骤；包合法性门不适用 |
</threat_model>

<verification>
- `cd packages/app && bun test src/settings/model.test.ts` 全绿
- 两个任务的 `bun check --no-script` 文件级门 0 诊断（整包 `bun typecheck` 的 custom-elements.d.ts 符号链接缺陷是既有环境问题，不计入）
- `bun script/lint-changed.ts upstream/dev`（仓库根）0 problems
- `cd packages/desktop && bun test src/main/service/registration-file.test.ts` 通过
- 任务后 `rg '"fork"'` 在 Task 2 列出的常量/配置文件 0 匹配
</verification>

<success_criteria>
- Interface layout 有四选项，Projects 选中即渲染 workspace 侧栏；本渠道构建默认 tabLayout=projects，其他渠道默认不变
- 打包渠道恒为 projects（OpenCode Projects / ai.opencode.desktop.projects / opencode-projects 协议），fork 标识从代码中退役
- 注册文件契约测试按渠道成表并通过
- 代码任务全部不依赖重打包即可自动化验证；重打包与装机验证由编排器按 <orchestrator> 执行
</success_criteria>

<output>
完成后写执行摘要到 .planning/quick/261114-lht-workspace-sidebar-interface-layout-proje/261114-lht-SUMMARY.md
</output>
