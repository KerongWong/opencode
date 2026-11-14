import { describe, expect, test } from "bun:test"
import { adoptEntryDirectory, applyOrder, withTitle } from "./store"
import type { WorkspaceEntry } from "./registry"

const entry = (directory: string, order: number, extra: Partial<WorkspaceEntry> = {}): WorkspaceEntry => ({
  directory,
  title: "Workspace",
  order,
  createdAt: 0,
  ...extra,
})

describe("applyOrder", () => {
  test("writes the supplied position as each visible record's order", () => {
    const app = entry("D:/code/app", 3)
    const lib = entry("D:/code/lib", 7)

    expect(applyOrder([app, lib], ["D:/code/lib", "D:/code/app"], "win32")).toEqual([
      { ...app, order: 1 },
      { ...lib, order: 0 },
    ])
  })

  test("leaves removed records and unlisted records at their order", () => {
    const app = entry("D:/code/app", 0)
    const lib = entry("D:/code/lib", 1)
    const old = entry("D:/code/old", 2, { removedAt: 5 })

    expect(applyOrder([app, lib, old], ["D:/code/app"], "win32")).toEqual([app, lib, old])
    expect(applyOrder([app, old], ["D:/code/old", "D:/code/app"], "win32")).toEqual([{ ...app, order: 1 }, old])
  })

  test("matches the supplied directories through the registry key", () => {
    const app = entry("D:/code/app", 0)
    const lib = entry("D:/code/lib", 1)

    expect(applyOrder([app, lib], ["D:\\CODE\\lib\\", "d:/code/app"], "win32")).toEqual([
      { ...app, order: 1 },
      { ...lib, order: 0 },
    ])
  })

  test("returns a new array without mutating the input, ignoring unknown directories", () => {
    const entries = [entry("D:/code/app", 0)]

    const result = applyOrder(entries, ["D:/code/missing", "D:/code/app"], "win32")

    expect(result).not.toBe(entries)
    expect(entries[0]!.order).toBe(0)
    expect(result[0]!.order).toBe(1)
  })
})

describe("withTitle", () => {
  test("stores the trimmed title and touches nothing else", () => {
    const app = entry("D:/code/app", 3, { createdAt: 500 })

    expect(withTitle([app], "d:\\CODE\\app\\", "  Renamed  ", "win32")).toEqual([{ ...app, title: "Renamed" }])
  })

  test("writes nothing for a blank title or an unchanged one", () => {
    const entries = [entry("D:/code/app", 0, { title: "My app" })]

    expect(withTitle(entries, "D:/code/app", "   ", "win32")).toBe(entries)
    expect(withTitle(entries, "D:/code/app", " My app ", "win32")).toBe(entries)
  })

  test("renames a removed record and ignores an unregistered directory", () => {
    const old = entry("D:/code/old", 0, { removedAt: 5 })
    const entries = [old]

    expect(withTitle(entries, "D:/code/old", "Gone", "win32")).toEqual([{ ...old, title: "Gone" }])
    expect(withTitle(entries, "D:/code/other", "Other", "win32")).toBe(entries)
  })
})

describe("adoptEntryDirectory", () => {
  test("takes the server spelling of the same row and keeps title, order, createdAt and removedAt", () => {
    const app = entry("D:/code/app", 3, { title: "My app", createdAt: 500 })

    expect(adoptEntryDirectory([app], "D:/code/app", "D:/CODE/app", "win32")).toEqual([
      { ...app, directory: "D:/CODE/app" },
    ])
  })

  test("normalizes the adopted spelling instead of storing the server's separators", () => {
    const app = entry("D:/code/app", 0)

    expect(adoptEntryDirectory([app], "D:/code/app", "D:\\CODE\\app\\", "win32")).toEqual([
      { ...app, directory: "D:/CODE/app" },
    ])
  })

  test("ignores a spelling that resolves to a different row", () => {
    const app = entry("D:/code/app", 0)
    const entries = [app]

    expect(adoptEntryDirectory(entries, "D:/code/app", "D:/code/other", "win32")).toBe(entries)
    expect(adoptEntryDirectory(entries, "/srv/app", "/srv/APP", "linux")).toBe(entries)
  })

  test("writes nothing when the spelling already matches", () => {
    const entries = [entry("D:/code/app", 0)]

    expect(adoptEntryDirectory(entries, "D:/code/app", "d:/code/app", "win32")).toBe(entries)
  })
})
