import { describe, expect, test } from "bun:test"
import { conceal, initialUiState, reveal, UI_STATE_KEY, WorkspaceUiSchema } from "./ui-state"

describe("reveal / conceal", () => {
  test("reveal appends an unseen key", () => {
    expect(reveal([], "row-a")).toEqual(["row-a"])
    expect(reveal(["row-a"], "row-b")).toEqual(["row-a", "row-b"])
  })

  test("reveal of a known key returns the same reference so nothing persists", () => {
    const keys = ["row-a"]

    expect(reveal(keys, "row-a")).toBe(keys)
  })

  test("conceal removes a known key", () => {
    expect(conceal(["row-a", "row-b"], "row-a")).toEqual(["row-b"])
  })

  test("conceal of an unknown key returns the same reference", () => {
    const keys = ["row-a"]

    expect(conceal(keys, "row-b")).toBe(keys)
  })

  test("repeated reveal and conceal are idempotent", () => {
    const once = reveal([], "row-a")
    const twice = reveal(once, "row-a")

    expect(twice).toBe(once)

    const without = conceal(once, "row-a")

    expect(conceal(without, "row-a")).toBe(without)
  })
})

describe("workspace-sidebar-ui.v1 persistence shape", () => {
  test("the persisted key and schema stay stable", () => {
    expect(UI_STATE_KEY).toBe("workspace-sidebar-ui.v1")
    expect(WorkspaceUiSchema.make(initialUiState)).toEqual({ revealed: [] })
  })
})
