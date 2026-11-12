import type { SessionInfo } from "@opencode/client/promise"

export type RootSessionIndexOptions = {
  /** Keep archived roots. Views that list archived sessions opt in; the Projects rows leave it unset. */
  includeArchived?: boolean
  /** Bounds the locally known sessions merged into the index to the index window. */
  boundedKnown?: boolean
}

/**
 * Merge live metadata into indexed roots. Only a completed run advances an indexed row's recency.
 *
 * `boundedKnown` makes the index page the row source: a known root joins only when it is indexed already or its
 * `time.updated` is at least the oldest indexed row's, so opening old history cannot add a row. With no indexed page
 * the known roots are the list (the offline fallback).
 */
export function mergeRootSessionIndex(
  indexed: readonly SessionInfo[],
  known: readonly SessionInfo[],
  options: RootSessionIndexOptions = {},
) {
  const floor =
    options.boundedKnown && indexed.length
      ? indexed.reduce((min, info) => Math.min(min, info.time.updated), Number.POSITIVE_INFINITY)
      : undefined
  const rows = new Map(indexed.map((info) => [info.id, info]))

  for (const info of known) {
    if (floor !== undefined && !rows.has(info.id) && info.time.updated < floor) continue
    const time = rows.get(info.id)?.time
    const passive = time && (info.time.idle ?? 0) <= (time.idle ?? 0) && info.time.updated !== time.updated
    rows.set(info.id, passive ? { ...info, time: { ...info.time, updated: time.updated } } : info)
  }

  return [...rows.values()].filter(
    (info) => !info.parentID && (options.includeArchived !== false || info.time.archived === undefined),
  )
}
