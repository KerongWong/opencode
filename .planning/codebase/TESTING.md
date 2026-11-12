---
last_mapped_commit: acdb57123fbf279c585996a507b90f3e79d3e72e
last_mapped_at: 2026-11-12
---
# Testing Patterns

**Analysis Date:** 2026-11-12

Scope: `packages/app/src/shell/titlebar`, `packages/app/src/runtime/server`, `packages/app/src/workspaces`,
`packages/app/src/home`, `packages/app/src/settings`, and `docs/designs`. Test policy comes from
`packages/app/AGENTS.md` ("Tests") and `e2e/AGENTS.md`.

## Test Framework

**Runner:**
- `bun:test`, run with Bun `1.4.4` (`packages/app/package.json`, root `package.json`).
- App unit config: `packages/app/bunfig.toml` sets `[test] root = "./src"` and `preload = ["./happydom.ts"]`.
- Unit script adds Solid conditions and preloads:
  `bun test --conditions=solid --only-failures --isolate --preload ../ui/test/solid-jsx.ts --preload ./happydom.ts ./src`
  (`packages/app/package.json`).
- Browser-condition script: `bun test --conditions=browser --isolate --preload ../ui/test/solid-jsx.ts --preload ./happydom.ts ./test-browser`.

**Assertion Library:**
- Bun's `expect` (`toBe`, `toEqual`, `toMatchObject`, `toContainEqual`, `toHaveLength`, `toBeTrue`,
  `rejects.toThrow`, `resolves.toBeUndefined`).
- No snapshot assertions in the scoped tests; outcomes are asserted explicitly.

**Run Commands:**
```bash
cd packages/app

bun run test:unit          # unit tests under ./src
bun run test:unit:watch    # watch mode
bun run test:browser       # browser-condition tests under ./test-browser
bun run test:e2e           # Playwright e2e (dev server)
bun run test:e2e:built     # Playwright e2e against the built app
bun run test:components    # Playwright component tests (stories)
bun run test:service-worker
bun run test:stability
```

- Never run tests from the repository root. Root `bunfig.toml` points `[test] root` at
  `./do-not-run-tests-from-root`, and the root `test` script exits 1 with "do not run tests from root".
- Default per-test timeout is Bun's 5000 ms. Use a per-test `{ timeout }` only for work that legitimately needs
  longer, with a comment naming the work. Do not hide waits behind larger timeouts or retries.

## Test File Organization

**Location:**
- Unit tests are co-located with the module: `src/shell/titlebar/projects-groups.test.ts`,
  `src/runtime/server/data.test.ts`, `src/workspaces/inventory.test.ts`,
  `src/home/sessions/load-machine.test.ts`, `src/settings/search-machine.test.ts`.
- Browser-condition tests live in `packages/app/test-browser/*.test.ts(x)`.
- Playwright e2e lives in `packages/app/e2e/*.spec.ts`, with area keeper suites under `e2e/regression/`.
- Component tests live in `packages/app/component-tests/*.spec.ts`; URL-mounted fixtures are
  `*.fixture.tsx` in the same folder or beside the component.
- Stories live beside the component as `*.stories.tsx` / `*.standalone.stories.tsx`.

**Naming:**
- Unit test basename equals the module basename: `inbox-settle-machine.ts` →
  `inbox-settle-machine.test.ts`.
- E2E uses `.spec.ts`; component tests use `.spec.ts`; fixtures must not end in `.spec`/`.test`.
- No `__tests__` directories and no separate `test/` tree for app unit tests.

**Structure:**
```text
packages/app/
├── src/
│   ├── shell/titlebar/
│   │   ├── inbox-settle-machine.ts
│   │   ├── inbox-settle-machine.test.ts
│   │   ├── projects-groups.ts
│   │   └── projects-groups.test.ts
│   ├── runtime/server/
│   │   ├── data.ts
│   │   └── data.test.ts
│   ├── workspaces/
│   │   ├── inventory.ts
│   │   └── inventory.test.ts
│   └── settings/
│       ├── search-machine.ts
│       └── search-machine.test.ts
├── test-browser/                  # --conditions=browser
├── e2e/                           # Playwright, mocked server
│   └── regression/                # area keeper suites
└── component-tests/               # Playwright mounts stories
```

## Test Structure

