import { Key } from "@solid-primitives/keyed"
import type { SessionInfo } from "@opencode/client/promise"
import { createEffect, createMemo, on, Show } from "solid-js"
import { createStore } from "solid-js/store"
import { Button } from "@opencode/ui/button"
import { Icon } from "@opencode/ui/icon"
import { Loader } from "@opencode/ui/loader"
import { useLanguage } from "@/runtime/i18n/language"
import { usePlatform } from "@/runtime/platform/platform"
import { ServerConnection, useServers } from "@/runtime/server/registry"
import { useServerCtx } from "@/runtime/server/runtime"
import { useLayout } from "@/shell/state/layout"
import { homeProjectDirectories } from "@/shell/layout/helpers"
import { createProjectSessionActions } from "@/shell/tabs/project-sessions"
import { useTabs } from "@/shell/tabs/tabs"
import { ProjectSessionRow } from "@/shell/titlebar/project-session-row"
import { createSidebarActivityListener } from "@/shell/titlebar/sidebar-organized"
import { useDirectoryPicker } from "@/workspaces/selection/picker"
import { directoryKey, hostPlatform, visible, type WorkspaceEntry } from "./registry"
import { createWorkspaceSessions, sessionsOf } from "./sessions"
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

  const actions = createProjectSessionActions()

  const host = hostPlatform(platform.platform === "desktop" ? platform.os : undefined)

  const serverKey = ServerConnection.key(props.conn)

  const route = () => layout.route()

  const registry = createWorkspaceRegistry(servers.scope(serverKey), host)

  const rows = createMemo(() => visible(registry.entries()))

  const sessions = createWorkspaceSessions({
    entries: rows,
    connection: () => props.conn,
    ctx: useServerCtx(() => props.conn),
    platform: () => host,
    onServerSpelling: (directory, spelling) => registry.adoptDirectory(directory, spelling),
  })

  const [ui, setUi] = createStore<{ expanded: Record<string, boolean> }>({ expanded: {} })

  // `on` tracks the row list only: `load` reads and writes the session store, so a bare effect would retrigger itself.
  createEffect(on(rows, () => sessions.load()))

  const expanded = (key: string) => ui.expanded[key] === true

  const toggle = (key: string) => setUi("expanded", key, (value) => !value)

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

  return (
    <div data-slot="workspace-sidebar" class="flex min-h-0 flex-1 flex-col [app-region:no-drag]">
      <div data-slot="workspace-list" data-scrollable class="min-h-0 flex-1 overflow-y-auto">
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
          <div class="flex flex-col gap-1">
            <Key each={rows()} by={(entry) => directoryKey(entry.directory, host)}>
              {(entry) => {
                const key = () => directoryKey(entry().directory, host)

                return (
                  <WorkspaceRow
                    server={serverKey}
                    entry={entry()}
                    expanded={expanded(key())}
                    onToggle={() => toggle(key())}
                    row={sessionsOf(sessions.rows(), key())}
                    isOpenTab={isOpenTab}
                    isActive={isActive}
                    onOpen={(session) =>
                      actions.openProjectSession(props.conn, session.location.directory, session, { preview: true })
                    }
                  />
                )
              }}
            </Key>
          </div>
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
  entry: WorkspaceEntry
  expanded: boolean
  onToggle: () => void
  /** This row's session list, read from the sidebar store so an unloaded row never suspends. */
  row: { status: "loading" | "ready" | "failed"; sessions: SessionInfo[] }
  isOpenTab: (sessionID: string) => boolean
  isActive: (sessionID: string) => boolean
  onOpen: (session: SessionInfo) => void
}) {
  const language = useLanguage()

  return (
    <div class="relative shrink-0">
      <div class="group/workspace relative flex h-7 min-w-0 shrink-0 items-center rounded-[6px] pe-1 hover:bg-v2-overlay-simple-overlay-hover has-[:focus-visible]:bg-v2-overlay-simple-overlay-hover">
        <button
          type="button"
          class="flex h-full min-w-0 flex-1 cursor-default items-center gap-2 rounded-[6px] bg-transparent px-2 text-start text-[13px] leading-[var(--line-height-compact)] text-v2-text-text-muted [font-weight:440] transition-colors duration-[120ms] ease-in-out group-hover/workspace:text-v2-text-text-base focus-visible:text-v2-text-text-base focus-visible:outline-none"
          aria-expanded={props.expanded}
          onClick={props.onToggle}
        >
          <Icon name="folder" size="small" class="shrink-0 text-v2-icon-icon-muted" />
          <span class="min-w-0 flex-1 truncate" dir="auto">
            {props.entry.title}
          </span>
          <Icon
            name="fill-triangle-down"
            size="small"
            class="shrink-0 text-v2-icon-icon-muted transition-transform"
            classList={{ "-rotate-90 rtl:rotate-90": !props.expanded }}
          />
        </button>
      </div>
      <Show when={props.expanded}>
        <div class="flex flex-col gap-[3px] pb-1">
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
          <Key each={props.row.sessions} by={(session) => session.id}>
            {(session) => (
              <ProjectSessionRow
                server={props.server}
                session={session()}
                openTab={props.isOpenTab(session().id)}
                active={props.isActive(session().id)}
                onOpen={() => props.onOpen(session())}
              />
            )}
          </Key>
        </div>
      </Show>
    </div>
  )
}
