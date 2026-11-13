---
phase: 01
review: 01-REVIEW.md
titles: json
findings:
  - id: WR-01
    severity: warning
    disposition: open
    title: "`fetchedAt` is the last cache write time, not the fetch time, so local writes silently tighten the new floor"
  - id: WR-02
    severity: warning
    disposition: open
    title: "The floor compares the client's wall clock with the server's timestamp, and no comment says so"
  - id: WR-03
    severity: warning
    disposition: open
    title: "The Inbox now passes `fetchedAt`, and no case pins that the merge ignores it"
  - id: WR-04
    severity: warning
    disposition: open
    title: "The wiring line has no automated regression, and both manual checks were left unrun"
  - id: WR-05
    severity: warning
    disposition: open
    title: "A test case duplicates an existing one exactly"
  - id: IN-01
    severity: info
    disposition: open
    title: "Impossible-state guard — an empty page with no fetch time cannot occur for the only bounded caller"
  - id: IN-02
    severity: info
    disposition: open
    title: "`includeArchived`'s doc comment still states the opposite of the only caller"
  - id: IN-03
    severity: info
    disposition: open
    title: "A failed page request still widens the window to every known root, and the new floor does not apply"
  - id: IN-04
    severity: info
    disposition: open
    title: "The all-archived fixture guards a page shape the request cannot produce, and its parity case cannot fail"
  - id: CR-01
    severity: critical
    disposition: fixed
    title: "An empty fetched page drops sessions created after the fetch, and nothing refetches them"
  - id: CR-02
    severity: critical
    disposition: fixed
    title: "`Lint changed files` (CI) fails on the delivered tree"
  - id: IN-05
    severity: info
    disposition: open
    title: "The all-archived fixture's comment describes a request that can no longer happen"
open: 10
total: 12
recorded: 2026-11-13T11:26:00.000Z
---

# Phase 01: Code Review Disposition

| Finding | Severity | Disposition | Source |
|---------|----------|-------------|--------|
| WR-01 | warning | open | - |
| WR-02 | warning | open | - |
| WR-03 | warning | open | - |
| WR-04 | warning | open | - |
| WR-05 | warning | open | - |
| IN-01 | info | open | - |
| IN-02 | info | open | - |
| IN-03 | info | open | - |
| IN-04 | info | open | - |
| CR-01 | critical | fixed | closed by plan 01-04: empty page bounded by fetch time; 19/19 unit cases pass |
| CR-02 | critical | fixed | closed by plan 01-04: `bun script/lint-changed.ts db7df8d999` exits 0 |
| IN-05 | info | open | - (not in the current review) |

Dispositions: `open` (recorded, not yet triaged), `fixed`, `skipped`, `deferred`.
Set `deferred` by hand and put the reason in the Source cell; both are preserved. A `|` in the reason is kept as prose and escaped on the next run.
Re-running the gate keeps every row it can. A row the current review no longer reports is kept and its Source cell flagged, so a finding does not leave this record silently.

Note: the current review renumbered findings, so prior WR-01..WR-03 and IN-01..IN-04 now name different findings; their recorded decisions were dropped rather than carried onto the new findings. Prior IN-03 (bench inventory) and IN-04 (survivor predicates) are outside this plan's scope. WR-01 here is a new, incomplete-fix finding on the `dataUpdatedAt` source, not the prior duplicate-test one.
