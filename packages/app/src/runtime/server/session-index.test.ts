import { describe, expect, test } from "bun:test"
import type { SessionInfo } from "@opencode/client/promise"
import { parseHomeSessionIndex } from "@/home/sessions/index"
import { mergeRootSessionIndex } from "@/runtime/server/session-index"
import { projectGroupFor } from "@/shell/titlebar/projects-groups"

const session = (id: string, input: Partial<SessionInfo> = {}) =>
  // SAFETY: fixtures spell every other field of the info they model, and each test only reads those fields.
  ({
    id,
    projectID: "project",
    title: id,
    time: { created: 1, updated: 1 },
    location: { directory: "/repo" },
    ...input,
  }) as SessionInfo

const archivedRoot = session("archived", {
  time: { created: 1, updated: 2, archived: 3 },
  location: { directory: "/other" },
})

// The Projects view's row source: one key per checkout, matching how `groups()` fills its map.
const projectKeys = (rows: SessionInfo[]) => [
  ...new Set(rows.map((row) => projectGroupFor("srv", { worktrees: [{ directory: "/repo" }] }, row.location.directory).key)),
]

describe("root session index merge", () => {
  test("keeps a locally known archived session out of a project row", () => {
    const index = [session("active", { location: { directory: "/repo" } })]
    const known = [archivedRoot, session("child", { parentID: "active", location: { directory: "/repo" } })]

    const keys = mergeRootSessionIndex(index, known, { includeArchived: false }).map(
      (row) => projectGroupFor("srv", { worktrees: [{ directory: "/repo" }] }, row.location.directory).key,
    )

    expect(keys).toEqual(["srv\u0000/repo"])
  })

  test("the default keeps archived rows for the Inbox view", () => {
    expect(mergeRootSessionIndex([], [archivedRoot]).map((row) => row.id)).toEqual(["archived"])
    expect(mergeRootSessionIndex([], [archivedRoot], { includeArchived: true }).map((row) => row.id)).toEqual([
      "archived",
    ])
  })

  test("a live archive wins over a cached active index row", () => {
    const index = [session("s1", { time: { created: 1, updated: 10 } })]
    const archived = session("s1", { time: { created: 1, updated: 20, archived: 99 } })

    expect(mergeRootSessionIndex(index, [archived], { includeArchived: false })).toEqual([])
    expect(mergeRootSessionIndex(index, [archived]).map((row) => row.time.archived)).toEqual([99])
  })
})

