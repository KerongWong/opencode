import { describe, expect, test } from "bun:test"
import { registrationFile } from "./registration-file"

// Packaging contract: the desktop and its bundled CLI must agree on the registration filename,
// or the desktop probes a file the service never writes (timed-out fork launches, killed
// strangers' services). Keep in sync with filename() in packages/cli/src/services/service-config.ts.
describe("registrationFile", () => {
  test.each([
    ["local", "service-local.json"],
    ["dev", "service.json"],
    ["beta", "service.json"],
    ["prod", "service-prod.json"],
    ["fork", "service-fork.json"],
    ["latest", "service.json"],
    ["next", "service.json"],
  ])("channel %s registers as %s", (channel, expected) => {
    expect(registrationFile(channel)).toBe(expected)
  })
})
