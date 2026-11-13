// The sidebar's grouping hot path: one `projectGroupFor` per session whenever the session index updates. strobe's
// script host loads this module once per block and calls `group` (perf/projects-groups.bench.ts). No DOM, Solid or
// timers.
import { projectGroupFor } from "../src/shell/titlebar/projects-groups"

const checkouts = Array.from({ length: 20 }, (_, i) => `/repo/wt-${i}`)

// One project that already lists its inventory: the canonical root plus the 20 checkouts in both views, so the
// benchmark pays the root-set dedupe and the closest-owner scan rather than a difference in input.
const project = {
  worktree: "/repo",
  sandboxes: checkouts,
  worktrees: [{ directory: "/repo" }, ...checkouts.map((directory) => ({ directory }))],
}

// 200 sessions, round robin over the checkouts' subdirectories, as a person with every checkout open would have them.
const directories = Array.from({ length: 200 }, (_, i) => `${checkouts[i % checkouts.length]}/packages/app`)

let keys = 0

/** `count` grouping passes over the session directories, returning the last key count so the call cannot be dropped. */
export function group(count: number) {
  for (let i = 0; i < count; i++) {
    const found = new Set<string>()

    for (const directory of directories) found.add(projectGroupFor("srv", project, directory).key)

    keys = found.size
  }

  return keys
}
