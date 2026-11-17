# Phase 04: session-row-status-time — Code Review

**Reviewed:** 2026-11-17
**Depth:** standard (per-file reads + cross-reference against upstream blueprint `shell/titlebar/inbox-model.ts`, `inbox.tsx`, `inbox-working.ts`, `project-session-row.tsx`, `project-avatar-state.ts`)
**Commits:** 652068b7a7, 1ccdc13928, c5085ab689, ffdfdf34eb

## Findings

| ID | Severity | File | Line | Issue | Recommendation |
|----|----------|------|------|-------|----------------|
| F-01 | high | `packages/app/src/workspace-sidebar/session-row.tsx` | 115–121 | Elapsed label always uses `session.time.updated`, ignoring per-status reference time from the blueprint (`since`) | Select reference per status: `workingSince()` for working, `time.idle ?? time.updated` for idle |
| F-02 | low | `packages/app/src/workspace-sidebar/sidebar.tsx` | 104, 118 | `working` registry never shrinks: `false` entries accumulate forever | Delete the key when a row unregisters |
| F-03 | low | `packages/app/src/workspace-sidebar/session-row.tsx` | 80–103 | Unread "Done" mark is shown on the active row; upstream suppresses unread when `active` | Exclude `unread` from `status()` when `props.active`, or gate the mark |
| F-04 | low | `packages/app/src/workspace-sidebar/session-row.tsx` + `session-status.ts` | 115–121; 31–41 | Second-granularity clock has almost no observable effect: no label ever renders second-level values | Use the existing `sidebar.inbox.elapsed.seconds` keys for working rows <60s (blueprint parity), or document the simplification |

### F-01 (high): Wrong reference timestamp for the elapsed label

**Evidence:** `session-row.tsx:116` computes the age from `props.session.time.updated` for every status:

```ts
const elapsed = elapsedBucket(props.session.time.updated, props.now(value))
```

The blueprint this phase cites (comment on `session-status.ts:28`, "the blueprint `age()` rules") deliberately does **not** do this. `inbox-model.ts:185-193` selects the reference per status:

```ts
if (value === "working") return workingSince(session)              // time.busy of the current run
if (!inboxBusy(value)) return session.time.idle ?? session.time.updated
const request = value === "approval" ? requests.permission : requests.form
return (request && requestTimes[...]) ?? workingSince(session) ?? session.time.updated
```

and `inbox-working.ts:7-13` defines `workingSince` as `time.busy` when a run is in progress.

`SessionInfo.time` (`packages/client/src/promise/generated/types.ts:2334`) is `{ created; updated; busy?; idle?; ... }`, so the correct fields are available on the exact prop the row already holds — no extra plumbing is needed for the working/idle cases.

**Concrete failure modes:**
- **Working rows:** the server bumps `time.updated` during a run (session updates such as AI-generated title changes; see `data.ts` re-`remember(info)` on session update events). The elapsed label therefore under-reports run duration and can stick at "now" indefinitely for a long-running session — which silently defeats TIME-02, since the whole second-granularity clock exists to animate the working duration.
- **Idle rows:** any post-idle metadata touch (rename, archive) resets `time.updated`, so the age jumps back to "now" instead of measuring time since the session went idle.
- **Waiting rows:** the age measures from the last update rather than from when the permission/form request arrived (the blueprint tracks `requestTimes`; a fallback to `workingSince(session) ?? time.updated` is acceptable if request tracking is out of scope, but the current code does not even do that).

**Fix:** add a pure selector (e.g. `referenceTime(session: SessionInfo, status: SessionRowStatus)`) next to the other pure functions in `session-status.ts`, mirroring `inbox-model.ts since()`:

```ts
export function referenceTime(session: SessionInfo, status: SessionRowStatus) {
  if (status === "working") return workingSince(session) ?? session.time.updated
  if (status === "idle" || status === "unread" || status === "failed")
    return session.time.idle ?? session.time.updated
  return workingSince(session) ?? session.time.updated // approval/input: request time if tracked
}
```

(`workingSince` can be re-implemented in the pure module or imported; it is a 6-line pure function.) Then `age()` calls `elapsedBucket(referenceTime(props.session, value), props.now(value))`. This keeps the component thin and the rule unit-testable alongside `elapsedBucket`.

### F-02 (low): `working` registry never shrinks

**Evidence:** `sidebar.tsx:104` creates `const [working, setWorking] = createStore<Record<string, boolean>>({})` and `sidebar.tsx:118` registers `setWorking(sessionID, value)`. `SessionRow` unregisters with `onWorkingChange(id, false)` (`session-row.tsx:112`), which stores an explicit `false` — the key is never deleted. Every session ever expanded leaves a permanent entry, and `Object.values(working).some(Boolean)` (`sidebar.tsx:107`) scans a growing proxy. Over a long-lived window this is unbounded growth proportional to sessions viewed, not sessions present.

**Fix:**

```ts
const setRowWorking = (sessionID: string, value: boolean) =>
  setWorking(sessionID, value ? true : undefined) // undefined deletes the key in Solid stores
```

