# Phase 08: Review Fix Disposition

**Review:** `08-REVIEW.md` (1 warning, 3 info, 0 critical)
**Fixed:** 2026-11-22

| ID | Severity | Disposition | Change |
|----|----------|-------------|--------|
| WR-01 | warning | **fixed** | `registry.ts`: each `expanded` value is wrapped in `Schema.catchDecoding(() => Option.none())`, so one malformed entry is dropped while valid siblings remain. Test now decodes `{ "d:/code/app": true, bad: "true" }` and expects `{ "d:/code/app": true }`. |
| IN-01 | info | **fixed** | `store.ts`: collapse deletes the key (`produce` + `delete`) instead of persisting `false`; `remove()` also prunes that directory's fold key. The map no longer grows per collapse/removed workspace. |
| IN-03 | info | **fixed** | `sidebar.tsx`: one derived `open = expanded && !unavailable` drives `aria-expanded`, the chevron rotation, and the content gate, so a restored-but-unavailable row announces folded and stays consistent. |
| IN-02 | info | **narrowed verification** | No desktop e2e exists; the async IPC hydration path is shared with the already-shipped `entries`/`scrollTop` in the same document. `08-VERIFICATION.md` now states this explicitly and keeps the user's next-restart observation instead of claiming desktop coverage. |

## Verification after fixes

| Command | Result |
|---------|--------|
| `bun test --conditions=solid --isolate --preload ../ui/test/solid-jsx.ts --preload ./happydom.ts ./src/workspace-sidebar` | 148 pass / 0 fail |
| `bun check --no-script src/workspace-sidebar/{registry,registry.test,store}.ts src/workspace-sidebar/sidebar.tsx e2e/regression/home.spec.ts` | ✓ No type errors |
| `PLAYWRIGHT_PORT=4319 bun run test:e2e:built -- e2e/regression/home.spec.ts -g "fold state"` | 1 passed (49.7s) |
| Same e2e with `--repeat-each=10 --workers=5 --retries=0` (pre-fix baseline) | 10 passed (1.1m) |
