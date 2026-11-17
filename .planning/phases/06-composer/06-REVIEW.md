---
phase: 06-composer
reviewed: 2026-11-17T00:00:00Z
depth: standard
files_reviewed: 6
files_reviewed_list:
  - packages/session-ui/src/message/mention-label.ts
  - packages/session-ui/src/message/mention-label.test.ts
  - packages/session-ui/src/message/message-content.tsx
  - packages/app/src/composer/editor/editor.tsx
  - packages/app/src/composer/editor/dom.ts
  - packages/app/src/composer/editor/dom.test.ts
findings:
  critical: 1
  warning: 2
  info: 1
  total: 4
  necessity: 1
status: issues_found
---

# Phase 06: Code Review Report — @ mention short path (composer & sent messages)

**Reviewed:** 2026-11-17
**Depth:** standard
**Files Reviewed:** 6
**Status:** issues_found

## Summary

Reviewed the @ file mention shortening work: the `mentionLabels` disambiguation pure function (ported from dsh segment-window semantics), the sent-message rendering in `CurrentHighlightedText`, and the composer pill render/parse/match round trip in `editor.tsx` / `dom.ts`. Verified against `06-CONTEXT.md` locked decisions (basename default, shortest distinguishing suffix per scope, `title` carries full path without `@`, wire/body layers keep full paths).

The disambiguation algorithm itself is sound — I traced the same-basename chain, root-path, mixed-separator, and case-sensitivity cases against the tests and they behave as contracted. The SolidJS memos in `message-content.tsx` are correctly scoped (no stale-memo or untracked-read issues found). Both test suites pass locally (`mention-label.test.ts`: 9 pass; `dom.test.ts`: 22 pass).

The critical problem is a regression the phase brief explicitly guards against (**正文与 wire/协议层永远写全路径**): the shortened label became the pills' DOM text, and there is no plain-text recovery path. Every plain-text channel — in-app copy of a composer pill, copy of a sent-message mention, paste back into the draft — now carries the *short* name, and the pasted short name flows into the submitted message text as a non-resolving `@app.tsx` reference. The necessity-review reference was read before classifying the necessity finding.

## Critical Issues

### CR-01: Shortened label leaks into plain-text copy/paste, producing non-resolving @mentions on the wire

**File:** `packages/app/src/composer/editor/editor.tsx:586-587`, `packages/session-ui/src/message/message-content.tsx:871-879`, `packages/app/src/composer/editor/interaction.ts:767-805`, `packages/app/src/composer/request.ts:130`, `packages/app/src/composer/submit.ts:473`
**Issue:** The phase decision is that display shortens while the wire keeps full paths. But the display label is now the *DOM text* of both pill types, and neither surface has a clipboard path that restores the full path:

1. **Composer → composer:** `renderComposerEditor` sets `mention.textContent = "@" + <short label>`. The composer has **no `onCopy` handler** (verified by grep — no `copy` listener anywhere in `packages/app/src/composer`). Copying a selection that spans a file pill puts the short `"@app.tsx"` on `text/plain`. `onPaste` (`interaction.ts:767-805`) inserts `text/plain` verbatim as a text node. `parseComposerEditor` reads it as plain text (not a pill), and `request.ts:130` / `submit.ts:473` build the wire text by joining `part.content` — so the submitted message contains `@app.tsx`, which does not resolve to `src/app.tsx`. Before this change the pill's DOM text *was* the full `@src/app.tsx`, so the same copy-paste flow produced a resolvable reference.
2. **Sent message → anywhere:** the `data-highlight="file"` span (`message-content.tsx:870-880`) renders only the short label and carries the full path solely in `title` — there is no `data-path` attribute. `copySessionReferences` (`message-content.tsx:895-907`) only intercepts selections intersecting `[data-session-reference]` spans and otherwise lets the browser copy DOM text; `markdown.tsx:718` similarly falls back to `selection.toString()`. Copying a file mention from the timeline now yields `@app.tsx` instead of `@src/app.tsx`, and pasting that into the composer lands in the wire as a dangling reference per flow 1.

This is reachable through a normal user flow (copy a mention, paste it into the next prompt) and silently degrades the model-facing text — exactly the layer the phase locked as "full paths, always."

