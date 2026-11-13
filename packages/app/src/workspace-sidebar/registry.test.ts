import { afterEach, describe, expect, setSystemTime, test } from "bun:test"
import { Schema } from "effect"
import { ServerScope } from "@/runtime/server/scope"
import {
  defaultTitle,
  detectHostPlatform,
  directoryKey,
  hostPlatform,
  initialRegistry,
  normalizeDirectory,
  register,
  registryTarget,
  remove,
  visible,
  WorkspaceRegistrySchema,
  type WorkspaceEntry,
  type WorkspaceRegistry,
} from "./registry"

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

  test("appends after the highest order, including removed records", () => {
    setSystemTime(3_000)

    const entries: WorkspaceEntry[] = [
      { directory: "/a", title: "a", order: 0, createdAt: 1 },
      { directory: "/b", title: "b", order: 5, createdAt: 2, removedAt: 900 },
    ]

    const result = register(entries, { directory: "/c", platform: "linux" })

    expect(result.entry!.order).toBe(6)
    expect(result.entries.map((entry) => entry.order)).toEqual([0, 5, 6])
  })

  test.each([
    ["", "linux"],
    ["  ", "linux"],
    ["relative/path", "linux"],
    ["", "win32"],
  ] as const)("rejects an unregistrable directory %p on %s instead of fabricating a root", (directory, platform) => {
    const entries: WorkspaceEntry[] = []

    const result = register(entries, { directory, platform })

    expect(result.entries).toBe(entries)
    expect(result.entry).toBeUndefined()
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
    ["win32", "/a\\b", "/a/b"],
    ["linux", "/home/me/proj/", "/home/me/proj"],
    ["linux", "/a//b", "/a/b"],
    ["linux", "/a\\b", "/a\\b"],
    ["linux", "C:", "C:"],
    ["linux", "/", "/"],
    ["linux", "/Home/Me/Proj", "/Home/Me/Proj"],
    ["darwin", "/Users/Me/Proj/", "/Users/Me/Proj"],
    ["darwin", "/users/me/project", "/users/me/project"],
    ["darwin", "/Users/me/a\\b", "/Users/me/a\\b"],
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

  test("keeps a backslash distinct from a separator on POSIX", () => {
    expect(directoryKey("/a\\b", "linux")).not.toBe(directoryKey("/a/b", "linux"))
  })

  test("folds a backslash into a separator on Windows", () => {
    expect(directoryKey("/a\\b", "win32")).toBe(directoryKey("/a/b", "win32"))
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

  // The web build has no `Platform["os"]`, so a constant `linux` fallback made every Windows path
  // fail the absolute-path check and turned register/remove into silent no-ops inside a Windows browser.
  test.each([
    ["Win32", "win32"],
    ["Windows", "win32"],
    ["MacIntel", "darwin"],
    ["Linux x86_64", "linux"],
    ["", "linux"],
    [undefined, "linux"],
  ] as const)("detects %p as %s", (hint, expected) => {
    expect(detectHostPlatform(hint)).toBe(expected)
  })
})

describe("defaultTitle", () => {
  test.each([
    ["/", "/"],
    ["C:/", "C:"],
    ["D:/code/app", "app"],
    ["//server/share", "share"],
  ] as const)("derives %p from %p", (directory, title) => {
    expect(defaultTitle(directory)).toBe(title)
  })
})

describe("remove", () => {
  afterEach(() => setSystemTime())

  test("masks a record without deleting it or rewriting its display name", () => {
    setSystemTime(4_000)

    const next = remove([app], { directory: "d:/CODE/app", platform: "win32" })

    expect(next).toHaveLength(1)
    expect(next[0]!.removedAt).toBe(4_000)
    expect(next[0]!.title).toBe("My app")
  })

  test("keeps the first removal timestamp and returns the same list", () => {
    setSystemTime(4_000)
    const once = remove([app], { directory: "D:/code/app", platform: "win32" })
    setSystemTime(5_000)

    const twice = remove(once, { directory: "D:/code/app", platform: "win32" })

    expect(twice).toBe(once)
    expect(twice[0]!.removedAt).toBe(4_000)
  })

  test("ignores an unregistered directory", () => {
    const entries: WorkspaceEntry[] = [app]

    expect(remove(entries, { directory: "/nope", platform: "linux" })).toBe(entries)
  })

  test.each([
    ["", "linux"],
    [" ", "linux"],
  ] as const)("does not mask a record for an unregistrable directory %p on %s", (directory, platform) => {
    const entries: WorkspaceEntry[] = [{ directory: "/", title: "/", order: 0, createdAt: 1 }]

    expect(remove(entries, { directory, platform })).toBe(entries)
  })

  test("re-registering after removal restores the display name and order", () => {
    const renamed: WorkspaceEntry = { directory: "/project", title: "Renamed", order: 2, createdAt: 10 }
    const removed = remove([renamed], { directory: "/project", platform: "linux" })
    setSystemTime(6_000)

    const result = register(removed, { directory: "/project/", platform: "linux" })

    expect(result.entry!.title).toBe("Renamed")
    expect(result.entry!.order).toBe(2)
    expect(result.entry!.removedAt).toBeUndefined()
  })
})

describe("visible", () => {
  test("drops removed entries and sorts by order", () => {
    const entries: WorkspaceEntry[] = [
      { directory: "/b", title: "b", order: 5, createdAt: 1 },
      { directory: "/a", title: "a", order: 0, createdAt: 1 },
      { directory: "/c", title: "c", order: 9, createdAt: 1, removedAt: 2 },
    ]

    expect(visible(entries).map((entry) => entry.directory)).toEqual(["/a", "/b"])
  })
})

describe("workspace registry document", () => {
  const registry: WorkspaceRegistry = { entries: [app, removedApp], scrollTop: 12 }

  test("keeps entries and scroll position through a round trip", () => {
    const encoded = Schema.encodeSync(WorkspaceRegistrySchema)(registry)

    expect(encoded).toEqual({
      entries: [
        { directory: "D:/code/app", title: "My app", order: 3, createdAt: 500 },
        { directory: "D:/code/app", title: "My app", order: 3, createdAt: 500, removedAt: 900 },
      ],
      scrollTop: 12,
    })
    expect(encoded.entries?.[0]).not.toHaveProperty("removedAt")
    expect(Schema.decodeUnknownSync(WorkspaceRegistrySchema)(encoded)).toEqual(registry)
  })

  test("starts empty", () => {
    expect(initialRegistry).toEqual({ entries: [], scrollTop: 0 })
  })

  test("uses the registry key as the persisted key", () => {
    expect(registryTarget(ServerScope.local).key).toBe("workspace-registry.v1")
  })
})
