import { describe, expect, test } from "bun:test"
import { directoryGroupLabels, projectGroupFor, sessionProjectDirectory } from "./projects-groups"

describe("sessionProjectDirectory", () => {
  test("uses the closest known project directory", () => {
    const project = { worktrees: [{ directory: "C:/work/app" }, { directory: "C:/work/app/.worktrees/feature" }] }

    expect(sessionProjectDirectory(project, "C:/work/app/.worktrees/feature/src")).toBe(
      "C:/work/app/.worktrees/feature",
    )
    expect(sessionProjectDirectory(project, "C:/work/app/packages/ui")).toBe("C:/work/app")
  })

  test("keeps an unknown checkout as its own directory", () => {
    const project = { worktrees: [{ directory: "C:/work/app" }] }

    expect(sessionProjectDirectory(project, "D:/branch/app")).toBe("D:/branch/app")
    expect(sessionProjectDirectory(undefined, "D:/branch/app")).toBe("D:/branch/app")
  })

  test("falls back to the project's sandboxes before the inventory arrives", () => {
    // Metadata carries only the canonical worktree at this point; `sandboxes` is the saved inventory of the others.
    const project = { worktree: "C:/work/app", sandboxes: ["C:/work/app/.worktrees/feature"] }

    expect(sessionProjectDirectory(project, "C:/work/app/.worktrees/feature/src")).toBe(
      "C:/work/app/.worktrees/feature",
    )
    expect(sessionProjectDirectory(project, "C:/work/app/packages/ui")).toBe("C:/work/app")
  })
})

describe("projectGroupFor", () => {
  test("keys the checkout that owns the session directory", () => {
    const project = { worktrees: [{ directory: "C:/work/app" }, { directory: "C:/work/app/.worktrees/feature" }] }

    expect(projectGroupFor("srv", project, "C:/work/app/packages/ui")).toEqual({
      key: "srv\u0000C:/work/app",
      directory: "C:/work/app",
    })
    expect(projectGroupFor("srv", project, "C:/work/app/.worktrees/feature/src")).toEqual({
      key: "srv\u0000C:/work/app/.worktrees/feature",
      directory: "C:/work/app/.worktrees/feature",
    })
  })

  test("separates clones and servers", () => {
    const project = { worktrees: [{ directory: "C:/work/app" }] }

    expect(projectGroupFor("a", project, "C:/work/app").key).not.toBe(projectGroupFor("b", project, "C:/work/app").key)
    expect(projectGroupFor("a", project, "D:/branch/app").key).toBe("a\u0000D:/branch/app")
  })

  test("sessions without a project share the ungrouped key", () => {
    expect(projectGroupFor("srv", undefined, "D:/scratch")).toEqual({ key: "ungrouped", directory: "D:/scratch" })
  })

  test("keys the same sessions the same way before and after the inventory arrives", () => {
    const sessions = ["C:/work/app/packages/ui", "C:/work/app/.worktrees/feature/src"]

    // Before the inventory: metadata carries the canonical worktree, and `sandboxes` holds the saved checkouts.
    const sandboxesOnly = {
      worktree: "C:/work/app",
      sandboxes: ["C:/work/app/.worktrees/feature"],
      worktrees: [{ directory: "C:/work/app" }],
    }
    // After: `withWorktreeInventory` recomputes `sandboxes` from the listed inventory minus the canonical root.
    const inventoried = {
      worktree: "C:/work/app",
      sandboxes: ["C:/work/app/.worktrees/feature"],
      worktrees: [{ directory: "C:/work/app" }, { directory: "C:/work/app/.worktrees/feature" }],
    }

    const before = sessions.map((directory) => projectGroupFor("srv", sandboxesOnly, directory).key)
    const after = sessions.map((directory) => projectGroupFor("srv", inventoried, directory).key)

    expect(before).toEqual(after)
    expect(before).toEqual(["srv\u0000C:/work/app", "srv\u0000C:/work/app/.worktrees/feature"])
  })

  test("keeps two clones of one repository on separate rows", () => {
    const project = { worktree: "C:/work/app", sandboxes: ["D:/branch/app"] }

    expect(projectGroupFor("srv", project, "C:/work/app/packages/ui").key).toBe("srv\u0000C:/work/app")
    expect(projectGroupFor("srv", project, "D:/branch/app/packages/ui").key).toBe("srv\u0000D:/branch/app")
  })

  test("moves a session into a deeper checkout the inventory reveals", () => {
    const sandboxesOnly = {
      worktree: "C:/work/app",
      sandboxes: ["C:/work/app/.worktrees/feature"],
      worktrees: [{ directory: "C:/work/app" }],
    }
    const inventoried = {
      worktree: "C:/work/app",
      sandboxes: ["C:/work/app/.worktrees/feature"],
      worktrees: [{ directory: "C:/work/app" }, { directory: "C:/work/app/.worktrees/feature" }],
    }

    expect(projectGroupFor("srv", inventoried, "C:/work/app/.worktrees/feature/src").key).toBe(
      "srv\u0000C:/work/app/.worktrees/feature",
    )
    expect(projectGroupFor("srv", sandboxesOnly, "C:/work/app/packages/ui").key).toBe("srv\u0000C:/work/app")
    expect(projectGroupFor("srv", inventoried, "C:/work/app/packages/ui").key).toBe("srv\u0000C:/work/app")
  })
})

describe("directoryGroupLabels", () => {
  test("keeps unique titles", () => {
    const labels = directoryGroupLabels([
      { key: "a", directory: "C:/work/app", title: "app" },
      { key: "b", directory: "C:/work/api", title: "api" },
    ])

    expect(labels.get("a")).toBe("app")
    expect(labels.get("b")).toBe("api")
  })

  test("disambiguates identical folder names with the parent folder", () => {
    const labels = directoryGroupLabels([
      { key: "a", directory: "C:/work/app", title: "app" },
      { key: "b", directory: "D:/branch/app", title: "app" },
    ])

    expect(labels.get("a")).toBe("app · work")
    expect(labels.get("b")).toBe("app · branch")
  })

  test("falls back to the full directory when the parent name repeats", () => {
    const labels = directoryGroupLabels([
      { key: "a", directory: "C:/work/app", title: "app" },
      { key: "b", directory: "D:/work/app", title: "app" },
    ])

    expect(labels.get("a")).toBe("app · C:/work/app")
    expect(labels.get("b")).toBe("app · D:/work/app")
  })
})
