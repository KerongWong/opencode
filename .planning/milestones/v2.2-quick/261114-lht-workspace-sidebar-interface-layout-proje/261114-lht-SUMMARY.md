---
phase: quick-261114-lht
plan: 01
status: complete
commits:
  - 92eaa5ae9e
  - e5513f38c2
---

# Quick Task 261114-lht Summary: workspace-sidebar 提升为 Interface layout 第四模式 + 渠道 fork→projects

Interface layout 现在有四选项（Top/Side/Inbox/Projects），选中 Projects 即渲染 workspace 登记侧栏（`SidebarWorkspaces`）；打包渠道标识从 `fork` 全面改为 `projects`（OpenCode Projects / `ai.opencode.desktop.projects` / `opencode-projects` 协议），隔离语义（service-projects.json、hash 派生端口、opencode-projects.db）由 CLI 编译期渠道自动派生，CLI 源码零改动。

## Task 1: Interface layout 第四模式 "projects"（app 侧接缝）— commit `92eaa5ae9e`

- `settings/model.tsx`：`tabLayout` Schema.Literals 加 `"projects"`（带渠道语义注释）；新增 `defaultTabLayout` 常量，`VITE_OPENCODE_CHANNEL === "projects"` 时默认 `"projects"`，否则 `"horizontal"`；`defaultSettings.appearance.tabLayout` 改用该常量。bun test 下该 env 键为 `undefined`，默认自然回落 horizontal。
- `env.d.ts`：`VITE_OPENCODE_CHANNEL` 联合加 `"projects"`。
- `vite.js`：channel 解析放行 `"projects"`，与 electron.vite.config.ts 的 define 同值。
- `settings/general/interface-mode.tsx`：modes 数组加 `{ id: "projects", layout: "projects" }`；预览 Switch 加 Match，复用 `preview-rail`/`preview-tab` 画 3 行（首行 active），无新 CSS。
- `shell/titlebar/titlebar.tsx`：在 `sidebarOrganize() === "projects"` Match **之前**插入 `tabLayout() === "projects"` → `<SidebarWorkspaces />`。Switch 首个命中生效，两条件同时命中时渲染同一组件，无双重渲染。
- `shell/shell.tsx`：`--sidebar-divider-bleed` 条件加 `tabLayout() === "projects"`（与 inbox 并列）。
- `runtime/i18n/en.ts`：新增 `"settings.general.row.interfaceMode.projects": "Projects"`（恰好 1 处，未改任何现有文案）。
- `settings/model.test.ts`：新增 tabLayout 往返表测试（horizontal/vertical/inbox/projects 四值），仿 sidebarOrganize 的 test.each 写法。

验证结果：
- `bun test src/settings/model.test.ts`（`--conditions=solid --preload ../ui/test/solid-jsx.ts --preload ./happydom.ts`）：36 pass / 0 fail（计划中的裸 `bun test` 命令在本机缺 `--conditions=solid` 预载会报 jsxDEV 错误，使用包内 test:unit 同款预载后全绿）。
- `bun check --no-script` 8 个改动文件：0 诊断。
- `rg -c '"projects"'`：model.tsx 7、interface-mode.tsx 2；en.ts 新键 1 处。
- `bun script/lint-changed.ts upstream/dev`：0 problems。

## Task 2: 渠道标识 fork → projects（desktop/plugin）— commit `e5513f38c2`

