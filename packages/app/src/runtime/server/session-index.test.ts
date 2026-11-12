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

describe("root session index merge", () => {
  test("keeps a locally known archived session out of a project row", () => {
    const index = [session("active", { location: { directory: "/repo" } })]
    const known = [archivedRoot, session("child", { parentID: "active", location: { directory: "/repo" } })]

    const keys = mergeRootSessionIndex(index, known, { includeArchived: false }).map(
      (row) => projectGroupFor("srv", { worktrees: [{ directory: "/repo" }] }, row.location.directory).key,
    )

    expect(keys).toEqual(["srv\u0000/repo"])
  })
})
