# Requirements: OpenCode Desktop 个人 Fork — 工作区侧栏

**Defined:** 2026-11-22
**Core Value:** 侧栏显示什么完全由我的登记表决定：登记哪个本地文件夹就出现哪一行；同一仓库两份拷贝是两行；移除只是藏起来，目录、git 与会话分毫不动，重新登记即回来。

## v2.3 Requirements（当前里程碑：Projects 侧栏折叠状态持久化）

### FOLD — 工作区行折叠状态

- [x] **FOLD-01**: 用户展开或折叠任意工作区行后，应用重启时该行恢复上次的展开/折叠状态（状态按 server scope 的 `workspace-registry.v1` 文档 + rowKey 记录）
- [x] **FOLD-02**: 未操作过的行仍默认折叠；新增/重新登记的行沿用现有「自动展开」流程，并同样持久化

## Future Requirements（延期）

- **UIX-02**: 会话列表真分页（服务端 cursor 拉取更多 than 50）
- **UIX-03**: 行级中间操作（归档会话、显示文件数量等；NAV-01 只是"新建后打开"）
- **STY-01**: `@opencode/ui/activity-ring` 的颜色分层 layer，删除"预置样式"方案
- **STAT-04**: 等待时间标签（"Working {{duration}}"，since 双粒度时钟），鼠标悬停，进度环

## Out of Scope（明确排除）

- **会话水位持久化** — COLL-05 的用户定案不变：水位（每行显示多少条会话）仍是内存态，折叠行重置；v2.3 只持久化行折叠态本身
- **恢复 v2.1 COLL-02 的 `revealed: string[]`** — 该语义已被 v2.2 水位模型替换，不复活旧字段
- **`workspace-sidebar-ui.v1` 重新启用** — 继续零读零写；折叠态并入 `workspace-registry.v1`
- **整条侧栏的收起/展开** — `settings.appearance.sidebarOpen` 已持久化且工作正常，不在本里程碑范围
- **TUI / core / server 改动** — 本里程碑只动 `packages/app/src/workspace-sidebar/`

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| FOLD-01 | Phase 8 | Complete |
| FOLD-02 | Phase 8 | Complete |

**Coverage:**
- v2.3 requirements: 2 total
- Mapped to phases: 2
- Unmapped: 0 ✓

---
*Requirements defined: 2026-11-22*
*Last updated: 2026-11-22 after milestone start*
