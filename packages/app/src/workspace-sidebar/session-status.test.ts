import { describe, expect, test } from "bun:test"
import { elapsedBucket, sessionRowStatus, statusMark } from "./session-status"

describe("sessionRowStatus", () => {
  const none = { failed: false, permission: false, form: false, busy: false, unread: false }

  test("all false reads as idle", () => {
    expect(sessionRowStatus(none)).toBe("idle")
  })

  test.each([
    ["failed", { failed: true }],
    ["approval", { permission: true }],
    ["input", { form: true }],
    ["working", { busy: true }],
    ["unread", { unread: true }],
  ] as const)("single signal %s wins alone", (expected, input) => {
    expect(sessionRowStatus({ ...none, ...input })).toBe(expected)
  })

  test("failed beats every other signal", () => {
    expect(sessionRowStatus({ failed: true, permission: true, form: true, busy: true, unread: true })).toBe("failed")
  })

  test("approval beats input, working and unread", () => {
    expect(sessionRowStatus({ ...none, permission: true, form: true, busy: true, unread: true })).toBe("approval")
  })

  test("input beats working and unread", () => {
    expect(sessionRowStatus({ ...none, form: true, busy: true, unread: true })).toBe("input")
  })

  test("working beats unread", () => {
    expect(sessionRowStatus({ ...none, busy: true, unread: true })).toBe("working")
  })
})

describe("elapsedBucket", () => {
  const updated = 1_000_000

  test.each([
    [0, { kind: "now" }],
    [59, { kind: "now" }],
    [60, { kind: "minutes", count: 1 }],
    [3_599, { kind: "minutes", count: 59 }],
    [3_600, { kind: "hours", count: 1 }],
    [86_399, { kind: "hours", count: 23 }],
    [86_400, { kind: "days", count: 1 }],
    [172_800, { kind: "days", count: 2 }],
  ] as const)("age %ss maps to %o", (seconds, expected) => {
    expect(elapsedBucket(updated, updated + seconds * 1000)).toEqual(expected)
  })

  test("a future updated time clamps to now", () => {
    expect(elapsedBucket(updated + 60_000, updated)).toEqual({ kind: "now" })
  })
})

describe("statusMark", () => {
  test.each([
    ["failed", { kind: "icon", icon: "close", className: "text-v2-state-fg-danger" }],
    ["approval", { kind: "icon", icon: "circle-exclamation", className: "text-v2-state-fg-warning" }],
    ["input", { kind: "icon", icon: "help", className: "text-v2-state-fg-warning" }],
    ["unread", { kind: "icon", icon: "check", className: "text-v2-state-fg-success" }],
  ] as const)("%s maps to its icon and semantic token", (status, expected) => {
    expect(statusMark(status)).toEqual(expected)
  })

  test("working maps to the info-colored ring", () => {
    expect(statusMark("working")).toEqual({ kind: "ring" })
  })

  test("idle carries no mark", () => {
    expect(statusMark("idle")).toBeUndefined()
  })
})