**Suite Organization:**
- Use `describe` for a module with several contracts; use a top-level `test` when each test is one contract
  (`data.test.ts`, `paths.test.ts`, `accounts.test.ts`).
- Titles are behavior sentences in lower case, naming the observable contract and often the regression:
  "a rerun while request checks are in flight does not send them again"
  (`inbox-settle-machine.test.ts`),
  "keeps a removed session hidden after its deletion event, for lists cached before it" (`data.test.ts`),
  "a failed list is not cached and never rejects the caller" (`inventory.test.ts`).

```ts
import { describe, expect, test } from "bun:test"
import {
  INBOX_SETTLE_TIMEOUT_MS,
  INITIAL_INBOX_SETTLE_STATE,
  selectInboxLoading,
  transitionInboxSettle,
  type InboxSettleEvent,
} from "./inbox-settle-machine"

const sync = (serversSettled: boolean, workingKeys: string[], hydrated = true): InboxSettleEvent => ({
  type: "sync",
  hydrated,
  serversSettled,
  workingKeys,
})

describe("inbox settle machine", () => {
  test("a rerun while request checks are in flight does not send them again", () => {
    const first = transitionInboxSettle(INITIAL_INBOX_SETTLE_STATE, sync(true, ["s\0a", "s\0b"]))
    expect(first.effects).toEqual([
      { type: "requests.sync", key: "s\0a" },
      { type: "requests.sync", key: "s\0b" },
      { type: "reveal-timer.start", timeoutMs: INBOX_SETTLE_TIMEOUT_MS },
    ])
  })
})
```

**Patterns:**
- Arrange / act / assert, with a blank line between phases.
- Assert whole structures with `toEqual` for transitions and views:
  `expect(transitionInboxSettle(...)).toEqual({ state: ..., effects: [...] })`.
- Assert no-op identity with `toBe` to prove an inapplicable event returns the same object:
  `expect(transitionInboxSettle(settled.state, { type: "reveal.timed-out" }).state).toBe(settled.state)`.
- Assert state subsets with `toMatchObject` when the contract is one field.
- Build production-shaped events, not impossible payloads (`packages/app/AGENTS.md`).
- Cover every exit: success, failure, timeout, cancel, dispose, and a stale attempt result.

**Machine replay helper:**
```ts
function replay(events: HomeSessionsLoadEvent[], state = INITIAL_HOME_SESSIONS_LOAD_STATE) {
  return events.reduce<{ state: HomeSessionsLoadState; effects: readonly HomeSessionsLoadEffect[] }>(
    (step, event) => transitionHomeSessionsLoad(step.state, event),
    { state, effects: [] },
  )
}
```
(`home/sessions/load-machine.test.ts`, same shape in `settings/rename-machine.test.ts`.)

**Table-driven cases:**
```ts
test.each([
  ["/tmp/demo///", "/tmp/demo"],
  ["C:\\tmp\\demo\\\\", "C:/tmp/demo"],
])("pathKey(%p) is %p", (input, expected) => {
  expect(String(pathKey(input))).toBe(expected)
})
```
(`workspaces/paths.test.ts`.)

- Use `as const` for string tables and `satisfies` for fixture objects.
- Titles interpolate `%s`, `%p`, or `$name` (`test.each([...])("formats a $name", ...)`,
  `runtime/server/errors.test.ts`).
- One table per behavior; do not repeat a case per theme, viewport, direction, or channel
  (`packages/app/AGENTS.md`).

## Mocking

**Framework:** No module mocking. `mock.module` is forbidden, and app unit scripts use `--isolate` precisely
because module mocks leaked across files. `anti-slop/no-module-mocking` also warns on it.

**Patterns:**
- Inject dependencies through parameters the product already has. `createWorktreeInventory` accepts
  `queryClient`, `api`, and `updated`; tests pass a real `QueryClient` and a fake API
  (`workspaces/inventory.test.ts`).
- Fake `fetch` instead of stubbing the network stack:
  `Object.assign(fetch, { preconnect: () => {} })` matches the SDK's request shape
  (`runtime/server/data.test.ts`, `runtime/server/health.test.ts`).
- Fake time through an injected clock: `createRequestQueue({ now: () => clock, ... })` and `tick(ms)`
  (`runtime/server/request-queue.test.ts`).
- Drive event streams through a minimal emitter that mirrors the SDK API, then emit production event envelopes
  (`setupDesktop` in `runtime/server/data.test.ts`).
