import { expect, test } from "bun:test"
import { mentionLabels } from "./mention-label"

test("shows the basename when no peer in scope shares it", () => {
  const labels = mentionLabels([{ path: "/home/me/src/app.ts" }, { path: "/home/me/src/util.ts" }])

  expect(labels.get("/home/me/src/app.ts")).toBe("app.ts")
  expect(labels.get("/home/me/src/util.ts")).toBe("util.ts")
})

test("shows the shortest distinguishing suffix for same-basename peers", () => {
  const labels = mentionLabels([{ path: "/home/me/a/workspace" }, { path: "/home/me/b/workspace" }])

  expect(labels.get("/home/me/a/workspace")).toBe("a/workspace")
  expect(labels.get("/home/me/b/workspace")).toBe("b/workspace")
})

test("falls back to the full root path instead of an empty suffix", () => {
  const labels = mentionLabels([{ path: "C:\\" }, { path: "D:\\C:" }])

  expect(labels.get("C:\\")).toBe("C:\\")
  expect(labels.get("D:\\C:")).toBe("C:")
})
