import { Key } from "@solid-primitives/keyed"
import { DragDropProvider, PointerSensor } from "@dnd-kit/solid"
import { isSortable, useSortable } from "@dnd-kit/solid/sortable"
import { Accessibility, Feedback, PointerActivationConstraints } from "@dnd-kit/dom"
import { RestrictToVerticalAxis } from "@dnd-kit/abstract/modifiers"
import type { SessionInfo } from "@opencode/client/promise"
import { createEffect, createMemo, createSignal, on, onCleanup, onMount, Show, untrack } from "solid-js"
import { createStore } from "solid-js/store"
import { Button } from "@opencode/ui/button"
import { useDialog } from "@opencode/ui/context/dialog"
import { Icon } from "@opencode/ui/icon"
import { IconButton } from "@opencode/ui/icon-button"
import { Loader } from "@opencode/ui/loader"
import { Menu } from "@opencode/ui/menu"
import { arrayMove } from "@/runtime/array-move"
import { useLanguage } from "@/runtime/i18n/language"
import { usePlatform } from "@/runtime/platform/platform"
import { ServerConnection, useServers } from "@/runtime/server/registry"
import { useServerCtx } from "@/runtime/server/runtime"
import { homeProjectDirectories } from "@/shell/layout/helpers"
import { useLayout } from "@/shell/state/layout"
import { createProjectSessionActions } from "@/shell/tabs/project-sessions"
import { useTabs } from "@/shell/tabs/tabs"
import { createSidebarActivityListener } from "@/shell/titlebar/sidebar-organized"
import { useDirectoryPicker } from "@/workspaces/selection/picker"
import { projectSettingsKey, useSettings } from "@/settings/model"
import {
  ADD_OPEN_WATCH_TIMEOUT_MS,
  INITIAL_ADD_OPEN_STATE,
  transitionAddOpen,
  type AddOpenEffect,
  type AddOpenEvent,
} from "./add-open-machine"
import { WorkspaceRemoveDialog, WorkspaceRenameDialog } from "./dialogs"
import { detectHostPlatform, directoryKey, hostPlatform, visible, type WorkspaceEntry } from "./registry"
import { SessionRow, rowSessionStatus } from "./session-row"
import type { SessionRowStatus } from "./session-status"
import {
  createWorkspaceSessions,
  nextWatermark,
  raisedWatermark,
  remainingHidden,
  requiredRowWatermark,
  SESSION_WATERMARK_BASE,
  sessionsOf,
  shownByWatermark,
  watermarkBaseline,
} from "./sessions"
import { createWorkspaceRegistry } from "./store"

/**
 * The registered workspaces of the selected server. Keyed on the connection, so switching servers
 * rebuilds the persisted registry instead of showing another server's rows.
 */
export function SidebarWorkspaces() {
  const servers = useServers()

  const layout = useLayout()

  // Upstream keeps a preview tab once its session shows activity; mounting this sidebar preserves it.
  createSidebarActivityListener()

  const connection = createMemo(() => {
    const route = layout.route()
    const key = route.type === "session" ? route.server : layout.home.selection().server

    return servers.visible.find((conn) => ServerConnection.key(conn) === key) ?? servers.visible[0]
  })

  return (
    <Show when={connection()} keyed>
      {(conn) => <WorkspaceSidebarBody conn={conn} />}
    </Show>
  )
}

