---
phase: 08-fold-persistence
verified: 2026-11-22T03:05:00Z
status: passed
score: 7/7 must-haves verified
covered_files:
  - ".planning/phases/08-fold-persistence/08-01-PLAN.md"
  - ".planning/phases/08-fold-persistence/08-01-SUMMARY.md"
  - "packages/app/src/workspace-sidebar/registry.ts"
  - "packages/app/src/workspace-sidebar/registry.test.ts"
  - "packages/app/src/workspace-sidebar/store.ts"
  - "packages/app/src/workspace-sidebar/sidebar.tsx"
  - "packages/app/e2e/regression/home.spec.ts"
behavior_unverified: 0
overrides_applied: 0
covered_digest: "v4:sha256:8f78e9132fe49ac08681c4f98bab2ee93f08347979d5a0a3f879260eca446ab9"
---

# Phase 8: 工作区行折叠状态持久化 Verification Report

**Phase Goal:** 用户对 Projects 侧栏每个工作区行的展开/折叠操作跨应用重启保留；启动时行恢复上次状态，不再全部折回折叠态；会话水位语义不变。
**Verified:** 2026-11-22T03:05:00Z
**Status:** passed

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | 用户展开过的行在应用重启后仍是展开态（FOLD-01） | ✓ VERIFIED | e2e `home.spec.ts:227`：点击 Alpha → `aria-expanded=true` → `page.reload()` → 仍 `true`（built 模式通过） |
| 2 | 用户折叠过的行在应用重启后仍是折叠态（FOLD-01） | ✓ VERIFIED | 同一 e2e：再次点击 Alpha → `false` → reload → 仍 `false`；Beta 行全程 `false` |
| 3 | 未操作过的行默认折叠（FOLD-02） | ✓ VERIFIED | e2e 首次打开断言 Alpha/Beta 均 `aria-expanded=false`；`registry.ts:30 initialRegistry.expanded = {}`，`store.ts:121` 仅 `true` 为展开 |
| 4 | 新登记目录仍自动展开并持久化（FOLD-02） | ✓ VERIFIED | `sidebar.tsx:343` 注册成功后 `registry.setExpanded(directoryKey(...), true)`，与既有 add-open 流程同一行；写入即进入 registry 文档 |
| 5 | 折叠态按 rowKey 记录且按 server scope 隔离（FOLD-01） | ✓ VERIFIED | schema `registry.ts:25` 字段为 `Persistence.record`；store 仍用 `registryTarget(scope)`（`Persist.serverGlobal`）；读写键均为 `directoryKey(entry.directory, host)` |
| 6 | 旧文档无 expanded 时 entries/scrollTop 不丢，expanded 回退 {}；单条脏值只丢该条 | ✓ VERIFIED | `registry.test.ts`：旧文档回退 `{}`、合法兄弟项在 `{ "d:/code/app": true, bad: "true" }` 下保留（`Schema.catchDecoding` 逐条恢复） |
| 7 | 会话水位仍为内存态，折叠重置语义不变（COLL-05 不回退） | ✓ VERIFIED | `sidebar.tsx:118-120` 注释与 `setRowWatermark` 未改；`sessions.test.ts` 水位 23 项全绿；registry 未新增任何水位字段 |

**Score:** 7/7 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `registry.ts` | 文档新增 `expanded` 字段与初始值 | ✓ EXISTS + SUBSTANTIVE | L25 `expanded: Persistence.record(Schema.Boolean)`；L30 initial 含 `expanded: {}` |
| `store.ts` | 读取/写入折叠态 | ✓ EXISTS + SUBSTANTIVE | L97-135 `expanded(key)` / `setExpanded(key, value)`；折叠删除 key，`remove()` 同时清理该目录 key |
| `sidebar.tsx` | 行折叠改读 registry | ✓ EXISTS + SUBSTANTIVE | L278 `registry.expanded`；L307 `registry.setExpanded`；L343 Add 自动展开；`setUi`/`ui.expanded` 零残留 |
| `registry.test.ts` | 文档 round-trip / 旧文档 / 脏表 | ✓ EXISTS + SUBSTANTIVE | 4 条文档级测试；`bun test` 56 项通过 |
| `home.spec.ts` | 跨 reload 折叠态回归 | ✓ EXISTS + SUBSTANTIVE | L227-274 新增用例；`bun run test:e2e:built -g "fold state"` 1 passed |

