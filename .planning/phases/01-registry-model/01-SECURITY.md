---
phase: "01"
slug: "registry-model"
status: verified
threats_open: 0
asvs_level: 1
created: "2026-11-14"
---

# Phase 01 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

**注册表来源说明：** 本阶段的 `01-PLAN.md` 没有 `<threat_model>` 块（planner 未写）。按 `secure-phase` 的规则，这种情况**不允许**直接跳过到干净状态；本文件因此以 **retroactive-STRIDE** 方式由 orchestrator 在 **ASVS L1（grep/读码深度）** 手工建立，依据是 `registry.ts` 的实际实现与它的 48 条单测。未 spawn `gsd-security-auditor`。`threats_open: 0` 的含义是「按 L1 深度没有发现需要阻断的开放威胁」，不是「经独立审计员确认」。

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| 设备持久化存储 → 模块 | 登记表文档由客户端存储读出后解码；文档可能被手工编辑、被旧版本写坏或被并发写覆盖 | JSON 文档（目录路径、显示名、序号、时间戳） |
| 用户输入 → 持久化键 | 目录选择器/拖拽提供的字符串成为主键 | 绝对路径字符串（用户可控） |
| server scope → 键命名空间 | 每个 server 一份登记表，共用同一个全局存储文件 | scope 前缀 + 键名 |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-01-01 | Tampering | 持久化文档解码 | medium | mitigate | `Persistence.withInitial` + schema 解码；坏文档回落初始值，逐条恢复由 `persistence/schema.test.ts` 拥有；登记表自身只断言文档形状与键字面量 `workspace-registry.v1` | closed |
| T-01-02 | Spoofing（路径→键伪造） | `register` / `remove` 的入参 | high | mitigate | `registrable()` 守卫先于归一执行：空串、纯空白、相对路径一律拒绝并原样返回 entries（WR-01 修复，`77266b8e7e`，5 条回归先红后绿） | closed |
| T-01-03 | Tampering（跨平台键碰撞） | `normalizeDirectory` 的平台分支 | high | mitigate | Windows 专属重写（`\`→`/`、盘符大写、盘符根修复）只在 `platform === "win32"` 生效；POSIX 保留 `\` 为文件名字符（WR-02 修复，`84065d5195`，4 条回归） | closed |
| T-01-04 | Information Disclosure（跨 server 串表） | `registryTarget(scope)` | medium | mitigate | `Persist.serverGlobal(scope, "workspace-registry.v1")`；跨 scope 隔离由 `persistence/storage.test.ts:59-65` 拥有（登记表不重复证明） | closed |
| T-01-05 | Denial of Service | 模块整体 | low | accept | 完全零 I/O、每次调用 O(n)，无递归、无循环放大、无定时器；输入规模即登记表长度（个位数到几十） | closed — accepted |
| T-01-06 | Repudiation（无记录的行为） | 盘符根与符号链接别名 | low | accept | 盘符根保留 `C:/`（不是 `C:`，否则服务端 `isWindowsStoragePath` 拒绝）；符号链接别名会登记成两个工作区，这是「客户端没有 `fs`、不做 realpath」的已承认残余，写进模块注释 | closed — accepted |
| T-01-SC | Tampering | 依赖安装 | high | mitigate | 本阶段 `git diff --name-only upstream/dev -- packages/` 只有两个新文件；未改动任何 `package.json` / lockfile | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above `workflow.security_block_on` (high) count toward `threats_open`*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-01-01 | T-01-05 | 纯函数模块，无 I/O 与放大路径；拒绝为理论 DoS 增加限流 | orchestrator (L1) | 2026-11-14 |
| AR-01-02 | T-01-06 | 符号链接别名 = 两个工作区：客户端无法 `realpath`，纳入 SPEC §4.4 的已知限制；盘符根用 `C:/` 已在 WR/checker 两轮里修正 | orchestrator (L1) | 2026-11-14 |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-11-14 | 6 | 6 | 0 | orchestrator retroactive-STRIDE (ASVS L1) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-11-14 (L1 depth, self-authored — see the origin note above)

**遗留到 Phase 2 的契约风险（不属本阶段计分）：** WR-03 —— 登记表把盘符转成大写，而服务端 `session.list` 按原样 `eq(directory)` 过滤，因此「首次从小写盘符打开的目录」可能渲染出零会话的行。这条已作为 REG-04（用服务端 `location.directory` 拼写校准）写入 Phase 2 的必须项，并要求 Phase 2 用 `directoryKey` 比较而非 `===`。
