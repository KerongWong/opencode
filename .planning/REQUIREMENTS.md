# Requirements: OpenCode Desktop 个人 Fork — 工作区侧栏

## v2.2 Requirements（当前里程碑：dsh 交互对齐 — @ 引用短路径与会话列表水位线）

### MENT — @ 引用短路径

- [ ] **MENT-01**: 用户在 composer 输入框中看到 file mention chip 显示 basename（同一 draft 内多个同名文件时显示最短区分后缀），hover/title 显示完整路径
- [ ] **MENT-02**: 用户在已发消息中看到 @ 文件引用渲染为 basename（同条消息内多个同名文件时显示最短区分后缀），hover/title 显示原始完整路径

### COLL — 会话列表水位线

- [ ] **COLL-03**: 用户点击会话列表底部 "Show N more" 每次增量显示 5 条；剩余隐藏数 ≤5 时一步展开全部并变为 "Show less"，点击 "Show less" 一步回到基线水位
- [ ] **COLL-04**: running / 待交互 / 当前会话 / 未读完成（该工作区列表前 50 条内）自动抬升水位使其可见；水位只升不降（render 期单调提升）
- [ ] **COLL-05**: 折叠工作区行时重置该行的会话水位；水位为内存态、不持久化（卸载即重置，替换 v2.1 COLL-02 的持久化展开语义）

## Future Requirements（延期）

- **UIX-02**: 会话列表真分页（服务端 cursor 拉取更多 than 50）
- **UIX-03**: 行级中间操作（归档会话、显示文件数量等；NAV-01 只是"新建后打开"）
- **STY-01**: `@opencode/ui/activity-ring` 的颜色分层 layer，删除"预置样式"方案
- **STAT-04**: 等待时间标签（"Working {{duration}}"，since 双粒度时钟），鼠标悬停，进度环

## Out of Scope（明确排除）

- **消息级"撤销+复制"入口（原任务简报 A 项）** — 事实复核（2026-11-17）确认 App 端已存在完整实现：session-ui `message-content.tsx`（Revert to here/Undo 菜单、Copy 按钮）、App `src/session/region.tsx` + `src/session/revert.ts` 接线、`packages/app/e2e/regression/session-header.spec.ts` 覆盖。能力已存在，重复实现违反最小改动
- **core/server 的 revert 既有逻辑** — 不改 revert 状态机与端点
- **TUI 改动** — TUI 已写相对路径且已有 /undo、/redo；本里程碑只动 packages/app 与 packages/session-ui
- **dsh 基础设施 fork** — 不搬事件日志、DI、文件搜索 Host 服务；只移植纯函数语义
- **全局 workspace 同名消歧** — dsh `distinguishingPathSuffixes()` 服务 WorkspacePicker 场景；本里程碑仅做同 draft / 同消息内的重名消歧
- **@ 引用 wire/正文层格式变更** — 正文与协议层永远写全路径（与 TUI 互操作）

## Traceability

<!-- 由 roadmapper 填充：REQ-ID → Phase -->

| REQ-ID | Phase |
|--------|-------|
| MENT-01 | Phase 6 |
| MENT-02 | Phase 6 |
| COLL-03 | Phase 7 |
| COLL-04 | Phase 7 |
| COLL-05 | Phase 7 |