**Artifacts:** 5/5 verified

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `WorkspaceRow` toggle | registry store | `onToggle` → `registry.setExpanded` | ✓ WIRED | `sidebar.tsx:305-307` |
| Add folder flow | registry store | register 成功后 `registry.setExpanded` | ✓ WIRED | `sidebar.tsx:340-343` |
| registry store | `workspace-registry.v1` | `persisted(registryTarget(scope), WorkspaceRegistrySchema, initialRegistry)` | ✓ WIRED | `store.ts:88`；schema L21-27 |
| e2e click | persisted state | Solid store → persistStore debounce + `pagehide` flush | ✓ WIRED | reload 后断言通过（真实写穿 localStorage） |

**Wiring:** 4/4 connections verified

## Requirements Coverage

| Requirement | Status | Blocking Issue |
|-------------|--------|----------------|
| FOLD-01: 展开/折叠状态跨重启恢复 | ✓ SATISFIED | - |
| FOLD-02: 未操作行默认折叠；新增行自动展开且持久化 | ✓ SATISFIED | - |

**Coverage:** 2/2 requirements satisfied

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| - | - | 无新增 `any` / `try-catch` / 测试专属 seam | ℹ️ Info | 符合项目约束 |

**Anti-patterns:** 0 found

## Verification Commands

| Command | Result |
|---------|--------|
| `cd packages/app && bun test --conditions=solid --isolate --preload ../ui/test/solid-jsx.ts --preload ./happydom.ts ./src/workspace-sidebar` | 148 pass / 0 fail |
| `cd packages/app && bun check --no-script src/workspace-sidebar/{registry,registry.test,store}.ts src/workspace-sidebar/sidebar.tsx e2e/regression/home.spec.ts` | ✓ No type errors |
| `cd packages/app && PLAYWRIGHT_PORT=4317 bun run test:e2e:built -- e2e/regression/home.spec.ts -g "fold state"` | 1 passed (51.4s) |
| same e2e `--repeat-each=10 --workers=5 --retries=0` | 10 passed (1.1m) |
| post-review fix, `PLAYWRIGHT_PORT=4319 ... -g "fold state"` | 1 passed (49.7s) |

## Unrelated Observations

- 运行 `home.spec.ts -g "desktop Projects"` 时 4 条既有的 `SidebarOrganized`（server/project 分组）用例失败：它们断言 `#vertical-tabs-sidebar` 内的 "Local Server" group，但本 fork 的 `tabLayout = "projects"` / `sidebarOrganize = "projects"` 渲染的是 `workspace-sidebar` 登记行，`SidebarOrganized` 未被 titlebar 引用。该失败在本次改动前即成立，与本 phase 无关；本次新增用例通过。

## Human Verification Required

None blocking — the e2e uses a real `page.reload()` and covers the storage contract. Residual (IN-02 from review): the e2e exercises synchronous web `localStorage`; on desktop the same `workspace-registry.v1` document hydrates asynchronously over IPC (the path already used for `entries`/`scrollTop` in this fork). The user's next self-initiated restart after installing a new build is the final desktop confirmation; AI must not restart the installed app.

## Code Review Follow-up

`08-REVIEW.md` → `08-REVIEW-FIX.md`: WR-01 fixed (per-entry fold recovery), IN-01 fixed (folded keys deleted; removed rows pruned), IN-03 fixed (one `open` value drives aria/chevron/content), IN-02 narrowed to the note above.

## Gaps Summary

**No gaps found.** Phase goal achieved.

## Security

`08-SECURITY.md`: 3 threats (2 mitigated low, 1 accepted low); `threats_open: 0`. Fold map values decode through the schema; no new identity source or injection path.

---

*Verified: 2026-11-22T03:05:00Z*
*Verifier: primary agent*