function WorkspaceSidebarBody(props: { conn: ServerConnection.Any }) {
  const servers = useServers()

  const platform = usePlatform()

  const language = useLanguage()

  const tabs = useTabs()

  const layout = useLayout()

  const picker = useDirectoryPicker()

  const dialog = useDialog()

  const actions = createProjectSessionActions()

  const host = platform.platform === "desktop" ? hostPlatform(platform.os) : detectHostPlatform(navigator.platform)

  const serverKey = ServerConnection.key(props.conn)

  const route = () => layout.route()

  const registry = createWorkspaceRegistry(servers.scope(serverKey), host)

  const rows = createMemo(() => visible(registry.entries()))

  const serverCtx = useServerCtx(() => props.conn)

  const settings = useSettings()

  const sessions = createWorkspaceSessions({
    entries: rows,
    connection: () => props.conn,
    ctx: serverCtx,
    platform: () => host,
    onServerSpelling: (directory, spelling) => registry.adoptDirectory(directory, spelling),
  })

  // COLL-05: session watermarks live in component memory only — folding the row or unmounting
  // resets them; nothing here reads or writes a persisted layer.
  const [watermarks, setWatermarks] = createStore<Record<string, number | undefined>>({})

  // Dual-granularity clock (TIME-02): minute-level always, second-level only while a visible row
  // is working, so a working row's "now" flips to "1m" at the 60s boundary without a page reload.
  // Rows register through onWorkingChange; the second timer exists only inside this effect.
  const [clock, setClock] = createStore({ second: Date.now(), minute: Date.now() })

  const minuteTimer = setInterval(() => setClock("minute", Date.now()), 60_000)

  onCleanup(() => clearInterval(minuteTimer))

  const [working, setWorking] = createStore<Record<string, boolean | undefined>>({})

  createEffect(() => {
    if (!Object.values(working).some(Boolean)) return

    setClock("second", Date.now())

    const secondTimer = setInterval(() => setClock("second", Date.now()), 1_000)

    onCleanup(() => clearInterval(secondTimer))
  })

  const now = (status: SessionRowStatus) => (status === "working" ? clock.second : clock.minute)

  // Undefined deletes the key, so the registry shrinks back when a row stops working.
  const setRowWorking = (sessionID: string, value: boolean) => setWorking(sessionID, value ? true : undefined)

  // A row with no stored watermark reads as the baseline (COLL-03).
  const watermark = (key: string) => watermarks[key] ?? SESSION_WATERMARK_BASE

  // Undefined deletes the key (COLL-05 fold reset), same idiom as setRowWorking.
  const setRowWatermark = (key: string, value: number | undefined) => setWatermarks(key, value)

  // NAV-01 driver: the machine decides, this edge acts. The watch effect below is owned by the
  // `awaiting` state (nested effects die with their parent's re-run), so watch.start/watch.stop
  // effects need no driver action of their own.
  const [addOpen, setAddOpen] = createSignal(INITIAL_ADD_OPEN_STATE)

  let addOpenDirectory: string | undefined

  const dispatchAddOpen = (event: AddOpenEvent) =>
    untrack(() => {
      const previous = addOpen()
      const next = transitionAddOpen(previous, event)

      if (next.state !== previous) setAddOpen(next.state)

      next.effects.forEach(runAddOpenEffect)
    })

  const runAddOpenEffect = (effect: AddOpenEffect) => {
    // watch.start / watch.stop are acted on by the state-driven watch effect below.
    if (effect.type !== "open.new" && effect.type !== "open.recent") return

    const directory = addOpenDirectory

    if (effect.type === "open.recent") {
      const session = directory
        ? sessionsOf(sessions.rows(), directoryKey(directory, host)).sessions.find(
            (item) => item.id === effect.session.id,
          )
        : undefined

      if (!directory || !session) return void dispatchAddOpen({ type: "open.failed", attempt: effect.attempt })

      try {
        actions.openProjectSession(props.conn, directory, session, { preview: true })
        dispatchAddOpen({ type: "opened", attempt: effect.attempt })
      } catch {
        dispatchAddOpen({ type: "open.failed", attempt: effect.attempt })
      }

      return
    }

    if (!directory) return void dispatchAddOpen({ type: "open.failed", attempt: effect.attempt })

    try {
      actions.openProjectNewSession(props.conn, directory)
      dispatchAddOpen({ type: "opened", attempt: effect.attempt })
    } catch {
      dispatchAddOpen({ type: "open.failed", attempt: effect.attempt })
    }
  }

  // Watch lifecycle: re-runs whenever the machine state changes. While awaiting a row, a nested
  // effect (owned by this run, disposed on re-run) dispatches `sessions.ready`; the timeout bounds
  // the wait so a row that never reads ready fails silently instead of waiting forever.
  createEffect(() => {
    const state = addOpen()

    if (state.type !== "awaiting") return

    const { attempt, key } = state

    const timer = setTimeout(() => dispatchAddOpen({ type: "watch.timed-out", attempt }), ADD_OPEN_WATCH_TIMEOUT_MS)

    onCleanup(() => clearTimeout(timer))

    createEffect(
      on(
        () => {
          const row = sessionsOf(sessions.rows(), key)

          return row.status === "ready" ? row.sessions : undefined
        },
        (ready) => {
          if (ready !== undefined) dispatchAddOpen({ type: "sessions.ready", attempt, sessions: ready })
        },
      ),
    )
  })

  onCleanup(() => dispatchAddOpen({ type: "disposed" }))

  let scroller: HTMLDivElement | undefined
  let restoreFrame = 0
  let scrollFrame = 0

  // A ref runs before its children render, so the position is restored a frame after mount. Desktop
  // storage hydrates asynchronously, so the hydration that lands after mount restores it too.
  const restoreScroll = () => {
    if (scroller && scroller.scrollTop === 0) scroller.scrollTop = registry.scrollTop()
  }

  onMount(() => {
    restoreFrame = requestAnimationFrame(restoreScroll)
  })

  createEffect(
    on(
      registry.ready,
      (ready) => {
        if (ready) restoreScroll()
      },
      { defer: true },
    ),
  )

  // Scrolling coalesces to one persisted write per frame, with the final position of that frame.
  const handleScroll = () => {
    if (scrollFrame) return

    scrollFrame = requestAnimationFrame(() => {
      scrollFrame = 0

      if (scroller) registry.setScrollTop(scroller.scrollTop)
    })
  }

  onCleanup(() => {
    if (restoreFrame) cancelAnimationFrame(restoreFrame)

    if (scrollFrame) cancelAnimationFrame(scrollFrame)
  })

  // `on` tracks the row list only: `load` reads and writes the session store, so a bare effect would retrigger itself.
  createEffect(on(rows, () => sessions.load()))

  const expanded = (key: string) => registry.expanded(key)

  const unavailable = (key: string) => sessions.availability()[key] === "unavailable"

  // One spelling of the COLL-04 requirement read, shared by the render-phase lift below and the
  // fold reset, so a reset can target max(BASE, required) instead of a bare floor the next lift
  // would immediately re-raise for a still-attention session.
  const rowRequirement = (key: string) => {
    const current = route()
    const ctx = serverCtx()

    const activeSession = current.type === "session" && current.server === serverKey ? current.sessionId : undefined

    const statusOf = (session: SessionInfo): SessionRowStatus =>
      ctx
        ? rowSessionStatus({
            serverCtx: ctx,
            session,
            active: session.id === activeSession,
            autoApprove: settings.permissions.autoApproves(projectSettingsKey(ctx.sdk.scope, session.projectID)),
          })
        : "idle"

    return requiredRowWatermark(sessionsOf(sessions.rows(), key), statusOf, activeSession)
  }

  const toggle = (key: string) => {
    const next = !expanded(key)

    registry.setExpanded(key, next)

    // COLL-05: folding a row resets its session watermark back to the baseline. The baseline is
    // the batch floor or an attention requirement above it — never a bare floor the next driver
    // pass would immediately re-lift for a still-unread session.
    if (!next) setRowWatermark(key, watermarkBaseline(rowRequirement(key)))

    // The first frame never waits: an expanded row renders what it already has, then fills in.
    if (next && !sessions.rows()[key] && !unavailable(key)) sessions.refreshRow(key)
  }

  const rename = (entry: WorkspaceEntry) =>
    dialog.show(() => (
      <WorkspaceRenameDialog title={entry.title} onRename={(title) => registry.rename(entry.directory, title)} />
    ))

  const remove = (entry: WorkspaceEntry) =>
    dialog.show(() => <WorkspaceRemoveDialog title={entry.title} onRemove={() => registry.remove(entry.directory)} />)

  const add = () =>
    picker({
      server: props.conn,
      title: language.t("sidebar.workspace.add"),
      multiple: false,
      onSelect: (result) => {
        const [directory] = homeProjectDirectories(result)

        if (!directory) return

        const entry = registry.register(directory)

        if (!entry) return

        // NAV-01: expand the new row and let the machine open its most recent session (or a new
        // draft once the row reads ready).
        addOpenDirectory = entry.directory
        registry.setExpanded(directoryKey(entry.directory, host), true)
        dispatchAddOpen({ type: "registered", key: directoryKey(entry.directory, host) })

        void sessions.probeSpelling(entry).then((spelling) => {
          if (spelling) registry.adoptDirectory(entry.directory, spelling)
          sessions.load()
        })
      },
    })

  const isOpenTab = (sessionID: string) =>
    tabs.store.some((tab) => tab.type === "session" && tab.server === serverKey && tab.sessionId === sessionID)

  const isActive = (sessionID: string) => {
    const current = route()

    return current.type === "session" && current.server === serverKey && current.sessionId === sessionID
  }

  // COLL-04: render-phase attention raise. Working / approval / input sessions and the active
  // session lift their row's watermark so they are visible without a click (unread sessions
  // deliberately do not raise it — 2026-11-18 user decision); statuses are derived from the row's
  // loaded session data (rowSessionStatus), so a session below the current watermark — which never
  // mounts a SessionRow — raises it too. Folded rows are skipped: folding resets their watermark
  // and its hidden sessions must not re-lift it while collapsed. The lift never lowers a watermark
  // here — folding the row is the only lower (there is no "Show less"). Every read stays in the
  // tracked region (status reads included, or a session turning working below the watermark would
  // never re-run this effect); `untrack` isolates the watermark writes, and a row writes only when
  // the raised watermark strictly exceeds the stored one, so a steady state performs zero writes.
  createEffect(() => {
    const entries = rows()

    const required = entries.map((entry) => {
      const key = directoryKey(entry.directory, host)

      if (!expanded(key)) return [key, 0] as const

      return [key, rowRequirement(key)] as const
    })

    untrack(() => {
      for (const [key, needed] of required) {
        if (needed === 0) continue

        const raised = raisedWatermark(watermark(key), needed)

        if (raised > watermark(key)) setRowWatermark(key, raised)
      }
    })
  })

  return (
    <div data-slot="workspace-sidebar" class="flex min-h-0 flex-1 flex-col [app-region:no-drag]">
      <div
        data-slot="workspace-list"
        data-scrollable
        class="min-h-0 flex-1 overflow-y-auto"
        ref={(element) => (scroller = element)}
        onScroll={handleScroll}
      >
        <Show
          when={rows().length > 0}
          fallback={
            <div class="flex flex-col items-start gap-1 px-2 py-4">
              <span class="text-[13px] leading-[var(--line-height-compact)] font-medium text-v2-text-text-base">
                {language.t("sidebar.workspace.empty.title")}
              </span>
              <span class="text-12-regular text-v2-text-text-faint">
                {language.t("sidebar.workspace.empty.description")}
              </span>
              <Button variant="contrast" size="small" class="mt-2" icon="folder-add-left" onClick={add}>
                {language.t("sidebar.workspace.add")}
              </Button>
            </div>
          }
        >
          <DragDropProvider
            sensors={[
              PointerSensor.configure({
                activationConstraints: [new PointerActivationConstraints.Distance({ value: 4 })],
                preventActivation: (event) =>
                  event.target instanceof Element && !!event.target.closest("[data-workspace-action]"),
              }),
            ]}
            modifiers={[RestrictToVerticalAxis]}
            plugins={(defaults) => [
              ...defaults.filter((plugin) => plugin !== Accessibility),
              Feedback.configure({ dropAnimation: null }),
            ]}
            onDragEnd={(event) => {
              const source = event.operation.source

              if (event.canceled || !isSortable(source) || source.initialIndex === source.index) return

              registry.reorder(
                arrayMove(
                  rows().map((entry) => entry.directory),
                  source.initialIndex,
                  source.index,
                ),
              )
            }}
          >
            <div class="flex flex-col gap-1">
              <Key each={rows()} by={(entry) => directoryKey(entry.directory, host)}>
                {(entry, index) => {
                  const key = () => directoryKey(entry().directory, host)

                  return (
                    <WorkspaceRow
                      server={serverKey}
                      sortKey={key()}
                      index={index()}
                      entry={entry()}
                      expanded={expanded(key())}
                      unavailable={unavailable(key())}
                      onToggle={() => toggle(key())}
                      onRename={() => rename(entry())}
                      onRemove={() => remove(entry())}
                      row={sessionsOf(sessions.rows(), key())}
                      isOpenTab={isOpenTab}
                      isActive={isActive}
                      now={now}
                      onWorkingChange={setRowWorking}
                      watermark={watermark(key())}
                      onShowMore={() =>
                        setRowWatermark(
                          key(),
                          nextWatermark(watermark(key()), sessionsOf(sessions.rows(), key()).sessions.length),
                        )
                      }
                      onOpen={(session) =>
                        actions.openProjectSession(props.conn, session.location.directory, session, { preview: true })
                      }
                    />
                  )
                }}
              </Key>
            </div>
          </DragDropProvider>
        </Show>
      </div>
      <Show when={rows().length > 0}>
        <div class="shrink-0 p-1">
          <Button variant="ghost-muted" size="small" class="w-full justify-start" icon="folder-add-left" onClick={add}>
            {language.t("sidebar.workspace.add")}
          </Button>
        </div>
      </Show>
    </div>
  )
}

