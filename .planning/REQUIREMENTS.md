# Requirements: OpenCode Desktop 个人 Fork — 工作区侧栏

**Defined:** 2026-11-17
**Milestone:** v2.1 workspace-sidebar 会话行状态与交互增强
**Core Value:** 侧栏显示什么完全由我的登记表决定：登记哪个本地文件夹就出现哪一行；同一仓库两份拷贝是两行；移除只是藏起来，目录、git 与会话分毫不动，重新登记即回来。

## v1 Requirements

本里程碑范围。每条映射到 roadmap 的一个 phase。蓝本：`origin/projects-sidebar` 分支（只读参照，不整文件搬移）。

### 时间标签 (TIME)

- [x] **TIME-01**: 用户可以在每个会话行看到相对更新时间标签：基于 `session.time.updated`，<60s 显示 "now"，<60m 显示 "Nm"，<24h 显示 "Nh"，否则 "Nd"
- [x] **TIME-02**: 时间标签随时间自动刷新：任一可见会话处于 working 时秒级刷新，否则分钟级刷新；没有 working 会话时不运行秒级定时器

### 状态标记 (STAT)

- [x] **STAT-01**: 用户可以在会话行看到状态标记，状态集合为 failed / approval（等待审批）/ input（等待提问）/ working / unread / idle（读完且无异常，无标记）
- [x] **STAT-02**: 多状态并存时按优先级裁决只显示一个标记：failed > approval > input > working > unread > idle；裁决逻辑是纯函数，可被单测逐组合断言
- [x] **STAT-03**: 标记的图标与颜色：failed→close/danger，approval→circle-exclamation/warning，input→help/warning，working→ActivityRing/info，unread→check/success；颜色只用 `text-v2-state-fg-*` 语义 token

### Add-folder 跳转 (NAV)

- [x] **NAV-01**: 用户通过 sidebar 的 Add 注册 folder 成功后，该行自动展开；若该 folder 已有会话则打开最近一个，否则新建会话并打开；整个注册→等待会话→打开的流程是显式状态机（纯 transition + driver，attempt 防陈旧）

### 会话列表折叠 (COLL)

- [x] **COLL-01**: 每个 project 行默认只显示最近 5 条会话；超过时提供 "Show N more" 展开全部与 "Show less" 收起
- [x] **COLL-02**: 展开/收起状态按 project key（rowKey）持久化在 `Persist.serverGlobal` 客户端存储，重启后保持（激活 v2.0 延期的 UIX-01）

## v2 Requirements

推迟，不在本里程碑 roadmap 中。

- **UIX-02**: 行内会话真正分页拉取（cursor）
- **UIX-03**: 完整行级操作：归档会话、在文件管理器中显示（NAV-01 只覆盖「新建并打开」）
- **STY-01**: 把 `@opencode/ui/activity-ring` 的颜色规则放进 layer，删除内联样式覆盖
- **STAT-04**: 等待时长标签（"Working {{duration}}"，`since` 双粒度）——蓝本有，本里程碑不做

## Out of Scope

| Feature | Reason |
|---------|--------|
| 修改 `shell/titlebar/` 任何 upstream 共享文件（含 `project-session-row.tsx`） | 扩大合并冲突面；新行组件 `workspace-sidebar/session-row.tsx` 承载全部改动 |
| 改变其他三种布局模式（Top tabs / Side tabs / Inbox）的行为 | 第四模式自包含，触点最小化 |
| 项目级通知、badge 计数 | 任务简报显式排除 |
| i18n 非英文翻译 | 只加英文源串，运行时 fallback |
| 行内会话实时刷新（ROW-06 已定义首屏取全） | v2.0 产品决定不变 |
| 行 expanded（折叠整个 project 行）持久化 | 本里程碑只持久化 Show more/less 展开态；行 expanded 维持 v2.0 行为 |

## Traceability

Roadmap: `.planning/ROADMAP.md` — milestone v2.1「workspace-sidebar 会话行状态与交互增强」。

| Requirement | Phase | Status |
|-------------|-------|--------|
| TIME-01 | Phase 4 | Complete |
| TIME-02 | Phase 4 | Complete |
| STAT-01 | Phase 4 | Complete |
| STAT-02 | Phase 4 | Complete |
| STAT-03 | Phase 4 | Complete |
| NAV-01 | Phase 5 | Complete |
| COLL-01 | Phase 5 | Complete |
| COLL-02 | Phase 5 | Complete |
| UIX-02 | — | Deferred (v2) |
| UIX-03 | — | Deferred (v2) |
| STY-01 | — | Deferred (v2) |
| STAT-04 | — | Deferred (v2) |

**Coverage:**
- v1 requirements: 9 total
- Mapped to phases: 9
- Unmapped: 0

**Per phase:**
- Phase 4 (会话行状态与时间标签): TIME-01, TIME-02, STAT-01, STAT-02, STAT-03 — 5
- Phase 5 (Add-folder 跳转与会话列表折叠): NAV-01, COLL-01, COLL-02 — 3

---
*Requirements defined: 2026-11-17*
*Last updated: 2026-11-17 — v2.1 requirements defined; UIX-01 由 COLL-01/02 激活*
