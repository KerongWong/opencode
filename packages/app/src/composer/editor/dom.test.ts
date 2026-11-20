import { expect, test } from "bun:test"
import type { ComposerPrompt } from "../types"
import {
  composerClipboardText,
  editorMatchesPrompt,
  getCursorPosition,
  isEditorDomBlank,
  isPromptInlineBlank,
  mentionParts,
  setCursorPosition,
} from "./dom"

const br = () => document.createElement("br")

const text = (value: string) => document.createTextNode(value)

const pill = () => {
  const element = document.createElement("span")
  element.dataset.mention = "file"
  element.textContent = "@file"

  return element
}

// Breaks count as one character and zero-width characters count as none.
// Each caret row is [position, anchor child index or null for the container, anchor offset].
test.each<{ name: string; nodes: () => Node[]; caret: [number, number | null, number][] }>([
  {
    name: "zero-width characters",
    nodes: () => [text("ab\u200B"), br(), text("cd")],
    caret: [
      [3, 2, 0],
      [4, 2, 1],
    ],
  },
  {
    name: "pills and breaks",
    nodes: () => [text("ab"), pill(), br(), text("cd")],
    caret: [
      [2, 0, 2],
      [7, null, 2],
      [8, 3, 0],
    ],
  },
  {
    name: "blank lines",
    nodes: () => [text("a"), br(), br(), text("b")],
    caret: [
      [2, null, 2],
      [3, 3, 0],
    ],
  },
])("maps the caret across $name", (row) => {
  const container = document.createElement("div")
  container.append(...row.nodes())
  document.body.appendChild(container)

  row.caret.forEach(([position, child, offset]) => {
    setCursorPosition(container, position)
    const selection = window.getSelection()
    expect(selection?.anchorNode).toBe(child === null ? container : container.childNodes[child]!)
    expect(selection?.anchorOffset).toBe(offset)
    expect(getCursorPosition(container)).toBe(position)
  })

  container.remove()
})

test("reads a caret on or inside a mention as before or after it", () => {
  const container = document.createElement("div")
  const mention = pill()
  container.append(text("ab"), mention, br(), text("cd"))
  document.body.appendChild(container)
  const selection = window.getSelection()!

  selection.collapse(mention.firstChild, 0)
  expect(getCursorPosition(container)).toBe(2)
  selection.collapse(mention.firstChild, 3)
  expect(getCursorPosition(container)).toBe(7)
  selection.collapse(container.childNodes[2]!, 0)
  expect(getCursorPosition(container)).toBe(7)

  container.remove()
})

test("reads a caret after a shortened file pill as the end of its full @path", () => {
  const container = document.createElement("div")
  const mention = pill()
  const path = "test-case/2026-11-18-feature/detail.md"
  mention.textContent = "@detail.md"
  mention.dataset.path = path
  mentionParts.set(mention, { type: "file", path, content: `@${path}`, start: 0, end: 0 })
  container.append(mention, text(" hi"))
  document.body.appendChild(container)

  // The pill's label is shorter than the mention it stands for, so a caret after it is the prompt's full @path end.
  expect(mention.textContent).toBe("@detail.md")
  setCursorPosition(container, path.length + 1)
  expect(getCursorPosition(container)).toBe(path.length + 1)

  container.remove()
})

const part = (content: string) => ({ type: "text" as const, content, start: 0, end: 0 })

const filePart = { type: "file" as const, path: "src/a.ts", content: "@file", start: 0, end: 0 }

const attachment = { type: "path" as const, id: "att", filename: "a.png", mime: "image/png", path: "/tmp/a.png" }

const fileMention = () => {
  const element = pill()
  element.dataset.path = "src/a.ts"

  return element
}

const editor = (...nodes: Node[]) => {
  const element = document.createElement("div")
  element.append(...nodes)

  return element
}

const prompt = (...parts: ComposerPrompt): ComposerPrompt => parts

// A rendered file pill shows a shortened label (basename or distinguishing suffix) while the prompt part keeps
// the full @path, so a file mention cannot be identified by its label.
const shortenedFileMention = (label: string, path: string) => {
  const element = pill()
  element.textContent = label
  element.dataset.path = path

  return element
}

