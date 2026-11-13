# Phase 2 — UI Review

**Audited:** 2026-11-13
**Baseline:** `.planning/phases/02-checkout/02-UI-SPEC.md` (status: approved, 0 BLOCK / 2 FLAG addressed)
**Screenshots:** not captured — no dev server answered on `localhost:3000`, `5173`, `8080`, `4096` or `4444` (`000` on all five). Code-only audit; runtime evidence is reused from `02-UAT.md` §Agent-Run Evidence (CDP request log, a11y row snapshot, fault-injection proxy DOM assertions) instead of re-running the app, per this session's constraint.
**Interaction captures:** off (`workflow.ui_interaction_capture` is false)

**Scope of the shipped surface:** this phase has **zero visual delta**. `git diff 7a61e6550f..HEAD` touches 6 files; the only user-visible file is `packages/app/src/shell/titlebar/projects.tsx`, and its 27 added lines are a single `createEffect` (`:69-94`) with no JSX, no class, no token, no i18n key. `projects-groups.ts` is a pure function; the remaining four files are tests, perf harness and a design-doc line. Every pillar below therefore grades **the audited surface against the contract**, not a new visual design, and pillars with no delta say so explicitly.

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 3/4 | All 16 contract strings byte-identical; the group total count is an unlabeled bare number in the accessible name (`projects.tsx:615`), and the approved removal toast's promise is contradicted by the linked-worktree path |
| 2. Visuals | 3/4 | No JSX delta and all 11 element rows match; two rows can still render byte-identical labels when two servers expose the same checkout path (`projects-groups.ts:63-89`) |
| 3. Color | 4/4 | 0 hex/rgb literals; accent only on the 5 status marks plus one destructive menu item; hover/pressed/focus are overlay-only; `ActivityRing` keeps its inline `--v2-state-fg-info` |
| 4. Typography | 4/4 | Exactly the 4 declared sizes (14/13/12/11) and 2 weights (400/500); every 13px pairs with `leading-4`; `dir="auto"` on both truncating labels |
| 5. Spacing | 4/4 | 32px group rows, 28px session rows, documented 2/6/12/26px exceptions only; no undeclared arbitrary spacing |
| 6. Experience Design | 2/4 | Removal does not survive the inventory load (row returns, Restore is a no-op); a failed read is never retried for the mount; the spec's `partial` backstop is unmet and was never observed |

**Overall: 20/24**

**BLOCKER: none.** No pillar scores 1 and no audited flow fails to complete in the happy path (the UAT runtime evidence shows 4 rows from 3 project IDs with 3 inventory GETs and no `refresh`). Both pillar-6 defects are recoverable from the UI or from the next mount, so they are classified **WARNING**.

Registry audit: skipped — `components.json` does not exist (SolidJS project, no shadcn); all components come from the in-repo `@opencode/ui` and `@dnd-kit/solid`, and `02-UI-SPEC.md` §Registry Safety lists no third-party block.

---

## Top 3 Priority Fixes

1. **A removed project comes back, and its Restore does nothing** — `projects.tsx:111` keys removal by checkout key, while `projects-groups.ts:23-27` now admits `sandboxes` and `projects.tsx:75-94` loads the inventory **after first paint on every mount**. Result, on every app start for any project with linked worktrees: the removed project's sessions re-key to `/repo/.worktrees/feature`, a named row reappears outside `removed`, `removedProjects()` keeps a phantom `count: 0` entry (`:209-213`), and Restore (`:468`) un-removes a key no session uses. The toast copy at `:277-279` promises "They now appear under Ungrouped" — visibly false. Concretely: treat "this project's canonical key is removed" as "project removed" when remapping (`projects.tsx:52-60` of `02-REVIEW.md` has the patch), reconcile the stale canonical entry in `removedProjects()`, or record the alternative in `docs/designs/project-grouped-sessions-sidebar.md` and point Restore at the live row. **Impact:** an undo affordance that is a visible no-op and a project the person explicitly removed reappearing as a normal row.
2. **One failed inventory read disables the whole phase for that mount** — `projects.tsx:85-92` claims `${server}\0${projectID}` **before** `cached()`/`list()` and never releases it; the effect does not track connection state, and `list` swallows failures (`workspaces/inventory.ts:57`). `sync.tsx:104-118` reconnects with `refetchType: "none"` and `worktree.updated` needs a server event, so D-04's documented "重连失效" recovery does not exist. For a project that was never V1-migrated `sandboxes` is `[]` (`packages/core/src/project/sql.ts:56`), so an offline start leaves every checkout permanently collapsed into the canonical row — the exact "一个 checkout 裂成多行" intermediate state this phase removes — with no loader, no toast and no retry. Concretely: read `entry.ctx.sdk.connection.status()` inside the effect and `requestedWorktrees.delete(key)` while not connected (`02-REVIEW.md` WR-02 has the patch). **Impact:** one unlucky first request turns a transient failure into the whole session's grouping.
3. **The `partial` backstop cannot hold, and nothing measures the transition** — on a fresh project (`sandboxes: []`), before the first inventory response, sessions in a **sibling clone** each own a row and then merge when inventory lands (row count **decreases**), while sessions in a **nested** worktree all collapse onto the canonical row and then split (a row **appears**). Both contradict the spec's `partial` resolution "行数与 group key 必须完全相同；…不得…改标签", and `02-UAT.md` §Tests 3 records `行数不减少` as a passing expectation — true only on its migrated 24-worktree dataset, which contains no session in a checkout subdirectory at all. Concretely: restate the `partial` row and UAT 3 to the bound the code can hold (`sandboxes`-backed equality; a documented transitional window for fresh projects), then instrument it — a frame capture of first paint → inventory arrival on a two-clone fixture, or an e2e keeper on that path. **Impact:** the phase's headline behavior is currently proven only by a unit test, on data where it cannot be seen.

