---
phase: 06-composer
verified: 2026-11-18T01:35:00Z
status: passed
human_accepted: 2026-11-18 — user validated in the OpenCode Test desktop package (channel test, v2.3.0): composer chip shows short name (@Msg0070.java), sent message renders the short name; hover title carries the full path (same change, code-verified). Environment note: the earlier "send spins forever" report traced to an upstream edge case — the draft's project directory (D:\00-pax\01-AndroidProject\02-Spain\pup-android) does not exist on this machine; the new-session prepare transition hangs client-side for a missing directory. Unrelated to Phase 6; not fixed in this milestone.
score: 4/4 must-haves verified
covered_files:
  - ".planning/phases/06-composer/06-01-PLAN.md"
  - ".planning/phases/06-composer/06-01-SUMMARY.md"
  - ".planning/phases/06-composer/06-02-PLAN.md"
  - ".planning/phases/06-composer/06-02-SUMMARY.md"
  - "packages/app/src/composer/editor/dom.test.ts"
  - "packages/app/src/composer/editor/dom.ts"
  - "packages/app/src/composer/editor/editor.test.ts"
  - "packages/app/src/composer/editor/editor.tsx"
  - "packages/session-ui/package.json"
  - "packages/session-ui/src/components/markdown-session-links.test.ts"
  - "packages/session-ui/src/components/markdown-session-links.ts"
  - "packages/session-ui/src/message/mention-label.test.ts"
  - "packages/session-ui/src/message/mention-label.ts"
  - "packages/session-ui/src/message/message-content.tsx"
covered_digest: "v4:sha256:e097914982133691aee458bf2608110f059aecda324aa098cadf3fa4698f5151"
behavior_unverified: 0
human_verification:
  - test: "启动 app dev 服务器（composer 输入框），@ 引用一个文件（如 src/app.tsx），观察 chip 显示"
    expected: "chip 显示 @app.tsx（basename）；鼠标悬停时浏览器原生 tooltip 显示完整路径 src/app.tsx（不含 @）"
    why_human: "chip 的 textContent/title 赋值在 DOM 构建代码中（editor.tsx:601-620），无组件级断言证明浏览器实际渲染与原生 title tooltip 效果"
  - test: "同一 draft 内 @ 引用两个同名文件（如 pkg/a/app.tsx 与 pkg/b/app.tsx）"
    expected: "两个 chip 分别显示 @a/app.tsx 与 @b/app.tsx（最短区分后缀），且各自 hover/title 仍显示完整路径"
    why_human: "区分后缀由纯函数计算且有单测覆盖，但 chip 实际渲染观感（两个 chip 同时显示、tooltip 各自正确）只能人眼确认"
  - test: "发送一条含 @ 同名文件引用的消息，在已发消息渲染层查看"
    expected: "消息内 @ 引用渲染为 basename（同名时最短区分后缀），hover 时 title 显示原始完整路径"
    why_human: "message-content.tsx:872-880 的 label/title 接线无组件级测试，实际 DOM 渲染与 tooltip 效果需人眼确认"
---

# Phase 6: @ 引用短路径（composer 与已发消息）Verification Report

