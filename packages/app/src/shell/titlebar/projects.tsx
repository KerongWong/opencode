import { For, Match, Show, Switch, createEffect, createMemo, createSignal, on, onCleanup } from "solid-js"
import { createResizeObserver } from "@solid-primitives/resize-observer"
import { createStore } from "solid-js/store"
import { DragDropProvider, PointerSensor } from "@dnd-kit/solid"
import { isSortable, useSortable } from "@dnd-kit/solid/sortable"
import { Accessibility, AutoScroller, Feedback, PointerActivationConstraints } from "@dnd-kit/dom"
import { RestrictToVerticalAxis } from "@dnd-kit/abstract/modifiers"
import { RestrictToElement } from "@dnd-kit/dom/modifiers"
import { Icon } from "@opencode/ui/icon"
import { IconButton } from "@opencode/ui/icon-button"
import { Menu } from "@opencode/ui/menu"
import { ActivityRing } from "@opencode/ui/activity-ring"
import { Loader } from "@opencode/ui/loader"
import { displayName } from "@opencode/ui/project-avatar"
import { useDialog } from "@opencode/ui/context/dialog"
import { getFilename } from "@opencode/util/path"
import { fileManagerApp } from "@/home/projects/file-manager"
import { useRevealProject } from "@/home/projects/reveal"
import { arrayMove } from "@/runtime/array-move"
import { useLanguage } from "@/runtime/i18n/language"
import { usePlatform } from "@/runtime/platform/platform"
import { SessionTabAvatarView } from "@/shell/layout/session-tab-avatar"
import { showToast } from "@/shell/notifications/toast"
import { createSessionInbox, type InboxEntry } from "./inbox-model"
import { RenameDialog } from "./project-session-row"
import { directoryGroupLabels, projectGroupFor } from "./projects-groups"
import { createProjectsSidebarState } from "./projects-state"
import { sessionTabTitle } from "./tab-title"

// How many sessions a project shows before "show more". The whole list is capped by the inbox index, so this only
// decides how much of a project's list is on screen at once.
const SESSIONS_PER_PROJECT = 5

// A click still arrives after a drag finishes, and it must not collapse the project the person just moved.
const DRAG_CLICK_GRACE = 250

const STATUS_LABEL = {
  approval: "sidebar.inbox.status.approval",
  input: "sidebar.inbox.status.input",
  working: "sidebar.inbox.status.working",
  failed: "sidebar.inbox.status.failed",
  done: "sidebar.inbox.status.done",
} as const

type DirectoryGroup = {
  key: string
  entries: InboxEntry[]
  directory: string
  project: ReturnType<InboxEntry["ctx"]["projects"]["forSession"]>
}

type ProjectGroup = DirectoryGroup & { label: string }

