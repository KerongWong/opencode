import { Schema } from "effect"
import type { Platform } from "@/runtime/platform/platform"
import { Persistence } from "@/runtime/persistence/schema"
import { Persist } from "@/runtime/persistence/storage"
import type { ServerScope } from "@/runtime/server/scope"

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

export const WorkspaceRegistrySchema = Persistence.struct({
  entries: Persistence.array(WorkspaceEntrySchema),
  scrollTop: Schema.Number,
})

export type WorkspaceRegistry = typeof WorkspaceRegistrySchema.Type

export const initialRegistry: WorkspaceRegistry = { entries: [], scrollTop: 0 }

/**
 * The persisted target only. Phase 2 calls `persisted(registryTarget(scope), ...)` from its own
 * component, so no Solid owner enters this module.
 */
export function registryTarget(scope: ServerScope): ReturnType<typeof Persist.serverGlobal> {
  return Persist.serverGlobal(scope, REGISTRY_KEY)
}

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

/**
 * A directory this key cannot own: an empty or whitespace-only value (a cancelled picker coerced to
 * `""`) or a relative path. `normalizeDirectory` maps `""` to `/`, so the guard reads the raw input
 * first and then requires an absolute result. Rejection returns the list unchanged rather than
 * throwing, the same way remove rejects an unregistered directory.
 */
function registrable(input: string, platform: HostPlatform) {
  if (input.trim() === "") return false

  const normalized = normalizeDirectory(input, platform)

  return platform === "win32" ? /^([A-Za-z]:\/|\/\/)/.test(normalized) : normalized.startsWith("/")
}

/** The last segment of a normalized directory, except for a root, which keeps its own spelling. */
export function defaultTitle(directory: string) {
  const trimmed = trimTrailingSeparators(directory)
  const title = trimmed.slice(trimmed.lastIndexOf("/") + 1)

  return title === "" ? directory : title
}

export function register(entries: WorkspaceEntry[], input: { directory: string; platform: HostPlatform }) {
  if (!registrable(input.directory, input.platform)) return { entries, entry: undefined }

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
    title: defaultTitle(directory),
    order: entries.reduce((next, item) => Math.max(next, item.order + 1), 0),
    createdAt: Date.now(),
  }

  return { entries: [...entries, entry], entry }
}

/** Masks the record instead of deleting it, so re-registering restores its display name and order. */
export function remove(entries: WorkspaceEntry[], input: { directory: string; platform: HostPlatform }) {
  if (!registrable(input.directory, input.platform)) return entries

  const key = directoryKey(input.directory, input.platform)
  const existing = entries.find((entry) => directoryKey(entry.directory, input.platform) === key)

  if (!existing || existing.removedAt !== undefined) return entries

  const removedAt = Date.now()

  return entries.map((entry) => (entry === existing ? { ...entry, removedAt } : entry))
}

export function visible(entries: WorkspaceEntry[]) {
  return entries.filter((entry) => entry.removedAt === undefined).sort((left, right) => left.order - right.order)
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