**Phase Goal:** 用户在 composer 输入框与已发消息中看到 @ 文件引用以 basename 显示（同名时最短区分后缀），hover/title 保留完整路径；正文与 wire 层全路径不变（与 TUI 互操作）。
**Verified:** 2026-11-17
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | 用户在 composer 输入框中看到 file mention chip 显示 basename；hover/title 显示完整路径 | ✓ VERIFIED | `editor.tsx:588-590` 对整个 draft 的 file parts 调 `mentionLabels`；`:601-602` `textContent = "@" + label`；`:619-620` `dataset.path` + `title = part.path`（全路径，不含 @）。回退表达式带括号（concat 先于 `??`），正确 |
| 2 | 同一 draft 内多个同名文件时，chip 各自显示最短区分后缀，hover/title 仍是完整路径 | ✓ VERIFIED | 作用域 = 整个 draft（editor.tsx:589 flatMap）；`dom.test.ts:118-123` 表驱动用例「file pills showing distinguishing suffixes」(@a/app.tsx/@b/app.tsx → pkg/a、pkg/b 路径) 通过；后缀算法 10 条契约矩阵全绿 |
| 3 | 已发消息中 @ 引用渲染为 basename；同名时最短区分后缀，title/hover 显示原始完整路径 | ✓ VERIFIED | `message-content.tsx:824-826` labels memo（作用域 = props.files 的 mention.text）；`:872-873` `data-path` + `title=segment.text.slice(1)`；`:880` 显示 label。`labels().get(...)` 在 Show fallback 中正确解包 accessor |
| 4 | 提交后的消息正文与协议 wire 层仍写全路径 | ✓ VERIFIED | 三重机器证据：① `git diff --quiet d2605f6..HEAD -- request.ts model.ts submit.ts` 通过（exit 0，wire 零改动）；② `parseComposerEditor` file 分支 `editor.tsx:700-701` original.content 优先 / dataset.path 兜底；③ composer 全量套件 267 pass（含 request.test.ts 的 wire 文本断言）；tui/core/server touchpoint gate exit 0 |

