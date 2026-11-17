# Retrospective

跨里程碑工程回顾。每个完成的 milestone 追加一节。

## Cross-Milestone Trends

| Milestone | Phases | Plans | 关键门禁结果 |
|-----------|--------|-------|--------------|
| v2.1 | 2 | 2 | 审计 passed（8/8 需求）；code review 8 findings（2 修复、4 驳回/接受并记录）；133 单测全绿 |

## Milestone: v2.1 — workspace-sidebar 会话行状态与交互增强

**Shipped:** 2026-11-17
**Phases:** 2 | **Plans:** 2 | **Tasks:** 6

### What Was Built
- SessionRow 行组件：五态状态标记（语义 token）+ now/Nm/Nh/Nd 相对时间标签，双粒度时钟 driver，upstream shell/titlebar 零改动
- Add folder 后自动展开并打开会话（add-open 纯状态机 + attempt 防陈旧 + 10s 超时静默）
- 会话列表默认 5 条折叠 + Show more/less，展开态持久化 workspace-sidebar-ui.v1

### What Worked
- 蓝本分支（origin/projects-sidebar）只读参照 + 纯函数先行 TDD：25 + 11 个用例全部修复前失败、实现后全绿
- 状态驱动嵌套 effect 表达 watch 生命周期，免手工 dispose
- code reviewer 子代理在两个 phase 各抓出真问题（F-02/F-03 观感与泄漏；F-01 failed 吸收态 BLOCKER），驳回的两条也有蓝本证据支撑

### What Was Inefficient
- 文件级 type gate + 整包 typecheck 缺陷（custom-elements.d.ts）每次都要手动区分，已记入 Constraints
- verification.fingerprint 的手工刷新流程在 review-fix 后容易遗漏（本次两 phase 各返工一次）

### Patterns Established
- 「纯派生模块 + 组件只读派生」：session-status.ts 三纯函数是唯一真相，组件渲染从其派生
- 「状态驱动 watch」：嵌套 effect 归状态 effect 所有，re-run 即 dispose
- 机器 effect 载荷（timeoutMs）保留契约即使 driver 暂不用

### Key Lessons
- 状态机终态必须可重入：failed 若无 registered 出口，一次失败永久瘫痪功能（review 抓出的 BLOCKER）
- review 发现要逐条对照需求来源再处置：F-01（high）经蓝本取证后驳回，避免错误"修复"违背 TIME-01

### Cost Observations
- 模型：inherit（单模型全链路）
- 会话：1（new-milestone 初始化 + 全 autonomous 执行 + lifecycle）
- Notable: 子代理（code review ×2 + integration ×1）合计 3 次派发，主上下文未读取大文件审查
