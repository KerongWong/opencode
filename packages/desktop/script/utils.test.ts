import { afterEach, describe, expect, test } from "bun:test"
import { resolveChannel } from "./utils"

const original = process.env.OPENCODE_CHANNEL

afterEach(() => {
  if (original === undefined) delete process.env.OPENCODE_CHANNEL
  else process.env.OPENCODE_CHANNEL = original
})

describe("resolveChannel", () => {
  test.each([
    [undefined, "projects"],
    ["", "projects"],
    ["nonsense", "projects"],
    ["dev", "dev"],
    ["beta", "beta"],
    ["prod", "prod"],
    ["projects", "projects"],
    ["latest", "prod"],
  ] as const)("OPENCODE_CHANNEL=%s resolves to %s", (raw, expected) => {
    if (raw === undefined) delete process.env.OPENCODE_CHANNEL
    else process.env.OPENCODE_CHANNEL = raw

    expect(resolveChannel()).toBe(expected)
  })
})
