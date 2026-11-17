import { describe, expect, test } from "bun:test"
import {
  ADD_OPEN_WATCH_TIMEOUT_MS,
  INITIAL_ADD_OPEN_STATE,
  transitionAddOpen,
} from "./add-open-machine"

describe("transitionAddOpen", () => {
  test("idle + registered starts watching with attempt 1", () => {
    const { state, effects } = transitionAddOpen(INITIAL_ADD_OPEN_STATE, { type: "registered", key: "row-a" })

    expect(state).toEqual({ type: "awaiting", attempt: 1, key: "row-a" })
    expect(effects).toEqual([{ type: "watch.start", key: "row-a", attempt: 1, timeoutMs: ADD_OPEN_WATCH_TIMEOUT_MS }])
  })

  test("awaiting + ready with sessions opens the most recent", () => {
    const awaiting = transitionAddOpen(INITIAL_ADD_OPEN_STATE, { type: "registered", key: "row-a" }).state
    const recent = { id: "s1" }

    const { state, effects } = transitionAddOpen(awaiting, {
      type: "sessions.ready",
      attempt: 1,
      sessions: [recent, { id: "s2" }],
    })

    expect(state).toEqual({ type: "opening", attempt: 1 })
    expect(effects).toEqual([
      { type: "watch.stop", attempt: 1 },
      { type: "open.recent", session: recent, attempt: 1 },
    ])
  })

  test("awaiting + ready with an empty list opens a new draft", () => {
    const awaiting = transitionAddOpen(INITIAL_ADD_OPEN_STATE, { type: "registered", key: "row-a" }).state
    const { state, effects } = transitionAddOpen(awaiting, { type: "sessions.ready", attempt: 1, sessions: [] })

    expect(state).toEqual({ type: "opening", attempt: 1 })
    expect(effects).toEqual([
      { type: "watch.stop", attempt: 1 },
      { type: "open.new", attempt: 1 },
    ])
  })

  test("a stale ready from an earlier attempt is ignored", () => {
    const first = transitionAddOpen(INITIAL_ADD_OPEN_STATE, { type: "registered", key: "row-a" }).state
    const second = transitionAddOpen(first, { type: "registered", key: "row-b" }).state

    expect(second).toEqual({ type: "awaiting", attempt: 2, key: "row-b" })

    const stale = transitionAddOpen(second, { type: "sessions.ready", attempt: 1, sessions: [{ id: "s1" }] })

    expect(stale.state).toBe(second)
    expect(stale.effects).toEqual([])
  })

  test("watch timeout while awaiting fails silently and stops the watch", () => {
    const awaiting = transitionAddOpen(INITIAL_ADD_OPEN_STATE, { type: "registered", key: "row-a" }).state
    const { state, effects } = transitionAddOpen(awaiting, { type: "watch.timed-out", attempt: 1 })

    expect(state).toEqual({ type: "failed", attempt: 1 })
    expect(effects).toEqual([{ type: "watch.stop", attempt: 1 }])
  })

  test("opened returns to idle; open.failed lands on failed", () => {
    const opening = { type: "opening", attempt: 1 } as const

    expect(transitionAddOpen(opening, { type: "opened", attempt: 1 }).state).toBe(INITIAL_ADD_OPEN_STATE)
    expect(transitionAddOpen(opening, { type: "open.failed", attempt: 1 }).state).toEqual({
      type: "failed",
      attempt: 1,
    })
  })

  test("mismatching attempt on open results is ignored", () => {
    const opening = { type: "opening", attempt: 2 } as const
    const stale = transitionAddOpen(opening, { type: "opened", attempt: 1 })

    expect(stale.state).toBe(opening)
    expect(stale.effects).toEqual([])
  })

  test("a second registration while opening does not apply", () => {
    const opening = { type: "opening", attempt: 1 } as const
    const result = transitionAddOpen(opening, { type: "registered", key: "row-b" })

    expect(result.state).toBe(opening)
    expect(result.effects).toEqual([])
  })

  test("disposed returns to idle and stops an active watch", () => {
    const awaiting = transitionAddOpen(INITIAL_ADD_OPEN_STATE, { type: "registered", key: "row-a" }).state
    const { state, effects } = transitionAddOpen(awaiting, { type: "disposed" })

    expect(state).toBe(INITIAL_ADD_OPEN_STATE)
    expect(effects).toEqual([{ type: "watch.stop", attempt: 1 }])
  })

  test("disposed from a settled state stops nothing", () => {
    expect(transitionAddOpen(INITIAL_ADD_OPEN_STATE, { type: "disposed" })).toEqual({
      state: INITIAL_ADD_OPEN_STATE,
      effects: [],
    })
  })
})