/** The Projects interface mode: sessions grouped by local project checkout in place of vertical tabs. */
export function SidebarProjects() {
  const language = useLanguage()
  const inbox = createSessionInbox()
  const sidebar = createProjectsSidebarState()
  const dialog = useDialog()
  const revealProject = useRevealProject()

  const [state, setState] = createStore<{ collapsed: Record<string, boolean>; expanded: Record<string, boolean> }>({
    collapsed: {},
    expanded: {},
  })

  const removedKeys = createMemo(() => new Set(sidebar.removed()))

  // Entries arrive newest first, so the first entry of a group dates it. Ungrouped sessions go last rather than
  // disappearing: a session without a project is still a session a person can open, and so is a session whose project
  // was removed from this sidebar.
  const groups = createMemo(() => {
    const map = new Map<string, DirectoryGroup>()
    const removed = removedKeys()

    inbox.entries().forEach((entry) => {
      const project = entry.ctx.projects.forSession(entry.session)

      // Clones of one repository share a project ID, so a group follows the local checkout instead: two working
      // copies of the same repository stay separate rows.
      const group = projectGroupFor(entry.server, project, entry.session.location.directory)

      // A removed project's sessions stay visible in the ungrouped section instead of disappearing with its row.
      const key = group.key === "ungrouped" || !removed.has(group.key) ? group.key : "ungrouped"
      const existing = map.get(key)

      if (existing) {
        existing.entries.push(entry)

        return
      }

      map.set(key, {
        key,
        entries: [entry],
        directory: group.directory,
        project: key === "ungrouped" ? undefined : project,
      })
    })

    // A dragged order wins. Projects the person has not placed keep the creation order they had before and go after
    // the placed ones, so a newly discovered project never jumps into the middle of a hand-made order.
    const rank = new Map(sidebar.order().map((key, index) => [key, index] as const))

    const sorted = [...map.values()].sort((a, b) => {
      if (a.key === "ungrouped") return 1

      if (b.key === "ungrouped") return -1

      const aRank = rank.get(a.key)
      const bRank = rank.get(b.key)

      if (aRank !== undefined || bRank !== undefined) {
        if (aRank === undefined) return 1

        if (bRank === undefined) return -1

        if (aRank !== bRank) return aRank - bRank
      }

      const created = (a.project?.time?.created ?? 0) - (b.project?.time?.created ?? 0)

      return (
        created ||
        displayName(a.project ?? { worktree: a.directory }).localeCompare(
          displayName(b.project ?? { worktree: b.directory }),
          undefined,
          { sensitivity: "base" },
        )
      )
    })

    // The ungrouped section has a fixed name, so it is not a candidate for the folder-name disambiguation below.
    const labels = directoryGroupLabels(
      sorted
        .filter((group) => group.key !== "ungrouped")
        .map((group) => ({
          key: group.key,
          directory: group.directory,
          title: displayName(group.project ?? { worktree: group.directory }),
        })),
    )

    return sorted.map((group): ProjectGroup => ({
      ...group,
      label:
        group.key === "ungrouped"
          ? language.t("sidebar.projects.ungrouped")
          : (labels.get(group.key) ?? displayName(group.project ?? { worktree: group.directory })),
    }))
  })

  // Removed projects stay listed while they have a group key, so a removed project can always be restored: a key whose
  // sessions left the index falls back to the folder name it stores.
  const removedProjects = createMemo(() => {
    const keys = removedKeys()

    if (keys.size === 0) return []

    const found = new Map<string, { key: string; label: string; count: number }>()

    inbox.entries().forEach((entry) => {
      const project = entry.ctx.projects.forSession(entry.session)
      const group = projectGroupFor(entry.server, project, entry.session.location.directory)

      if (!keys.has(group.key)) return
      const existing = found.get(group.key)

      if (existing) {
        existing.count++

        return
      }

      found.set(group.key, {
        key: group.key,
        label: displayName(project ?? { worktree: group.directory }),
        count: 1,
      })
    })

    keys.forEach((key) => {
      if (found.has(key)) return
      const directory = key.slice(key.indexOf("\u0000") + 1)
      found.set(key, { key, label: directory.slice(directory.lastIndexOf("/") + 1) || directory, count: 0 })
    })

    return [...found.values()].sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" }))
  })

  // Key the rendered list by group keys, not by the group objects: the inbox rebuilds every group on each update, and
  // a list keyed by object would destroy and recreate the rows, killing an in-flight drag and resetting the scroll
  // container to the top in some window states.
  const groupByKey = createMemo(() => new Map(groups().map((group) => [group.key, group] as const)))
  const groupKeys = createMemo(() => groups().map((group) => group.key))

  // A row acts on the group it renders now, not on the group object it was built with: the inbox rebuilds groups on
  // every update.
  const renameProject = (key: string) => {
    const group = groupByKey().get(key)
    const project = group?.project
    const ctx = group?.entries[0]?.ctx

    if (!project || !ctx) return

    void dialog.show(() => (
      <RenameDialog
        label={language.t("sidebar.projects.rename")}
        title={displayName(project)}
        onRename={async (name) => {
          // The folder name is the default title: typing it back clears a custom name instead of storing a duplicate.
          const value = name === getFilename(project.worktree) ? "" : name

          if (!project.id || project.id === "global") {
            ctx.sync.project.meta(project.worktree, { name: value })

            return
          }

          const updated = await ctx.sdk.api.project.update({ projectID: project.id, name: value })
          ctx.sync.project.update(updated)
        }}
      />
    ))
  }

  const canReveal = (key: string) => {
    const conn = groupByKey().get(key)?.entries[0]?.conn

    return !!conn && revealProject.available(conn)
  }

  const revealGroup = (key: string) => {
    const group = groupByKey().get(key)
    const conn = group?.entries[0]?.conn

    if (!group?.project || !conn) return
    // A group follows the local checkout, which is not the project's main worktree for a clone or linked worktree.
    revealProject.reveal(conn, { ...group.project, worktree: group.directory })
  }

  const removeProject = (key: string) => {
    const group = groupByKey().get(key)

    if (!group) return
    sidebar.remove(key)

    showToast({
      title: language.t("sidebar.projects.removed"),
      description: language.t("sidebar.projects.remove.description", {
        name: displayName(group.project ?? { worktree: group.directory }),
      }),
      actions: [{ label: language.t("sidebar.projects.restore"), onClick: () => sidebar.restore(key) }],
    })
  }

  let dragEndedAt = 0
  const recentlyDragged = () => Date.now() - dragEndedAt < DRAG_CLICK_GRACE

  const selected = (entry: InboxEntry) => inbox.selected(entry)

  const age = (entry: InboxEntry) => {
    const seconds = Math.max(0, Math.floor((inbox.now(entry.status) - entry.session.time.updated) / 1000))

    if (seconds < 60) return language.t("sidebar.inbox.time.now")

    if (seconds < 3_600) return language.plural("sidebar.inbox.elapsed.minutes", Math.floor(seconds / 60))

    if (seconds < 86_400) return language.plural("sidebar.inbox.elapsed.hours", Math.floor(seconds / 3_600))

    return language.plural("sidebar.inbox.elapsed.days", Math.floor(seconds / 86_400))
  }

  const toggle = (key: string, collapsed: boolean) => {
    setState("collapsed", key, !collapsed)
  }

  const reorder = (from: number, to: number) => {
    const keys = groupKeys().filter((key) => key !== "ungrouped")
    const last = keys.length - 1
    const next = arrayMove(keys, Math.min(from, last), Math.min(to, last))
    const placed = new Set(next)

    // Keep the keys of projects that are not on screen right now after the visible ones, so a project that drops out
    // of the session index keeps its hand-made place when it returns.
    sidebar.setOrder([...next, ...sidebar.order().filter((key) => !placed.has(key))])
  }

  // The scroll container outlives the rows, but not every path does: switching layouts and restarting the app build it
  // again. Remember where the person was and put it back when rows return.
  const [scroller, setScroller] = createSignal<HTMLDivElement>()
  const [list, setList] = createSignal<HTMLDivElement>()
  let rememberedScroll = sidebar.scrollTop()
  let restoredScroll = -1
  let scrollTimer: ReturnType<typeof setTimeout> | undefined

  const rememberScroll = () => {
    const element = scroller()

    if (!element) return
    // The browser fires a scroll event for the position restoreScroll wrote. It is not the person scrolling, so keep
    // the remembered position that the list may only be too short to show yet.

    if (element.scrollTop === restoredScroll) return
    restoredScroll = -1

    if (element.scrollTop === rememberedScroll) return
    rememberedScroll = element.scrollTop
    clearTimeout(scrollTimer)
    scrollTimer = setTimeout(() => sidebar.setScrollTop(rememberedScroll), 250)
  }

  const restoreScroll = () => {
    const element = scroller()

    if (!element || rememberedScroll <= 0) return
    // Only restore from the top, or from where the last restore landed while the list was still short.

    if (element.scrollTop !== 0 && element.scrollTop !== restoredScroll) return
    const max = element.scrollHeight - element.clientHeight

    if (max <= 0) return
    restoredScroll = Math.min(rememberedScroll, max)
    element.scrollTop = restoredScroll
  }

  createEffect(on(groupKeys, () => restoreScroll(), { defer: true }))

  // Rows can arrive after the container mounts, and an expanded project can make the list tall enough for the saved
  // position again. Restore then, but only from the top, so it never drags a person away from where they scrolled.
  createResizeObserver(
    () => [scroller(), list()],
    () => restoreScroll(),
  )

  onCleanup(() => {
    clearTimeout(scrollTimer)

    if (rememberedScroll > 0) sidebar.setScrollTop(rememberedScroll)
  })

  return (
    <div data-slot="sidebar-projects" class="flex min-h-0 flex-1 flex-col">
      <Show
        when={groups().length > 0}
        fallback={
          <Show
            when={inbox.loading()}
            fallback={
              <p class="px-2 py-3 text-[13px] leading-4 text-v2-text-text-muted">{language.t("sidebar.projects.empty")}</p>
            }
          >
            {/* Before the index settles an empty list would claim the person has no sessions. */}
            <div class="flex justify-center p-2">
              <Loader role="img" aria-hidden="false" aria-label={language.t("common.loading")} />
            </div>
          </Show>
        }
      >
        <div
          ref={(element) => {
            setScroller(element)
            requestAnimationFrame(restoreScroll)
          }}
          data-scrollable
          class="min-h-0 flex-1 overflow-y-auto overflow-x-hidden"
          onScroll={rememberScroll}
        >
          <DragDropProvider
            sensors={[
              PointerSensor.configure({
                activationConstraints: (event) =>
                  event.pointerType === "touch"
                    ? [new PointerActivationConstraints.Distance({ value: 8 })]
                    : [new PointerActivationConstraints.Distance({ value: 4 })],
              }),
            ]}
            modifiers={[RestrictToVerticalAxis, RestrictToElement.configure({ element: () => list() ?? null })]}
            plugins={(defaults) => [
              ...defaults.filter(
                (plugin) => plugin !== Accessibility && plugin !== AutoScroller && plugin !== Feedback,
              ),
              AutoScroller.configure({ acceleration: 8, threshold: { x: 0, y: 0.05 } }),
              Feedback.configure({ dropAnimation: null }),
            ]}
            onDragEnd={(event) => {
              const source = event.operation.source

              dragEndedAt = Date.now()

              if (event.canceled || !isSortable(source)) return

              if (source.initialIndex === source.index) return

              reorder(source.initialIndex, source.index)
            }}
          >
            <div ref={(element) => setList(element)}>
              <For each={groupKeys()}>
                {(key, index) => (
                  <ProjectGroup
                    id={key}
                    index={() => index()}
                    group={() => groupByKey().get(key)}
                    collapsed={() => !!state.collapsed[key]}
                    expanded={() => !!state.expanded[key]}
                    recentlyDragged={recentlyDragged}
                    canReveal={() => canReveal(key)}
                    onToggle={(collapsed) => toggle(key, collapsed)}
                    onExpand={() => setState("expanded", key, true)}
                    onOpen={(entry) => inbox.open(entry)}
                    onRename={() => renameProject(key)}
                    onReveal={() => revealGroup(key)}
                    onRemove={() => removeProject(key)}
                    selected={selected}
                    age={age}
                  />
                )}
              </For>
            </div>
          </DragDropProvider>
        </div>
      </Show>
      <Show when={removedProjects().length > 0}>
        <div class="shrink-0 border-t border-v2-border-border-muted pt-1">
          <Menu gutter={4} modal={false} placement="top-start">
            <Menu.Trigger
              as="button"
              type="button"
              class="flex h-8 w-full items-center gap-1.5 rounded-[6px] px-1.5 text-start text-[12px] leading-4 text-v2-text-text-muted hover:bg-v2-overlay-simple-overlay-hover focus-visible:outline-none focus-visible:bg-v2-overlay-simple-overlay-hover"
            >
              <Icon name="archive" class="size-3 shrink-0" />
              <span class="min-w-0 flex-1 truncate">
                {language.plural("sidebar.projects.removedMenu", removedProjects().length)}
              </span>
            </Menu.Trigger>
            <Menu.Portal>
              <Menu.Content>
                <For each={removedProjects()}>
                  {(item) => (
                    <Menu.Item onSelect={() => sidebar.restore(item.key)}>
                      {item.label}
                      <Show when={item.count > 0}>
                        <span class="ms-2 text-[11px] tabular-nums text-v2-text-text-muted">{item.count}</span>
                      </Show>
                    </Menu.Item>
                  )}
                </For>
              </Menu.Content>
            </Menu.Portal>
          </Menu>
        </div>
      </Show>
    </div>
  )
}

