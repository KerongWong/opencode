---
phase: "02"
slug: "checkout"
status: verified
threats_open: 0
asvs_level: 1
created: "2026-11-13"
---

# Phase 02 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

Register authored at plan time (`<threat_model>` present in both `02-01-PLAN.md` and `02-02-PLAN.md`), ASVS level 1 → L1 grep-depth classification, no auditor escalation.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Projects 视图 → 各服务器 `worktree` 接口 | 侧栏发起的清单读取请求跨过服务器边界；目标服务器必须由入口（`entry.ctx.sync`）决定 | projectID（非敏感标识）、worktree 目录路径 |
| 服务器清单 → 客户端 projects store | 服务器返回的目录集合经 `withWorktreeInventory` 重写 `worktrees`/`sandboxes`，进而改变分组 | 文件系统路径（本机信息） |
| inventory 目录 → 项目行 | 目录集合若被当作行源会凭空产生行 | 路径字符串 |
| 会话目录 → 分组 key | 用户可控的工作目录参与最近包含者比较与 key 拼接 | 路径字符串 |
| 分组 key → 持久化侧栏状态 | key 变化会让 `order`/`removed` 失配 | key 字符串 |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-02-01 | Information Disclosure | `SidebarProjects` 的清单 effect | medium | mitigate | 只为 `inbox.entries()` 出现的 projectID 发请求，跳过 `!project?.id` 与 `"global"`（`projects.tsx:80`）；请求经 `entry.ctx.sync.worktrees`（`projects.tsx:90,92`）——`serverCtx(` 在文件中出现 **0** 次 | closed |
| T-02-02 | Elevation of Privilege | `entry.ctx.sync.worktrees` 成员选择 | high | mitigate | 只调 `cached` 与 `list`；`.refresh(` 在 `projects.tsx` 中出现 **0** 次（`refresh` 仅出现在说明注释里），渲染期不产生写入副作用 | closed |
| T-02-03 | Tampering (persisted view state) | 清单到达后的分组身份 | medium | mitigate | key 构造未变（`projects-groups.ts:56` `${server}\u0000${comparablePath(checkout)}`）；清单只经 `withWorktreeInventory`（`workspaces/inventory.ts:17-25`）更新 `worktrees`/`sandboxes`；双路径同 key 回归钉住 | closed |
| T-02-04 | Denial of Service (UI) | 清单读取失败路径 | low | accept | `list` 自带 `.catch`；实测注入 503 后无 toast、无 loader、无错误文案，4 行仍按 `sandboxes`/canonical 分组（UAT test 2） | closed — accepted |
| T-02-05 | Tampering (row identity) | `sessionProjectDirectory` 根集合 | high | mitigate | 根集合只并入 `sandboxes` 与 canonical，key 表达式不变；双路径同 key 用例在修复前失败 | closed |
| T-02-06 | Spoofing (path prefix match) | `containsDirectory` 的最近包含者选择 | medium | mitigate | 归属完全委托 `@opencode/util/path` 的 `containsDirectory`/`comparablePath`/`sameDirectory`（`projects-groups.ts:1,27,40,41`），不写字符串前缀比较 | closed |
| T-02-07 | Denial of Service (hot path) | `groups()` 每次会话更新重算的根集合构造 | medium | mitigate | strobe 对改动前构建实测 `cpu.work` +1499%，据此加 per-project 根集合记忆化（`projects-groups.ts:14-29`），复测 +3%（无判定） | closed |
| T-02-08 | Repudiation (undocumented behavior) | D-08 的「更深 checkout 独立成行」 | low | accept | 行为记为回归用例（`moves a session into a deeper checkout the inventory reveals`），并在 `02-CONTEXT.md` D-08 与设计文档留下依据 | closed — accepted |
| T-02-SC | Tampering | npm/pip/cargo installs | high | mitigate | 本阶段 `7a61e6550f..HEAD` 未改动任何 `package.json` / lockfile（`git diff --name-only` 只有 6 个源码与文档文件），无新增依赖 | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above `workflow.security_block_on` (high) count toward `threats_open`*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-02-01 | T-02-04 | 本次挂载内清单读取失败不重试：侧栏保持 canonical 与 `sandboxes` 分组，恢复路径是重新挂载或服务器的 `worktree.updated` 事件。**注意**：`projects.tsx` 的注释与 D-04 曾把「重连」写成恢复路径，而该路径在代码中不存在（`sync.tsx` 只用 `refetchType: "none"`）——这是 `02-REVIEW.md` WR-02，仍为 open，属产品取舍，不在本安全门的计分范围 | phase-02 executor + verifier | 2026-11-13 |
| AR-02-02 | T-02-08 | 清单揭示的更深 checkout 独立成行是有意语义，不做「一行拆成多行」的修补 | phase-02 planner (D-08) | 2026-11-13 |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-11-13 | 9 | 9 | 0 | gsd-secure-phase (ASVS L1, grep-depth) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-11-13
