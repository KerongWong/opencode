import { For, Match, Show, Switch, createEffect, createMemo, createSignal, on, onCleanup } from "solid-js"
import { createResizeObserver } from "@solid-primitives/resize-observer"
import { createStore } from "solid-js/store"
import { DragDropProvider, PointerSensor } from "@dnd-kit/solid"
import { isSortable, useSortable } from "@dnd-kit/solid/sortable"
import { Accessibility, AutoScroller, Feedback, PointerActivationConstraints } from "@dnd-kit/dom"
import { RestrictToVerticalAxis } from "@dnd-kit/abstract/modifiers"
import { RestrictToElement } from "@dnd-kit/dom/modifiers"
import { Icon } from "@opencode/ui/icon"
import { ActivityRing } from "@opencode/ui/activity-ring"
import { displayName } from "@opencode/ui/project-avatar"
import { arrayMove } from "@/runtime/array-move"
import { useLanguage } from "@/runtime/i18n/language"
import { SessionTabAvatarView } from "@/shell/layout/session-tab-avatar"
import { createSessionInbox, type InboxEntry } from "./inbox-model"
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

type ProjectGroup = {
  key: string
  entries: InboxEntry[]
  directory: string
  project: ReturnType<InboxEntry["ctx"]["projects"]["forSession"]>
}

/** The Projects interface mode: sessions grouped by project in place of vertical tabs. */
export function SidebarProjects() {
  const language = useLanguage()
  const inbox = createSessionInbox()
  const sidebar = createProjectsSidebarState()

  const [state, setState] = createStore<{ collapsed: Record<string, boolean>; expanded: Record<string, boolean> }>({
    collapsed: {},
    expanded: {},
  })

  // Entries arrive newest first, so the first entry of a group dates it. Ungrouped sessions go last rather than
  // disappearing: a session without a project is still a session a person can open.
  const groups = createMemo(() => {
    const map = new Map<string, ProjectGroup>()

    inbox.entries().forEach((entry) => {
      const project = entry.ctx.projects.forSession(entry.session)
      const directory = project?.worktree ?? entry.session.location.directory
      const key = project ? `${entry.server}\0${project.worktree}` : "ungrouped"
      const group = map.get(key)

      if (group) {
        group.entries.push(entry)

        return
      }

      map.set(key, { key, entries: [entry], directory, project })
    })

    // A dragged order wins. Projects the person has not placed keep the creation order they had before and go after
    // the placed ones, so a newly discovered project never jumps into the middle of a hand-made order.
    const rank = new Map(sidebar.order().map((key, index) => [key, index] as const))

    return [...map.values()].sort((a, b) => {
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
  })

  // Key the rendered list by group keys, not by the group objects: the inbox rebuilds every group on each update, and
  // a list keyed by object would destroy and recreate the rows, killing an in-flight drag and resetting the scroll
  // container to the top in some window states.
  const groupByKey = createMemo(() => new Map(groups().map((group) => [group.key, group] as const)))
  const groupKeys = createMemo(() => groups().map((group) => group.key))

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
          <p class="px-2 py-3 text-[13px] leading-4 text-v2-text-text-muted">{language.t("sidebar.projects.empty")}</p>
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
                    onToggle={(collapsed) => toggle(key, collapsed)}
                    onExpand={() => setState("expanded", key, true)}
                    onOpen={(entry) => inbox.open(entry)}
                    selected={selected}
                    age={age}
                  />
                )}
              </For>
            </div>
          </DragDropProvider>
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
  onToggle: (collapsed: boolean) => void
  onExpand: () => void
  onOpen: (entry: InboxEntry) => void
  selected: (entry: InboxEntry) => boolean
  age: (entry: InboxEntry) => string
}) {
  const language = useLanguage()

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
        <button
          ref={sortable.handleRef}
          type="button"
          data-slot="sidebar-projects-project"
          aria-expanded={!props.collapsed()}
          class="flex h-8 w-full cursor-grab items-center gap-1.5 rounded-[6px] bg-v2-background-bg-layer-02 px-1.5 text-start active:cursor-grabbing hover:bg-v2-overlay-simple-overlay-hover focus-visible:outline-none focus-visible:bg-v2-overlay-simple-overlay-hover"
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
            {displayName(props.group()?.project ?? { worktree: props.group()?.directory ?? "" })}
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
