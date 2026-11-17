---
phase: 01-registry-model
reviewed: 2026-11-14T00:36:00Z
depth: standard
files_reviewed: 2
files_reviewed_list:
  - packages/app/src/workspace-sidebar/registry.ts
  - packages/app/src/workspace-sidebar/registry.test.ts
findings:
  critical: 0
  warning: 3
  info: 5
  total: 8
  necessity: 0
status: issues_found
---

# Phase 01: Code Review Report

**Reviewed:** 2026-11-14T00:36:00Z
**Depth:** standard
**Files Reviewed:** 2
**Status:** issues_found

## Summary

The registry model is small, readable, and every lifecycle rule from §9 is expressed as a pure function. I re-ran the suite (`bun test --conditions=solid --isolate --preload ../ui/test/solid-jsx.ts --preload ./happydom.ts src/workspace-sidebar` → 36 pass / 0 fail), the file-scoped type gate (`bun check --no-script` on both files → 0 type errors), and `bun script/lint-changed.ts` (0 problems); the executor's verification claims hold. I also verified the real persistence path empirically: `Persistence.withInitial(WorkspaceRegistrySchema, initialRegistry)` → `Schema.fromJsonString` round-trips `{ entries, scrollTop }` losslessly, recovers a missing/partial document without throwing, and decodes `initialRegistry` into a fresh object/array, so Phase 2 can mount `persisted(registryTarget(scope), WorkspaceRegistrySchema, initialRegistry)` without mutating the module constant.

