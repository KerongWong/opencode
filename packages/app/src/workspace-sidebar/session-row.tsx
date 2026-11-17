import { createEffect, createMemo, onCleanup, Show } from "solid-js"
import { useQueryClient } from "@tanstack/solid-query"
import type { SessionInfo } from "@opencode/client/promise"
import { ActivityRing } from "@opencode/ui/activity-ring"
import { Button } from "@opencode/ui/button"
import { useDialog } from "@opencode/ui/context/dialog"
import { Dialog, DialogFooter, DialogHeader, DialogTitleGroup } from "@opencode/ui/dialog"
import { Icon } from "@opencode/ui/icon"
import { Menu } from "@opencode/ui/menu"
import { useLanguage } from "@/runtime/i18n/language"
import { ServerConnection } from "@/runtime/server/registry"
import { useGlobal, type ServerCtx } from "@/runtime/server/runtime"
import type { Project } from "@/runtime/server/types"
import { projectSettingsKey, useSettings } from "@/settings/model"
import { errorMessage } from "@/shell/layout/helpers"
import { ProjectIcon } from "@/shell/layout/project-icon"
import { sessionBusy, sessionRequests } from "@/shell/layout/project-avatar-state"
import { showToast } from "@/shell/notifications/toast"
import { createSessionExporter } from "@/session/commands/export-session"
import { createSessionRenamer } from "@/session/commands/rename-session"
import { sessionTreeIDs } from "@/session/requests/session-request-tree"
import { SessionReadMenuItem } from "@/session/session-read-menu-item"
import { sessionLabel } from "@/session/title"
import { RenameDialog } from "@/shell/titlebar/project-session-row"
import { notifySessionTabsRemoved } from "@/shell/titlebar/session-events"
import { elapsedBucket, sessionRowStatus, statusMark, type SessionRowStatus } from "./session-status"

// Existing inbox status labels double as the row mark's accessible name.
const STATUS_LABEL: Partial<Record<SessionRowStatus, string>> = {
  approval: "sidebar.inbox.status.approval",
  input: "sidebar.inbox.status.input",
  working: "sidebar.inbox.status.working",
  failed: "sidebar.inbox.status.failed",
  unread: "sidebar.inbox.status.done",
}

/**
 * COLL-04: the row status as a pure read over the server context — the same inputs the row memo
 * below uses. Shared with the sidebar's watermark driver so a session hidden below the watermark
 * (which never mounts a SessionRow) still contributes its attention status to the auto-raise.
 */
export function rowSessionStatus(input: {
  serverCtx: ServerCtx
  session: SessionInfo
  active: boolean
  autoApprove: boolean
}): SessionRowStatus {
  const sessionID = input.session.id
  const requests = sessionRequests(input.serverCtx, sessionID, true, input.autoApprove)
  const busy = [...new Set([sessionID, ...input.serverCtx.data.session.family(sessionID)])].some((id) =>
    sessionBusy(input.serverCtx.data, id),
  )
  const unread = !input.active && input.serverCtx.notification.session.unread(sessionID, input.session)
  const failed = (input.serverCtx.data.session.get(sessionID) ?? input.session)?.outcome === "failed"

  return sessionRowStatus({
    failed,
    permission: !!requests.permission,
    form: !!requests.form,
    busy,
    unread,
  })
}

/**
 * One session row of the workspace sidebar: title, state mark, relative age and the shared
 * session context menu. Derived from `ProjectSessionRow` without touching that upstream file;
 * the status inputs are the same ones the tab avatar reads (`project-avatar-state`).
 */
