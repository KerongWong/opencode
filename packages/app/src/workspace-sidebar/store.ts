import { persisted } from "@/runtime/persistence/storage"
import type { ServerScope } from "@/runtime/server/scope"
import {
  directoryKey,
  initialRegistry,
  normalizeDirectory,
  register,
  registryTarget,
  remove,
  WorkspaceRegistrySchema,
  type HostPlatform,
  type WorkspaceEntry,
} from "./registry"

/**
 * Drag-and-drop writes the visible order back as `order = index`. Records outside the supplied
 * order keep theirs, which is what leaves removed rows and rows the caller never saw untouched.
 */
export function applyOrder(entries: WorkspaceEntry[], orderedDirectories: string[], platform: HostPlatform) {
  const positions = new Map<string, number>()

  orderedDirectories.forEach((directory, index) => {
    const key = directoryKey(directory, platform)

    if (!positions.has(key)) positions.set(key, index)
  })

  return entries.map((entry) => {
    if (entry.removedAt !== undefined) return entry

    const position = positions.get(directoryKey(entry.directory, platform))

    if (position === undefined || position === entry.order) return entry

    return { ...entry, order: position }
  })
}

/** Renaming writes `title` only; a blank or unchanged title returns the same array so nothing persists. */
export function withTitle(entries: WorkspaceEntry[], directory: string, title: string, platform: HostPlatform) {
  const trimmed = title.trim()

  if (trimmed === "") return entries

  const key = directoryKey(directory, platform)
  const target = entries.find((entry) => directoryKey(entry.directory, platform) === key)

  if (!target || target.title === trimmed) return entries

  return entries.map((entry) => (entry === target ? { ...entry, title: trimmed } : entry))
}

/**
 * REG-04: a server spelling replaces the record's own spelling only when both resolve to the same
 * row. Cross-row spellings are rejected, so one row can never take over another's directory.
 */
export function adoptEntryDirectory(
  entries: WorkspaceEntry[],
  directory: string,
  serverDirectory: string,
  platform: HostPlatform,
) {
  const key = directoryKey(directory, platform)
  // The server answers with whatever its filesystem layer produced — on Windows that can be a
  // backslash spelling. Adopting it raw would leave the registry with two shapes of key and make
  // `defaultTitle` treat the whole path as one segment.
  const spelling = normalizeDirectory(serverDirectory, platform)

  if (directoryKey(spelling, platform) !== key) return entries

  const target = entries.find((entry) => directoryKey(entry.directory, platform) === key)

  if (!target || target.directory === spelling) return entries

  return entries.map((entry) => (entry === target ? { ...entry, directory: spelling } : entry))
}

/**
 * The `persisted()` call site for this module: the workspace registry (`workspace-registry.v1`),
 * a per-server client-local store.
 */

/**
 * The only `persisted(registryTarget(scope), ...)` call site. `platform` is the host OS, fixed for
 * the component's lifetime, so it enters once as a factory argument.
 */
export function createWorkspaceRegistry(scope: ServerScope, platform: HostPlatform) {
  const [state, setState, , ready] = persisted(registryTarget(scope), WorkspaceRegistrySchema, initialRegistry)

  const commit = (entries: WorkspaceEntry[]) => {
    if (entries === state.entries) return

    setState("entries", entries)
  }

  return {
    entries: () => state.entries,
    scrollTop: () => state.scrollTop,
    ready,
    register(directory: string) {
      const result = register(state.entries, { directory, platform })

      commit(result.entries)

      return result.entry
    },
    rename(directory: string, title: string) {
      commit(withTitle(state.entries, directory, title, platform))
    },
    remove(directory: string) {
      commit(remove(state.entries, { directory, platform }))
    },
    reorder(orderedDirectories: string[]) {
      commit(applyOrder(state.entries, orderedDirectories, platform))
    },
    setScrollTop(value: number) {
      setState("scrollTop", value)
    },
    adoptDirectory(directory: string, serverDirectory: string) {
      commit(adoptEntryDirectory(state.entries, directory, serverDirectory, platform))
    },
  }
}
