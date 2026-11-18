# Roadmap: OpenCode Desktop 个人 Fork — 工作区侧栏

## Milestones

- ✅ **v1.0 Projects 侧栏正确性** - Phases 1-2（Phase 3 superseded；归档 `.planning/milestones/v1.0-phases/`）
- ✅ **v2.0 工作区登记侧栏** - Phases 1-3（Phase 03 归档未验收；归档 `.planning/milestones/v2.0-phases/`）
- ✅ **v2.1 workspace-sidebar 会话行状态与交互增强** - Phases 4-5（shipped 2026-11-17；归档 `.planning/milestones/v2.1-*`，审计 passed 8/8）
- 🚧 **v2.2 dsh 交互对齐：@ 引用短路径与会话列表水位线** - Phases 6-7

## Phases

- [x] **Phase 6: @ 引用短路径（composer 与已发消息）** - file mention 渲染层缩短为 basename，同名最短区分后缀，正文/wire 保持全路径 (completed 2026-11-18)
- [ ] **Phase 7: 会话列表水位线** - 二元持久化展开替换为 dsh 式内存水位（+5 增量、≤5 一步全展开、注意力自动抬升、折叠重置）

## Phase Details

### Phase 6: @ 引用短路径（composer 与已发消息）
**Goal**: 用户在 composer 输入框与已发消息中看到 @ 文件引用以 basename 显示（同名时最短区分后缀），hover/title 保留完整路径；正文与 wire 层全路径不变（与 TUI 互操作）。
**Depends on**: Nothing（与 Phase 7 相互独立）
**Requirements**: MENT-01, MENT-02
**Success Criteria** (what must be TRUE):
  1. 用户在 composer 输入框中看到 file mention chip 显示 basename；将鼠标悬停在 chip 上时 title/提示显示完整路径
  2. 同一 draft 内引用多个同名文件时，chip 各自显示最短区分后缀（彼此可区分），且每个 chip 的 hover/title 仍是完整路径
  3. 用户在已发消息中看到 @ 文件引用渲染为 basename；同条消息内多个同名文件时显示最短区分后缀，title/hover 显示原始完整路径
  4. 提交后的消息正文与协议 wire 层仍写全路径（TUI 等其他端打开同一会话看到全路径，行为不变）
**Plans**: 2/2 plans complete

Plans:
- [x] 06-01-PLAN.md — mentionLabels 纯函数（basename+最短区分后缀）+ 已发消息渲染接线（MENT-02）
- [x] 06-02-PLAN.md — composer chip 显示缩短 + parse/match 双回路保全（MENT-01）
**UI hint**: yes

### Phase 7: 会话列表水位线
**Goal**: workspace-sidebar 会话列表从二元持久化展开（v2.1 COLL-02 的 `revealed: string[]`）替换为 dsh 式分批水位：基线 5、每次 +5、剩余 ≤5 一步全展开、注意力自动抬升（只升不降）、折叠行重置、内存态不持久化。
**Depends on**: Nothing（与 Phase 6 相互独立；建立在 v2.1 Phase 5 的折叠行实现之上）
**Requirements**: COLL-03, COLL-04, COLL-05
**Success Criteria** (what must be TRUE):
  1. 用户点击会话列表底部 "Show N more" 每次增量显示 5 条；当剩余隐藏数 ≤5 时一步展开全部且按钮变为 "Show less"，点击 "Show less" 一步回到基线水位 5
  2. 每组列表前 50 条内的 running / 待交互 / 当前会话无需点击即可见；水位在 render 期单调提升，不因这些会话完成而回落（同次渲染内不降低）
  3. 用户折叠工作区行再展开后，该行的会话列表回到基线水位 5（水位被重置）
  4. 水位为内存态：刷新/重新加载应用后所有行回到基线水位 5，且不再向 `workspace-sidebar-ui.v1` 写入或读取展开持久化状态（替换 v2.1 COLL-02 语义）
**Plans**: 2/2 plans executed
**UI hint**: yes

Plans:
- [x] 07-01-PLAN.md — 水位纯函数（基线/+5/剩余≤5一步全展开/Show less 回基线）+ 内存 store + 按钮重接线 + 折叠重置（COLL-03, COLL-05）
- [x] 07-02-PLAN.md — 注意力自动抬升（render 期单调，前 50 条内 working/待交互/当前/未读完成）+ 移除 revealed 持久化层（COLL-04, COLL-05）

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 6. @ 引用短路径 | 2/2 | Complete    | 2026-11-18 |
| 7. 会话列表水位线 | 2/2 | In Progress | - |