---

## Invariant Conformance (UI-SPEC §本阶段范围与不变量)

| # | Invariant | Verdict | Evidence |
|---|-----------|---------|----------|
| I-1 | 一行 = 一份本地 checkout; key = `${server}\u0000${comparablePath(checkout)}` | **Met** (unit + runtime) | `projects-groups.ts:56` unchanged by the diff; 4 rows / 3 project IDs with `pup-android` split into `02-Spain` + `pup-android-msg-0070-0080` (`02-UAT.md` §Agent-Run Evidence) |
| I-2 | 行源只由 `inbox.entries()` 推导 | **Met** | `groups()` still iterates `inbox.entries()` only (`projects.tsx:99-178`); the effect writes nothing (`:75-94`); no empty checkout row can appear (authority: design doc §已知取舍 4) |
| I-3 | 清单读取不产生用户可观察状态 | **Met** (runtime) | No loader/skeleton/toast/error on the 503 path: `toasts: []`, `loaderCount: 0`, `alerts: []`, 4 rows still rendered (`02-UAT.md` §Tests 2) |
| I-4 | 每 `server+projectID` 每挂载期 ≤1 `list`；缓存命中零请求；永不 `refresh` | **Partially verified** | Cold start: 3 project IDs → 3 GET, no `POST /api/worktree/refresh` (`02-UAT.md` §Agent-Run Evidence). `refresh` appears 0 times and `global.serverCtx` 0 times in `projects.tsx` (grep). The cache-hit branch (mode switch) was **not** executed — see E4. |
| I-5 | 清单到达不改写已有 checkout 的身份 | **Met** | key expression and `directoryGroupLabels` untouched by the diff; `inventoried`/`sandboxesOnly` equality pinned by `projects-groups.test.ts:57-79` |
| I-6 | 清单缺失是正常状态，按 `worktrees ∪ sandboxes ∪ worktree` 兜底 | **Met for migrated projects; not for fresh ones** — see E3 | `projects-groups.ts:23-27`; `sandboxes` is `[]` at creation (`packages/core/src/project/sql.ts:56`) |
| I-7 | 文案、字号、间距、颜色、滚动容器与交互行为一律不变 | **Met** | diff has no JSX/class/i18n hunk; `data-slot` / `data-scrollable` / scroll restore (`:316-367`) untouched |

## UI Considerations (8 rows)

| Category | Status | Audit result |
|----------|--------|--------------|
| empty | ✅ covered | `projects.tsx:371-385` — `No sessions yet` only when `groups().length === 0` and `inbox.loading()` is false; single line, no heading, no CTA, exactly as contracted |
| loading | ✅ covered | only `inbox.loading()` gates the `Loader` (`:382`); the inventory effect adds none, and the 503 run proves it at runtime |
| error | ✅ covered in the failure UI, **broken in recovery** | silent degrade verified (no toast/retry/`aria-live`); D-04's reconnect recovery does not exist → E2 |
| populated | ✅ covered | 4 rows / 3 project IDs; two clones are two rows; `Show {{count}} more` at 5 (`SESSIONS_PER_PROJECT`, `:32`) |
| partial | 🧪 **backstop not met, and not observed** | row set/count changes on inventory arrival for fresh projects → E3 |
| overflow | ✅ covered | `min-h-0 flex-1 overflow-y-auto overflow-x-hidden` + `data-scrollable` (`:387-395`); 5-per-group fold; `truncate` everywhere |
| zero-one-many | ✅ covered | 0 → empty state; 1 → 32px row; many → 32px rows, `mb-1`; plurals go through `language.plural` (`:294-298`, `:461`, `:549`) |
| long-text | ✅ covered | `truncate` + `dir="auto"` on group label (`:584`) and session title (`:667`); `directoryGroupLabels` escalation; `session.tab.session` fallback (`:670`) |

