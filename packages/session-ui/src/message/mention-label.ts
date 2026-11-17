import { getFilename } from "@opencode/util/path"

/**
 * Display labels for @ file references in a single scope (one composer draft or
 * one sent message). Each entry maps its original path to the basename, or — when
 * a peer in scope shares that basename — to the shortest trailing run of path
 * segments that no same-basename peer also ends with, keeping the path's own
 * separators. Ports the dsh `distinguishingPathSuffixes()` segment-window
 * semantics, grouped by basename instead of workspace title.
 */
export function mentionLabels(paths: readonly { readonly path: string }[]): ReadonlyMap<string, string> {
  // Segments and the separators between them alternate: `/a/b` → ['', '/', 'a', '/', 'b'].
  const rows = paths.map((entry) => ({ path: entry.path, parts: entry.path.split(/([\\/])/) }))
  const suffix = (parts: readonly string[], count: number): string => parts.slice(-(2 * count - 1)).join("")
  const labels = new Map<string, string>()

  for (const row of rows) {
    const basename = getFilename(row.path)
    const peers = rows.filter((other) => other !== row && getFilename(other.path) === basename)
    if (peers.length === 0) {
      labels.set(row.path, basename)
      continue
    }
    let count = 1
    // A root path (`/`, `C:\`) ends in an empty segment; grow past it.
    while (2 * count - 1 < row.parts.length && (suffix(row.parts, count) === "" || peers.some((peer) => suffix(peer.parts, count) === suffix(row.parts, count)))) count++
    labels.set(row.path, suffix(row.parts, count))
  }

  return labels
}
