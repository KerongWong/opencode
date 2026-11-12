# Requirements: OpenCode Desktop 个人 Fork — Projects 侧栏

**Defined:** 2026-11-12
**Core Value:** 无论启动顺序、仓库布局、服务器 URL 如何变化，Projects 侧栏都稳定显示「我的项目 × 本地 checkout」及其会话。

## v1 Requirements

本里程碑范围。每条映射到 roadmap 的一个 phase。

### 行源 (SRC)

侧栏从哪些会话推导出项目行。

- [ ] **SRC-01**: 已归档会话不再出现在 Projects 侧栏（按 `time.archived === undefined` 过滤，或在 inbox 构建层过滤）
- [x] **SRC-02**: 侧栏的行源有单一、有界的窗口——本进程新加载过的会话不会凭空新增项目行，重启前后显示同一组项目
- [x] **SRC-03**: `mergeRootSessionIndex` 的合并契约有单元测试，至少覆盖「已归档的 known 会话」「只有 known 没有索引」两种情况

### 本地 checkout (CHK)

同一个 git 根的不同本地目录如何成行。

- [ ] **CHK-01**: 进入 Projects 模式时按需为可见项目加载 worktree 清单（每个 `projectID` 一次、缓存复用、不在渲染中重复 refresh）
- [ ] **CHK-02**: worktree 清单到达前，`sessionProjectDirectory` 用项目已有的 `sandboxes` 兜底，使分组不再退化为「按会话目录」
- [ ] **CHK-03**: 同一 git 根的两份本地拷贝各占一行；某一份拷贝没有落在窗口内的会话时，该行仍可见（或显式说明为何不显示）
- [ ] **CHK-04**: 分组逻辑有回归测试，覆盖「有 inventory」与「只有 canonical + sandboxes」两条路径

### 持久化 key (PSK)

`projects-sidebar.*` 的状态可迁移、可裁剪。

- [ ] **PSK-01**: 新增统一的 `groupKey(server, checkout)` / `parseGroupKey(key)`，替换 `projects.tsx` 与 `inbox-model.ts` 里的内联 `\u0000` 拼接与切片
- [ ] **PSK-02**: `projects-sidebar.v1` 迁移到 v2：丢弃不再匹配的 key、旧反斜杠变体与已改名 key，保留仍然有效的顺序与 `removed`
- [ ] **PSK-03**: key 往返与 v1→v2 迁移有单元测试（含 legacy 反斜杠 key）

### 接缝文档 (DOC)

- [ ] **DOC-01**: 更新 `docs/designs/project-grouped-sessions-sidebar.md` 的接缝表（当前实测 12 文件 +76/−19），并把承诺的 `SEAMS.md` 补上或从文档删除该承诺

## v2 Requirements

推迟，不在本里程碑 roadmap 中。

### 侧栏交互

- **UIX-01**: 折叠/展开状态持久化（跨界面模式切换与重启）
- **UIX-02**: Show more 真正分页拉取项目历史会话
- **UIX-03**: 项目级操作：新建会话、归档会话、项目右键菜单

### 启动与样式

- **BOT-01**: 冷启动默认打开最近修改的会话
- **STY-01**: 把 `@opencode/ui/activity-ring` 的颜色规则放进 layer，删除 5 处内联样式覆盖

## Out of Scope

| Feature | Reason |
|---------|--------|
| 向上游提交 PR / 发布 / CHANGELOG | 个人 fork，明确不参与上游流程 |
| 服务端「按项目查会话」接口 | 属于上游能力；本里程碑只用客户端现有索引 |
| 修复 `updateConfig` / config bootstrap 的 TODO | 依赖 V2 config API，不由本里程碑引入 |
| Home 归档动作接入 Inbox 同一路径 | 与本里程碑的两个缺陷无关，单独评估 |

## Traceability

Roadmap: `.planning/ROADMAP.md` — milestone v1.0「Projects 侧栏正确性」, 3 phases.

| Requirement | Phase | Status |
|-------------|-------|--------|
| SRC-01 | Phase 1 | Pending |
| SRC-02 | Phase 1 | Complete |
| SRC-03 | Phase 1 | Complete |
| CHK-01 | Phase 2 | Pending |
| CHK-02 | Phase 2 | Pending |
| CHK-03 | Phase 2 | Pending |
| CHK-04 | Phase 2 | Pending |
| PSK-01 | Phase 3 | Pending |
| PSK-02 | Phase 3 | Pending |
| PSK-03 | Phase 3 | Pending |
| DOC-01 | Phase 3 | Pending |

**Coverage:**
- v1 requirements: 11 total
- Mapped to phases: 11
- Unmapped: 0 ✓

---
*Requirements defined: 2026-11-12*
*Last updated: 2026-11-12 after roadmap creation (v1.0, Phases 1-3)*
