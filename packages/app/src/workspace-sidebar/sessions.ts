import type { SessionInfo } from "@opencode/client/promise"
import { type Accessor } from "solid-js"
import { createStore, produce } from "solid-js/store"
import type { ServerConnection } from "@/runtime/server/registry"
import type { ServerCtx } from "@/runtime/server/runtime"
import { directoryKey, visible, type HostPlatform, type WorkspaceEntry } from "./registry"

export type RowKey = string

/**
 * One row's session list. The variant carries the loaded data, so a refresh that fails keeps the
 * previous sessions on screen instead of flashing the row empty.
 */
export type RowSessions = { status: "loading" | "ready" | "failed"; sessions: SessionInfo[] }

/** The registry key is the row identity everywhere; a row never invents a second spelling. */
export function rowKeyFor(entry: WorkspaceEntry, platform: HostPlatform) {
  return directoryKey(entry.directory, platform)
}

export function rowKeyOf(directory: string, platform: HostPlatform) {
  return directoryKey(directory, platform)
}

/**
 * The directory a row sends to the server: the server's own spelling once REG-04 adopted it,
 * otherwise the registered one. A spelling that would land on another row is never used.
 */
export function queryDirectoryFor(
  entry: WorkspaceEntry,
  platform: HostPlatform,
  spellings: Record<RowKey, string>,
) {
  const key = rowKeyFor(entry, platform)
  const spelling = spellings[key]

  if (spelling === undefined) return entry.directory

  return directoryKey(spelling, platform) === key ? spelling : entry.directory
}

/** A session returned by `session.list({ directory })` belongs to the row that asked, whatever spelling it carries. */
export function attributeSessions(sessions: readonly { id: string }[], rowKey: RowKey) {
  return sessions.map((session) => [session.id, rowKey] as const)
}

/** The row a `session.created` directory belongs to, or undefined when that directory is not registered. */
export function matchCreated(entries: WorkspaceEntry[], directory: string, platform: HostPlatform) {
  const key = directoryKey(directory, platform)
  const match = visible(entries).find((entry) => rowKeyFor(entry, platform) === key)

  return match ? rowKeyFor(match, platform) : undefined
}

/** Synchronous row read for the renderer: an unloaded row reads as loading, never throws. */
export function sessionsOf(rows: Record<RowKey, RowSessions>, key: RowKey) {
  return rows[key] ?? { status: "loading", sessions: [] }
}

const SESSION_LIST_LIMIT = 50

/**
 * Owns every read the sidebar makes: one `session.list({ directory })` per visible row, and the
 * in-memory `sessionID → row` map that lets id-only events refresh a single row.
 */
export function createWorkspaceSessions(input: {
  /** The row source: the renderer passes `() => visible(registry.entries())`. */
  entries: Accessor<WorkspaceEntry[]>
  connection: Accessor<ServerConnection.Any | undefined>
  ctx: Accessor<ServerCtx | undefined>
  platform: Accessor<HostPlatform>
}) {
  const [state, setState] = createStore<{ rows: Record<RowKey, RowSessions> }>({ rows: {} })

  const sessionRows = new Map<string, RowKey>()
  const inflight = new Set<RowKey>()
  const dirty = new Set<RowKey>()

  const entryForKey = (key: RowKey) => {
    const platform = input.platform()

    return visible(input.entries()).find((entry) => rowKeyFor(entry, platform) === key)
  }

  const forget = (key: RowKey) => {
    setState("rows", produce((rows) => void delete rows[key]))

    for (const [sessionID, row] of sessionRows) if (row === key) sessionRows.delete(sessionID)
  }

  const fetchRow = async (entry: WorkspaceEntry, key: RowKey) => {
    if (inflight.has(key)) {
      dirty.add(key)

      return
    }

    const ctx = input.ctx()

    if (!input.connection() || !ctx || ctx.sdk.connection.status() !== "connected") return

    inflight.add(key)

    try {
      const result = await ctx.sdk.api.session.list({
        directory: queryDirectoryFor(entry, input.platform(), {}),
        limit: SESSION_LIST_LIMIT,
        parentID: null,
        order: "desc",
      })

      setState("rows", key, { status: "ready", sessions: result.data })

      for (const [sessionID, row] of attributeSessions(result.data, key)) sessionRows.set(sessionID, row)
    } catch {
      const row = state.rows[key]

      if (!row || row.status !== "ready") setState("rows", key, { status: "failed", sessions: [] })
    } finally {
      inflight.delete(key)

      const rerun = dirty.delete(key) ? entryForKey(key) : undefined

      if (rerun) void fetchRow(rerun, key)
    }
  }

  const refreshRow = (key: RowKey) => {
    const entry = entryForKey(key)

    if (!entry) {
      forget(key)

      return
    }

    void fetchRow(entry, key)
  }

  /** Reconciles rows with `visible(entries)`; rows that left the registry drop their data. */
  const load = () => {
    const platform = input.platform()
    const entries = visible(input.entries())
    const keys = new Set(entries.map((entry) => rowKeyFor(entry, platform)))

    for (const key of Object.keys(state.rows)) if (!keys.has(key)) forget(key)

    for (const entry of entries) {
      const key = rowKeyFor(entry, platform)

      if (!state.rows[key]) setState("rows", key, { status: "loading", sessions: [] })
      void fetchRow(entry, key)
    }
  }

  return {
    rows: () => state.rows,
    load,
    refresh: load,
    refreshRow,
  }
}