**Score:** 4/4 truths verified（0 present-but-behavior-unverified）

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/session-ui/src/message/mention-label.ts` | mentionLabels 纯函数（basename + 最短区分后缀） | ✓ VERIFIED | 37 行实质实现，段窗口语义移植；含尾部分隔符 trim 与根路径回退 |
| `packages/session-ui/src/message/mention-label.test.ts` | 契约矩阵测试 | ✓ VERIFIED | 10 tests 全绿（9 原 + 1 IN-01 修复补） |
| `packages/session-ui/package.json` | exports 新增 ./mention-label | ✓ VERIFIED | line 37；app 侧 `@opencode/session-ui/mention-label` import 可解析（editor.tsx:33，测试通过） |
| `packages/session-ui/src/message/message-content.tsx` | CurrentHighlightedText 显示缩短 + title | ✓ VERIFIED | +12/-2 行；agent/link/剪贴板/segment 切分不动 |
| `packages/app/src/composer/editor/editor.tsx` | render/parse 双回路 | ✓ VERIFIED | render 缩短 + onCopy 接线（CR-01 修复）；parse original.content 优先 + dataset.path 兜底（WR-01 修复） |
| `packages/app/src/composer/editor/dom.ts` | matchMention file 跳过 label 比较 | ✓ VERIFIED | `:138-156` file 身份由 dataset.path/mime/filename 判定；其余 kind 保留原比较 |
| `packages/app/src/composer/editor/dom.test.ts` | 缩短 pill 匹配契约 | ✓ VERIFIED | 7 条表驱动用例 + copy 全路径用例 |
| `packages/app/src/composer/editor/editor.test.ts` | WR-01 回归测试 | ✓ VERIFIED | WeakMap-less pill 回读全路径 content 与 offsets |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| editor.tsx render | mentionLabels (session-ui) | `@opencode/session-ui/mention-label` import | ✓ WIRED | editor.tsx:33, 588 |
| message-content.tsx | mentionLabels | 相对路径 import `./mention-label` | ✓ WIRED | message-content.tsx:62, 824 |
| renderComposerEditor | parseComposerEditor | mentionParts WeakMap original.content 优先 | ✓ WIRED | editor.tsx:598 set / 657, 700-701 get |
| dom.ts matchMention | editor.tsx 同步 effect | dataset.path 身份判定 | ✓ WIRED | dom.ts:150-156；editorMatchesPrompt 测试全绿 |
| 复制路径（composer + 已发消息） | text/plain 全路径 | composerClipboardText / sessionReferenceClipboardText | ✓ WIRED | CR-01 修复：dom.ts:76-92、markdown-session-links.ts:147-175，测试覆盖（dom.test.ts:172、markdown-session-links.test.ts:138-140） |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| file chip 显示文本 | `mention.textContent` | `part.path` → mentionLabels | 是（label 或 basename） | ✓ FLOWING |
| file chip title | `mention.title` | `part.path`（全路径） | 是 | ✓ FLOWING |
| 消息 segment 显示 | `labels().get(...)` | `file.mention.text.slice(1)` | 是 | ✓ FLOWING |
| wire 正文 | `part.content` | original.content（非 DOM textContent） | 是（全路径） | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| mentionLabels 契约矩阵 | `cd packages/session-ui && bun test src/message/mention-label.test.ts` | 10 pass 0 fail | ✓ PASS |
| composer 全量套件（含 wire 断言、parse/match 契约） | `bun test --conditions=solid --preload ../ui/test/solid-jsx.ts --preload ./happydom.ts src/composer`（packages/app） | 267 pass 0 fail | ✓ PASS |
| 复制路径契约（已发消息侧） | `bun test ./src/components/markdown-session-links.test.ts ./src/message/mention-label.test.ts`（packages/session-ui） | 19 pass 0 fail | ✓ PASS |
| session-ui 包级 typecheck | `bun run typecheck` | 381 files 无错误 | ✓ PASS |
| app 触文件 typecheck | `bun check --no-script editor.tsx dom.ts dom.test.ts` | 573 files 无错误 | ✓ PASS |
| wire 零改动门 | `git diff --quiet d2605f6..HEAD -- request.ts model.ts submit.ts` | exit 0 | ✓ PASS |
| 触点评定门 | `git diff --quiet d2605f6..HEAD -- packages/tui core server` | exit 0 | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| MENT-01 | 06-02 | composer chip basename/区分后缀 + title 全路径 | ✓ SATISFIED | editor.tsx 接线 + dom.test.ts 契约 + wire 门 |
| MENT-02 | 06-01 | 已发消息 basename/区分后缀 + title 全路径 | ✓ SATISFIED | message-content.tsx 接线 + 10 条矩阵 + 复制路径契约 |

无 ORPHANED requirements（REQUIREMENTS.md 中 Phase 6 仅 MENT-01/MENT-02，均被计划认领）。

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | 无 TBD/FIXME/XXX/placeholder/空实现 | — | 06-REVIEW.md 1 critical + 2 warning 全部在修复迭代中解决（75a6d2f/0e7e8a6/aaa9fbf），re-review verdict: clean；残余 1 条 INFO（text/html clipboard flavor 仍带短 label）为非阻塞观察，app 内粘贴走 text/plain，wire 不变量不受影响 |

### Human Verification Required

### 1. Composer chip basename 显示与 title tooltip

**Test:** 启动 app dev 服务器，在 composer 输入框 @ 引用一个文件（如 src/app.tsx），观察 chip。
**Expected:** chip 显示 @app.tsx；hover 时浏览器原生 tooltip 显示完整路径 src/app.tsx（不含 @）。
**Why human:** textContent/title 赋值在 DOM 构建代码中，无组件级断言证明浏览器实际渲染与原生 tooltip 效果（与 06-01/06-02 SUMMARY 自标记的 human_judgment 残余一致）。

### 2. 同 draft 同名文件区分后缀显示

**Test:** 同一 draft 内 @ 引用两个同名文件（如 pkg/a/app.tsx 与 pkg/b/app.tsx）。
**Expected:** 两个 chip 分别显示 @a/app.tsx 与 @b/app.tsx，各自 hover 仍显示完整路径。
**Why human:** 算法语义有单测，但两 chip 同屏渲染观感只能人眼确认。

### 3. 已发消息渲染缩短

**Test:** 发送一条含 @ 同名文件引用的消息，在 timeline 查看已发消息。
**Expected:** @ 引用渲染为 basename（同名时最短区分后缀），hover 显示原始完整路径。
**Why human:** CurrentHighlightedText 的 label/title 接线无组件级测试，实际 DOM 渲染与 tooltip 效果需人眼确认。

### Gaps Summary

无 gap。4 条成功判据全部经代码与测试证据验证；3 项人眼 UAT（渲染观感）为唯一的 human_needed 来源。

---

_Verified: 2026-11-17_
_Verifier: the agent (gsd-verifier)_
