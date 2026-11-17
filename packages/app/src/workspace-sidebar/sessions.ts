import type { SessionInfo } from "@opencode/client/promise"
import { createEffect, on, onCleanup, untrack, type Accessor } from "solid-js"
import { createStore, produce } from "solid-js/store"
import type { ServerConnection } from "@/runtime/server/registry"
import type { ServerCtx } from "@/runtime/server/runtime"
import { directoryKey, visible, type HostPlatform, type WorkspaceEntry } from "./registry"
import type { SessionRowStatus } from "./session-status"

export type RowKey = string

/**
 * One row's session list. The variant carries the loaded data, so a refresh that fails keeps the
 * previous sessions on screen instead of flashing the row empty.
 */
export type RowSessions = { status: "loading" | "ready" | "failed"; sessions: SessionInfo[] }

/** A probe answer is only ever the filesystem's, never inferred from how many sessions exist. */
export type Availability = "checking" | "available" | "unavailable"

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

/**
 * REG-04: the server's original spelling of a row's directory. A non-empty list is the only
 * trustworthy source; an empty one leaves the caller on its local normalization.
 */
export function serverSpelling(
  entry: WorkspaceEntry,
  sessions: readonly { id?: string; location?: { directory?: string } }[],
  platform: HostPlatform,
) {
  const directory = sessions[0]?.location?.directory

  if (directory === undefined) return undefined

  return directoryKey(directory, platform) === rowKeyFor(entry, platform) ? directory : undefined
}

/**
 * Availability is a filesystem answer, so every row that finished listing is probed — including a
 * row with history, because `session.list` is a database filter and keeps returning sessions after
 * the directory was renamed or deleted.
 */
export function needsAvailabilityProbe(row: RowSessions) {
  return row.status === "ready"
}

/** Synchronous row read for the renderer: an unloaded row reads as loading, never throws. */
export function sessionsOf(rows: Record<RowKey, RowSessions>, key: RowKey) {
  return rows[key] ?? { status: "loading", sessions: [] }
}

/** How many sessions a row shows before "show more" (COLL-03 baseline). */
export const SESSION_WATERMARK_BASE = 5

/**
 * COLL-05: auto-raise ceiling only — clicking "show more" is unbounded. Reserved for 07-02's
 * attention lift; this plan exports it so the constant has one spelling.
 */
export const SESSION_WATERMARK_AUTO_MAX = 50

/**
 * COLL-03: one "show more" click raises the row's watermark by one batch, except when the hidden
 * remainder is at most one batch — then the row expands to everything in a single step (dsh's
 * Infinity semantics, boundary equality included). Undefined reads as the baseline, and a row at
 * or past its total never moves, so the watermark is monotonic across clicks.
 */
export function nextWatermark(current: number | undefined, total: number) {
  if (current !== undefined && current >= total) return current

  if (total <= SESSION_WATERMARK_BASE) return total

  if (current === undefined) return SESSION_WATERMARK_BASE

  if (total - current <= SESSION_WATERMARK_BASE) return total

  return current + SESSION_WATERMARK_BASE
}

/** COLL-03: the button count reads the hidden remainder below the watermark, clamped at zero. */
export function remainingHidden(total: number, watermark: number) {
  return Math.max(0, total - watermark)
}

/** COLL-03: the on-screen prefix of a row's list. Pure so the cutoff is unit-testable. */
export function shownByWatermark<T>(sessions: readonly T[], watermark: number) {
  return sessions.slice(0, watermark)
}

/**
 * COLL-04: the watermark an attention session forces when it sits at `index` of its row. Working,
 * approval, input and unread sessions — plus the active session, whatever its status — are visible
 * without a click when they are within the auto-raise ceiling; the ceiling constrains only this
 * automatic lift, never "show more" clicks. Everything else reads as no requirement (0), so a row
 * full of quiet sessions never triggers a write. Index is zero-based, the ceiling is inclusive.
 */
export function requiredWatermark(index: number, status: SessionRowStatus, isActive: boolean) {
  const attention = status === "working" || status === "approval" || status === "input" || status === "unread"

  if (index <= SESSION_WATERMARK_AUTO_MAX && (attention || isActive)) return index + 1

  return 0
}

/**
 * COLL-04: the raise half of the render-phase lift — monotonic by construction. A requirement at
 * or below the current watermark leaves it untouched, and an equal requirement returns the current
 * value, so the driver can compare and skip the store write entirely (no signal churn).
 */
