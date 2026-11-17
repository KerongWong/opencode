# Roadmap: OpenCode Desktop 个人 Fork — 工作区侧栏

## Milestones

- ✅ **v1.0 Projects 侧栏正确性** - Phases 1-2（Phase 3 superseded；归档 `.planning/milestones/v1.0-phases/`）
- ✅ **v2.0 工作区登记侧栏** - Phases 1-3（Phase 03 归档未验收；归档 `.planning/milestones/v2.0-phases/`）
- ✅ **v2.1 workspace-sidebar 会话行状态与交互增强** - Phases 4-5（shipped 2026-11-17）

<details>
<summary>✅ v1.0 Projects 侧栏正确性（Phases 1-2 完成，Phase 3 superseded）</summary>

行源收敛到单一有界索引窗口、每份本地 checkout 恰好一行。模型在 v2.0 被登记表取代。归档：`.planning/milestones/v1.0-phases/`。

</details>

<details>
<summary>✅ v2.0 工作区登记侧栏（Phases 1-2 完成；Phase 03 归档未验收）</summary>

行源换成用户显式登记的本地文件夹登记表，收敛为自包含模块 `packages/app/src/workspace-sidebar/`。Phase 03（触点收敛与打包隔离）未正式验收即随 v2.1 启动归档。归档：`.planning/milestones/v2.0-phases/`；SPEC：`docs/designs/workspace-registry-sidebar.md`。

</details>

<details>
<summary>✅ v2.1 workspace-sidebar 会话行状态与交互增强（Phases 4-5，2026-11-17）</summary>

- [x] Phase 4: 会话行状态与时间标签 (1/1 plans) — completed 2026-11-17
- [x] Phase 5: Add-folder 跳转与会话列表折叠 (1/1 plans) — completed 2026-11-17

移植 projects-sidebar 蓝本的相对时间标签与状态标记，新增 Add-folder 自动打开与列表折叠。归档：`.planning/milestones/v2.1-phases/`；审计：`.planning/milestones/v2.1-MILESTONE-AUDIT.md`（passed，8/8 需求）。

</details>
