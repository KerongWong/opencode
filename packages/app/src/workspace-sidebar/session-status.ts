/**
 * The session row's scannable state and relative-time label, as pure functions.
 * Priority (STAT-02): failed > approval > input > working > unread > idle; the
 * if-chain order is the resolution, every combination is unit-testable.
 */
export type SessionRowStatus = "failed" | "approval" | "input" | "working" | "unread" | "idle"

export function sessionRowStatus(input: {
  failed: boolean
  permission: boolean
  form: boolean
  busy: boolean
  unread: boolean
}): SessionRowStatus {
  if (input.failed) return "failed"
  if (input.permission) return "approval"
  if (input.form) return "input"
  if (input.busy) return "working"
  if (input.unread) return "unread"
  return "idle"
}

/** TIME-01: <60s now, <60m minutes, <24h hours, otherwise days (the blueprint `age()` rules). */
export type Elapsed = { kind: "now" } | { kind: "minutes" | "hours" | "days"; count: number }

export function elapsedBucket(updatedMs: number, nowMs: number): Elapsed {
  const seconds = Math.max(0, Math.floor((nowMs - updatedMs) / 1000))

  if (seconds < 60) return { kind: "now" }
  if (seconds < 3_600) return { kind: "minutes", count: Math.floor(seconds / 60) }
  if (seconds < 86_400) return { kind: "hours", count: Math.floor(seconds / 3_600) }
  return { kind: "days", count: Math.floor(seconds / 86_400) }
}

/** STAT-03: shape and color per status, color only through `text-v2-state-fg-*` semantic tokens. */
export type StatusMark =
  | { kind: "icon"; icon: "close" | "circle-exclamation" | "help" | "check"; className: string }
  | { kind: "ring" }
  | undefined

export function statusMark(status: SessionRowStatus): StatusMark {
  if (status === "failed") return { kind: "icon", icon: "close", className: "text-v2-state-fg-danger" }
  if (status === "approval") return { kind: "icon", icon: "circle-exclamation", className: "text-v2-state-fg-warning" }
  if (status === "input") return { kind: "icon", icon: "help", className: "text-v2-state-fg-warning" }
  if (status === "working") return { kind: "ring" }
  if (status === "unread") return { kind: "icon", icon: "check", className: "text-v2-state-fg-success" }
  return undefined
}
