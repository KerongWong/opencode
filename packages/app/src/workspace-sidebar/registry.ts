import { Schema } from "effect"
import { Persistence } from "@/runtime/persistence/schema"

export type HostPlatform = "win32" | "darwin" | "linux"

export const REGISTRY_KEY = "workspace-registry.v1"

export const WorkspaceEntrySchema = Persistence.struct({
  directory: Schema.String,
  title: Schema.String,
  order: Schema.Number,
  createdAt: Schema.Number,
  removedAt: Persistence.optional(Schema.Number),
})

export type WorkspaceEntry = typeof WorkspaceEntrySchema.Type

/**
 * The client has no `fs`, so a directory cannot be resolved through symlinks or 8.3 short names: an
 * alias registers as a second workspace. Accepted residual, not silently normalized away.
 */
export function normalizeDirectory(input: string, platform: HostPlatform) {
  const trimmed = trimTrailingSeparators(input.replaceAll("\\", "/"))

  return trimmed === "" ? "/" : trimmed
}

/** Only compares spellings of the same directory; a record stores `normalizeDirectory` instead. */
export function directoryKey(directory: string, platform: HostPlatform) {
  const normalized = normalizeDirectory(directory, platform)

  return platform === "win32" ? normalized.toLowerCase() : normalized
}

export function register(entries: WorkspaceEntry[], input: { directory: string; platform: HostPlatform }) {
  const key = directoryKey(input.directory, input.platform)
  const existing = entries.find((entry) => directoryKey(entry.directory, input.platform) === key)

  if (existing) {
    if (existing.removedAt === undefined) return { entries, entry: existing }

    const entry: WorkspaceEntry = { ...existing, removedAt: undefined }

    return { entries: entries.map((item) => (item === existing ? entry : item)), entry }
  }

  const directory = normalizeDirectory(input.directory, input.platform)

  const entry: WorkspaceEntry = {
    directory,
    title: directory.slice(directory.lastIndexOf("/") + 1),
    order: entries.length,
    createdAt: Date.now(),
  }

  return { entries: [...entries, entry], entry }
}

function trimTrailingSeparators(value: string) {
  let end = value.length

  while (end > 0 && value[end - 1] === "/") end--

  return value.slice(0, end)
}