export function SessionRow(props: {
  server: ServerConnection.Key
  session: SessionInfo
  openTab: boolean
  active: boolean
  /** A faint trailing label, such as the server a session belongs to. */
  label?: string
  /** Extra nesting steps of 14px, for subagent sessions and nested groups. */
  depth?: number
  /** Shows the project avatar in the leading slot, where no project header names it. */
  project?: Project
  /** Dual-granularity clock: second-level while working, minute-level otherwise. */
  now: (status: SessionRowStatus) => number
  /** Registers the row with the sidebar's second-level clock while it is working. */
  onWorkingChange?: (sessionID: string, working: boolean) => void
  onOpen: () => void
}) {
  const language = useLanguage()

  const global = useGlobal()

  const settings = useSettings()

  const dialog = useDialog()

  const queryClient = useQueryClient()

  const connection = () => global.servers.list().find((conn) => ServerConnection.key(conn) === props.server)

  const ctx = () => global.serverCtx(props.server)

  const exporter = createSessionExporter()

  const rename = createSessionRenamer()

  const exportTarget = () => ({ server: props.server, sessionID: props.session.id })

  // Same sources as the tab avatar: pending requests, family-wide busy, unread, outcome.
  const status = createMemo((): SessionRowStatus => {
    const serverCtx = ctx()

    if (!serverCtx) return "idle"

    return rowSessionStatus({
      serverCtx,
      session: props.session,
      active: props.active,
      autoApprove: settings.permissions.autoApproves(projectSettingsKey(serverCtx.sdk.scope, props.session.projectID)),
    })
  })

  const mark = createMemo(() => statusMark(status()))

  createEffect(() => {
    if (status() !== "working") return

    props.onWorkingChange?.(props.session.id, true)

    onCleanup(() => props.onWorkingChange?.(props.session.id, false))
  })

  const age = (value: SessionRowStatus) => {
    const elapsed = elapsedBucket(props.session.time.updated, props.now(value))

    if (elapsed.kind === "now") return language.t("sidebar.inbox.time.now")

    return language.plural(`sidebar.inbox.elapsed.${elapsed.kind}`, elapsed.count)
  }

  function DeleteDialog() {
    const confirm = () => {
      const current = ctx()

      const server = props.server

      dialog.close()

      if (!current) return

      const ids = sessionTreeIDs(current.data.session.list(), props.session.id)

      const conn = connection()

      queryClient.setQueryData<SessionInfo[]>(["home-sessions", conn], (sessions) =>
        sessions?.filter((session) => !ids.includes(session.id)),
      )
      void current.data.session
        .remove(props.session.id)
        .then(() => {
          notifySessionTabsRemoved({ server, directory: props.session.location.directory, sessionIDs: ids })
        })
        .catch((cause) => {
          showToast({
            title: language.t("session.delete.failed.title"),
            description: errorMessage(cause, language.t("session.delete.failed.title")),
          })
        })
        .finally(() => {
          void queryClient.invalidateQueries({ queryKey: ["home-sessions", conn], exact: true })
        })
    }

    return (
      <Dialog fit>
        <DialogHeader hideClose>
          <DialogTitleGroup
            title={language.t("session.delete.title")}
            description={language.t("session.delete.confirm", { name: sessionLabel(props.session) })}
          />
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" autofocus onClick={() => dialog.close()}>
            {language.t("common.cancel")}
          </Button>
          <Button variant="danger" onClick={confirm}>
            {language.t("session.delete.button")}
          </Button>
        </DialogFooter>
      </Dialog>
    )
  }

  return (
    <Menu.Context modal={false}>
      <Menu.Context.Trigger
        as="button"
        type="button"
        data-titlebar-tab-action
        data-state={props.active ? "pressed" : undefined}
        class="relative flex h-7 w-full shrink-0 items-center gap-2 rounded-[6px] ps-8 pe-2 text-start text-[13px] leading-[var(--line-height-compact)] font-medium focus-visible:outline-none"
        classList={{ "text-v2-text-text-base": props.active, "text-v2-text-text-faint": !props.active }}
        aria-current={props.active ? "page" : undefined}
        title={sessionLabel(props.session)}
        style={props.depth ? { "padding-inline-start": `calc(2rem + ${props.depth * 14}px)` } : undefined}
        onClick={props.onOpen}
      >
        <Show when={props.project && !props.openTab ? props.project : undefined}>
          {(project) => (
            <span class="absolute start-2 top-1/2 flex size-4 -translate-y-1/2 items-center justify-center">
              <ProjectIcon project={project()} />
            </span>
          )}
        </Show>
        <Show when={props.openTab}>
          <span
            role="img"
            aria-label={language.t("sidebar.organize.openTab")}
            title={language.t("sidebar.organize.openTab")}
            class="absolute start-2 top-1/2 flex size-4 -translate-y-1/2 items-center justify-center"
          >
            <span class="size-1 rounded-full bg-v2-icon-icon-faint" />
          </span>
        </Show>
        <span class="min-w-0 flex-1 truncate" dir="auto">
          {sessionLabel(props.session)}
        </span>
        <Show when={props.label}>
          {(label) => (
            <span class="max-w-[40%] shrink-0 truncate text-[11px] leading-[var(--line-height-compact)] text-v2-text-text-faint [font-weight:400]">
              {label()}
            </span>
          )}
        </Show>
        <span class="flex size-4 shrink-0 items-center justify-center">
          <Show when={mark()} keyed>
            {(value) =>
              value.kind === "ring" ? (
                // The ring's own unlayered CSS beats utility classes, so the status color goes inline.
                <ActivityRing width={16} height={16} style={{ color: "var(--v2-state-fg-info)" }} />
              ) : (
                <Icon name={value.icon} size="small" class={value.className} />
              )
            }
          </Show>
        </span>
        <span class="shrink-0 text-[11px] tabular-nums text-v2-text-text-muted">{age(status())}</span>
        <Show when={STATUS_LABEL[status()]}>
          {(label) => <span class="sr-only">{language.t(label())}</span>}
        </Show>
      </Menu.Context.Trigger>
      <Menu.Context.Portal>
        <Menu.Context.Content
          onCloseAutoFocus={(event) => {
            if (dialog.active) event.preventDefault()
          }}
        >
          <Menu.Item
            disabled={!ctx()}
            onSelect={() =>
              dialog.show(() => (
                <RenameDialog
                  title={sessionLabel(props.session)}
                  onRename={(title) => rename(props.server, props.session, title)}
                />
              ))
            }
          >
            {language.t("common.rename")}
          </Menu.Item>
          <Menu.Item
            disabled={!ctx() || exporter.exporting(exportTarget())}
            onSelect={() => exporter.export(exportTarget())}
          >
            {language.t("common.export")}…
          </Menu.Item>
          <SessionReadMenuItem server={props.server} session={props.session} />
          <Menu.Separator />
          <Menu.Item disabled={!ctx()} onSelect={() => dialog.show(() => <DeleteDialog />)}>
            {language.t("common.delete")}…
          </Menu.Item>
        </Menu.Context.Content>
      </Menu.Context.Portal>
    </Menu.Context>
  )
}
