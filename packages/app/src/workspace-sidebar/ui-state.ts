import { Schema } from "effect"
import { Persistence } from "@/runtime/persistence/schema"
import { Persist } from "@/runtime/persistence/storage"
import type { ServerScope } from "@/runtime/server/scope"

/**
 * COLL-02: the sidebar's client-local UI state — which rows reveal their full session list.
 * Kept apart from the workspace registry: renaming, removing or re-registering a workspace never
 * touches it, and a stale key for a removed row is harmless (re-registering the same directory
 * simply inherits the previous reveal state).
 */
export const UI_STATE_KEY = "workspace-sidebar-ui.v1"

export const WorkspaceUiSchema = Persistence.struct({
  // Row keys (directoryKey results) whose session list is revealed beyond the default cutoff.
  revealed: Persistence.array(Schema.String),
})

export type WorkspaceUiState = typeof WorkspaceUiSchema.Type

export const initialUiState: WorkspaceUiState = { revealed: [] }

export function uiStateTarget(scope: ServerScope): ReturnType<typeof Persist.serverGlobal> {
  return Persist.serverGlobal(scope, UI_STATE_KEY)
}

/** Reference-stable: an already-revealed key writes nothing. */
export function reveal(keys: string[], key: string) {
  if (keys.includes(key)) return keys

  return [...keys, key]
}

/** Reference-stable: an unknown key writes nothing. */
export function conceal(keys: string[], key: string) {
  if (!keys.includes(key)) return keys

  return keys.filter((item) => item !== key)
}