No Critical findings. Three Warnings (empty input fabricates a root entry, Windows-only normalization steps run on darwin/linux, and the module's stored spelling is a *client* spelling that the server will not match), plus five Info items. No necessity findings: every guard here defends against a state that the picker/storage contract can actually produce.

The three warnings share one root cause worth naming: the module owns the *identity* of a directory, but its inputs (picker strings, persisted documents) and its outputs (a string Phase 2 feeds verbatim to `session.list`) cross trust and process boundaries, and the existing app-wide path comparators (`comparablePath`, `sameDirectory`) were not consulted when the normalization rules were pinned.

## Warnings

### WR-01: Empty input silently becomes the filesystem root

**File:** `packages/app/src/workspace-sidebar/registry.ts:66-68`
**Resolved:** 2026-11-14 (77266b8e7e) — `register`/`remove` now reject empty, whitespace-only and relative
directories through a `registrable()` guard that reads the raw input before normalization; the list is
returned unchanged and `register`'s `entry` is now `WorkspaceEntry | undefined`.
**Issue:** `normalizeDirectory("", platform)` returns `"/"`, so `register([], { directory: "", platform: "linux" })` creates a real entry `{ directory: "/", title: "/", order: 0 }` (verified by running the module). `directoryKey("")` and `directoryKey("/")` are therefore the same key, and `remove(entries, { directory: "" })` would mask a genuine root entry. The input is a native-dialog result typed as `string | string[] | null` (`Platform` in `packages/app/src/runtime/platform/platform.tsx:8-10,150`), so a cancelled picker coerced to `""` (`directory ?? ""`) registers the root directory as a workspace — a persisted row that lists `/`'s sessions and that the user cannot remove except by registering/removing `/` itself. Nothing in `normalizeDirectory`, `register`, or `remove` rejects a non-absolute or empty directory even though the key is documented as "归一后的绝对路径" (`registry.ts:51-55`).
**Fix:** Reject a directory that is not registrable at the boundary that owns the key. Minimal version:

```ts
function registrable(directory: string, platform: HostPlatform) {
  return platform === "win32" ? /^([A-Za-z]:\/|\/\/)/.test(directory) : directory.startsWith("/")
}

export function register(entries: WorkspaceEntry[], input: { directory: string; platform: HostPlatform }) {
  if (!registrable(normalizeDirectory(input.directory, input.platform), input.platform)) return
  // ...
}
```

and the same early return in `remove`. Add table rows for `["", "linux"]` and `[" ", "linux"]` so the guard is owned by the test that must fail before it (same file, `normalizeDirectory`/`register` tables).

### WR-02: Windows-only normalization runs on darwin/linux and merges distinct POSIX directories

**File:** `packages/app/src/workspace-sidebar/registry.ts:56-69`
**Resolved:** 2026-11-14 (84065d5195) — backslash folding, drive casing and drive-root repair now run only
when `platform === "win32"`; POSIX keeps `\` as a filename character and leaves `C:` unchanged.
**Issue:** Two Windows-shaped rules are applied on every platform:

1. `input.replaceAll("\\", "/")` (line 57) runs unconditionally. `\` is a legal filename character on POSIX, so `normalizeDirectory("/a\\b", "linux")` → `"/a/b"` and `directoryKey("/a\\b", "linux") === directoryKey("/a/b", "linux")` (verified by running the module). Two distinct macOS/Linux directories collapse into one registry row; whichever spelling registered first is persisted and Phase 2 passes it verbatim to `session.list`, so the row shows the other directory's sessions (or none).
2. The drive-root branches at lines 62-64 fire on POSIX too: `normalizeDirectory("C:", "linux")` → `"C:/"`, turning a relative directory named `C:` into a rooted, non-existent path.

This diverges from the repo's canonical comparator, which converts backslashes only when the path looks Windows-shaped (`isWindowsPath` at `packages/util/src/path.ts:48,52`) and whose `sameDirectory`/`containsDirectory` are used by every other app-side directory comparison (`packages/app/src/workspaces/paths.ts:11-31,88-108`, `packages/app/src/runtime/persistence/storage.ts:372-397`). Note this conflicts with the locked step list in `01-CONTEXT.md` ("`\`→`/`" with no platform qualifier); the phase already threads `platform` through every call specifically so behavior can vary, and §4.4's intent is Windows-spelling handling.
**Fix:** Gate both steps on the platform that owns them, keeping the UNC prefix logic:

```ts
const fused = fuseSeparators(platform === "win32" ? input.replaceAll("\\", "/") : input)
const cased = platform === "win32" ? upperDrive(fused) : fused
if (platform === "win32" && /^[A-Za-z]:$/.test(cased)) return `${cased}/`
if (platform === "win32" && /^[A-Za-z]:\/$/.test(cased)) return cased
```

Add rows `["darwin", "/Users/me/a\\b", "/Users/me/a\\b"]` and `["linux", "C:", "C:"]`. With WR-01's absoluteness guard, the `"C:"` POSIX case becomes a no-op instead of a bogus `C:/` entry, which is the correct outcome.

### WR-03: `entry.directory` is a client spelling, and the contract does not say so

**File:** `packages/app/src/workspace-sidebar/registry.ts:51-58`
**Issue:** The comment justifies only the drive-root slash ("the server only stores paths matching `^[A-Za-z]:/`"), which reads as a guarantee that the stored spelling matches the server's. It does not. The server preserves the caller's case (`storagePath` only replaces backslashes; no drive case change — `packages/core/src/database/path.ts:6-13`, `canonical` uses `path.win32/posix.normalize` — `packages/core/src/location-service-map.ts:38-48`), while this module explicitly uppercases the drive (line 58). `session.list` filters by raw equality (`packages/core/src/session/store.ts:151`), so a folder first opened from a lowercase-drive path (`opencode d:\code\app` → sessions stored and returned as `d:/code/app`, `fromDriver`/`toPlatform` at `packages/core/src/database/path.ts:27-30,61-63`) will never match the registry's `D:/code/app`: the row renders with 0 sessions and no error. The design names the mitigation (§4.4 optional enhancement 4 = REG-04 reconciliation) and `01-SUMMARY.md:171` defers it to Phase 2, but nothing in this module tells that consumer that verbatim equality is wrong — and Phase 2's `sessionID → directory` map (§5.6) receives *platform-spelled* directories (`d:\code\app` on a Windows server) that also must be normalized before comparison.
**Fix:** Do not change the normalization (locked). Extend the comment so the consumer contract is explicit, e.g.:

```ts
/**
 * ...
 * `entry.directory` is a client spelling, not the server's: the server keeps the caller's case and
 * returns rows in platform form, while `session.list` matches `directory` by exact equality. Phase 2
 * must compare through `directoryKey(normalizeDirectory(...))` on both sides and must implement
 * REG-04 reconciliation before a row can be trusted to list the sessions of its directory.
 */
```

and make REG-04 a stated Phase 2 exit criterion rather than an optional enhancement.

## Info

### IN-01: Redundant root branch in `normalizeDirectory`

**File:** `packages/app/src/workspace-sidebar/registry.ts:60`
**Issue:** `if (cased === "/") return "/"` is unreachable-in-effect duplication: `trimTrailingSeparators("/")` returns `""` and line 68 already maps `""` to `"/"`. Unlike the drive-root branches at 62-64 (which are load-bearing, because trimming `"C:/"` would yield `"C:"`), this branch changes nothing.
**Fix:** Delete line 60; the table row `["linux", "/", "/"]` already proves the behavior survives.

### IN-02: A restored entry keeps an own `removedAt: undefined` key

**File:** `packages/app/src/workspace-sidebar/registry.ts:97`
**Issue:** `{ ...existing, removedAt: undefined }` creates the key with an `undefined` value rather than omitting it. `Schema.encodeSync(WorkspaceRegistrySchema)` preserves that own key (verified), so only `JSON.stringify` inside `persisted` removes it — the persisted bytes are correct today, but the in-memory shape differs from a freshly created entry, and the round-trip test only pins an entry that never had the key (`registry.test.ts:193`), so a regression to a shape that *does* serialize `removedAt` would pass.
**Fix:** Omit the key when restoring (`const { removedAt: _removed, ...rest } = existing`) and add the restored case to the document round-trip assertion.

### IN-03: `REGISTRY_KEY` is exported but has no consumer

**File:** `packages/app/src/workspace-sidebar/registry.ts:9`
**Issue:** The constant is used only by `registryTarget`; the test deliberately asserts the literal (`registry.test.ts:202`) because the literal is the persisted contract. Exporting it adds public surface that nothing imports and invites a caller to build a persist target by hand instead of using `registryTarget`.
**Fix:** Drop the `export` (keep the constant module-private) or have Phase 2 import it only if it genuinely needs the key outside `registryTarget`.

### IN-04: `visible` non-mutation is not owned by a test

**File:** `packages/app/src/workspace-sidebar/registry.test.ts:168-178`
**Issue:** `visible` filters before sorting, which is correct, but the test only asserts the returned order. If a later edit became `entries.sort(...)`, the test would still pass while the function mutated the caller's array — in Phase 2 that array is the Solid store's `entries`, so an in-place sort would reorder persisted rows outside `setStore`.
**Fix:** Add one line to the same test: `expect(entries.map((entry) => entry.directory)).toEqual(["/b", "/a", "/c"])` (input order unchanged) — this fails on the old logic and costs nothing.

### IN-05: Undocumented alias spellings (`.`/`..`, long-path prefix)

**File:** `packages/app/src/workspace-sidebar/registry.ts:51-55`
**Issue:** The comment documents symlink and 8.3 aliases as accepted residuals but not the two other alias spellings that pass through unchanged: a `.` segment (`normalizeDirectory("C:/a/./", "win32")` → `"C:/a/."`) and a Windows long-path prefix (`"\\\\?\\C:\\x"` → `"//?/C:/x"`). Both are another spelling of an existing directory that registers as a second row.
**Fix:** Add them to the same residual note. No resolution logic is requested — native pickers do not emit either form, and `.`/`..` resolution would be a new normalization step.

---

_Reviewed: 2026-11-14T00:36:00Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: standard_
