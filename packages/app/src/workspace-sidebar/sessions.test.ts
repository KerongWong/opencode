import { describe, expect, test } from "bun:test"
import { createRoot } from "solid-js"
import type { ServerConnection } from "@/runtime/server/registry"
import type { ServerCtx } from "@/runtime/server/runtime"
import {
  attributeSessions,
  createWorkspaceSessions,
  matchCreated,
  needsAvailabilityProbe,
  queryDirectoryFor,
  rowKeyFor,
  rowKeyOf,
  serverSpelling,
  sessionsOf,
} from "./sessions"
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

describe("serverSpelling", () => {
  const app = entry("D:/code/app")

  test("returns the server's raw spelling when it belongs to the same row", () => {
    expect(serverSpelling(app, [{ id: "ses_one", location: { directory: "d:/code/app" } }], "win32")).toBe(
      "d:/code/app",
    )
  })

  test("returns nothing for an empty list, a foreign directory or a session without a location", () => {
    expect(serverSpelling(app, [], "win32")).toBeUndefined()
    expect(serverSpelling(app, [{ id: "ses_one", location: { directory: "D:/code/other" } }], "win32")).toBeUndefined()
    expect(serverSpelling(app, [{ id: "ses_one" }], "win32")).toBeUndefined()
    expect(serverSpelling(entry("/srv/app"), [{ id: "ses_one", location: { directory: "/srv/APP" } }], "linux")).toBe(
      undefined,
    )
  })
})

describe("needsAvailabilityProbe", () => {
  test("probes every ready row, whether it lists sessions or not", () => {
    expect(needsAvailabilityProbe({ status: "ready", sessions: [] })).toBe(true)
  })

  test("does not probe a row with no answer yet", () => {
    expect(needsAvailabilityProbe({ status: "loading", sessions: [] })).toBe(false)
    expect(needsAvailabilityProbe({ status: "failed", sessions: [] })).toBe(false)
  })
})

const session = (id: string, directory: string, title = "Chat") => ({ id, title, location: { directory } })

const tick = async () => {
  await new Promise((resolve) => setTimeout(resolve, 0))
  await new Promise((resolve) => setTimeout(resolve, 0))
}

function asServerCtx<T extends object>(input: T) {
  // SAFETY: the factory reads only the fields this fixture provides; no other member of `ServerCtx` runs here.
  return input as ServerCtx
}

function setup() {
  const sessions: ReturnType<typeof session>[] = []
  const listCalls: string[] = []
  const fileCalls: string[] = []
  const spellings: [string, string][] = []

  const state = {
    sessions,
    listError: false,
    fileError: false,
    listCalls,
    fileCalls,
    spellings,
  }

  const ctx = {
    data: {},
    sdk: {
      connection: { status: () => "connected" },
      api: {
        session: {
          list(input: { directory: string }) {
            listCalls.push(input.directory)

            return state.listError ? Promise.reject(new Error("offline")) : Promise.resolve({ data: state.sessions })
          },
        },
        file: {
          list(input: { location?: { directory?: string } }) {
            fileCalls.push(input.location?.directory ?? "")

            return state.fileError ? Promise.reject(new Error("not found")) : Promise.resolve({ data: [] })
          },
        },
      },
    },
  }

  const connection: ServerConnection.Any = { type: "http", http: { url: "http://localhost:4096" } }

  return {
    state,
    mount(entries: WorkspaceEntry[]) {
      let api!: ReturnType<typeof createWorkspaceSessions>

      const dispose = createRoot((dispose) => {
        api = createWorkspaceSessions({
          entries: () => entries,
          connection: () => connection,
          ctx: () => asServerCtx(ctx),
          platform: () => "win32",
          onServerSpelling: (directory, spelling) => state.spellings.push([directory, spelling]),
        })

        return dispose
      })

      return { api, dispose }
    },
  }
}

describe("createWorkspaceSessions", () => {
  const app = entry("D:/code/app", 0)

  test("never loads a row for a removed record", async () => {
    const fixture = setup()
    const { api, dispose } = fixture.mount([entry("D:/code/app", 0, 5)])

    api.load()
    await tick()

    expect(api.rows()).toEqual({})
    expect(fixture.state.listCalls).toEqual([])
    dispose()
  })

  test("loads a row and probes its directory even when the row lists sessions", async () => {
    const fixture = setup()
    fixture.state.sessions = [session("ses_one", "D:/code/app")]
    const { api, dispose } = fixture.mount([app])

    api.load()
    await tick()

    expect(api.rows()["d:/code/app"]?.status).toBe("ready")
    expect(api.rows()["d:/code/app"]?.sessions.map((item) => item.id)).toEqual(["ses_one"])
    expect(api.availability()["d:/code/app"]).toBe("available")
    expect(fixture.state.fileCalls).toEqual(["D:/code/app"])
    dispose()
  })

  test("marks a row unavailable when the directory probe fails, even with history", async () => {
    const fixture = setup()
    fixture.state.sessions = [session("ses_one", "D:/code/app")]
    fixture.state.fileError = true
    const { api, dispose } = fixture.mount([app])

    api.load()
    await tick()

    expect(api.rows()["d:/code/app"]?.status).toBe("ready")
    expect(api.availability()["d:/code/app"]).toBe("unavailable")
    dispose()
  })

  test("probeSpelling adopts a non-empty server spelling and falls back to local normalization", async () => {
    const fixture = setup()
    fixture.state.sessions = [session("ses_one", "d:/code/app")]
    const { api, dispose } = fixture.mount([app])

    expect(await api.probeSpelling(app)).toBe("d:/code/app")
    expect(fixture.state.spellings).toEqual([["D:/code/app", "d:/code/app"]])

    fixture.state.sessions = []
    expect(await api.probeSpelling(app)).toBeUndefined()
    dispose()
  })

  test("self-heals an old record's spelling on the first non-empty load", async () => {
    const fixture = setup()
    fixture.state.sessions = [session("ses_one", "d:/code/app")]
    const { api, dispose } = fixture.mount([app])

    api.load()
    await tick()

    expect(fixture.state.spellings).toEqual([["D:/code/app", "d:/code/app"]])

    fixture.state.listCalls.length = 0
    api.load()
    await tick()

    expect(fixture.state.listCalls).toEqual(["d:/code/app"])
    dispose()
  })
})