export function raisedWatermark(current: number, required: number) {
  if (required > current) return required

  return current
}

/**
 * COLL-04: the watermark requirement of a whole row, derived from every session in it — including
 * sessions hidden below the current watermark, which never mount a SessionRow to report a status.
 * The caller injects the status lookup (a read over the server context), keeping this a pure
 * function over the row data so the hidden-session case is unit-testable. A row without a ready
 * answer raises nothing.
 */
export function requiredRowWatermark<T extends { id: string }>(
  row: { status: "loading" | "ready" | "failed"; sessions: readonly T[] },
  statusOf: (session: T) => SessionRowStatus,
  activeSession: string | undefined,
) {
  if (row.status !== "ready") return 0

  return row.sessions.reduce(
    (highest, session, index) =>
      Math.max(highest, requiredWatermark(index, statusOf(session), session.id === activeSession)),
    0,
  )
}

const SESSION_LIST_LIMIT = 50

/**
 * Owns every read the sidebar makes: one `session.list({ directory })` per visible row, one
 * `file.list` availability probe per load, the REG-04 spelling reconciliation, and the in-memory
 * `sessionID → row` map that lets id-only events refresh a single row.
 */
export function createWorkspaceSessions(input: {
  /** The row source: the renderer passes `() => visible(registry.entries())`. */
  entries: Accessor<WorkspaceEntry[]>
  connection: Accessor<ServerConnection.Any | undefined>
  ctx: Accessor<ServerCtx | undefined>
  platform: Accessor<HostPlatform>
  /** Called when a row answers with a different server spelling, so the registry can adopt it too. */
  onServerSpelling?: (directory: string, serverDirectory: string) => void
}) {
  const [state, setState] = createStore<{
    rows: Record<RowKey, RowSessions>
    availability: Record<RowKey, Availability>
    spellings: Record<RowKey, string>
  }>({ rows: {}, availability: {}, spellings: {} })

  const sessionRows = new Map<string, RowKey>()
  const inflight = new Set<RowKey>()
  const dirty = new Set<RowKey>()
  const pendingProbe = new Set<RowKey>()
  const scheduled = new Set<RowKey>()
  let flushScheduled = false

  const entryForKey = (key: RowKey) => {
    const platform = input.platform()

    return visible(input.entries()).find((entry) => rowKeyFor(entry, platform) === key)
  }

  const forget = (key: RowKey) => {
    setState("rows", produce((rows) => void delete rows[key]))
    setState("availability", produce((availability) => void delete availability[key]))
    setState("spellings", produce((spellings) => void delete spellings[key]))

    for (const [sessionID, row] of sessionRows) if (row === key) sessionRows.delete(sessionID)
  }

  const adoptSpelling = (entry: WorkspaceEntry, key: RowKey, spelling: string) => {
    if (state.spellings[key] !== spelling) setState("spellings", key, spelling)

    if (spelling !== entry.directory) input.onServerSpelling?.(entry.directory, spelling)
  }

  const probeAvailability = async (entry: WorkspaceEntry, key: RowKey) => {
    const ctx = input.ctx()

    if (!ctx) return

    setState("availability", key, "checking")

    try {
      await ctx.sdk.api.file.list({
        location: { directory: queryDirectoryFor(entry, input.platform(), state.spellings) },
      })
      setState("availability", key, "available")
    } catch {
      setState("availability", key, "unavailable")
    }
  }

  const fetchRow = async (entry: WorkspaceEntry, key: RowKey, probe: boolean) => {
    if (inflight.has(key)) {
      dirty.add(key)

      if (probe) pendingProbe.add(key)

      return
    }

    const ctx = input.ctx()

    if (!input.connection() || !ctx || ctx.sdk.connection.status() !== "connected") return

    inflight.add(key)

    try {
      const result = await ctx.sdk.api.session.list({
        directory: queryDirectoryFor(entry, input.platform(), state.spellings),
        limit: SESSION_LIST_LIMIT,
        parentID: null,
        order: "desc",
        archived: false,
      })

      const ready: RowSessions = { status: "ready", sessions: result.data }

      setState("rows", key, ready)

      for (const [sessionID, row] of attributeSessions(result.data, key)) sessionRows.set(sessionID, row)

      const spelling = serverSpelling(entry, result.data, input.platform())

      if (spelling !== undefined) adoptSpelling(entry, key, spelling)

      if (probe && needsAvailabilityProbe(ready)) await probeAvailability(entry, key)
    } catch {
      const row = state.rows[key]

      if (!row || row.status !== "ready") setState("rows", key, { status: "failed", sessions: [] })
    } finally {
      inflight.delete(key)

      const rerunProbe = pendingProbe.delete(key)
      const rerun = dirty.delete(key) ? entryForKey(key) : undefined

      if (rerun) void fetchRow(rerun, key, rerunProbe)
    }
  }

  const refreshRow = (key: RowKey) => {
    const entry = entryForKey(key)

    if (!entry) {
      forget(key)

      return
    }

    void fetchRow(entry, key, false)
  }

  /** Coalesces a burst of events into one refetch per row on the next microtask. */
  const schedule = (key: RowKey) => {
    scheduled.add(key)

    if (flushScheduled) return

    flushScheduled = true
    queueMicrotask(() => {
      flushScheduled = false

      const keys = [...scheduled]

      scheduled.clear()

      for (const key of keys) refreshRow(key)
    })
  }

  const renameSession = (key: RowKey, sessionID: string, title: string) => {
    const index = state.rows[key]?.sessions.findIndex((session) => session.id === sessionID) ?? -1

    if (index === -1) return

    setState("rows", key, "sessions", index, "title", title)
  }

  const dropSession = (key: RowKey, sessionID: string) => {
    const row = state.rows[key]

    sessionRows.delete(sessionID)

    if (!row) return

    setState(
      "rows",
      key,
      "sessions",
      row.sessions.filter((session) => session.id !== sessionID),
    )
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
      void fetchRow(entry, key, true)
    }
  }

  /** REG-04: ask the server for its spelling of a freshly registered directory. */
  const probeSpelling = async (entry: WorkspaceEntry) => {
    const ctx = input.ctx()

    if (!ctx || ctx.sdk.connection.status() !== "connected") return undefined

    const platform = input.platform()
    const key = rowKeyFor(entry, platform)

    try {
      const result = await ctx.sdk.api.session.list({
        directory: queryDirectoryFor(entry, platform, state.spellings),
        limit: 1,
        parentID: null,
        order: "desc",
      })

      const spelling = serverSpelling(entry, result.data, platform)

      if (spelling === undefined) return undefined

      adoptSpelling(entry, key, spelling)

      return spelling
    } catch {
      return undefined
    }
  }

  // Resubscribe whenever the controller identity changes; every handler reads the current entries.
  createEffect(() => {
    const ctx = input.ctx()

    if (!ctx) return

    onCleanup(
      ctx.data.on("session.created", (event) => {
        if (event.data.parentID !== undefined) return

        const key = matchCreated(input.entries(), event.data.location.directory, input.platform())

        if (key === undefined) return

        sessionRows.set(event.data.sessionID, key)
        schedule(key)
      }),
    )
    onCleanup(
      ctx.data.on("session.archived", (event) => {
        const key = sessionRows.get(event.data.sessionID)

        if (key !== undefined) schedule(key)
      }),
    )
    onCleanup(
      ctx.data.on("session.unarchived", (event) => {
        const key = sessionRows.get(event.data.sessionID)

        if (key !== undefined) schedule(key)
      }),
    )
    onCleanup(
      ctx.data.on("session.deleted", (event) => {
        const key = sessionRows.get(event.data.sessionID)

        if (key === undefined) return

        dropSession(key, event.data.sessionID)
        schedule(key)
      }),
    )
    onCleanup(
      ctx.data.on("session.renamed", (event) => {
        const key = sessionRows.get(event.data.sessionID)

        if (key !== undefined) renameSession(key, event.data.sessionID, event.data.title)
      }),
    )
  })

  // A reconnect reloads every visible row, which also re-probes directories the user may have
  // restored. `untrack` keeps this effect from subscribing to the store writes `load` performs.
  createEffect(
    on(
      () => input.ctx()?.sdk.connection.status(),
      (status) => {
        if (status === "connected") untrack(load)
      },
      { defer: true },
    ),
  )

  return {
    rows: () => state.rows,
    availability: () => state.availability,
    load,
    refresh: load,
    refreshRow,
    probeSpelling,
  }
}