- `desktop/src/main/constants.ts`：Channel 联合与 raw 校验 `"fork"`→`"projects"`；`appNames.projects = "OpenCode Projects"`；`appIDs.projects = "ai.opencode.desktop.projects"`；头部注释改渠道名（隔离解释保留）。
- `desktop/electron.vite.config.ts`：resolveChannel 放行 `"projects"`（`channel === "local" ? "dev" : channel` 逻辑不动）。
- `desktop/electron-builder.config.ts`：resolveChannel 同步；`APP_IDS.projects = "ai.opencode.desktop.projects"`；`case "projects"`：productName "OpenCode Projects"、protocols `{ name: "OpenCode Projects", schemes: ["opencode-projects"] }`；无 update feed 注释保留并改渠道名。
- `desktop/script/utils.ts`：Channel 类型与 resolveChannel 放行 `"projects"`（此前自定义渠道落到 "dev"，导致 build.ts 渠道感知失效）。
- `desktop/script/copy-icons.ts`：`"projects"` 显式映射到 dev 图标源目录（`./icons/projects` 不存在，fork 时代即回落 dev），加注释说明。
- `desktop/src/main/service/cli-version.ts`：serviceVersion 输入 channel 联合 `"fork"`→`"projects"`。
- `desktop/src/main/service/registration-file.ts`、`background-service.ts`：注释举例改为 projects/service-projects.json（函数逻辑不动，渠道泛型）。
- `desktop/src/main/service/registration-file.test.ts`：表行 `["fork", "service-fork.json"]` → `["projects", "service-projects.json"]`，注释同步（保持单表跨渠道）。
- `plugin/src/gui/core.ts`：`App.channel` 联合 `"fork"`→`"projects"`。

验证结果：
- `bun test src/main/service/registration-file.test.ts`（+ cli-version.test.ts）：17 pass / 0 fail，含 projects 行。
- **偏离记录（环境，Rule 3 说明）**：`bun check --no-script` 对 desktop 改动文件报 8 个诊断，全部位于 `electron.vite.config.ts`（TS2769/TS7006 ×5）与 `script/beta-visual.ts`（×3）。已用 `git show HEAD:` 字节级还原基线文件复跑，基线产生**完全相同**的 8 个错误——属既有配置类型噪音（electron-vite beta 类型 + untyped 回调），非本次改动引入；改动前后诊断集零差异。其余改动文件（constants.ts、cli-version.ts、registration-file.ts、utils.ts、copy-icons.ts、electron-builder.config.ts）0 诊断。整包 `bun run typecheck` 仍被既有 `packages/app/src/custom-elements.d.ts` 符号链接缺陷阻断（计划环境说明已含），不计入。
- `cd packages/plugin && bun check --no-script src/gui/core.ts`：No type errors in 49 files。
- 负向门：`rg '"fork"'` 在 constants.ts / cli-version.ts / core.ts / electron.vite.config.ts / electron-builder.config.ts：**0 匹配**。
- `rg -c 'ai\.opencode\.desktop\.projects'`：constants.ts 1、electron-builder.config.ts 1。
- `bun script/lint-changed.ts upstream/dev`：0 problems（27 changed files）。

## 未执行部分（按计划交由编排器）

- `<orchestrator>` 步骤未执行：卸载旧 OpenCode Fork、OPENCODE_CHANNEL=projects 重建全部 12 目标捆绑 CLI、`bun --cwd packages/desktop build` / `pack`、新包装机验证（service-projects.json、`v2 CLI background service ready` 日志、与官方安装并存）、界面人工验证。代码任务均已通过不依赖重打包的自动化门。

## Deviations from Plan

1. **[Rule 3 - 环境偏离] bun test 需包内预载**：计划 verify 写 `bun test src/settings/model.test.ts`，本机直接跑报 `jsxDEV not found`（bun 1.4.4 + solid-js）。改用 package.json `test:unit` 同款命令行（`--conditions=solid --preload ../ui/test/solid-jsx.ts --preload ./happydom.ts`）后 36/36 通过。测试本身无需改动。
2. **[Rule 3 - 既有缺陷说明] desktop `bun check --no-script` 8 诊断**：如上，基线（HEAD 未改动文件）产生完全相同错误集，非本次引入；已在 Task 2 验证结果中说明。未做修复（SCOPE BOUNDARY：与当前任务无关的既有问题，记录于此）。

## Known Stubs

无。
