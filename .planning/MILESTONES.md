# Milestones

## v2.1 workspace-sidebar 会话行状态与交互增强 (Shipped: 2026-11-17)

**Phases completed:** 2 phases, 2 plans, 6 tasks

**Key accomplishments:**
- workspace-sidebar 新行组件 SessionRow：五态状态标记（语义 token 颜色）+ now/Nm/Nh/Nd 相对时间标签，双粒度时钟 driver（working 秒级、其余分钟级），upstream shell/titlebar 零改动
- Add folder 后自动展开并打开会话（add-open 纯状态机 + 状态驱动 watch driver）；会话列表默认 5 条 + Show more/less，展开态持久化到 workspace-sidebar-ui.v1

---
