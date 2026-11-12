// The sidebar's row source: one index page plus a large locally known list. strobe's script host loads this module
// once per block and calls `merge` (perf/session-index.bench.ts). No DOM, Solid or timers.
import type { SessionInfo } from "@opencode/client/promise"
import { mergeRootSessionIndex } from "../src/runtime/server/session-index"

const session = (id: string, updated: number, directory: string) =>
  // SAFETY: the merge reads only these fields, and the harness never renders a row.
  ({
    id,
    projectID: "project",
    title: id,
    time: { created: 1, updated },
    location: { directory },
  }) as SessionInfo

// 50 roots, one per index slot (INDEX_LIMIT), newest first: the floor is 999_951.
const indexed = Array.from({ length: 50 }, (_, i) => session(`indexed-${i}`, 1_000_000 - i, "/repo"))

// 5,000 known roots: 20 above the floor, so both builds insert them; the rest below it, so the bounded build skips
// them with one comparison each.
const known = Array.from({ length: 5_000 }, (_, i) =>
  session(`known-${i}`, i < 20 ? 1_000_000 + i : 900_000 - i, "/other"),
)

let rows = 0

/** `count` merges of the index page with the known list, returning the last row count so the call cannot be dropped. */
export function merge(count: number) {
  for (let i = 0; i < count; i++) {
    // The third argument is passed unconditionally: origin/dev's two-parameter function ignores it, so both builds
    // receive identical input and the verdict is attributable to the merge change.
    rows = mergeRootSessionIndex(indexed, known, { includeArchived: false, boundedKnown: true }).length
  }

  return rows
}