with the store typed `Record<string, boolean | undefined>`.

### F-03 (low): Unread mark shown on the active row

**Evidence:** upstream `project-session-row.tsx:170` suppresses the unread indicator for the row the user is looking at: `<Show when={status.unread() && !props.active}>`. The new `SessionRow` builds `unread` into the status with no `active` guard (`session-row.tsx:93,101`), so the active session renders a success check mark plus the sr-only "Done" label (`sidebar.inbox.status.done`) whenever its root has an unviewed execution result. The mark semantics ("result no client has viewed yet", `notification.tsx:448-450`) make this self-correcting only after the view is reported, so the row the user is actively reading can briefly advertise an unviewed result.

**Fix:** exclude unread when active, matching upstream:

```ts
const unread = !props.active && serverCtx.notification.session.unread(sessionID, props.session)
```

### F-04 (low): Second-granularity clock has almost no observable effect

**Evidence:** TIME-02 (`sidebar.tsx:96-116`) runs a 1-second interval while any row is working, and `now()` routes working rows to `clock.second`. But the label pipeline never renders anything finer than the "now" bucket: `elapsedBucket` (`session-status.ts:34`) collapses everything <60s to `{ kind: "now" }`, and `age()` renders the static `sidebar.inbox.time.now` string for that bucket (`session-row.tsx:118`). The only visible effect of the entire second-level timer is flipping "now" → "1m" at the 60-second boundary (which the minute timer would also do within its own interval). Meanwhile the blueprint renders live seconds for working rows (`inbox.tsx:614`: `language.plural("sidebar.inbox.elapsed.seconds", seconds)`), and those keys already exist in `en.ts:811-812` — using them would not violate the "no new i18n keys" constraint.

**Fix:** either render `language.plural("sidebar.inbox.elapsed.seconds", seconds)` for working rows under 60s (blueprint parity, gives the second clock its purpose), or add a comment in `sidebar.tsx` stating the second tick exists only for the bucket-boundary flip.

## Dispositions (orchestrator, 2026-11-17)

| ID | Disposition | Rationale |
|----|-------------|-----------|
| F-01 | **Rejected** | TIME-01 需求与蓝本 `projects.tsx` 的 `age()`（行 290：`inbox.now(entry.status) - entry.session.time.updated`）都以 `time.updated` 为基准；`since`/requestTimes 是 Inbox 视图的「Working {{duration}}」状态标签（STAT-04，本里程碑显式延期），不进入 projects/workspace 行年龄。 |
| F-02 | **Fixed** | `working` store 改 `Record<string, boolean \| undefined>`，`false` 写 `undefined` 删 key，注册表随行收缩。 |
| F-03 | **Fixed** | active 行抑制 unread（`!props.active && …`），与 upstream `ProjectSessionRow` 的抑制行为一致。 |
| F-04 | **Rejected** | 蓝本 projects 行渲染同样无秒级文案（秒级 `elapsed.seconds` 属于 Inbox 状态标签，见 F-01）；已在 `sidebar.tsx` 时钟注释中说明秒级 tick 的可见效果（working 行 now→1m 边界翻转）。 |

## Notes

Reviewed all four scoped files plus the upstream blueprint files for cross-module facts. Verified correct and *not* flagged:

- Priority order `failed > approval > input > working > unread > idle` is implemented exactly as the deliberate product decision states; the if-chain in `sessionRowStatus` matches and the tests prove every pairwise precedence.
- `elapsedBucket` boundary math (60/3600/86400), negative-diff clamp, and the test table's boundary cases (59/60, 3599/3600, 86399/86400) are all correct.
- All i18n keys used (`sidebar.inbox.time.now`, `sidebar.inbox.elapsed.minutes|hours|days`, `sidebar.inbox.status.approval|input|working|failed|done`) exist in `en.ts`; `language.plural` receives only a typed plural base key; no hardcoded user-visible English.
- All icon names (`close`, `circle-exclamation`, `help`, `check`) exist in the icon catalog; mark colors use only `text-v2-state-fg-*` semantic tokens; the `ActivityRing` inline `var(--v2-state-fg-info)` is the documented exception.
- Status inputs (`sessionRequests` with family-wide root scan, `sessionBusy` over `[id, ...family(id)]`, `notification.session.unread`, `outcome === "failed"`) match the APIs used by `project-avatar-state.ts` / `inbox-model.ts`; busy-check equivalence with the tab avatar's `running()` holds because `family()` is the established upstream pattern (`tab-strip.tsx:472`).
- The working-registration effect (`session-row.tsx:107-113`) balances register/unregister across status transitions and unmount; keyed `Key by={session.id}` remounts prevent ID-reuse hazards; the second timer is created/disposed correctly in `sidebar.tsx:106-114`.
- Delete/rename/export menu, `queryClient` optimistic removal, and `notifySessionTabsRemoved` are byte-equivalent to upstream `ProjectSessionRow` and inherit its behavior deliberately.
- No writes to upstream `shell/` files; all reuse is import-only, as the fork rules require.
- No security issues found (no injection surface, no secrets, no `[SecureContext]` APIs).
