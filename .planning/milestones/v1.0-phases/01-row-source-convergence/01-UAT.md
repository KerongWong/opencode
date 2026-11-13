---
status: complete
phase: 01-行源收敛
source: [01-VERIFICATION.md]
started: 2026-11-13T03:30:00Z
updated: 2026-11-13T05:56:47.201Z
---

## Current Test

[testing complete]

## Tests

### 1. Inbox 归档分区仍列出刚归档的会话（cache miss）
expected: 在 Inbox 归档一个会话，随即（不离开视图、让 archived 页保持未加载）打开 Archived 搜索，该会话出现在归档分区，归档入口可见。
result: pass
evidence: |
  隔离实例（临时 `OPENCODE_DB` + 后端 :4097 + app dev :4445），tabLayout=Inbox。
  通过 Inbox 行右键菜单「归档」归档 `UAT post-fetch session`；服务端 `PATCH /api/session/:id {archived:true}` 返回 204。
  归档后侧栏出现 `Archived` 入口（即 `sections().archived === true`），打开后「Archived sessions」列出刚归档行。
caveat: |
  SidebarInbox 挂载时 archived 查询即启用，因此不是严格的“archived 页从未缓存”。但该页在归档之前抓取、不含刚归档行；
  该行进入归档集合只能来自 known 存储 + `boundedKnown: false`，仍验证了 Inbox 无界路径。

### 2. 归档后 Projects 行消失且空组消失
expected: 在 Inbox 归档一个项目唯一的会话，切到 Projects，该会话不在任何项目行，只剩它的项目行消失。
result: pass
evidence: |
  Projects 侧栏项目组 `opencode` 下只有一条会话。归档后侧栏变为 `No sessions yet` / `这里还没有内容`，项目组与行一起消失；
  同一时刻 `archived=false` 列表请求数保持 1（未重新拉取），说明是 known 经 merge 的实时过滤。

### 3. 窗口外旧会话不改变 Projects 行集，且重启后一致
expected: 记录 Projects 行；打开一个 Projects 未显示的旧会话，返回 Projects，前后行集一致；重启应用后再看，行集仍一致。
result: pass
evidence: |
  隔离实例中创建 51 条 root（`UAT old-01` … `UAT old-51`）。Projects 侧栏恰好 50 行，范围 `old-51` … `old-02`，
  `old-01` 不在其中（窗口外）。
  在 SPA 内点击 Home 列表里的 `old-01` 打开它；Projects 侧栏仍为 50 行、仍不含 `old-01`（未新增行）。
  随后**重启后端进程**（同一 `OPENCODE_DB`）并 reload 应用、重新连接（客户端 known 清空），Projects 侧栏仍为
  50 行、`old-51` … `old-02`、不含 `old-01` —— 重启前后行集一致。

### 4. 空页面状态下新建会话可见、旧会话不新增行（01-04 计划的两条手工检查）
expected: 空页面状态下新建会话出现项目行；打开未列出的旧会话不新增行。
result: pass
evidence: |
  正向（CR-01 的精确状态）：归档全部会话后 reload Projects，`archived=false` 只发 1 次请求且返回空页，
  侧栏显示 `No sessions yet`。随后通过 API 新建会话（fetch 之后创建），侧栏立即出现该行，`archived=false` 请求数仍为 1，
  没有刷新/重连/改名/remount。修复前的 `+∞` 下限会丢弃该行。
  反向：见测试 3 —— 打开窗口外的 `old-01` 不新增行。空页面状态下没有“未列出的活跃旧会话”可打开
  （存在的旧会话只可能是已归档行，那是测试 2 覆盖的归档过滤），因此窗口界定的反向证据取自 51 会话状态。

## Summary

total: 4
passed: 4
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps
