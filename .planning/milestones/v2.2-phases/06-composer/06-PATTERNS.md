# Phase 6: @ 引用短路径（composer 与已发消息）- Pattern Map

**Mapped:** 2026-11-17
**Files analyzed:** 3（1 新建 + 2 修改，含 1 个测试文件）
**Analogs found:** 3 / 3

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `packages/session-ui/src/message/mention-label.ts` (NEW) | utility | transform（纯函数） | `packages/session-ui/src/message/agent-label.ts` | role-match（同目录纯函数 + colocated `.test.ts` 惯例） |
| `packages/session-ui/src/message/mention-label.test.ts` (NEW) | test | batch（表驱动断言） | `packages/session-ui/src/message/agent-label.test.ts` | exact（bun:test 惯例完全一致） |
| `packages/session-ui/src/message/message-content.tsx` (MODIFIED, `CurrentHighlightedText` L822-884) | component | render（segment 切分 + 显示文本映射） | 自身现有实现（修改点即 analog） | exact |
| `packages/app/src/composer/editor/editor.tsx` (MODIFIED, `renderComposerEditor` L570-616) | component | render（DOM span 渲染） | 自身现有实现 + `mention.title` 先例（L586） | exact |
| `packages/app/src/composer/editor/dom.ts` (MODIFIED, `matchMention` L106-131) | utility | transform（chip 身份匹配判定） | 自身现有实现（self-analog：修改点即 matchMention 身份检查语义，L106-131） | exact |
| `packages/app/src/composer/editor/dom.test.ts` (MODIFIED) | test | batch（表驱动断言） | 自身现有测试文件（dom.test.ts 现有 pill()/fileMention() helper 与 editorMatchesPrompt 用例） | exact |

算法参照（外部只读，**不可 import**，需移植）：`D:/01-project/02-opensource/deepseek-harness/packages/client/ui-workspace/src/client/path-suffix.ts`

## Pattern Assignments

### `packages/session-ui/src/message/mention-label.ts` (NEW, utility, transform)

**Analog（模块形态/导出风格）:** `packages/session-ui/src/message/agent-label.ts`（全文，git-tracked）

```ts
export function agentLabel(agent: string | undefined, visible: boolean) {
  return visible && agent ? agent[0]?.toUpperCase() + agent.slice(1) : ""
}
```

**惯例要点：**
- 纯函数单文件、无副作用、无 Solid 依赖；命名 `<domain>-label.ts`，导出单个命名函数。
- 测试 colocated：同目录 `agent-label.test.ts`，`import { expect, test } from "bun:test"` + 相对路径 import（不使用 `src` 别名）。
- session-ui 内部模块间用相对路径 import（见 `message-content.tsx` L61 `import { agentLabel } from "./agent-label"`）。
- 需要 `@opencode/util/path` 时直接 import（session-ui 已依赖，`message-content.tsx` L35 `import { getFilename } from "@opencode/util/path"`）。

**算法移植源（dsh，只读参考）:** `path-suffix.ts:11-27` — `distinguishingPathSuffixes()`：

```ts
export function distinguishingPathSuffixes<Id>(
  workspaces: readonly { readonly id: Id; readonly title: string; readonly path: string }[],
): ReadonlyMap<Id, string> {
  // Segments and the separators between them alternate: `/a/b` → ['', '/', 'a', '/', 'b'].
  const rows = workspaces.map(workspace => ({ ...workspace, parts: workspace.path.split(/([\\/])/) }))
  const suffix = (parts: readonly string[], count: number): string => parts.slice(-(2 * count - 1)).join('')
  const suffixes = new Map<Id, string>()
  for (const row of rows) {
    const peers = rows.filter(other => other !== row && other.title === row.title)
    if (peers.length === 0) continue
    let count = 1
    // A root path (`/`, `C:\`) ends in an empty segment; grow past it.
    while (2 * count - 1 < row.parts.length && (suffix(row.parts, count) === '' || peers.some(peer => suffix(peer.parts, count) === suffix(row.parts, count)))) count++
    suffixes.set(row.id, suffix(row.parts, count))
  }
  return suffixes
}
```

**移植适配要点（按 CONTEXT 决策）：**
- dsh 按 `title`（workspace 显示名）分组消歧；本阶段按 **basename** 分组：peers = 作用域内 `getFilename(path)` 相同的其他项。
- 输入为作用域内 `{path}[]`（composer draft 的全部 file mention parts / 单条消息的 `files[]`），输出 `Map<path, label>`（或同名函数签名，由实现定夺）。
- 无冲突项的 label = `getFilename(path)`（CONTEXT 明确"无冲突时不带父目录"）；有冲突项的 label = 最短区分后缀（保留原分隔符）。
- 可复用现有 basename 助手 `@opencode/util/path`（`packages/util/src/path.ts:1-6`）：

```ts
export function getFilename(path: string | undefined) {
  if (!path) return ""
  const trimmed = path.replace(/[/\\]+$/, "")
  const index = Math.max(trimmed.lastIndexOf("/"), trimmed.lastIndexOf("\\"))
  return trimmed.slice(index + 1)
}
```

**新增包导出（必须）:** `packages/session-ui/package.json` 的 `exports` 需加一条（格式仿现有 `"./attachment-card": "./src/message/attachment-card.tsx"`）：

```jsonc
"./mention-label": "./src/message/mention-label.ts",
```

App 侧按 `@opencode/session-ui/mention-label` import（editor.tsx 现有 import 风格，如 L32 `import { AttachmentCard } from "@opencode/session-ui/attachment-card"`）。

---

### `packages/session-ui/src/message/mention-label.test.ts` (NEW, test)

**Analog:** `packages/session-ui/src/message/agent-label.test.ts`（全文，git-tracked）：

```ts
import { expect, test } from "bun:test"
import { agentLabel } from "./agent-label"

test("capitalizes the agent when agents are visible", () => {
  expect(agentLabel("build", true)).toBe("Build")
})
```

