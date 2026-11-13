import type { SessionInfo } from "@opencode/client/promise"

export type RootSessionIndexOptions = {
  /** Keep archived roots. Views that list archived sessions opt in; the Projects rows leave it unset. */
  includeArchived?: boolean
  /** Bounds the locally known sessions merged into the index to the index window. */
  boundedKnown?: boolean
  /**
   * When the fetched page has no surviving root, the time the page was fetched bounds the known rows, so work done after
   * the fetch still joins (the Projects view passes the query's update time).
   */
  fetchedAt?: number
}

/**
 * Merge live metadata into indexed roots. Only a completed run advances an indexed row's recency.
 *
 * `undefined` as the index means no page has been fetched yet, and the known roots are then the list. Any array means a
 * fetched page, so an empty page bounds instead of falling back.
 *
 * `boundedKnown` makes the index page the row source: a known root joins only when it is indexed already or its
 * `time.updated` is at least the oldest indexed row's, so opening old history cannot add a row. The floor is reduced
 * over the rows the final filter can keep, so an archived or child row in the page cannot lower it. A page with no
 * surviving root is bounded by its fetch time instead of an infinite floor; without a fetch time no time bound applies,
 * so a session created after the fetch still joins.
 */
export function mergeRootSessionIndex(
  indexed: readonly SessionInfo[] | undefined,
  known: readonly SessionInfo[],
  options: RootSessionIndexOptions = {},
) {
  const survivors =
    options.boundedKnown && indexed !== undefined
      ? indexed.reduce(
          (min, info) =>
            info.parentID || (options.includeArchived === false && info.time.archived !== undefined)
              ? min
              : Math.min(min, info.time.updated),
          Number.POSITIVE_INFINITY,
        )
      : undefined

  // A non-empty page keeps its survivor floor; an empty one is bounded by when it was fetched.
  const floor = survivors === undefined ? undefined : Number.isFinite(survivors) ? survivors : options.fetchedAt

  const rows = new Map((indexed ?? []).map((info) => [info.id, info]))

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
