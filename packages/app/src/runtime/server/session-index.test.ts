import { describe, expect, test } from "bun:test"
import type { SessionInfo } from "@opencode/client/promise"
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
})