---

## Detailed Findings

### Pillar 1: Copywriting (3/4)

No copy was added, changed or removed (`git diff --stat 7a61e6550f..HEAD -- packages/app/src/runtime/i18n` is empty). Every string in the contract table resolves to the same English source:

- `sidebar.projects.empty` = `No sessions yet` — `en.ts:819`
- `sidebar.projects.more.one/.other` = `Show {{count}} more` — `en.ts:820-821`
- `sidebar.projects.status.attention/failed/working` — `en.ts:822-827`
- `sidebar.projects.ungrouped` / `rename` / `remove` / `remove.description` / `removed` / `restore` / `removedMenu` — `en.ts:828-836`
- `common.loading`, `common.moreOptions`, `session.tab.session` — `en.ts:326`, `:756`, `:610`

**A1 — WARNING (pre-existing, not a regression).** `projects.tsx:615` renders the group's total session count as `{entries().length}` inside the group button, with no `sr-only` companion, while each state badge deliberately gets one (`:611`). The accessible name of the row becomes e.g. "opencode · 3 sessions need you · 26", where "26" has no referent. The spec only requires sr-only copy for *states* (`§元素与视觉源` 组徽标 row), so this is an abstract-standards gap rather than a contract violation. Fix: wrap the total in `<span class="sr-only">{language.plural("sidebar.projects.sessionCount", entries().length)}</span>` plus the visible `aria-hidden` number, or reuse the existing `removedMenu`-style count pairing.

**A2 — WARNING (state-dependent truth of approved copy).** The undo toast at `projects.tsx:275-282` says the removed project "stays on disk with all of its sessions. They now appear under Ungrouped." In the linked-worktree path that statement is false within one round trip: the sessions reappear under a named checkout row (E1). The string is contract-correct and must not be reworded; the state has to be fixed to match it. Counted here only once, and referenced from Pillar 6.

### Pillar 2: Visuals (3/4)

**No delta.** The only visible-file change is `projects.tsx:69-94` (a `createEffect` with no JSX). All 11 rows of §元素与视觉源 were checked line by line against the code and match: `sidebar-projects` `:370`, scroll container `:392-394`, `sidebar-projects-group` + drag `opacity-60` `:558-560`, header row `:562`, `sidebar-projects-project` + `aria-expanded` `:566-568`, group label `:585`, badge block `:589-616`, `sidebar-projects-session` `:661-663`, session title `:668`, status marks `:704-726`, age `:676`, `sidebar-projects-more` `:690-691`, empty state `:377`, removed menu `:452-463`, more-options `IconButton` `:625-631`.

Hierarchy is intact: 14px/500 group label → 13px/400 session title → 11px muted meta, with the accent confined to status marks, so scanning lands on attention/failed before titles. The one icon-only control carries `aria-label={language.t("common.moreOptions")}` (`:630`).

**V1 — WARNING (pre-existing).** `directoryGroupLabels` (`projects-groups.ts:63-89`) disambiguates duplicates as title → `title · parent` → `title · comparablePath(directory)` and then stops. Two groups whose full directory is identical — the same checkout served by two servers, which this phase makes more common because inventory-derived rows are per checkout — render **byte-identical labels** on two separate rows, so neither the drag handle nor the "reveal in file manager" menu can be told apart visually. The function's own comment (`:59-62`) claims the full directory is the final disambiguator, which is only true when directories differ. Fix: add a server-derived suffix as the last step, or document that labels are unique per directory and not per row.

**Evidence limit:** with no dev server, hierarchy/interaction claims are class-level and are corroborated by the UAT a11y snapshot (four labels, two of them the disambiguated `pup-android · 02-Spain` / `pup-android · pup-android-msg-0070-0080` pair). Nothing about spacing rhythm or color legibility was observed as pixels this session.

### Pillar 3: Color (4/4)

**No delta; full conformance.** 20 token usages in the file, all `--v2-*` semantics:

