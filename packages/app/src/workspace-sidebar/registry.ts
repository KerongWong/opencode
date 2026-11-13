import { Schema } from "effect"
import type { Platform } from "@/runtime/platform/platform"
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
 * The only mapping from the host OS vocabulary to the normalization platform. `DesktopOS` is not
 * exported, so this reads the same union through `Platform["os"]`; a browser has no host OS and the
 * directory picker is desktop-only, so Web falls back to POSIX rules.
 */
export function hostPlatform(os: Platform["os"]): HostPlatform {
  if (os === "macos") return "darwin"

  if (os === "windows") return "win32"

  return "linux"
}

/**
 * The client has no `fs`, so a directory cannot be resolved through symlinks or 8.3 short names: an
 * alias registers as a second workspace. Accepted residual, not silently normalized away. A Windows
 * drive root keeps its slash (`C:/`) because the server only stores paths matching `^[A-Za-z]:/`.
 */
export function normalizeDirectory(input: string, platform: HostPlatform) {
  const fused = fuseSeparators(input.replaceAll("\\", "/"))
  const cased = platform === "win32" ? upperDrive(fused) : fused

  if (cased === "/") return "/"

  if (/^[A-Za-z]:$/.test(cased)) return `${cased}/`

  if (/^[A-Za-z]:\/$/.test(cased)) return cased

  const trimmed = trimTrailingSeparators(cased)

  return trimmed === "" ? "/" : trimmed
}

/**
 * Only compares spellings of the same directory; a record stores `normalizeDirectory` instead.
 * Case-insensitive filesystems (default APFS / NTFS) can still yield two rows for one directory,
 * the same accepted residual as symlink aliases.
 */
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

/** Keeps a UNC prefix's leading `//` while collapsing separators inside the rest of the path. */
function fuseSeparators(value: string) {
  const prefix = value.startsWith("//") && !value.startsWith("///") ? "//" : ""

  return prefix + value.slice(prefix.length).replace(/\/{2,}/g, "/")
}

function upperDrive(value: string) {
  if (!/^[A-Za-z]:/.test(value)) return value

  return value.slice(0, 1).toUpperCase() + value.slice(1)
}

function trimTrailingSeparators(value: string) {
  let end = value.length

  while (end > 0 && value[end - 1] === "/") end--

  return value.slice(0, end)
}
