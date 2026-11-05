import { Schema } from "effect"
import { Persistence } from "@/runtime/persistence/schema"
import { persisted } from "@/runtime/persistence/storage"

const schema = Persistence.struct({
  // Project group keys in the order the person dragged them. Keys for projects that temporarily have no sessions stay
  // here so they keep their place when they come back.
  order: Persistence.array(Schema.String),
  // The sidebar's last scroll position. Keeping it means reopening the app or the layout does not throw away where
  // the person was reading.
  scrollTop: Persistence.fallback(Schema.Finite, () => 0),
})

/** The Projects sidebar's client-local state: manual order and scroll position. */
export function createProjectsSidebarState() {
  const [store, setStore] = persisted("projects-sidebar.v1", schema, { order: [], scrollTop: 0 })

  return {
    order: () => store.order,
    scrollTop: () => store.scrollTop,
    setOrder(order: string[]) {
      setStore("order", order)
    },
    setScrollTop(scrollTop: number) {
      setStore("scrollTop", scrollTop)
    },
  }
}
