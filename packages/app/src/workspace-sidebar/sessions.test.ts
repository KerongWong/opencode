import { describe, expect, test } from "bun:test"
import { attributeSessions, matchCreated, queryDirectoryFor, rowKeyFor, rowKeyOf, sessionsOf } from "./sessions"
import type { RowSessions } from "./sessions"
import type { WorkspaceEntry } from "./registry"

const entry = (directory: string, order = 0, removedAt?: number): WorkspaceEntry => {
  const value: WorkspaceEntry = { directory, title: "Workspace", order, createdAt: 0 }

  if (removedAt !== undefined) value.removedAt = removedAt

  return value
}

describe("rowKeyFor", () => {
  test("Windows folds separators, drive case and a trailing separator into one key", () => {
    expect(rowKeyFor(entry("D:\\code\\app"), "win32")).toBe(rowKeyOf("d:/CODE/app/", "win32"))
    expect(rowKeyFor(entry("D:\\code\\app"), "win32")).toBe("d:/code/app")
  })

  test("POSIX keeps two spellings apart unless they are byte-identical", () => {
    expect(rowKeyFor(entry("/srv/App"), "linux")).not.toBe(rowKeyOf("/srv/app", "linux"))
    expect(rowKeyFor(entry("/srv/App"), "darwin")).toBe(rowKeyOf("/srv/App", "darwin"))
  })
})

describe("queryDirectoryFor", () => {
  const app = entry("D:/code/app", 0)

  test("uses the recorded spelling until the server supplies one", () => {
    expect(queryDirectoryFor(app, "win32", {})).toBe("D:/code/app")
  })

  test("prefers the server spelling when it still belongs to this row", () => {
    expect(queryDirectoryFor(app, "win32", { "d:/code/app": "d:/code/app" })).toBe("d:/code/app")
    expect(queryDirectoryFor(app, "win32", { "d:/code/app": "D:\\code\\app" })).toBe("D:\\code\\app")
  })

  test("ignores a spelling that resolves to a different row", () => {
    expect(queryDirectoryFor(app, "win32", { "d:/code/app": "D:/code/other" })).toBe("D:/code/app")
  })
})

describe("attributeSessions", () => {
  test("files every returned id under the queried row, whatever spelling the session carries", () => {
    const sessions = [
      { id: "ses_one", location: { directory: "d:/code/app" } },
      { id: "ses_two", location: { directory: "D:\\CODE\\app\\" } },
    ]

    expect(attributeSessions(sessions, "d:/code/app")).toEqual([
      ["ses_one", "d:/code/app"],
      ["ses_two", "d:/code/app"],
    ])
  })

  test("returns no attribution for an empty list", () => {
    expect(attributeSessions([], "d:/code/app")).toEqual([])
  })
})

describe("matchCreated", () => {
  test("attributes a session.created directory on Windows regardless of case and separators", () => {
    expect(matchCreated([entry("D:/code/app", 0)], "d:\\CODE\\app\\", "win32")).toBe("d:/code/app")
  })

  test("keeps POSIX matching exact", () => {
    expect(matchCreated([entry("/srv/app")], "/srv/APP", "linux")).toBeUndefined()
    expect(matchCreated([entry("/srv/app")], "/srv/app", "linux")).toBe("/srv/app")
  })

  test("finds no row for an unregistered directory or a removed record", () => {
    expect(matchCreated([entry("/srv/app")], "/srv/other", "linux")).toBeUndefined()
    expect(matchCreated([entry("/srv/app", 0, 1)], "/srv/app", "linux")).toBeUndefined()
  })
})

describe("sessionsOf", () => {
  test("reads an unloaded row as loading with no sessions", () => {
    expect(sessionsOf({}, "d:/code/app")).toEqual({ status: "loading", sessions: [] })
  })

  test("keeps a failed row failed, with no sessions to render", () => {
    expect(sessionsOf({ "d:/code/app": { status: "failed", sessions: [] } }, "d:/code/app")).toEqual({
      status: "failed",
      sessions: [],
    })
  })

  test("returns the loaded row as-is", () => {
    const row: RowSessions = { status: "ready", sessions: [] }

    expect(sessionsOf({ "d:/code/app": row }, "d:/code/app")).toBe(row)
  })
})
