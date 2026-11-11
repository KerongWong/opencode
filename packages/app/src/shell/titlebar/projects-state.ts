import { Schema } from "effect"
import { Persistence } from "@/runtime/persistence/schema"
import { persisted } from "@/runtime/persistence/storage"

const schema = Persistence.struct({
  // Project group keys in the order the person dragged them. Keys for projects that temporarily have no sessions stay
  // here so they keep their place when they come back.
  order: Persistence.array(Schema.String),
  // Project group keys the person removed from this sidebar. They stay here until restored, so a finished project
  // does not return the next time it is used.
  removed: Persistence.array(Schema.String),
  // The sidebar's last scroll position. Keeping it means reopening the app or the layout does not throw away where
  // the person was reading.
  scrollTop: Persistence.fallback(Schema.Finite, () => 0),
})

/** The Projects sidebar's client-local state: manual order, removed projects and scroll position. */
export function createProjectsSidebarState() {
  const [store, setStore] = persisted("projects-sidebar.v1", schema, { order: [], removed: [], scrollTop: 0 })

  return {
    order: () => store.order,
    removed: () => store.removed,
    scrollTop: () => store.scrollTop,
    setOrder(order: string[]) {
      setStore("order", order)
    },
    remove(key: string) {
      if (store.removed.includes(key)) return
      setStore("removed", [...store.removed, key])
    },
    restore(key: string) {
      setStore(
        "removed",
        store.removed.filter((item) => item !== key),
      )
    },
    setScrollTop(scrollTop: number) {
      setStore("scrollTop", scrollTop)
    },
  }
}
