---
phase: "02"
slug: "sidebar-render"
status: verified
threats_open: 0
asvs_level: 1
created: "2026-11-14"
---

# Phase 02 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

**来源说明：** 本阶段两份 `PLAN.md` 均带 `<threat_model>`（`02-01` 的 T-2-01..05、`02-02` 的官方威胁段）。本文件在它们之上做 **ASVS L1（读码深度）** 的补全，并给出实现级证据；未 spawn `gsd-security-auditor`。`threats_open: 0` 读作「L1 深度无阻断项」。

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| 用户输入（目录选择器 / 标题输入框）→ 持久化文档 | 任意字符串进入登记表并被渲染 | 路径、显示名（都可含任意 Unicode） |
| 持久化文档 → 侧栏渲染 | 手工编辑或旧版本写坏的文档 | JSON |
| 本地文件夹 → `file.list` 探测 | 探测结果决定行是否可展开 | 目录存在性 |
| 会话服务 → 行内列表 | `session.list({directory})` 的返回值 | 会话标题、时间、状态 |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-02-01 | Tampering | 持久化文档解码 | medium | mitigate | schema 解码 + `withInitial`；坏文档回落初始值；坏条目逐条丢弃由 `persistence/schema.test.ts` 拥有 | closed |
| T-02-02 | Spoofing（路径→键伪造） | `register` / `remove` / `adoptDirectory` | high | mitigate | Phase 1 的 `registrable()` 守卫（空/空白/相对路径拒绝）；本阶段新增 web 平台探测修复（`62fb6cbabb`）——此前 web 构建把平台误判为 linux，使 Windows 路径全部被判为「非绝对」而静默 no-op | closed |
| T-02-03 | Cross-site Scripting（显示名/会话标题注入） | `sidebar.tsx` / `dialogs.tsx` 渲染 | high | mitigate | 所有标题经 Solid 文本节点渲染（无 `innerHTML`、无 `dangerouslySetInnerHTML`），并沿用上游 `dir="auto"` 与截断；i18n 走 `language.t` 插值而非拼接 HTML | closed |
| T-02-04 | Denial of Service（探测放大） | `file.list` 探测 | low | accept | 每次 load / 重连对**每个可见行**一次探测（N = 登记数，通常个位数），无轮询、无重试；已由 checker 要求显式记录该成本 | closed — accepted |
| T-02-05 | Information Disclosure（跨 server 串表） | `registryTarget(scope)` | medium | mitigate | `Persist.serverGlobal`；隔离由 `persistence/storage.test.ts:59-65` 拥有 | closed |
| T-02-06 | Elevation of Privilege（渲染期写副作用） | 侧栏 mount | medium | mitigate | 渲染路径只调 `session.list` / `file.list`（只读）；不调 `location.get`（会创建 project 行）、不调 `worktrees.refresh`、不写 `project.name/icon` | closed |
| T-02-07 | Repudiation（移除语义不可证） | 移除 → 会话可见性 | medium | mitigate | 移除只写 `removedAt`，行从 `visible()` 消失即整行不渲染，因此不存在「兜底分组漏出会话」的路径；浏览器 UAT 第 4 条实测 0 匹配 | closed |
| T-02-08 | Tampering（拖拽顺序被写坏） | `applyOrder` | low | accept | 纯函数重建顺序，非法输入丢弃；未做 UI 拖拽实测（UAT 第 10 条 skipped） | closed — accepted |
| T-02-SC | Tampering | 依赖安装 | high | mitigate | 本阶段 `git diff --name-only upstream/dev -- packages/` 只含 `workspace-sidebar/*`、`titlebar.tsx`、`i18n/en.ts`；未改 `package.json` / lockfile | closed |

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-02-01 | T-02-04 | 每次加载每行一次只读探测；登记表规模是个位数到几十，拒绝为理论放大增加缓存失效复杂度 | orchestrator (L1) | 2026-11-14 |
| AR-02-02 | T-02-08 | 拖拽顺序的纯函数契约已由单测覆盖，UI 拖拽留一次人工验证（UAT 第 10 条） | orchestrator (L1) | 2026-11-14 |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-11-14 | 8 | 8 | 0 | orchestrator retroactive augmentation (ASVS L1) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-11-14 (L1 depth, self-authored)

**遗留（不属本阶段计分，已记入 UAT skipped 行）：** ROW-06 的事件接线（新增/归档/删除会话）与 REG-04 的服务端拼写校准都只在单测层面覆盖，浏览器侧尚未制造真实事件；拖拽排序的 UI 行为同理。