- Dominant: no background class on `projects.tsx` (`:370`); inherited from the shell, as contracted.
- Secondary: `bg-v2-background-bg-layer-02` on the group header only (`:562`).
- Accent, restricted to the five declared status marks: warning dot + count (`:600`, `:605`), danger dot (`:601`), `ActivityRing` info (`:609`, `:710`), `circle-exclamation` warning (`:713`), `help` warning (`:716`), `close` danger (`:719`), `check` success (`:722`). Plus the single destructive menu item (`:641`).
- Neutral layers: hover `--v2-overlay-simple-overlay-hover` (`:457`, `:562`, `:568`, `:663`, `:691`), pressed/selected `--v2-overlay-simple-overlay-pressed` (`:663`), muted text `:377`, `:471`, `:615`, `:676`, `:691`, muted icon `:576`, border `:452`.
- `ActivityRing` keeps `style={{ color: "var(--v2-state-fg-info)" }}` (`:609`, `:710`) — the required exception, since its unlayered CSS beats utilities.
- **0** hex literals, **0** `rgb(` in the file.

That is the 60/30/10 split the contract declares, with accent under 10% and no accent on hover/focus.

**Minor observation (not scored):** `docs/designs/project-grouped-sessions-sidebar.md` §已知取舍 2 still says the inline `ActivityRing` color is `--v2-icon-icon-base` at 3 call sites; the code uses `--v2-state-fg-info` at 2 (`:609`, `:710`), which is what the UI-SPEC requires. The doc sentence is stale, not the code.

### Pillar 4: Typography (4/4)

**No delta; full conformance.** Distinct sizes: `14px` (`:585`), `13px` (`:377`, `:668`), `12px` (`:457`, `:691`), `11px` (`:471`, `:605`, `:615`, `:676`). That is exactly the four declared roles and nothing else. Distinct weights: `font-medium` on the group label only (`:585`); everything else inherits 400 — no 600+ anywhere, so IBM Plex Mono Bold is never triggered.

- Every 13px is paired with `leading-4` (`:377`, `:668`), so descenders cannot clip in the `truncate` containers (`packages/ui/AGENTS.md` §Typography).
- `tracking-[-0.04px]` appears only on the 14px label (`:585`) and the 13px title (`:668`), as contracted.
- 11px meta carries no `leading-*` and inherits the 16px row box (`:605`, `:615`, `:676`), matching the Micro role.
- `dir="auto"` is on both truncating strings (`:584`, `:667`); no `dir="ltr"` in the file.

### Pillar 5: Spacing (4/4)

**No delta; full conformance.** Vertical rhythm is the contracted one: group header `h-8` = 32px (`:562`, `:568`, `:457`), session row and Show more `h-7` = 28px (`:663`, `:691`), group gap `mb-1` = 4px (`:559`).