function WorkspaceRow(props: {
  server: ServerConnection.Key
  sortKey: string
  index: number
  entry: WorkspaceEntry
  expanded: boolean
  /** The directory probe failed: the row stays, marked, and cannot expand. */
  unavailable: boolean
  onToggle: () => void
  onRename: () => void
  onRemove: () => void
  /** This row's session list, read from the sidebar store so an unloaded row never suspends. */
  row: { status: "loading" | "ready" | "failed"; sessions: SessionInfo[] }
  isOpenTab: (sessionID: string) => boolean
  isActive: (sessionID: string) => boolean
  now: (status: SessionRowStatus) => number
  onWorkingChange: (sessionID: string, working: boolean) => void
  /** COLL-03: how many of this row's sessions are on screen; the baseline reads when unstored. */
  watermark: number
  onShowMore: () => void
  onOpen: (session: SessionInfo) => void
}) {
  const language = useLanguage()

  const [menu, setMenu] = createStore({ open: false })

  const openMenu = () => setMenu("open", true)

  const sortable = useSortable({
    get id() {
      return props.sortKey
    },
    get index() {
      return props.index
    },
  })

  const open = () => props.expanded && !props.unavailable

  return (
    <div ref={sortable.ref} class="relative shrink-0">
      <div
        class="group/workspace relative flex h-7 min-w-0 shrink-0 items-center rounded-[6px] pe-1 hover:bg-v2-overlay-simple-overlay-hover has-[:focus-visible]:bg-v2-overlay-simple-overlay-hover"
        onContextMenu={(event) => {
          event.preventDefault()
          openMenu()
        }}
        onKeyDown={(event) => {
          if (event.key !== "ContextMenu" && (event.key !== "F10" || !event.shiftKey)) return
          event.preventDefault()
          openMenu()
        }}
      >
        <button
          type="button"
          class="flex h-full min-w-0 flex-1 cursor-default items-center gap-2 rounded-[6px] bg-transparent px-2 text-start text-[13px] leading-[var(--line-height-compact)] text-v2-text-text-muted [font-weight:440] transition-colors duration-[120ms] ease-in-out group-hover/workspace:text-v2-text-text-base focus-visible:text-v2-text-text-base focus-visible:outline-none"
          aria-expanded={open()}
          aria-disabled={props.unavailable}
          onClick={() => {
            if (!props.unavailable) props.onToggle()
          }}
        >
          <Icon name="folder" size="small" class="shrink-0 text-v2-icon-icon-muted" />
          <span class="min-w-0 flex-1 truncate" dir="auto">
            {props.entry.title}
          </span>
          <Show when={props.unavailable}>
            <span
              class="shrink-0 truncate text-[11px] leading-[var(--line-height-compact)] text-v2-text-text-faint [font-weight:400]"
              title={language.t("sidebar.workspace.unavailable.description")}
            >
              {language.t("sidebar.workspace.unavailable")}
            </span>
          </Show>
          <Icon
            name="fill-triangle-down"
            size="small"
            class="shrink-0 text-v2-icon-icon-muted transition-transform"
            classList={{ "-rotate-90 rtl:rotate-90": !open() }}
          />
        </button>
        <span
          data-workspace-action
          data-menu={menu.open}
          class="hover-reveal flex shrink-0 items-center gap-1 group-hover/workspace:opacity-100 focus-within:opacity-100 data-[menu=true]:opacity-100"
        >
          <Menu
            gutter={6}
            modal={false}
            placement="bottom-end"
            open={menu.open}
            onOpenChange={(open) => setMenu("open", open)}
          >
            <Menu.Trigger
              as={IconButton}
              variant="ghost-muted"
              size="small"
              icon={<Icon name="outline-dots" />}
              aria-label={language.t("sidebar.workspace.options")}
            />
            <Menu.Portal>
              <Menu.Content>
                <Menu.Item onSelect={props.onRename}>{language.t("common.rename")}</Menu.Item>
                <Menu.Separator />
                <Menu.Item onSelect={props.onRemove}>{language.t("sidebar.workspace.remove.title")}</Menu.Item>
              </Menu.Content>
            </Menu.Portal>
          </Menu>
        </span>
      </div>
      <Show when={open()}>
        <div data-workspace-action class="flex flex-col gap-[3px] pb-1">
          <Show when={props.row.status === "loading"}>
            <div class="ps-8 pe-2 py-1.5">
              <Loader
                class="size-3.5 shrink-0 text-v2-icon-icon-muted"
                role="img"
                aria-label={language.t("common.loading")}
              />
            </div>
          </Show>
          <Show when={props.row.status === "ready" && props.row.sessions.length === 0}>
            <div class="ps-8 pe-2 py-1.5 text-12-regular text-v2-text-text-faint">
              {language.t("sidebar.workspace.sessions.empty")}
            </div>
          </Show>
          <Key each={shownByWatermark(props.row.sessions, props.watermark)} by={(session) => session.id}>
            {(session) => (
              <SessionRow
                server={props.server}
                session={session()}
                openTab={props.isOpenTab(session().id)}
                active={props.isActive(session().id)}
                now={props.now}
                onWorkingChange={props.onWorkingChange}
                onOpen={() => props.onOpen(session())}
              />
            )}
          </Key>
          <Show when={remainingHidden(props.row.sessions.length, props.watermark) > 0}>
            <button
              type="button"
              class="flex h-7 w-full shrink-0 items-center rounded-[6px] ps-8 pe-2 text-start text-12-regular text-v2-text-text-muted hover:bg-v2-overlay-simple-overlay-hover focus-visible:outline-none focus-visible:bg-v2-overlay-simple-overlay-hover"
              aria-expanded={false}
              onClick={props.onShowMore}
            >
              {language.plural("sidebar.workspace.sessions.more", remainingHidden(props.row.sessions.length, props.watermark))}
            </button>
          </Show>
        </div>
      </Show>
    </div>
  )
}