- Use Solid's `createRoot((dispose) => ...)` for anything that registers owners; return `dispose` and call it in
  `finally` (`data.test.ts`).
- Type assertions on fakes need a `// SAFETY:` comment and an oxlint suppression:
  ```ts
  // SAFETY: the picker only reads `api.file.find` and `api.file.list`, which every fake here provides.
  // oxlint-disable-next-line anti-slop/no-chained-type-assertions -- a partial fake stands in for the generated SDK client
  const sdk = (file: FileApi) => ({ api: { file } }) as unknown as Sdk
  ```
  (`workspaces/selection/domain.test.ts`.)

**What to Mock:**
- Network `fetch`, query clients, clock/`now`, logging sinks, and SDK surfaces that the unit under test calls.
- Abort signals and deferred promises at the boundary.

**What NOT to Mock:**
- The behavior you assert. Run the real `transition`, parser, store, or factory and assert its output.
- Dependencies already covered elsewhere (`@pierre/trees`), config pass-through, or source text/imports.
- `globalThis.*`; it should not be replaced unless there is no alternative (root `AGENTS.md`).

## Fixtures and Factories

**Test Data:**
```ts
const session: SessionInfo = {
  id: "ses_test",
  projectID: "project",
  cost: 0,
  tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
  time: { created: 0, updated: 0 },
  location: { directory: "/project" },
}
```
(`runtime/server/data.test.ts`.)

```ts
const integration = (connections: IntegrationInfo["connections"]): IntegrationInfo => ({
  id: "openai",
  name: "OpenAI",
  methods: [],
  connections,
})
```
(`settings/providers/accounts.test.ts`.)

**Location:**
- Builders are local to the test file, at the top, above the suites. There is no shared app unit-test fixture
  directory; the only `fixtures` folder in scope is feature data under `src/voice/fixtures`.
- Reuse a builder across cases in the file; keep it free of mutable state between tests.
- Use `Promise.withResolvers` for gates and `satisfies` for fixture typing:
  ```ts
  const release = Promise.withResolvers<void>()
  const mutation = createSessionMutations(async () => release.promise)
  const request = mutation.remove(session.id)
  ```
  (`runtime/server/data.test.ts`.)
- E2E fixtures come from the shared harness in `e2e/utils/` (`app.ts`, `workspace.ts`, `mock-server.ts`,
  `timeline.ts`). Do not hand-write routing or storage seeding inside a spec
  (`packages/app/e2e/AGENTS.md`).

## Coverage

**Requirements:** None enforced. There is no coverage script, threshold, or coverage reporter configured in
`packages/app` (no `coverage` entry in `packages/app/package.json` or root config).

Coverage is contract-driven:
- Every test must answer: which observable contract it protects, which credible regression makes it fail, and why
  no existing test already catches it. If any answer is missing, do not add the test.
