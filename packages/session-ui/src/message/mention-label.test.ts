import { expect, test } from "bun:test"
import { mentionLabels } from "./mention-label"

test("shows the basename when no peer in scope shares it", () => {
  // 契约：无同名 peer 时 label 即 basename（`/` 与 `\` 均为分隔符）
  const labels = mentionLabels([{ path: "/home/me/src/app.ts" }, { path: "/home/me/src/util.ts" }])

  expect(labels.get("/home/me/src/app.ts")).toBe("app.ts")
  expect(labels.get("/home/me/src/util.ts")).toBe("util.ts")
})

test("shows the shortest distinguishing suffix for same-basename peers", () => {
  // 契约：两个同名不同目录 → 各自最短区分后缀
  const labels = mentionLabels([{ path: "/home/me/a/workspace" }, { path: "/home/me/b/workspace" }])

  expect(labels.get("/home/me/a/workspace")).toBe("a/workspace")
  expect(labels.get("/home/me/b/workspace")).toBe("b/workspace")
})

test("falls back to the full root path instead of an empty suffix", () => {
  // 契约：根路径（`/` 或 `C:\`）不给空后缀，回退整路径（保留原分隔符）
  const labels = mentionLabels([{ path: "C:\\" }, { path: "D:\\C:" }])

  expect(labels.get("C:\\")).toBe("C:\\")
  expect(labels.get("D:\\C:")).toBe("C:")
})

test("grows the suffix past two segments when a middle peer needs more context", () => {
  // 契约：三同名链式 —— 中间项与其他项的 2 段后缀撞车时继续加长，直到唯一
  const labels = mentionLabels([
    { path: "/home/me/a/workspace" },
    { path: "/home/me/b/workspace" },
    { path: "/srv/deep/b/workspace" },
  ])

  expect(labels.get("/home/me/a/workspace")).toBe("a/workspace")
  expect(labels.get("/home/me/b/workspace")).toBe("me/b/workspace")
  expect(labels.get("/srv/deep/b/workspace")).toBe("deep/b/workspace")
})

test("keeps a single relative segment as its own label", () => {
  // 契约：单段相对路径的 basename 就是整段（无父目录可取，也不产生空后缀）
  const labels = mentionLabels([{ path: "a.ts" }])

  expect(labels.get("a.ts")).toBe("a.ts")
})

test("tolerates a trailing separator when taking the basename", () => {
  // 契约：尾部分隔符（/a/b/）容忍 —— basename 提取先trim尾分隔符，label = "b"
  const labels = mentionLabels([{ path: "/a/b/" }])

  expect(labels.get("/a/b/")).toBe("b")
})

test("keeps the path's own separators in a mixed-separator suffix", () => {
  // 契约：双分隔符混用时后缀保留原分隔符（\ 与 / 不互相转换）
  const labels = mentionLabels([{ path: "C:\\repo/src/app.ts" }, { path: "C:\\other/src/app.ts" }])

  expect(labels.get("C:\\repo/src/app.ts")).toBe("repo/src/app.ts")
  expect(labels.get("C:\\other/src/app.ts")).toBe("other/src/app.ts")
})

test("does not fold Windows case when grouping basenames", () => {
  // 契约：Windows 大小写不折叠 —— Foo.ts 与 foo.ts 视为不同 basename，不触发消歧
  const labels = mentionLabels([{ path: "C:\\src\\Foo.ts" }, { path: "C:\\src\\foo.ts" }])

  expect(labels.get("C:\\src\\Foo.ts")).toBe("Foo.ts")
  expect(labels.get("C:\\src\\foo.ts")).toBe("foo.ts")
})

test("uses the whole path, separators intact, when it is a suffix of a peer", () => {
  // 契约：自身路径是 peer 的后缀时取整路径（段窗口耗尽后回退），分隔符原样保留
  const labels = mentionLabels([
    { path: "/workspace" },
    { path: "/a/workspace" },
    { path: "C:\\x\\w" },
    { path: "C:\\y\\w" },
  ])

  expect(labels.get("/workspace")).toBe("/workspace")
  expect(labels.get("/a/workspace")).toBe("a/workspace")
  expect(labels.get("C:\\x\\w")).toBe("x\\w")
  expect(labels.get("C:\\y\\w")).toBe("y\\w")
})