function ProjectGroup(props: {
  id: string
  index: () => number
  group: () => ProjectGroup | undefined
  collapsed: () => boolean
  expanded: () => boolean
  recentlyDragged: () => boolean
  canReveal: () => boolean
  onToggle: (collapsed: boolean) => void
  onExpand: () => void
  onOpen: (entry: InboxEntry) => void
  onRename: () => void
  onReveal: () => void
  onRemove: () => void
  selected: (entry: InboxEntry) => boolean
  age: (entry: InboxEntry) => string
}) {
  const language = useLanguage()
  const platform = usePlatform()
  const [menuOpen, setMenuOpen] = createSignal(false)

  const sortable = useSortable({
    get id() {
      return props.id
    },
    get index() {
      return props.index()
    },
    // The catch-all group belongs at the bottom; dragging it cannot change that.
    get disabled() {
      return props.id === "ungrouped"
    },
  })

  const entries = () => props.group()?.entries ?? []
  const shown = () => (props.expanded() ? entries() : entries().slice(0, SESSIONS_PER_PROJECT))
  const entryByKey = createMemo(() => new Map(entries().map((entry) => [entry.key, entry] as const)))
  const hidden = () => entries().length - SESSIONS_PER_PROJECT

  const summary = createMemo(() =>
    entries().reduce(
      (counts, entry) => {
        if (entry.status === "approval" || entry.status === "input") counts.attention++
        else if (entry.status === "failed") counts.failed++
        else if (entry.status === "working") counts.working++

        return counts
      },
      { attention: 0, failed: 0, working: 0 },
    ),
  )

  // One badge, most urgent first: a person scanning the list needs to see where they are needed, not every state.
  const badge = () => {
    const counts = summary()

    if (counts.attention) return { kind: "attention" as const, count: counts.attention }

    if (counts.failed) return { kind: "failed" as const, count: counts.failed }

    if (counts.working) return { kind: "working" as const, count: counts.working }
  }

  const badgeLabel = (value: { kind: "attention" | "failed" | "working"; count: number }) =>
    language.plural(`sidebar.projects.status.${value.kind}`, value.count, { count: value.count })

  const statusLabel = (status: InboxEntry["status"]) =>
    status === "ready" ? undefined : language.t(STATUS_LABEL[status])

  return (
    <Show when={props.group()}>
      <section
        ref={sortable.ref}
        data-slot="sidebar-projects-group"
        class="mb-1"
        classList={{ "opacity-60": sortable.isDragSource() }}
      >
        <div class="group/project flex h-8 items-center gap-0.5 rounded-[6px] bg-v2-background-bg-layer-02 pe-1 hover:bg-v2-overlay-simple-overlay-hover">
          <button
            ref={sortable.handleRef}
            type="button"
            data-slot="sidebar-projects-project"
            aria-expanded={!props.collapsed()}
            class="flex h-8 min-w-0 flex-1 cursor-grab items-center gap-1.5 rounded-[6px] ps-1.5 text-start active:cursor-grabbing focus-visible:outline-none focus-visible:bg-v2-overlay-simple-overlay-hover"
            onClick={() => {
              if (props.recentlyDragged()) return
              props.onToggle(props.collapsed())
            }}
          >
            <Icon
              name={props.collapsed() ? "chevron-right" : "chevron-down"}
              class="size-3 shrink-0 text-v2-icon-icon-muted"
            />
            <SessionTabAvatarView
              project={props.group()?.project}
              directory={props.group()?.directory ?? ""}
              unread={false}
            />
            <span
              dir="auto"
              class="min-w-0 flex-1 truncate text-[14px] leading-4 font-medium tracking-[-0.04px] text-v2-text-text-base"
            >
              {props.group()?.label ?? ""}
            </span>
            <span class="flex shrink-0 items-center gap-1.5">
              <Show when={badge()}>
                {(value) => (
                  <>
                    <Show
                      when={value().kind === "working"}
                      fallback={
                        <span
                          aria-hidden="true"
                          class="flex items-center gap-1"
                          classList={{
                            "text-v2-state-fg-warning": value().kind === "attention",
                            "text-v2-state-fg-danger": value().kind === "failed",
                          }}
                        >
                          <span class="size-1.5 rounded-full bg-current" />
                          <span class="text-[11px] tabular-nums">{value().count}</span>
                        </span>
                      }
                    >
                      <ActivityRing width={12} height={12} style={{ color: "var(--v2-state-fg-info)" }} />
                    </Show>
                    <span class="sr-only">{badgeLabel(value())}</span>
                  </>
                )}
              </Show>
              <span class="text-[11px] tabular-nums text-v2-text-text-muted">{entries().length}</span>
            </span>
          </button>
          {/* The ungrouped section holds no project, so it has nothing to rename, reveal or remove. */}
          <Show when={props.group()?.project}>
            <span
              class="hover-reveal flex shrink-0 items-center group-hover/project:opacity-100 focus-within:opacity-100 data-[menu=true]:opacity-100"
              data-menu={menuOpen()}
            >
              <Menu gutter={4} modal={false} placement="bottom-end" open={menuOpen()} onOpenChange={setMenuOpen}>
                <Menu.Trigger
                  as={IconButton}
                  variant="ghost-muted"
                  size="small"
                  icon={<Icon name="outline-dots" />}
                  aria-label={language.t("common.moreOptions")}
                />
                <Menu.Portal>
                  <Menu.Content>
                    <Menu.Item onSelect={props.onRename}>{language.t("sidebar.projects.rename")}</Menu.Item>
                    <Show when={props.canReveal()}>
                      <Menu.Item onSelect={props.onReveal}>
                        {language.t(fileManagerApp(platform.os ?? "unknown").actionLabel)}
                      </Menu.Item>
                    </Show>
                    <Menu.Separator />
                    <Menu.Item class="text-v2-state-fg-danger" onSelect={props.onRemove}>
                      {language.t("sidebar.projects.remove")}
                    </Menu.Item>
                  </Menu.Content>
                </Menu.Portal>
              </Menu>
            </span>
          </Show>
        </div>
        <Show when={!props.collapsed()}>
          <div class="mt-0.5 flex flex-col">
            <For each={shown().map((entry) => entry.key)}>
              {(key) => {
                const entry = () => entryByKey().get(key)

                return (
                  <Show when={entry()}>
                    {(entry) => (
                      <button
                        type="button"
                        data-slot="sidebar-projects-session"
                        data-state={props.selected(entry()) ? "active" : undefined}
                        class="flex h-7 w-full items-center gap-2 rounded-[5px] ps-[26px] pe-1.5 text-start hover:bg-v2-overlay-simple-overlay-hover focus-visible:outline-none focus-visible:bg-v2-overlay-simple-overlay-hover data-[state=active]:bg-v2-overlay-simple-overlay-pressed"
                        onClick={() => props.onOpen(entry())}
                      >
                        <span
                          dir="auto"
                          class="min-w-0 flex-1 truncate text-[13px] leading-4 tracking-[-0.04px] text-v2-text-text-base"
                        >
                          {sessionTabTitle(entry().session.title, language.t("session.tab.session"))}
                        </span>
                        <span class="flex shrink-0 items-center gap-1.5">
                          <span class="flex size-4 items-center justify-center">
                            <SessionStatusMark status={entry().status} />
                          </span>
                          <span class="text-[11px] tabular-nums text-v2-text-text-muted">{props.age(entry())}</span>
                          <Show when={statusLabel(entry().status)}>
                            {(label) => <span class="sr-only">{label()}</span>}
                          </Show>
                        </span>
                      </button>
                    )}
                  </Show>
                )
              }}
            </For>
            <Show when={!props.expanded() && hidden() > 0}>
              <button
                type="button"
                data-slot="sidebar-projects-more"
                class="flex h-7 w-full items-center rounded-[5px] ps-[26px] pe-1.5 text-start text-[12px] leading-4 text-v2-text-text-muted hover:bg-v2-overlay-simple-overlay-hover focus-visible:outline-none focus-visible:bg-v2-overlay-simple-overlay-hover"
                onClick={() => props.onExpand()}
              >
                {language.plural("sidebar.projects.more", hidden())}
              </button>
            </Show>
          </div>
        </Show>
      </section>
    </Show>
  )
}

// The row's state mark doubles as the scannable signal: shape and color, not color alone.
function SessionStatusMark(props: { status: InboxEntry["status"] }) {
  return (
    <Switch>
      <Match when={props.status === "working"}>
        {/* The ring's own unlayered CSS beats utility classes, so the status color goes inline. */}
        <ActivityRing width={16} height={16} style={{ color: "var(--v2-state-fg-info)" }} />
      </Match>
      <Match when={props.status === "approval"}>
        <Icon name="circle-exclamation" size="small" class="text-v2-state-fg-warning" />
      </Match>
      <Match when={props.status === "input"}>
        <Icon name="help" size="small" class="text-v2-state-fg-warning" />
      </Match>
      <Match when={props.status === "failed"}>
        <Icon name="close" size="small" class="text-v2-state-fg-danger" />
      </Match>
      <Match when={props.status === "done"}>
        <Icon name="check" size="small" class="text-v2-state-fg-success" />
      </Match>
    </Switch>
  )
}
