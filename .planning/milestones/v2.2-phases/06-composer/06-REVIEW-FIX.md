---
phase: 06-composer
fixed_at: 2026-11-17T00:00:00Z
review_path: .planning/phases/06-composer/06-REVIEW.md
iteration: 1
findings_in_scope: 3
fixed: 3
skipped: 1
status: all_fixed
---

# Phase 06: Code Review Fix Report

**Fixed at:** 2026-11-17
**Source review:** `.planning/phases/06-composer/06-REVIEW.md`
**Iteration:** 1

**Summary:**
- Findings in scope: 3 (CR-01, WR-01, IN-01)
- Fixed: 3
- Skipped: 1 (WR-02 — necessity category, outside `critical_warning` fix scope)

**Verification:** all gates ran in the main checkout on branch `workspace-registry` (no worktree; `workflow.use_worktrees` opt-out honored per spawn instructions). Per-fix gates: `bun check --no-script <changed files>` from the owning package, plus the owning package's `bun test`. Final full-suite runs: `packages/session-ui` `bun test src` → 628 pass / 0 fail; `packages/app` `bun run test:unit` → 2884 pass / 0 fail. Copy/paste behavior itself was not exercised in a real browser; the clipboard paths are covered by happy-dom unit tests only.

## Fixed Issues

### CR-01: Shortened label leaks into plain-text copy/paste, producing non-resolving @mentions on the wire

**Files modified:** `packages/app/src/composer/editor/dom.ts`, `packages/app/src/composer/editor/dom.test.ts`, `packages/app/src/composer/editor/editor.tsx`, `packages/session-ui/src/message/message-content.tsx`, `packages/session-ui/src/components/markdown-session-links.ts`, `packages/session-ui/src/components/markdown-session-links.test.ts`
**Commit:** `75a6d2f749`

**Applied fix:** Preserved the locked invariant "wire/body always full paths" by making both copy surfaces carry the full path, per the preferred resolution in the spawn brief:

1. **Composer:** added `composerClipboardText(root, ranges)` to `dom.ts` (mirrors `sessionReferenceClipboardText`: clones the selection, rewrites `[data-mention="file"], [data-mention="reference"]` pills to `"@" + dataset.path`, returns `undefined` when no file pill intersects so the browser's default copy proceeds). Wired an `onCopy` handler on the contenteditable editor in `editor.tsx` (placed next to `onPaste`), gated on the selection lying inside the editor. Copying a pill now puts the full `@src/app.tsx` on `text/plain`, so the existing paste path inserts a resolvable reference.
2. **Sent messages:** added `data-path={segment.text.slice(1)}` to the `data-highlight="file"` span in `message-content.tsx` and extended `sessionReferenceClipboardText` (`markdown-session-links.ts`) to also match and rewrite `[data-highlight="file"][data-path]` nodes to their full `@path`. Both copy call sites (`copySessionReferences` in `message-content.tsx`, `copySelection` in `markdown.tsx`) flow through this one function, so both are covered.
3. Because a selection can start/end inside a displayed label (which clones label text *without* the wrapping span), `sessionReferenceRange` now expands ranges touching file mentions to the whole mention — the same atomic-copy precedent session references already used in that function. Without this, a partial selection still copied the short label.

**Tests:** `composerClipboardText` (full-path rewrite + undefined for pill-free selections) in `dom.test.ts`; file-mention clipboard rewrite in `markdown-session-links.test.ts`. All pass; no pinned test changed behavior.

### WR-01: File pill without a WeakMap entry falls back to the shortened label as `content`

**Files modified:** `packages/app/src/composer/editor/editor.tsx`, `packages/app/src/composer/editor/editor.test.ts` (new)
**Commit:** `0e7e8a69db`

**Applied fix:** `parseComposerEditor` now prefers `element.dataset.path` (which survives `cloneNode`, native-undo reinsertion and drag-copy duplication) over the DOM `textContent` when no stored part exists:

```ts
const fileContent =
  original?.type === "file" ? original.content : element.dataset.path ? "@" + element.dataset.path : content
```

This keeps `content`, `start` and `end` computed against the full path, so `request.ts`/`submit.ts` submit a resolvable reference. The fallback chain is: stored part → `dataset.path` → label text (hand-built DOM with neither).

**Test:** exported `parseComposerEditor` (visibility change only — the module already imports cleanly under the app's bun test setup; no new seam) and added `editor.test.ts` asserting a `data-mention="file"` pill with `dataset.path` but no stored part parses to `content: "@src/app.tsx"` with matching offsets. Verified the test **fails on the pre-fix logic** (reverted the one line, observed failure, restored).

### IN-01: Trailing-separator path with a same-basename peer yields a label ending in the separator

**Files modified:** `packages/session-ui/src/message/mention-label.ts`, `packages/session-ui/src/message/mention-label.test.ts`
**Commit:** `aaa9fbf5ef`

**Applied fix:** `mentionLabels` trims trailing separators once up front (matching `getFilename`'s trimming) so the segment window never sees the empty trailing segment: `/a/b/` next to `/x/b` now labels `a/b` / `x/b` instead of `b/` / `x/b`, consistent with the lone-path case (`b`).

**Deviation from the reviewer's literal suggestion:** a bare trim breaks the pinned root-path contract (`mention-label.test.ts`: `C:\` must keep label `C:\`; trimming would leave the drive letter `C:`, colliding with peer `D:\C:`'s window and producing a non-unique label). Trimming therefore keeps the original path when the remainder is empty or a bare drive letter (`/`, `C:\`, `C:/`). All 9 pre-existing tests pass unchanged, including the root-path contract.

**Test:** added a pinning case for `/a/b/` + `/x/b` → `a/b` / `x/b`.

## Skipped Issues

### WR-02: Dead `??` fallback on `labels.get(...)` — the missing key cannot occur

**File:** `packages/app/src/composer/editor/editor.tsx:587`, `packages/session-ui/src/message/message-content.tsx:879`
**Reason:** Out of fix scope. The finding carries `**Category:** necessity`, and the `critical_warning` fix scope excludes necessity findings (removing code is a scope decision for the human, not a defect fix). The reviewer also noted removal "is a scope decision — confirm with the orchestrator before deleting." No edit applied; the unreachable fallbacks remain as-is.

---

_Fixed: 2026-11-17_
_Fixer: the agent (gsd-code-fixer)_
_Iteration: 1_