**Fix:**
```ts
// editor.tsx: add a copy listener on the contenteditable editor (e.g. alongside onPaste):
onCopy={(event) => {
  const selection = window.getSelection()
  if (!selection?.rangeCount || !event.currentTarget.contains(selection.anchorNode)) return
  // Rebuild text from parts: file pills contribute "@" + dataset.path, not their label.
  const text = composerClipboardText(event.currentTarget, selection) // walk DOM, use dataset.path for [data-mention=file]
  if (text === undefined) return
  event.preventDefault()
  event.clipboardData?.setData("text/plain", text)
}}
```
and for sent messages, either add `data-path={segment.text.slice(1)}` to the `data-highlight="file"` span and extend `sessionReferenceClipboardText` (`markdown-session-links.ts:147`) to rewrite `[data-highlight="file"]` nodes to their full path on copy, or handle them in `copySessionReferences` the same way session references are handled.

## Warnings

### WR-01: File pill without a WeakMap entry falls back to the shortened label as `content`, corrupting wire text and mention offsets

**File:** `packages/app/src/composer/editor/editor.tsx:682-691`
**Issue:** `parseComposerEditor` recovers the full path from `mentionParts.get(element)` (the WeakMap populated by `renderComposerEditor`). When a pill element reaches the parser **without** a WeakMap entry, the fallback is the DOM `textContent` — which is now the *shortened* label:

```ts
const fileContent = original?.type === "file" ? original.content : content
```

`content` for a shortened pill is `"@app.tsx"`, so the parsed part gets `content: "@app.tsx"` (submitted verbatim per `request.ts:130`) and `start`/`end` offsets computed against the shortened length. The full path is still available — `element.dataset.path` survives `cloneNode`/copy because attributes clone with the element — but it is only used for `path`, not `content`.

Reachability: the internal paste path is defused (`interaction.ts:767-805` forces `text/plain`, so pasted pills become text, not elements), but elements without WeakMap entries still arise via native **undo** of a pill deletion (Chromium's contenteditable undo can reinsert reconstructed nodes) and **drag-copy duplication** of a pill inside the editor. Before this change the same fallback read the full path from `textContent`, so this is a regression introduced by moving content identity into the WeakMap. Note `editorMatchesPrompt` (`dom.ts:127-133`) matches such a clone successfully by dataset, so the sync effect will *not* re-render it away — the corrupted parse is what lands in the store.

**Fix:**
```ts
// editor.tsx:684 — prefer the dataset (survives cloning) over display text when no original part exists:
const fileContent =
  original?.type === "file" ? original.content : element.dataset.path ? "@" + element.dataset.path : content
```
and add a `dom.test.ts`/editor test for a `data-mention="file"` pill carrying `dataset.path` but no stored part, asserting the parsed `content` equals the full `@path`.

### WR-02: Dead `??` fallback on `labels.get(...)` — the missing key cannot occur

**File:** `packages/app/src/composer/editor/editor.tsx:587`, `packages/session-ui/src/message/message-content.tsx:879`
**Category:** necessity
**Issue:** Impossible-state guard (necessity): `mentionLabels` sets a label for **every** path in its input array (`mention-label.ts:21` and `:27` run for all rows), and both call sites build that input from exactly the parts/segments being rendered in the same expression (`editor.tsx:573-575` flatMaps the same `prompt`; `message-content.tsx:824-826` flatMaps the same `props.files`). Therefore `labels.get(part.path)` / `labels().get(segment.text.slice(1))` cannot return `undefined` for these keys, and the `?? part.content.slice(1)` / `?? segment.text.slice(1)` fallback branches are unreachable (this is provable from the code, not judgment). They read as if a miss were possible, which invites future "fixes" of a state that cannot occur.

**Fix:** Drop the fallback (or assert intent with a comment, e.g. `// mentionLabels covers every path in scope`), e.g. `mention.textContent = "@" + labels.get(part.path)!`. Removal is a scope decision — not a defect fix — so confirm with the orchestrator before deleting.

## Info

### IN-01: Trailing-separator path with a same-basename peer yields a label ending in the separator

**File:** `packages/session-ui/src/message/mention-label.ts:13,26-27`
**Issue:** For a path with a trailing separator, the final empty segment makes the count-1 suffix `""` (handled), but at count 2 the window includes the trailing separator: paths `"/a/b/"` and `"/x/b"` produce labels `"b/"` and `"x/b"`. Displaying `b/` (with a dangling separator, and `title="/a/b/"`) looks accidental next to the no-peer case, which the tests pin to `"b"` (`mention-label.test.ts:48-53`); the two cases disagree about whether the trailing separator is part of the label.

**Fix:** Normalize once up front — trim trailing separators before splitting (e.g. `entry.path.replace(/[/\\]+$/, "")`, matching `getFilename`'s trimming in `@opencode/util/path:3`) so segment windows never see the empty trailing segment — or document the `b/` behavior with a test.

---

_Reviewed: 2026-11-17_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: standard_
