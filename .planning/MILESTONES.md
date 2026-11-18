# Milestones

## v2.2 dsh 交互对齐：@ 引用短路径与会话列表水位线 (Shipped: 2026-11-18)

**Phases completed:** 2 phases, 4 plans

**Key accomplishments:**
- @ 引用短路径（MENT-01/02）：session-ui `mentionLabels` 纯函数（basename + 最短区分后缀，dsh 段窗口语义）单点导出；composer chip 与已发消息渲染层缩短、title/hover 全路径；wire/正文层全路径不变，复制/粘贴/撤销回读双回路保持（code review 修复 1 critical + 2 warning 后 clean）
- 会话列表水位线（COLL-03/04/05）：二元持久化展开替换为内存水位（+5 分批、剩余≤5 一步全展开、无 Show less、running/待交互/当前自动抬升且未读不抬、只升不降、折叠重置 max(5, 注意力要求)）；`workspace-sidebar-ui.v1` 持久化层移除；两条用户定向语义修正（2026-11-18）以原始任务简报为准

**审计:** `.planning/v2.2-MILESTONE-AUDIT.md`（passed，5/5 requirements，集成 11/11，E2E 6/6）

---

## v2.1 workspace-sidebar 会话行状态与交互增强 (Shipped: 2026-11-17)

**Phases completed:** 2 phases, 2 plans, 6 tasks

**Key accomplishments:**
- workspace-sidebar 新行组件 SessionRow：五态状态标记（语义 token 颜色）+ now/Nm/Nh/Nd 相对时间标签，双粒度时钟 driver（working 秒级、其余分钟级），upstream shell/titlebar 零改动
- Add folder 后自动展开并打开会话（add-open 纯状态机 + 状态驱动 watch driver）；会话列表默认 5 条 + Show more/less，展开态持久化到 workspace-sidebar-ui.v1

---