test.each<{ name: string; dom: () => HTMLElement; prompt: ComposerPrompt; matches: boolean }>([
  {
    name: "a file pill showing its basename",
    dom: () => editor(shortenedFileMention("@app.tsx", "src/app.tsx")),
    prompt: prompt({ type: "file" as const, path: "src/app.tsx", content: "@src/app.tsx", start: 0, end: 0 }),
    matches: true,
  },
  {
    name: "file pills showing distinguishing suffixes",
    dom: () =>
      editor(
        shortenedFileMention("@a/app.tsx", "pkg/a/app.tsx"),
        shortenedFileMention("@b/app.tsx", "pkg/b/app.tsx"),
      ),
    prompt: prompt(
      { type: "file" as const, path: "pkg/a/app.tsx", content: "@pkg/a/app.tsx", start: 0, end: 0 },
      { type: "file" as const, path: "pkg/b/app.tsx", content: "@pkg/b/app.tsx", start: 0, end: 0 },
    ),
    matches: true,
  },
  {
    name: "a shortened file pill with another target",
    dom: () => editor(shortenedFileMention("@app.tsx", "src/app.tsx")),
    prompt: prompt({ type: "file" as const, path: "other/app.tsx", content: "@other/app.tsx", start: 0, end: 0 }),
    matches: false,
  },
  {
    name: "a file pill that kept the full path label",
    dom: () =>
      editor(
        (() => {
          const element = pill()
          element.textContent = "@src/app.tsx"
          element.dataset.path = "src/app.tsx"

          return element
        })(),
      ),
    prompt: prompt({ type: "file" as const, path: "src/app.tsx", content: "@src/app.tsx", start: 0, end: 0 }),
    matches: true,
  },
  {
    name: "a root-level file whose label is the whole path",
    dom: () => editor(shortenedFileMention("@app.tsx", "app.tsx")),
    prompt: prompt({ type: "file" as const, path: "app.tsx", content: "@app.tsx", start: 0, end: 0 }),
    matches: true,
  },
  {
    name: "a shortened file pill without a target",
    dom: () => {
      const element = pill()
      element.textContent = "@app.tsx"

      return editor(element)
    },
    prompt: prompt({ type: "file" as const, path: "src/app.tsx", content: "@src/app.tsx", start: 0, end: 0 }),
    matches: false,
  },
])("matches shortened file pills against the prompt: $name", (row) => {
  expect(editorMatchesPrompt(row.dom(), row.prompt)).toBe(row.matches)
})

test("copied file pills contribute their full path, not the shortened label", () => {
  const container = document.createElement("div")
  document.body.appendChild(container)
  container.append(text("see "), shortenedFileMention("@app.tsx", "src/app.tsx"), text(" now"))
  const range = document.createRange()
  range.selectNodeContents(container)
  expect(composerClipboardText(container, [range])).toBe("see @src/app.tsx now")
  container.remove()
})

test("a selection without file pills keeps the browser's copy", () => {
  const container = document.createElement("div")
  container.append(text("plain"))
  const range = document.createRange()
  range.selectNodeContents(container)
  expect(composerClipboardText(container, [range])).toBeUndefined()
  container.remove()
})

test.each<{ name: string; dom: () => HTMLElement; prompt: ComposerPrompt; matches: boolean }>([
  { name: "one text node", dom: () => editor(text("hello")), prompt: prompt(part("hello")), matches: true },
  {
    name: "split runs and breaks",
    dom: () => editor(text("ab"), br(), text("cd")),
    prompt: prompt(part("ab\ncd")),
    matches: true,
  },
  {
    name: "adjacent text parts",
    dom: () => editor(text("abcd")),
    prompt: prompt(part("ab"), part("cd")),
    matches: true,
  },
  {
    name: "a mention between text, with an attachment",
    dom: () => editor(text("see "), fileMention(), text(" now")),
    prompt: prompt(attachment, part("see "), filePart, part(" now")),
    matches: true,
  },
  {
    name: "an empty editor and an empty prompt",
    dom: () => editor(),
    prompt: prompt(part(""), attachment),
    matches: true,
  },
  { name: "the store cleared the text", dom: () => editor(text("!")), prompt: prompt(part("")), matches: false },
  { name: "different text", dom: () => editor(text("hello")), prompt: prompt(part("help!")), matches: false },
  {
    name: "a missing trailing part",
    dom: () => editor(text("ab")),
    prompt: prompt(part("ab"), filePart),
    matches: false,
  },
  {
    name: "a mention with another target",
    dom: () => editor(fileMention()),
    prompt: prompt({ ...filePart, path: "src/b.ts" }),
    matches: false,
  },
  { name: "a break where the prompt has text", dom: () => editor(br()), prompt: prompt(part("a")), matches: false },
])("matches the editor against the prompt: $name", (row) => {
  expect(editorMatchesPrompt(row.dom(), row.prompt)).toBe(row.matches)
})

test("classifies blank editors and prompts the way the parser normalizes them", () => {
  expect(isEditorDomBlank(editor(br(), text("\u200B\n")))).toBe(true)
  expect(isEditorDomBlank(editor(text("a")))).toBe(false)
  expect(isEditorDomBlank(editor(pill()))).toBe(false)
  expect(isPromptInlineBlank(prompt(part(""), attachment))).toBe(true)
  expect(isPromptInlineBlank(prompt(part(" ")))).toBe(false)
  expect(isPromptInlineBlank(prompt(filePart))).toBe(false)
})

test("reads no caret for a range or a selection outside the editor", () => {
  const container = document.createElement("div")
  container.append(text("abcd"))
  const outside = text("outside")
  document.body.append(container, outside)
  const selection = window.getSelection()!

  selection.setBaseAndExtent(container.firstChild!, 1, container.firstChild!, 3)
  expect(getCursorPosition(container)).toBeUndefined()
  selection.collapse(outside, 2)
  expect(getCursorPosition(container)).toBeUndefined()

  container.remove()
  outside.remove()
})
