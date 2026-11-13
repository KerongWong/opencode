import { Button } from "@opencode/ui/button"
import { useDialog } from "@opencode/ui/context/dialog"
import { Dialog, DialogBody, DialogFooter, DialogHeader, DialogTitleGroup } from "@opencode/ui/dialog"
import { TextInput } from "@opencode/ui/text-input"
import { createStore } from "solid-js/store"
import { useLanguage } from "@/runtime/i18n/language"

/** Renames the registry title only: the directory, its git state and its sessions stay untouched. */
export function WorkspaceRenameDialog(props: { title: string; onRename: (title: string) => void }) {
  const language = useLanguage()

  const dialog = useDialog()

  const [state, setState] = createStore({ value: props.title })

  const trimmed = () => state.value.trim()

  const submit = () => {
    if (trimmed() === "") return
    props.onRename(trimmed())
    dialog.close()
  }

  return (
    <Dialog fit>
      <DialogHeader hideClose>
        <DialogTitleGroup title={language.t("sidebar.workspace.rename.title")} />
      </DialogHeader>
      <form
        class="contents"
        onSubmit={(event) => {
          event.preventDefault()
          submit()
        }}
      >
        <DialogBody class="px-4">
          <TextInput
            appearance="large"
            class="!w-full self-stretch"
            aria-label={language.t("sidebar.workspace.rename.title")}
            value={state.value}
            autofocus
            autocomplete="off"
            onInput={(event) => setState("value", event.currentTarget.value)}
          />
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" onClick={() => dialog.close()}>
            {language.t("common.cancel")}
          </Button>
          <Button type="submit" variant="contrast" disabled={trimmed() === ""}>
            {language.t("common.save")}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  )
}

/** Removing writes `removedAt`: the record stays, so registering the folder again restores its name and order. */
export function WorkspaceRemoveDialog(props: { title: string; onRemove: () => void }) {
  const language = useLanguage()

  const dialog = useDialog()

  return (
    <Dialog fit>
      <DialogHeader hideClose>
        <DialogTitleGroup
          title={language.t("sidebar.workspace.remove.title")}
          description={language.t("sidebar.workspace.remove.description")}
        />
      </DialogHeader>
      <DialogBody class="px-4">
        <span class="min-w-0 truncate text-[13px] leading-[var(--line-height-compact)] text-v2-text-text-base" dir="auto">
          {props.title}
        </span>
      </DialogBody>
      <DialogFooter>
        <Button variant="ghost" autofocus onClick={() => dialog.close()}>
          {language.t("common.cancel")}
        </Button>
        <Button
          variant="danger"
          onClick={() => {
            props.onRemove()
            dialog.close()
          }}
        >
          {language.t("sidebar.workspace.remove.action")}
        </Button>
      </DialogFooter>
    </Dialog>
  )
}
