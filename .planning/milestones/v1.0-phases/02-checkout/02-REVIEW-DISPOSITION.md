---
phase: 02
review: 02-REVIEW.md
titles: json
findings:
  - id: WR-01
    severity: warning
    disposition: open
    title: "Removing a project no longer survives the inventory load — its checkout rows return and Restore becomes a no-op"
  - id: WR-02
    severity: warning
    disposition: open
    title: "A failed inventory read is never retried for the life of the mount, so D-04's \"reconnect\" recovery path does not exist"
  - id: IN-01
    severity: info
    disposition: open
    title: "Two servers exposing the same checkout path still produce identical labels"
  - id: IN-02
    severity: info
    disposition: open
    title: "The \"moves a session into a deeper checkout\" test cannot fail on the pre-fix code and restates existing cases"
  - id: IN-03
    severity: info
    disposition: open
    title: "The perf harness comment claims every pass pays the root-set dedupe, but the memo makes that once per module load"
  - id: IN-04
    severity: info
    disposition: open
    title: "\"sandboxes never carries the canonical directory\" is an unenforced invariant"
open: 6
total: 6
recorded: 2026-11-13T09:45:00.000Z
---

# Phase 02: Code Review Disposition

| Finding | Severity | Disposition | Source |
|---------|----------|-------------|--------|
| WR-01 | warning | open | - |
| WR-02 | warning | open | - |
| IN-01 | info | open | - |
| IN-02 | info | open | - |
| IN-03 | info | open | - |
| IN-04 | info | open | - |

Dispositions: `open` (recorded, not yet triaged), `fixed`, `skipped`, `deferred`.
Set `deferred` by hand and put the reason in the Source cell; both are preserved. A `|` in the reason is kept as prose and escaped on the next run.
Re-running the gate keeps every row it can. A row the current review no longer reports is kept and its Source cell flagged, so a finding does not leave this record silently.

Code review is advisory in this workflow and never blocks the phase. WR-01 and WR-02 are lifecycle issues around *removal* and *failed reads* — both are pre-existing behaviours that this phase's mount-time inventory read makes easier to reach, and both have fix sketches in `02-REVIEW.md`; they are left `open` rather than silently fixed inside a verification pass.