- One contract, one owner: test each behavior once at the strongest boundary (area e2e keeper or the owning
  module's unit test). Extend an existing table or keeper before adding a file.
- Remove or move coverage only with the name of the test that still proves the contract.
- Coverage reports are not a substitute: e2e writes an HTML report to `e2e/playwright-report`, unit runs print
  only failures via `--only-failures`.

**Notable gaps in this scope:**
- `runtime/server/session-index.ts` (`mergeRootSessionIndex`) has no co-located test. Related recency behavior is
  covered indirectly by `runtime/server/data.test.ts`, but the merge itself is untested.
- `workspaces/path-key.ts` has no own test file; it is exercised through `workspaces/paths.test.ts`.
- Pure UI shells (`shell/titlebar/titlebar.tsx`, `settings/shell.tsx`, `settings/search.tsx`) are not unit-tested;
  that is intentional, since their contracts belong to e2e keepers or component tests/stories.

## Test Types

**Unit Tests:**
- `bun:test` under `src`, run with Solid conditions and happy-dom preloaded.
- Pure machines and parsers need no DOM, timers, or mocks (`packages/app/AGENTS.md`).
- Store/runtime tests run the real factory with a real `QueryClient` and a fake `fetch`/SDK
  (`workspaces/inventory.test.ts`, `runtime/server/data.test.ts`).

**Browser-Condition Tests:**
- `test-browser/*.test.ts(x)` run with `--conditions=browser`; they cover browser-only modules and DOM behavior.
- Same happy-dom and Solid JSX preloads.

**E2E Tests (Playwright):**
- Config: `packages/app/playwright.config.ts`; `testDir: "./e2e"`, 60 s test timeout, 10 s expect timeout,
  retries 2 on CI, service workers blocked, Chromium only, with a separate `chromium-touch-scroll` project for
  `mobile-timeline-scroll.spec.ts`.
- The app runs against an in-memory mock of the opencode server per page (`e2e/utils/mock-server.ts`). Unmocked
  `/api/**` requests fail with 501 "Unmocked API request".
- Each test gets a fresh context; no `beforeAll`, serial mode, or shared worker fixtures (except the separate
  service-worker suite).
- Assert user-visible behavior with role/label/text locators and web-first assertions. Never use
  `waitForTimeout`, sleeps, or animation-frame counts. Register event/response waits before the triggering action.
- One keeper suite per product area in `e2e/regression/`; add a case there rather than a new spec file.
- Run modes: `test:e2e` (Vite dev server), `test:e2e:built` (`PLAYWRIGHT_BUILD=1`, built app + Bun static
  server), `test:service-worker` (own config), `test:stability` (own config, not CI).

**Component Tests (Playwright on stories):**
- Config: `packages/app/playwright.components.config.ts`, which delegates to `componentConfig` from
  `packages/stories/playwright/config`.
- Mount real production components through `*.stories.tsx`; use URL-mounted `*.fixture.tsx` only for contracts a
  story cannot show.
- A contract proven by a `packages/session-ui/component-tests` test does not also get an app e2e copy.

## Common Patterns

**Async testing with explicit gates:**
```ts
test("rolls back a failed removal", async () => {
  const release = Promise.withResolvers<void>()
  const mutation = createSessionMutations(async () => {
    await release.promise
    throw new Error("offline")
  })

  const request = mutation.remove(session.id)
  expect(mutation.apply([session])).toEqual([])
  release.resolve()
  await expect(request).rejects.toThrow("offline")
  expect(mutation.apply([session])).toEqual([session])
})
```
(`runtime/server/data.test.ts`.)

- Await every promise. Never leave `rejects`/`resolves` un-awaited.
- Use `Promise.all` for independent work, and a `setTimeout(0)` flush only to let queued work settle when a
  deferred is not available (`data.test.ts`, `request-queue.test.ts`).

**Error testing:**
```ts
await expect(request).rejects.toThrow("offline")
await expect(mutation.remove(session.id)).resolves.toBeUndefined()
```
- Compare failure states explicitly: `expect(view(failed.state)).toEqual({ status: "error", failure: { type: "timeout" } })`.
- Catch a rejection value only to assert its shape: `const error = await response.catch((cause) => cause)`
  (`workspaces/files/artifact.test.ts`).

**Time control:**
```ts
import { afterEach, expect, setSystemTime, test } from "bun:test"

afterEach(() => setSystemTime())

test("an accepted send promotes immediately", () => {
  setSystemTime(new Date(1_000))
  // ...
})
```
(`runtime/server/data.test.ts`.)

```ts
jest.useFakeTimers()
jest.advanceTimersByTime(59_999)
jest.advanceTimersByTime(1)
```
(`workspaces/files/artifact.test.ts`; `vi.useFakeTimers` also appears in
`runtime/persistence/namespace.test.ts`.)

- Prefer advancing to the exact timer boundary over arbitrary sleeps.
- For queue logic, inject `now` and advance the clock directly (`request-queue.test.ts`).

**Cleanup:**
- Dispose Solid roots and query clients in `finally`:
  ```ts
  try {
    // ...
  } finally {
    setup.dispose()
  }
  ```
- Clear a `QueryClient` with `client.clear()` at the end of a test that populated it (`inventory.test.ts`).
- Restore fake timers and system time in `afterEach`.

**Regression tests:**
- A regression test must fail on the code before the fix (`packages/app/AGENTS.md`). Replay the bug's event
  sequence, then keep coverage for stale attempts and every exit.

**What not to test:**
- Do not unit-test what an e2e keeper already proves, what a dependency does, config that passes values through,
  or source text (except persisted keys that are themselves the contract).
- Do not add production seams for tests: no test-only exports, `now`/`delay`/`budget` parameters, flags,
  globals, or `data-*` attributes.

---

*Testing analysis: 2026-11-12*
