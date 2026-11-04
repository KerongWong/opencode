import { For, Show, createMemo } from "solid-js"
import { createStore } from "solid-js/store"
import { Icon } from "@opencode/ui/icon"
import { ActivityRing } from "@opencode/ui/activity-ring"
import { displayName } from "@opencode/ui/project-avatar"
import { useLanguage } from "@/runtime/i18n/language"
import { SessionTabAvatarView } from "@/shell/layout/session-tab-avatar"
import { createSessionInbox, type InboxEntry } from "./inbox-model"
import { sessionTabTitle } from "./tab-title"

// How many sessions a project shows before "show more". The whole list is capped by the inbox index, so this only
// decides how much of a project's list is on screen at once.
const SESSIONS_PER_PROJECT = 5

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

    return [...map.values()].sort((a, b) => (a.key === "ungrouped" ? 1 : b.key === "ungrouped" ? -1 : 0))
  })

  const selected = (entry: InboxEntry) => inbox.selected(entry)

  const age = (entry: InboxEntry) => {
    const seconds = Math.max(0, Math.floor((inbox.now() - entry.session.time.updated) / 1000))

    if (seconds < 60) return language.t("sidebar.inbox.time.now")
    if (seconds < 3_600) return language.plural("sidebar.inbox.elapsed.minutes", Math.floor(seconds / 60))
    if (seconds < 86_400) return language.plural("sidebar.inbox.elapsed.hours", Math.floor(seconds / 3_600))

    return language.plural("sidebar.inbox.elapsed.days", Math.floor(seconds / 86_400))
  }

  const toggle = (key: string, collapsed: boolean) => {
    setState("collapsed", key, !collapsed)
  }

  return (
    <div data-slot="sidebar-projects" class="flex min-h-0 flex-1 flex-col">
      <div data-scrollable class="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
        <Show
          when={groups().length > 0}
          fallback={
            <p class="px-2 py-3 text-[13px] leading-4 text-v2-text-text-muted">{language.t("sidebar.projects.empty")}</p>
          }
        >
          <For each={groups()}>
            {(group) => {
              const collapsed = () => !!state.collapsed[group.key]
              const expanded = () => !!state.expanded[group.key]
              const shown = () => (expanded() ? group.entries : group.entries.slice(0, SESSIONS_PER_PROJECT))
              const hidden = () => group.entries.length - SESSIONS_PER_PROJECT

              return (
                <section data-slot="sidebar-projects-group" class="mb-1">
                  <button
                    type="button"
                    data-slot="sidebar-projects-project"
                    aria-expanded={!collapsed()}
                    class="flex h-8 w-full items-center gap-1.5 rounded-[6px] px-1.5 text-start hover:bg-v2-overlay-simple-overlay-hover focus-visible:outline-none focus-visible:bg-v2-overlay-simple-overlay-hover"
                    onClick={() => toggle(group.key, collapsed())}
                  >
                    <Icon
                      name={collapsed() ? "chevron-right" : "chevron-down"}
                      class="size-3 shrink-0 text-v2-icon-icon-muted"
                    />
                    <SessionTabAvatarView project={group.project} directory={group.directory} unread={false} />
                    <span
                      dir="auto"
                      class="min-w-0 flex-1 truncate text-[13px] leading-4 font-medium tracking-[-0.04px] text-v2-text-text-base"
                    >
                      {displayName(group.project ?? { worktree: group.directory })}
                    </span>
                    <span class="shrink-0 text-[11px] tabular-nums text-v2-text-text-muted">{group.entries.length}</span>
                  </button>
                  <Show when={!collapsed()}>
                    <div class="mt-0.5 flex flex-col">
                      <For each={shown()}>
                        {(entry) => (
                          <button
                            type="button"
                            data-slot="sidebar-projects-session"
                            data-state={selected(entry) ? "active" : undefined}
                            class="flex h-7 w-full items-center gap-2 rounded-[5px] ps-[26px] pe-1.5 text-start hover:bg-v2-overlay-simple-overlay-hover focus-visible:outline-none focus-visible:bg-v2-overlay-simple-overlay-hover data-[state=active]:bg-v2-overlay-simple-overlay-pressed"
                            onClick={() => inbox.open(entry)}
                          >
                            <span
                              dir="auto"
                              class="min-w-0 flex-1 truncate text-[13px] leading-4 tracking-[-0.04px] text-v2-text-text-base"
                            >
                              {sessionTabTitle(entry.session.title, language.t("session.tab.session"))}
                            </span>
                            <span class="flex shrink-0 items-center justify-end">
                              <Show
                                when={entry.status === "working"}
                                fallback={
                                  <span class="text-[11px] tabular-nums text-v2-text-text-muted">{age(entry)}</span>
                                }
                              >
                                <span class="sr-only">{language.t("sidebar.inbox.status.working")}</span>
                                <ActivityRing class="shrink-0 text-v2-icon-icon-muted" />
                              </Show>
                            </span>
                          </button>
                        )}
                      </For>
                      <Show when={!expanded() && hidden() > 0}>
                        <button
                          type="button"
                          data-slot="sidebar-projects-more"
                          class="flex h-7 w-full items-center rounded-[5px] ps-[26px] pe-1.5 text-start text-[12px] leading-4 text-v2-text-text-muted hover:bg-v2-overlay-simple-overlay-hover focus-visible:outline-none focus-visible:bg-v2-overlay-simple-overlay-hover"
                          onClick={() => setState("expanded", group.key, true)}
                        >
                          {language.plural("sidebar.projects.more", hidden())}
                        </button>
                      </Show>
                    </div>
                  </Show>
                </section>
              )
            }}
          </For>
        </Show>
      </div>
    </div>
  )
}
