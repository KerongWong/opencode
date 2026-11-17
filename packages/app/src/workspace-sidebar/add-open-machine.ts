import type { SessionInfo } from "@opencode/client/promise"

/**
 * NAV-01: the "Add local folder → open a session" lifecycle. Pure transition — the driver at the
 * edge of `sidebar.tsx` owns the watch timer, the row watch and the open/create calls. Attempt ids
 * reject stale results: a second Add supersedes the first, and late events from an earlier attempt
 * never fire a second open.
 */
export type AddOpenState =
  | { type: "idle" }
  | { type: "awaiting"; attempt: number; key: string }
  | { type: "opening"; attempt: number }
  | { type: "failed"; attempt: number }

export type AddOpenEvent =
  | { type: "registered"; key: string }
  | { type: "sessions.ready"; attempt: number; sessions: readonly Pick<SessionInfo, "id">[] }
  | { type: "watch.timed-out"; attempt: number }
  | { type: "opened"; attempt: number }
  | { type: "open.failed"; attempt: number }
  | { type: "disposed" }

export type AddOpenEffect =
  | { type: "watch.start"; key: string; attempt: number; timeoutMs: number }
  | { type: "watch.stop"; attempt: number }
  | { type: "open.recent"; session: Pick<SessionInfo, "id">; attempt: number }
  | { type: "open.new"; attempt: number }

export const INITIAL_ADD_OPEN_STATE: AddOpenState = { type: "idle" }

// A named owner contract: every transition returns the same result shape, and `unchanged` returns
// the identical state object so no signal writes when an event does not apply.
export type AddOpenResult = { state: AddOpenState; effects: AddOpenEffect[] }

// A row that stays loading past this lands on `failed` silently, so the sidebar never waits forever.
export const ADD_OPEN_WATCH_TIMEOUT_MS = 10_000

const unchanged = (state: AddOpenState): AddOpenResult => ({ state, effects: [] })

export function transitionAddOpen(state: AddOpenState, event: AddOpenEvent): AddOpenResult {
  if (event.type === "disposed") {
    return {
      state: INITIAL_ADD_OPEN_STATE,
      effects: state.type === "awaiting" ? [{ type: "watch.stop", attempt: state.attempt }] : [],
    }
  }

  if (state.type === "idle") {
    if (event.type !== "registered") return unchanged(state)

    const attempt = 1

    return {
      state: { type: "awaiting", attempt, key: event.key },
      effects: [{ type: "watch.start", key: event.key, attempt, timeoutMs: ADD_OPEN_WATCH_TIMEOUT_MS }],
    }
  }

  if (state.type === "awaiting") {    if (event.type === "registered") {
      const attempt = state.attempt + 1

      return {
        state: { type: "awaiting", attempt, key: event.key },
        effects: [
          { type: "watch.stop", attempt: state.attempt },
          { type: "watch.start", key: event.key, attempt, timeoutMs: ADD_OPEN_WATCH_TIMEOUT_MS },
        ],
      }
    }

    if (event.type === "sessions.ready" && event.attempt === state.attempt) {
      const [recent] = event.sessions

      return {
        state: { type: "opening", attempt: state.attempt },
        effects: [
          { type: "watch.stop", attempt: state.attempt },
          recent
            ? { type: "open.recent", session: recent, attempt: state.attempt }
            : { type: "open.new", attempt: state.attempt },
        ],
      }
    }

    if (event.type === "watch.timed-out" && event.attempt === state.attempt) {
      return {
        state: { type: "failed", attempt: state.attempt },
        effects: [{ type: "watch.stop", attempt: state.attempt }],
      }
    }

    return unchanged(state)
  }

  if (state.type === "failed") {
    // A failed run never blocks the next Add: a fresh registration starts a new attempt. The
    // previous watch already stopped when the state left `awaiting`, so only watch.start emits.
    if (event.type === "registered") {
      const attempt = state.attempt + 1

      return {
        state: { type: "awaiting", attempt, key: event.key },
        effects: [{ type: "watch.start", key: event.key, attempt, timeoutMs: ADD_OPEN_WATCH_TIMEOUT_MS }],
      }
    }

    return unchanged(state)
  }

  if (state.type === "opening") {
    if (event.type === "opened" && event.attempt === state.attempt) return unchanged(INITIAL_ADD_OPEN_STATE)

    if (event.type === "open.failed" && event.attempt === state.attempt)
      return { state: { type: "failed", attempt: state.attempt }, effects: [] }

    return unchanged(state)
  }

  return unchanged(state)
}
