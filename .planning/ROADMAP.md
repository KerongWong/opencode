# Roadmap: OpenCode Desktop 个人 Fork — 工作区侧栏

## Milestones

- ✅ **v1.0 Projects 侧栏正确性** - Phases 1-2（Phase 3 superseded；归档 `.planning/milestones/v1.0-phases/`）
- ✅ **v2.0 工作区登记侧栏** - Phases 1-3（Phase 03 归档未验收；归档 `.planning/milestones/v2.0-phases/`）
- ✅ **v2.1 workspace-sidebar 会话行状态与交互增强** - Phases 4-5（shipped 2026-11-17；归档 `.planning/milestones/v2.1-*`，审计 passed 8/8）
- ✅ **v2.2 dsh 交互对齐：@ 引用短路径与会话列表水位线** - Phases 6-7（shipped 2026-11-18；归档 `.planning/milestones/v2.2-*`，审计 passed 5/5）

<details>
<summary>✅ v2.2 dsh 交互对齐（Phases 6-7，2026-11-18）</summary>

- [x] Phase 6: @ 引用短路径 (2/2 plans) — composer chip 与已发消息渲染层缩短为 basename（同名最短区分后缀），hover/title 全路径，wire/正文层不变（MENT-01/02）
- [x] Phase 7: 会话列表水位线 (2/2 plans) — 二元持久化展开替换为内存水位：+5 分批、剩余≤5 一步全展开、无 Show less、running/待交互/当前自动抬升（未读不抬）、只升不降、折叠重置 max(5, 注意力要求)（COLL-03/04/05）

2026-11-18 用户定向修正三条语义（未读不抬、无 Show less、折叠基线），以原始任务简报为准。归档：`.planning/milestones/v2.2-ROADMAP.md` / `v2.2-REQUIREMENTS.md`；审计：`.planning/v2.2-MILESTONE-AUDIT.md`（passed 5/5，集成 11/11）。

</details>
