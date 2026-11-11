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
