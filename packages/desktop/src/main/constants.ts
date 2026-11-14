import { app } from "electron"

// `fork` is this repository's own channel: it keeps its own service registration file, port and
// database (see `packages/cli/src/services/service-config.ts` and `database-path.ts`), which is what
// lets the fork and an official install run side by side without replacing each other's backend.
type Channel = "local" | "dev" | "beta" | "prod" | "fork"

const raw = import.meta.env.OPENCODE_CHANNEL

export const CHANNEL: Channel =
  raw === "local" || raw === "dev" || raw === "beta" || raw === "prod" || raw === "fork" ? raw : "dev"

export const VERSION = app.isPackaged ? app.getVersion() : (process.env.OPENCODE_VERSION ?? app.getVersion())

const appNames = {
  // Local renderer/server mode keeps the dev application identity.
  local: "OpenCode Dev",
  dev: "OpenCode Dev",
  beta: "OpenCode Beta",
  prod: "OpenCode",
  fork: "OpenCode Fork",
} satisfies Record<string, string>

const appIDs = {
  local: "ai.opencode.desktop.dev",
  dev: "ai.opencode.desktop.dev",
  beta: "ai.opencode.desktop.beta",
  prod: "ai.opencode.desktop",
  fork: "ai.opencode.desktop.fork",
} satisfies Record<string, string>

// Local renderer/server mode keeps the dev application identity.
export const APP_NAME = app.isPackaged ? (appNames[CHANNEL] ?? "OpenCode Dev") : "OpenCode Dev"

export const APP_ID = app.isPackaged ? (appIDs[CHANNEL] ?? "ai.opencode.desktop.dev") : "ai.opencode.desktop.dev"
