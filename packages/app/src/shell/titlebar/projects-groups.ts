import { comparablePath, containsDirectory } from "@opencode/util/path"

type ProjectDirectory = { readonly directory: string }

/**
 * The known project directory that owns a session directory, preferring the closest one. Sessions can run in a
 * subdirectory of a checkout, so a group follows the checkout instead of every subdirectory becoming its own row.
 */
export function sessionProjectDirectory(
  project: { readonly worktrees?: readonly ProjectDirectory[] } | undefined,
  directory: string,
) {
  const roots = project?.worktrees?.map((item) => item.directory) ?? []

  const owner = roots
    .filter((root) => containsDirectory(root, directory))
    .toSorted((a, b) => comparablePath(b).length - comparablePath(a).length)[0]

  return owner ?? directory
}

/**
 * Titles for directory groups. Folder names repeat when one repository is checked out more than once, so a
 * duplicate gains its parent folder name, and the full directory when the parent name is ambiguous too.
 */
export function directoryGroupLabels(
  groups: readonly { readonly key: string; readonly directory: string; readonly title: string }[],
) {
  const titles = new Map<string, number>()

  for (const group of groups) titles.set(group.title, (titles.get(group.title) ?? 0) + 1)

  const labels = groups.map((group) => ({
    key: group.key,
    label: (titles.get(group.title) ?? 0) > 1 ? withParent(group.title, group.directory) : group.title,
  }))

  const counts = new Map<string, number>()

  for (const item of labels) counts.set(item.label, (counts.get(item.label) ?? 0) + 1)

  return new Map(
    labels.map((item, index) => {
      const group = groups[index]

      const label =
        (counts.get(item.label) ?? 0) > 1 ? `${group.title} · ${comparablePath(group.directory)}` : item.label

      return [item.key, label] as const
    }),
  )
}

function withParent(title: string, directory: string) {
  const parent = comparablePath(directory).split("/").filter(Boolean).at(-2)

  return parent ? `${title} · ${parent}` : title
}
