# Quick Task 261114-lht: 将 workspace-sidebar 提升为 Interface layout 第四模式，渠道 fork→projects - Context

**Gathered:** 2026-11-14
**Status:** Ready for planning

<domain>
## Task Boundary

将 `packages/app/src/workspace-sidebar/`（v2.0 工作区登记侧栏）提升为一等公民界面模式：Interface layout 增加第四个选项直接渲染该侧栏；同时把打包渠道标识从 `fork` 改名为 `projects`（应用显示名 OpenCode Projects），摆脱 "Fork" 命名。

</domain>

<decisions>
## Implementation Decisions

### 第四模式的命名
- 选项显示名就叫 **"Projects"**，沿用 v1.0 设计（`project-grouped-sessions-sidebar.md`）的名字。
- 接受与上游实验开关 `sidebarOrganize` 的 "Projects" 撞名——用户明确知晓并坚持此命名。

### 默认行为
- 本渠道打包的桌面端**默认启用**该模式：新装/重置后 `tabLayout` 直接落在 `projects`，打开应用即见侧栏，无需进设置切换。只影响本渠道，上游渠道默认行为不变。

### 渠道改名 fork → projects
- 打包渠道标识从 `fork` 改为 `projects`：appId `ai.opencode.desktop.projects`、应用显示名 `OpenCode Projects`。
- 隔离语义不变：独立 service 注册文件（`service-projects.json`）、独立端口（`hash("projects")` 派生）、独立数据库（`opencode-projects.db`），仍与官方安装并存互不顶替。
- 捆绑 CLI 必须用 `OPENCODE_CHANNEL=projects` 重建全部目标，否则桌面端与 CLI 的注册文件/端口不一致（2026-11-14 已踩过此坑，`docs/designs/build-desktop.md` 坑 3）。
- 旧的 fork 渠道标识（`service-fork.json` / 28698 端口 / `opencode-fork.db` / `ai.opencode.desktop.fork`）随之退役；本机已装的 OpenCode Fork 需要卸载后重装新身份的包。

### the agent's Discretion
- 选项卡片在 Interface layout 选择器中的预览图样式与文案细节。
- electron-builder 中 protocols/productName 等次要字段的取值。
- 改名波及面的具体推进顺序（常量 → 打包配置 → CLI 重建 → 注册文件契约测试）。

</decisions>

<specifics>
## Specific Ideas

- 参照 v1.0 的接缝做法：`settings/model.tsx` 的 `tabLayout` 联合加值 + `settings/general/interface-mode.tsx` 加选项卡 + `titlebar.tsx` 加渲染分支；只增不改。
- 现有挂载点 `titlebar.tsx` 中 `sidebarOrganize() === "projects"` 的 `<Match>`（fork 替换上游组件处）需要与新 `tabLayout === "projects"` 分支协调，避免两个 Match 同时命中（Solid `<Switch>` 首个命中生效）。
- 设置里的「项目」「工作区」两个 tab（settings/shell.tsx 的 `SettingsProjects` / `SettingsWorkspaces`）保持不变。

</specifics>

<canonical_refs>
## Canonical References

- `docs/designs/project-grouped-sessions-sidebar.md`（v1.0 设计，模式命名与接缝做法的来源）
- `docs/designs/workspace-registry-sidebar.md`（v2.0 SPEC，A3 决定：沿用 tabLayout="projects" token）
- `docs/designs/build-desktop.md`（坑 1/坑 3：版本核对与注册文件一致性）
- `.planning/MILESTONE-CONTEXT.md`（v2.0 语义决定 A1–A4）

</canonical_refs>
