---
phase: "01"
slug: "row-source-convergence"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-11-13"
---

# Phase 01 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| 服务器索引页 → Projects 行 | 已抓取的一页 root 会话决定窗口下限；空页面与“无页面”必须区分 | 会话 id、`time.updated`、`time.archived`、`parentID`、`projectID` |
| 客户端 known 存储 → Projects 行 | 本进程内新建或加载的会话只能经有界窗口进入 Projects | 会话元数据（内存态） |
| `inbox-sessions` 查询结果 → `entries()` 合并选项 | `dataUpdatedAt` 只在页面无存活 root 时作为下限 | 客户端墙钟时间戳 |
| 包安装 → 依赖面 | 本 phase 不应引入新依赖 | `package.json` / lockfile |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-01-01 | Information Disclosure | `mergeRootSessionIndex` final filter (`session-index.ts`) | medium | mitigate | 末过滤 `!info.parentID && (options.includeArchived !== false \|\| info.time.archived === undefined)`（session-index.ts:56）：归档行不可能保留 Projects 行，即使 known 副本覆盖了活跃索引行。 | closed |
| T-01-02 | Tampering (view state) | `createSessionInbox` option mapping (`inbox-model.ts`) | low | mitigate | 映射为单表达式 `includeArchived: options.archived === true`（inbox-model.ts:207）；`session-index.test.ts` 固定默认值，Inbox 归档分区不会静默丢行。 | closed |
| T-01-03 | Information Disclosure | locally known sessions in `mergeRootSessionIndex` | medium | mitigate | known root 只有在已索引或 `time.updated >= floor` 时才加入（session-index.ts:49）；进程内加载的窗口外旧会话不能新增 Projects 行。 | closed |
| T-01-04 | Denial of Service | `entries()` hot-path recompute | low | accept | 每行一次整数比较、索引页 ≤50 行的一次 `reduce`，不物化数组；`packages/app/perf/session-index.bench.ts` 以 strobe 对 `origin/dev` 度量并记录 verdict。见 Accepted Risks Log。 | closed |
| T-01-05 | Tampering (view state) | `createSessionInbox` bound selection (`inbox-model.ts`) | medium | mitigate | `boundedKnown: options.archived !== true`（inbox-model.ts:208）：Inbox 视图不传 bound，归档行不会被 floor 丢弃；merge 级用例固定了反向行为。 | closed |
| T-01-06 | Tampering (view state) | `inbox-sessions` request (`inbox-model.ts`) | medium | mitigate | 请求带 `archived: false`（inbox-model.ts:132），归档行不占 50 个索引槽；`INDEX_LIMIT`、`order`、`parentID: null` 未变。 | closed |
| T-01-07 | Information Disclosure | `mergeRootSessionIndex` page/fallback decision (`session-index.ts`) | medium | mitigate | `indexed !== undefined` 才推导下限（session-index.ts:33）；任何已获取数组（含 `[]`）都走有界分支，空页面不会回退到全部 known。 | closed |
| T-01-08 | Denial of Service | `entries()` hot-path recompute (`inbox-model.ts`, `session-index.ts`) | low | accept | 每次重算增加一次 `undefined` 比较与每行一次谓词；strobe case 已对 `origin/dev` 度量并记录 verdict。见 Accepted Risks Log。 | closed |
| T-01-09 | Information Disclosure | `mergeRootSessionIndex` empty-page floor (`session-index.ts`) | medium | mitigate | 下限表达式 `survivors === undefined ? undefined : Number.isFinite(survivors) ? survivors : options.fetchedAt`（session-index.ts:44）：仅当页面无存活 root 时才使用抓取时间，非空页面不能放宽窗口。 | closed |
| T-01-10 | Tampering (view state) | `entries()` merge options (`inbox-model.ts`) | medium | mitigate | `fetchedAt` 与 `boundedKnown` 在同一个 options 字面量上（inbox-model.ts:208-209），只有 Projects 视图传入；`home/sessions/index.ts` 与 `shell/commands/palette.ts` 仍为两参数调用。 | closed |
| T-01-11 | Tampering (view state) | `time.updated` vs `dataUpdatedAt` clock domain (`session-index.ts`, `inbox-model.ts`) | low | accept | 两个时间戳在同一墙钟上比较，对本地 sidecar 成立；远程时钟偏移只会造成行集差异，可由 remount/reconnect 重新推导。见 Accepted Risks Log。 | closed |
| T-01-SC | Tampering | package installs | high | mitigate | 本 phase 无依赖变更：`618fbc20..HEAD` 仅改动 `session-index.ts`、`session-index.test.ts`、`inbox-model.ts`，`package.json` 与 lockfile 未变。 | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-01-01 | T-01-04 | 热路径成本有界：每 known 行一次整数比较，索引页 ≤50 行一次 `reduce`，复用既有 strobe 基线；`--base origin/dev --head .` verdict 为 less。 | project owner (plan 01-02 threat model) | 2026-11-13 |
| AR-01-02 | T-01-08 | 同上，01-03 只增加一次 `undefined` 比较与每行一次谓词；无新分配。 | project owner (plan 01-03 threat model) | 2026-11-13 |
| AR-01-03 | T-01-11 | `time.updated` 是服务端时间，`dataUpdatedAt` 是客户端墙钟；本地 sidecar 共享时钟，远程偏移只造成行集差异，remount/reconnect 可重新推导。未引入新时钟源或服务端 API。 | project owner (plan 01-04 threat model) | 2026-11-13 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-11-13 | 12 | 12 | 0 | gsd-secure-phase (L1, asvs_level 1) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-11-13
