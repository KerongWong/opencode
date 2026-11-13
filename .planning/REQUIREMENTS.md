# Requirements: OpenCode Desktop 个人 Fork — 工作区侧栏

**Defined:** 2026-11-13
**Milestone:** v2.0 工作区登记侧栏
**Core Value:** 侧栏显示什么完全由我的登记表决定：登记哪个本地文件夹就出现哪一行；同一仓库两份拷贝是两行；移除只是藏起来，目录、git 与会话分毫不动，重新登记即回来。

## v1 Requirements

本里程碑范围。每条映射到 roadmap 的一个 phase。SPEC：`docs/designs/workspace-registry-sidebar.md`。

### 登记表 (REG)

行源的唯一真相。

- [ ] **REG-01**: 用户可以把一个本地文件夹登记为工作区；同一目录重复登记静默复用既有记录（含已移除的记录），不产生第二行
- [ ] **REG-02**: 登记表持久化 `{ directory, title, order, createdAt, removedAt? }`，键为归一后的绝对路径；不新增数据库迁移、不新增协议端点
- [ ] **REG-03**: 路径归一只做分隔符统一、去尾分隔符、Windows 盘符/大小写不敏感比较；符号链接别名会登记为两个工作区的限制被显式记录
- [ ] **REG-04**: 登记后立即用 `session.list({ directory })` 的 `location.directory` 校准服务端拼写（可选增强，目录为空时退回本地归一）

### 侧栏行与会话 (ROW)

行与行内会话的可见性规则。

- [ ] **ROW-01**: 侧栏行只来自登记表：未登记的目录不出现，即使该目录存在历史会话
- [ ] **ROW-02**: 同一 git 仓库的两个目录登记后是两行，各自展开本目录的会话（同一分支也允许）
- [ ] **ROW-03**: 行内会话只包含 `directory` 与该行精确相等的会话，不含子目录
- [ ] **ROW-04**: 侧栏不存在任何兜底分组（未分组 / 其它）；被移除登记的工作区，其会话在侧栏任何位置都不出现
- [ ] **ROW-05**: Inbox 与命令面板的会话入口不受登记表影响（被移除工作区的会话仍可从那里访问）
- [ ] **ROW-06**: `session.created` 的增量更新按 `location.directory` 归行；`archived` / `unarchived` / `deleted` 只带 `sessionID` 时，用 `sessionID → directory` 内存映射做行级刷新，不重扫全局索引

### 交互 (UX)

- [ ] **UX-01**: 重命名只写登记表的 `title`，默认取目录名；不写 `project.name` / `project.icon`，不碰任何会话数据
- [ ] **UX-02**: 移除工作区只写 `removedAt`：目录、git 状态、会话历史不动；重新登记恢复原显示名与原顺序
- [ ] **UX-03**: 拖拽排序写 `order`；新登记追加末尾，不抢占用户手排顺序
- [ ] **UX-04**: 无登记项时显示空态与「添加本地文件夹」单一动作；不自动创建默认工作区
- [ ] **UX-05**: 目录不存在或被改名时该行进入「不可用」态（可见、不可展开），不静默消失、不自动指向新路径

### 持久化 (PST)

- [ ] **PST-01**: 登记列表、显示名、顺序、移除状态在重启后全部保持
- [ ] **PST-02**: 状态存 `Persist.serverGlobal(serverScope, "workspace-registry.v1")`，不同 server 的登记互不干扰

### 上游同步与打包 (SYNC)

- [ ] **SYNC-01**: 对 `upstream/dev` 的触点不超过 5 个文件 / 约 10 行新增 / 0 删除；`titlebar.tsx` 的 27 行缩进重排被消除
- [ ] **SYNC-02**: v1.0 的会话派生行源相关改动全部回退（`inbox-model.ts`、`session-index.ts` 及其测试、`perf/session-index*`、`inbox.tsx`、`home/sessions/view.tsx`、`project-session-row.tsx`）
- [ ] **SYNC-03**: fork 构建用 `OPENCODE_CHANNEL=fork`：独立 appId / productName / userData / `service-fork.json` / 端口 / `opencode-fork.db`，可与官方安装同时运行且后台服务互不顶替

## v2 Requirements

推迟，不在本里程碑 roadmap 中。

- **UIX-01**: 折叠/展开状态持久化
- **UIX-02**: 行内会话真正分页拉取（cursor）
- **UIX-03**: 行级操作：新建会话、归档会话、在文件管理器中显示
- **STY-01**: 把 `@opencode/ui/activity-ring` 的颜色规则放进 layer，删除内联样式覆盖

## Out of Scope

| Feature | Reason |
|---------|--------|
| 上游 PR / 发布 / CHANGELOG | 个人 fork，不参与上游流程 |
| 从会话历史推导行 | v2.0 的行只来自登记表；这正是 v1.0 被取代的原因 |
| 兜底分组（未分组 / 其它） | 与「移除后彻底不可见」互斥 |
| 按 git worktree 清单自动成行 | 数据源从 git inventory 换成用户登记 |
| 插件插槽承载侧栏 | 不减少上游触点，却引入异步加载与跨进程调试 |
| 子目录会话归入父行 | 采用精确等值语义（DSH 同此） |
| 自动跟随目录改名 | 改名后进入不可用态，由用户重新登记 |
| 修复 `updateConfig` / config bootstrap 的 TODO | 依赖 V2 config API，不由本里程碑引入 |

## Traceability

Roadmap: `.planning/ROADMAP.md` — milestone v2.0「工作区登记侧栏」。

| Requirement | Phase | Status |
|-------------|-------|--------|
| REG-01 | TBD | Pending |
| REG-02 | TBD | Pending |
| REG-03 | TBD | Pending |
| REG-04 | TBD | Pending |
| ROW-01 | TBD | Pending |
| ROW-02 | TBD | Pending |
| ROW-03 | TBD | Pending |
| ROW-04 | TBD | Pending |
| ROW-05 | TBD | Pending |
| ROW-06 | TBD | Pending |
| UX-01 | TBD | Pending |
| UX-02 | TBD | Pending |
| UX-03 | TBD | Pending |
| UX-04 | TBD | Pending |
| UX-05 | TBD | Pending |
| PST-01 | TBD | Pending |
| PST-02 | TBD | Pending |
| SYNC-01 | TBD | Pending |
| SYNC-02 | TBD | Pending |
| SYNC-03 | TBD | Pending |

**Coverage:**
- v1 requirements: 20 total
- Mapped to phases: 0 (roadmap pending)
- Unmapped: 20

---
*Requirements defined: 2026-11-13*
*Last updated: 2026-11-13 — v2.0 requirements defined*