**参照用例（dsh 测试语义，移植时改用 bun:test `test()` 风格）:** `D:/01-project/02-opensource/deepseek-harness/packages/client/ui-workspace/tests/path-suffix.client.spec.ts:7-49`，覆盖 5 个契约：
1. 无同名 → 无 entry（或全 basename，按实现的返回约定）。
2. 多个同名 → 各自最短唯一后缀（`/home/me/a/workspace` → `a/workspace`；注意中间项要长到 `me/b/workspace` 才唯一）。
3. 同名但尾部不同 → 按 basename 区分。
4. 自身是 peer 的后缀时取整路径、保留分隔符（`/` vs `C:\` 混合）。
5. 根路径（`/`, `C:\`）不给空后缀，取整路径。

运行方式：session-ui 包内 `bun test src`（package.json `"test": "bun test src --only-failures"`），从 `packages/session-ui` 目录运行，不要在仓库根运行。

---

### `packages/session-ui/src/message/message-content.tsx` (MODIFIED, component, render)

**Analog:** 自身 `CurrentHighlightedText`（L822-884，git-tracked）。改动面：file segment 的显示文本缩短 + 加 `title`，保持结构与样式。

**Segment 切分核心（L822-858）：**

```tsx
function CurrentHighlightedText(props: { text: string; files: PromptAttachment[]; agents: PromptAgentAttachment[] }) {
  const segments = createMemo(() => {
    const references = [
      ...props.files.flatMap((file) =>
        file.mention ? [{ start: file.mention.start, end: file.mention.end, type: "file" as const }] : [],
      ),
      ...props.agents.flatMap((agent) =>
        agent.mention ? [{ start: agent.mention.start, end: agent.mention.end, type: "agent" as const }] : [],
      ),
    ].sort((a, b) => a.start - b.start)
    // ... pushText / slice 组装 HighlightSegment[]
  })
```

**渲染与 mention 显示（L860-884，改动落点）：**

```tsx
  return (
    <For each={segments()}>
      {(segment) => (
        <Show
          when={segment.type === "link"}
          fallback={
            <span data-highlight={segment.type}>
              <Show
                when={segment.type && segment.text.startsWith("@")}
                fallback={<SessionReferenceText text={segment.text} />}
              >
                <span data-slot="user-message-mention-prefix">@</span>
                {segment.text.slice(1)}
              </Show>
            </span>
          }
        >
```

**改动模式（最小侵入）：**
- 在 `createMemo` 内（或派生 memo）对 `props.files`（即调用处 `inlineFiles()` = `files().filter((file) => !!file.mention)`，L301）计算一次 `Map<path, label>`，调用新纯函数。
- 仅 `segment.type === "file"` 分支：显示 `{label}` 替代 `{segment.text.slice(1)}`，并在 `<span data-highlight="file">` 上加 `title={完整路径（不含 @）}`。
- **不动** `type: "agent"` / session 类 mention、不动 `data-highlight` 样式属性、不动 `copySessionReferences` 剪贴板路径（剪贴板仍走原文全路径）。
- 调用处上下文（L683-695）：两处 `<CurrentHighlightedText text={props.text} files={inlineFiles()} agents={agents()} />`，作用域天然 = 单条消息，符合 CONTEXT。

---

### `packages/app/src/composer/editor/editor.tsx` (MODIFIED, component, render)

**Analog:** 自身 `renderComposerEditor`（L570-616，git-tracked）+ `mention.title` 先例（L586）。

**Mention span 渲染核心（L570-605，改动落点）：**

```ts
function renderComposerEditor(editor: HTMLDivElement, prompt: ComposerPrompt) {
  const active = document.activeElement === editor
  editor.replaceChildren(
    ...prompt.flatMap<Node>((part) => {
      if (isAttachment(part)) return []
      if (part.type === "text") return [document.createTextNode(part.content)]
      const mention = document.createElement("span")
      mentionParts.set(mention, part)
      mention.textContent = part.content
      mention.contentEditable = "false"
      mention.dir = "auto"
      mention.style.unicodeBidi = "isolate"
      mention.dataset.mention =
        part.type === "file" && part.mime === "application/x-directory" ? "reference" : part.type

      if (part.type === "session") mention.title = part.id

      if (part.type === "file") {
        mention.dataset.path = part.path
        if (part.mime) mention.dataset.mime = part.mime
        if (part.filename) mention.dataset.filename = part.filename
      }

      return [mention]
    }),
  )
```

**title 先例（L586，直接仿写）：**

```ts
if (part.type === "session") mention.title = part.id
```

**改动模式（最小侵入）：**
- 进入 `renderComposerEditor` 时先按整个 `prompt` 的 file parts（`part.type === "file"`，注意排除 `isAttachment(part)`）计算一次 `Map<path, label>`（从 `@opencode/session-ui/mention-label` import）。
- 仅 `part.type === "file"` 分支：`mention.textContent = label`（替代 `part.content`），并加 `mention.title = part.path`（全路径，不含 `@`，CONTEXT 决策）。
- **不变**：`mentionParts.set(mention, part)` 仍存原 part（`parseComposerEditor` L630+ 依赖 `mentionParts` 与 `element.textContent` 回读，注意 parse 路径用 `textContent` 作为 content——需核对缩短后 parse 是否会把 label 当 content 写回 prompt；`part.content` 与 label 不一致时以 `mentionParts` 里的 original 为准，L632-636 已有 `original` 优先先例）。
- **不动** `type: "session"` / `agent` / `skill` 分支；不动 `dataset.path`（仍存全路径）；提交序列化（`request.ts`）不发全路径的问题——parse 回读的 content 必须是全路径，这是本文件改动最需要小心的点（CONTEXT 已提示 `part.content` 仍为全路径）。

---

### `packages/app/src/composer/editor/dom.ts` (MODIFIED, utility, transform)

**Analog:** 自身现有实现（self-analog，git-tracked）——修改点即 `matchMention` 的身份检查语义（L106-131）。该函数修改自身行为而非引入新结构，先例即已建立的两条既有模式：

- `mention.title` 先例（editor.tsx L586，`if (part.type === "session") mention.title = part.id`）——file 分支同样以 `mention.title = part.path` 挂全路径，显示层与数据层分离已在本模块被认可。
- editor.tsx L190-203 的同步 effect 依赖 `editorMatchesPrompt` 决定不重渲染（已证实的不变量：误判会导致 caret 移动与原生 undo 丢失）——因此 matchMention 的语义变更必须最小化，仅对 `part.type === "file"` 跳过 `label === part.content` 比较，身份由 `dataset.path`/`dataset.mime`/`dataset.filename` 唯一确定；session/agent/skill 的 label/title/name 判定原样保留。

**改动模式（最小侵入）：**
- 仅 file 类型跳过 label===content 判定；不新增 helper、不改函数签名、不用 any。
- `dom.test.ts` 为新契约用例的唯一落点（仿现有 `pill()` / `fileMention()` helper），生产代码改动行数控制在 matchMention 一处。

---

### `packages/app/src/composer/editor/dom.test.ts` (MODIFIED, test)

**Analog:** 自身现有测试文件（git-tracked）——现有 `pill()` / `fileMention()` helper 与 `editorMatchesPrompt` 用例即模板。新增用例构造 `textContent` 为缩短 label、`dataset.path` 为全路径的 file pill，断言匹配契约（缩短 label + 正确 path → true；缩短 label + 错误 path → false；dataset.path 缺失时按现有 slice(1) 回退语义）。

## Shared Patterns

### 纯函数模块惯例（session-ui）
**Source:** `packages/session-ui/src/message/agent-label.ts` / `relative-time.ts`
**Apply to:** 新建 `mention-label.ts` + `mention-label.test.ts`
- 单文件单函数导出、无 Solid/DOM 依赖、bun:test colocated 测试、`packages/session-ui` 目录内运行 `bun test src`。

### basename 提取
**Source:** `packages/util/src/path.ts:1-6`（`getFilename`）
**Apply to:** `mention-label.ts`（内部用于 basename 分组与无冲突 label）
- 同时处理 `/` 与 `\`，容忍尾部分隔符与 `undefined`。

### 导出注册
**Source:** `packages/session-ui/package.json` `exports` 字段（`"./attachment-card": "./src/message/attachment-card.tsx"` 等条目）
**Apply to:** 新建模块必须在 `exports` 注册 `"./mention-label"`，App 才能以 `@opencode/session-ui/mention-label` import。

### 显示缩短、数据保全路径（双轨）
**Source:** composer `mention.dataset.path = part.path`（editor.tsx L596）+ `mention.title = part.id`（L586）
**Apply to:** 两个渲染点
- 显示文本 = label；`title` = 全路径（不含 `@`）；底层数据属性（`dataset.path`、wire/正文）永远全路径。

### i18n
本阶段无新增用户可见文案（label 来自路径，title 用原生属性），无需新 i18n key。

## No Analog Found

无。三个文件均有精确 analog（两处修改点即 analog 本身；新模块有同目录纯函数 + 测试模板，算法有 dsh 只读移植源）。

## Metadata

**Analog search scope:** `packages/session-ui/src/message/`、`packages/app/src/composer/`、`packages/util/src/path.ts`、dsh `ui-workspace/src/client/path-suffix.ts`（外部只读）
**Files scanned:** 8（message-content.tsx、editor.tsx、agent-label.ts/.test.ts、relative-time.ts、util/path.ts、session-ui/package.json、dsh path-suffix.ts/.spec.ts）
**Pattern extraction date:** 2026-11-17
