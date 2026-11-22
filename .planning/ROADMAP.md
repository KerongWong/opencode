# Roadmap: OpenCode Desktop 个人 Fork — 工作区侧栏

## Milestones

- ✅ **v1.0 Projects 侧栏正确性** - Phases 1-2（Phase 3 superseded；归档 `.planning/milestones/v1.0-phases/`）
- ✅ **v2.0 工作区登记侧栏** - Phases 1-3（Phase 03 归档未验收；归档 `.planning/milestones/v2.0-phases/`）
- ✅ **v2.1 workspace-sidebar 会话行状态与交互增强** - Phases 4-5（shipped 2026-11-17；归档 `.planning/milestones/v2.1-*`，审计 passed 8/8）
- ✅ **v2.2 dsh 交互对齐：@ 引用短路径与会话列表水位线** - Phases 6-7（shipped 2026-11-18；归档 `.planning/milestones/v2.2-*`，审计 passed 5/5）
- 🚧 **v2.3 侧栏折叠状态持久化** - Phase 8 完成（源码验证通过；待安装包后自行重启确认并归档）

<details>
<summary>✅ v2.2 dsh 交互对齐（Phases 6-7，2026-11-18）</summary>

- [x] Phase 6: @ 引用短路径 (2/2 plans) — composer chip 与已发消息渲染层缩短为 basename（同名最短区分后缀），hover/title 全路径，wire/正文层不变（MENT-01/02）
- [x] Phase 7: 会话列表水位线 (2/2 plans) — 二元持久化展开替换为内存水位：+5 分批、剩余≤5 一步全展开、无 Show less、running/待交互/当前自动抬升（未读不抬）、只升不降、折叠重置 max(5, 注意力要求)（COLL-03/04/05）

2026-11-18 用户定向修正三条语义（未读不抬、无 Show less、折叠基线），以原始任务简报为准。归档：`.planning/milestones/v2.2-ROADMAP.md` / `v2.2-REQUIREMENTS.md`；审计：`.planning/v2.2-MILESTONE-AUDIT.md`（passed 5/5，集成 11/11）。

</details>

## v2.3 侧栏折叠状态持久化

### Phase 8: 工作区行折叠状态持久化

**Goal**: 用户对 Projects 侧栏每个工作区行的展开/折叠操作跨应用重启保留；启动时行恢复上次状态，不再全部折回折叠态。折叠只由用户操作发起；会话水位语义不变（仍为内存态）。
**Depends on**: Nothing（建立在 v2.1 Phase 5 的行折叠与 v2.2 COLL-05 的内存水位之上）
**Requirements**: FOLD-01, FOLD-02
**Success Criteria**:
  1. 用户展开若干行并折叠其余行后重启应用：展开的行仍展开（`aria-expanded=true`），折叠的行仍折叠
  2. 折叠状态按 server scope 的 `workspace-registry.v1` 文档 + rowKey 记录；同一目录的 Windows 大小写/斜杠拼写差异不会丢失状态
  3. 旧版 `workspace-registry.v1` 文档（无 `expanded` 字段）解码后 entries 与 scrollTop 不丢，`expanded` 回退为 `{}`
  4. 新登记目录仍自动展开并持久化为展开；未操作过的行默认折叠
**Plans**: 1/1 plans complete

Plans:
- [x] 08-01-PLAN.md — 折叠态并入 registry schema/store 并重接 sidebar 行展开（FOLD-01, FOLD-02）

---

*Roadmap updated: 2026-11-22 — milestone v2.3 started*
