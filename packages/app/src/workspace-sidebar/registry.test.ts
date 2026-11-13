import { afterEach, describe, expect, setSystemTime, test } from "bun:test"
import { directoryKey, hostPlatform, normalizeDirectory, register, type WorkspaceEntry } from "./registry"

const app: WorkspaceEntry = { directory: "D:/code/app", title: "My app", order: 3, createdAt: 500 }

const removedApp: WorkspaceEntry = { ...app, removedAt: 900 }

describe("register", () => {
  afterEach(() => setSystemTime())

  test("reuses a removed record instead of adding a second row", () => {
    setSystemTime(2_000)

    const result = register([removedApp], { directory: "d:\\CODE\\app\\", platform: "win32" })

    expect(result.entries).toHaveLength(1)
    expect(result.entry).toBe(result.entries[0])
    expect(result.entries[0]!.directory).toBe("D:/code/app")
    expect(result.entries[0]!.title).toBe("My app")
    expect(result.entries[0]!.order).toBe(3)
    expect(result.entries[0]!.createdAt).toBe(500)
    expect(result.entries[0]!.removedAt).toBeUndefined()
  })

  test("reuses a visible record without touching the list", () => {
    const entries: WorkspaceEntry[] = [app]

    const result = register(entries, { directory: "d:/CODE/app", platform: "win32" })

    expect(result.entries).toBe(entries)
    expect(result.entry).toBe(app)
  })

  test("appends a new directory with its normalized spelling and default title", () => {
    setSystemTime(1_000)

    const result = register([], { directory: "D:\\code\\app", platform: "win32" })

    expect(result.entries).toEqual([{ directory: "D:/code/app", title: "app", order: 0, createdAt: 1_000 }])
    expect(result.entry).toBe(result.entries[0])
  })
})

describe("normalizeDirectory", () => {
  test.each([
    ["win32", "D:\\code\\app\\", "D:/code/app"],
    ["win32", "D:/a//b/", "D:/a/b"],
    ["win32", "c:/x", "C:/x"],
    ["win32", "c:/", "C:/"],
    ["win32", "C:", "C:/"],
    ["win32", "C:\\", "C:/"],
    ["win32", "\\\\server\\share\\x\\", "//server/share/x"],
    ["linux", "/home/me/proj/", "/home/me/proj"],
    ["linux", "/a//b", "/a/b"],
    ["linux", "/", "/"],
    ["linux", "/Home/Me/Proj", "/Home/Me/Proj"],
    ["darwin", "/Users/Me/Proj/", "/Users/Me/Proj"],
    ["darwin", "/users/me/project", "/users/me/project"],
  ] as const)("%s normalizes %p to %p", (platform, input, expected) => {
    expect(normalizeDirectory(input, platform)).toBe(expected)
  })
})

describe("directoryKey", () => {
  test("ignores case on Windows", () => {
    expect(directoryKey("D:/Proj", "win32")).toBe(directoryKey("d:/proj", "win32"))
  })

  test.each(["linux", "darwin"] as const)("keeps case on %s", (platform) => {
    expect(directoryKey("D:/Proj", platform)).not.toBe(directoryKey("D:/proj", platform))
  })
})

describe("hostPlatform", () => {
  test.each([
    ["macos", "darwin"],
    ["windows", "win32"],
    ["linux", "linux"],
    [undefined, "linux"],
  ] as const)("maps %p to %s", (os, expected) => {
    expect(hostPlatform(os)).toBe(expected)
  })
})