Arbitrary values in the whole file are exactly the declared exception set — `mt-0.5` 2px (`:651`), `gap-0.5` 2px (`:562`), `px-1.5` / `ps-1.5` / `gap-1.5` 6px (`:457`, `:568`, `:589`, `:672`), empty-state `py-3` 12px (`:377`), `ps-[26px]` (`:663`, `:691`), plus the type/radius tokens `text-[11|12|13|14px]`, `rounded-[5px]`, `rounded-[6px]`, `tracking-[-0.04px]`. No undeclared arbitrary spacing, no 44px touch-target change (the 32/28px decision is recorded as a product choice in the spec's exception table).

### Pillar 6: Experience Design (2/4)

State coverage that **is** correct: a single loading gate (`:374-384`), a contract-exact empty state (`:377`), silent failure by design (`workspaces/inventory.ts:57`), non-modal undo for the destructive action (`:269-282`), and the catch-all group is drag-disabled (`:513-516`). The 503 runtime run confirms no toast, no loader, no alert and a complete fallback render.

**E1 — WARNING (destructive confirmation broken).** Removal is stored per checkout key (`projects-state.ts:9-11,28-31`) and `groups()` remaps only keys present in `removed` (`:110-111`). Two phase changes break that pairing together: `projectRoots` now admits `sandboxes` (`projects-groups.ts:23-27`), and the inventory is read from the sidebar **after first paint on every mount** (`:75-94`). On every app start, for a project with linked worktrees: first paint folds the sessions into `Ungrouped` (correct), the inventory lands, the sessions re-key to `/repo/.worktrees/feature`, and a **named project row reappears** while a phantom `count: 0` entry sits in the removed menu (`:209-213`) whose Restore (`:468`) un-removes an unused key. The root cause (per-checkout key + per-key removal) predates the phase, but the phase's own mount-time read makes it reliably reproducible, and it directly contradicts the contract row "Destructive confirmation" plus `projects-state.ts:9-11` ("a finished project does not return the next time it is used"). Fix and patch sketch: `02-REVIEW.md` WR-01.

**E2 — WARNING (error recovery does not exist).** `projects.tsx:85-92` claims `${server}\0${projectID}` before `cached()`/`list()` and never releases it; the effect neither tracks `connected()` nor re-runs on connection change; `list` swallows failures. With `sync.tsx:104-118` invalidating with `refetchType: "none"` and `worktree.updated` requiring a server event, a first read taken while disconnected (offline start, backend restart) leaves `cached()` undefined and the claim permanent for that mount. Because `sandboxes` is `[]` for projects that were never V1-migrated (`packages/core/src/project/sql.ts:56`), all of that project's checkouts stay merged into the canonical row until the person switches modes — no loader, no toast, no retry, no hint. D-04 names "重连失效" as the recovery path; the code has none. Fix and patch sketch: `02-REVIEW.md` WR-02 (`home/machine.ts:278-284` already does the equivalent correctly for the same query).

**E3 — WARNING (the `partial` backstop is unmet and was never observed).** The spec's row reads: "同一批会话产出的 project row 集合、行数与 group key 必须完全相同；清单到达不得让已有行闪烁、改标签或改顺序." On a fresh project (`sandboxes: []`) that cannot hold in either direction:

- sessions in a **sibling clone** (`D:/branch/app/packages/ui`) each own a row before inventory and merge into one `D:/branch/app` row after → row count **decreases**;
- sessions in a **nested** worktree (`repo/.worktrees/feature/src`) all sit on the canonical row before inventory and move to their own row after → a row **appears** and the canonical count drops.

`02-UAT.md` §Tests 3 asserts `行数不减少` and marks it pass, but its dataset (34 projects / 2745 sessions / 24 worktrees, all sessions at checkout roots) contains **no** session in a checkout subdirectory — UAT records that explicitly, so CHK-02's headline behavior has only ever been proven by `projects-groups.test.ts`, and the first-paint → inventory transition was never instrumented ("CDP 侧没有可用的帧级采样"). This is the one place where the approved contract and the shipped code disagree, and the person's original complaint (4–9 projects, one checkout splitting into several rows) lives in exactly that window.

**E4 — evidence gap (not a defect).** I-4's cache-hit branch ("切到 Inbox 再切回 Projects 不新增请求") was not executed; `02-UAT.md` §Tests 1 says so and points at the unit/code-review fallback. The code path is unambiguous (`cached()` before `list()`, `:90-92`), so this lowers confidence rather than the score.

---

## Files Audited

- `packages/app/src/shell/titlebar/projects.tsx` (element table, color/type/spacing classes, effect `:69-94`, copy call sites, state coverage)
- `packages/app/src/shell/titlebar/projects-groups.ts` (roots, dedupe, key expression, label escalation, WeakMap memo)
- `packages/app/src/shell/titlebar/projects-groups.test.ts` (12 cases; dual-path key equality owner)
- `packages/app/src/shell/titlebar/projects-state.ts` (removed/order persistence)
- `packages/app/src/workspaces/inventory.ts` (`cached`/`list`/`refresh`, `staleTime`, `withWorktreeInventory`)
- `packages/app/src/runtime/server/sync.tsx` (`updated` write-back, reconnect invalidation)
- `packages/app/src/runtime/server/global-sync/utils.ts` (`normalizeProjectInfo`, `updateProjectInfo`)
- `packages/core/src/project/sql.ts` (`sandboxes: []` at project creation)
- `packages/app/src/runtime/i18n/en.ts` (16 contract strings)
- `packages/app/perf/projects-groups.ts`, `packages/app/perf/projects-groups.bench.ts` (shipped, no UI surface)
- `docs/designs/project-grouped-sessions-sidebar.md` §已知取舍 (D-10/D-11 record, §已知取舍 2 color drift)
- `git diff 7a61e6550f..HEAD` (zero-visual-delta proof), `git status --porcelain` (no uncommitted UI edits)
- `.planning/phases/02-checkout/02-UI-SPEC.md`, `02-CONTEXT.md`, `02-01/02-02-PLAN.md`, `02-01/02-02-SUMMARY.md`, `02-UAT.md`, `02-REVIEW.md` (baseline + runtime evidence)

---

*Phase: 02-checkout · Baseline: 02-UI-SPEC.md (approved) · Code-only audit, no screenshots*