// The index page is the window: locally known sessions may only join rows that are indexed already or are at least
// as recent as the oldest indexed row, so opening old history cannot add a project row.
describe("bounded known window", () => {
  const a = session("a", { time: { created: 1, updated: 300 }, location: { directory: "/repo" } })
  const b = session("b", { time: { created: 1, updated: 200 }, location: { directory: "/repo" } })
  const c = session("c", { time: { created: 1, updated: 100 }, location: { directory: "/other" } })
  // Created after the index was fetched, so it is above the window and must still get a row.
  const d = session("d", { time: { created: 1, updated: 400 }, location: { directory: "/other" } })
  const e = session("e", { time: { created: 1, updated: 200 }, location: { directory: "/other" } })
  const g = session("g", { time: { created: 1, updated: 100, archived: 50 }, location: { directory: "/other" } })
  const child = session("child", { parentID: "a", time: { created: 1, updated: 400 }, location: { directory: "/other" } })

  test("a locally known root older than the index window adds no project row", () => {
    const rows = mergeRootSessionIndex([a, b], [c], { includeArchived: false, boundedKnown: true })

    expect(rows.map((row) => row.id)).toEqual(["a", "b"])
    expect(projectKeys(rows)).toEqual(["srv\u0000/repo"])
  })

  test("the row set is the same with and without that old session (restart parity)", () => {
    const options = { includeArchived: false, boundedKnown: true }

    expect(projectKeys(mergeRootSessionIndex([a, b], [c], options))).toEqual(
      projectKeys(mergeRootSessionIndex([a, b], [], options)),
    )
  })

  test("a known root at the window floor still joins", () => {
    const rows = mergeRootSessionIndex([a, b], [e], { includeArchived: false, boundedKnown: true })

    expect(rows.map((row) => row.id)).toEqual(["a", "b", "e"])
    expect(projectKeys(rows)).toEqual(["srv\u0000/repo", "srv\u0000/other"])
  })

  test("a known root created after the index fetch still joins", () => {
    const rows = mergeRootSessionIndex([a, b], [d], { includeArchived: false, boundedKnown: true })

    expect(rows.map((row) => row.id)).toEqual(["a", "b", "d"])
    expect(projectKeys(rows)).toEqual(["srv\u0000/repo", "srv\u0000/other"])
  })

  test("an indexed root is refreshed by a known copy older than the floor", () => {
    const indexed = session("a", { title: "indexed", time: { created: 1, updated: 300, idle: 5 } })
    const known = session("a", {
      title: "known",
      time: { created: 1, updated: 100, idle: 0 },
      location: { directory: "/repo" },
    })

    expect(mergeRootSessionIndex([indexed], [known], { includeArchived: false, boundedKnown: true })).toMatchObject([
      { id: "a", title: "known", time: { updated: 300 } },
    ])
  })

  test("with no page fetched the known roots are the list", () => {
    const rows = mergeRootSessionIndex(undefined, [c, child, g], { includeArchived: false, boundedKnown: true })

    expect(rows.map((row) => row.id)).toEqual(["c"])
  })

  // On a cache miss the archived page is empty, so the known archived row is the only source for the Inbox view's
  // archived section. That view must not pass the bound; this pins the drop that would happen if it did.
  test("the Inbox view keeps a known archived row the bound would drop", () => {
    const inbox = { includeArchived: true, boundedKnown: false }
    const projects = { includeArchived: true, boundedKnown: true }

    expect(mergeRootSessionIndex([a, b], [g], inbox).map((row) => row.id)).toEqual(["a", "b", "g"])
    expect(mergeRootSessionIndex([a, b], [g], projects).map((row) => row.id)).toEqual(["a", "b"])
  })
})

// The page the row source receives is the server's window. A page that exists but holds no active root is not the same
// thing as no page at all: the Projects view must show no row rather than fall back to every locally known root.
describe("fetched page", () => {
  const a = session("a", { time: { created: 1, updated: 300 }, location: { directory: "/repo" } })
  const b = session("b", { time: { created: 1, updated: 200 }, location: { directory: "/repo" } })
  const c = session("c", { time: { created: 1, updated: 100 }, location: { directory: "/other" } })
  const d = session("d", { time: { created: 1, updated: 400 }, location: { directory: "/other" } })

  // A bulk cleanup archives every root the server has. Archiving bumps `time.updated`, so the 50 newest rows are all
  // archived and the parsed page is empty: the slots are spent before the archived rows are dropped.
  const archivedPage = Array.from({ length: 50 }, (_, i) =>
    session(`archived-${i}`, {
      time: { created: 1, updated: 1_000_000 - i, archived: 1_001_000 },
      location: { directory: "/repo" },
    }),
  )

  test("a fetched page the archive filter empties adds no project row", () => {
    const page = parseHomeSessionIndex(archivedPage)
    expect(page).toEqual([])

    const rows = mergeRootSessionIndex(page, [c, d], { includeArchived: false, boundedKnown: true })

    expect(rows).toEqual([])
    expect(projectKeys(rows)).not.toContain("srv\u0000/other")
  })

  test("the archived-page state shows the same project rows after a restart", () => {
    const options = { includeArchived: false, boundedKnown: true }
    const page = parseHomeSessionIndex(archivedPage)

    expect(projectKeys(mergeRootSessionIndex(page, [c], options))).toEqual(
      projectKeys(mergeRootSessionIndex(page, [], options)),
    )
  })

  test("a known root created after a non-empty page still joins", () => {
    const rows = mergeRootSessionIndex([a, b], [d], { includeArchived: false, boundedKnown: true })

    expect(rows.map((row) => row.id)).toEqual(["a", "b", "d"])
    expect(projectKeys(rows)).toEqual(["srv\u0000/repo", "srv\u0000/other"])
  })
})
