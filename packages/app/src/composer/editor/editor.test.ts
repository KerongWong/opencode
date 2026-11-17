import { expect, test } from "bun:test"
import { parseComposerEditor } from "./editor"

// A pill that native undo reinserted or that drag-copy duplicated has no stored part, but its dataset.path
// survived the cloning: the parsed content must be the full @path, not the shortened label, so the wire text
// stays resolvable.
test("parses a file pill without a stored part from its dataset path", () => {
  const editor = document.createElement("div")
  const pill = document.createElement("span")
  pill.dataset.mention = "file"
  pill.dataset.path = "src/app.tsx"
  pill.textContent = "@app.tsx"
  editor.append(document.createTextNode("see "), pill, document.createTextNode(" now"))
  const parts = parseComposerEditor(editor)

  expect(parts).toEqual([
    { type: "text", content: "see ", start: 0, end: 4 },
    { type: "file", path: "src/app.tsx", content: "@src/app.tsx", start: 4, end: 16 },
    { type: "text", content: " now", start: 16, end: 20 },
  ])
})
