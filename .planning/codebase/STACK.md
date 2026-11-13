---
last_mapped_commit: acdb57123fbf279c585996a507b90f3e79d3e72e
last_mapped_at: 2026-11-12
---
# Technology Stack

**Analysis Date:** 2026-11-12

> Scope: this is a personal fork of `anomalyco/opencode` (OpenCode Desktop). The fork's only own
> feature is the project-grouped sessions sidebar in `packages/app/src/shell/titlebar` (design
> record: `docs/designs/project-grouped-sessions-sidebar.md`). This analysis covers
> `packages/app/src/shell/titlebar`, `packages/app/src/runtime/server`, `packages/app/src/workspaces`,
> `packages/app/src/home`, `packages/app/src/settings`, and `docs/designs`. The rest of the monorepo is
> upstream and is only described as far as manifests and the app's imports reveal it.

## Languages

**Primary:**
- TypeScript 6.0.2 (catalog alias `typescript: npm:@typescript/typescript6@6.0.2`) — all app code in
  `packages/app/src/**` is `.ts`/`.tsx`.
- TSX with Solid JSX — `packages/app/tsconfig.json` sets `"jsx": "preserve"` and
  `"jsxImportSource": "solid-js"`; every component file is `.tsx` (e.g.
  `packages/app/src/shell/titlebar/projects.tsx`, `packages/app/src/settings/providers/providers.tsx`).
- TypeScript 7.1.0-beta (native compiler, `@typescript/native`) is the CI source of truth via
  `typecheck:tsc` (`package.json`, `.github/workflows/check.yml`). Local `typecheck` uses `bun check`.

**Secondary:**
- CSS — Tailwind CSS v4 utilities plus per-feature stylesheets:
  `packages/app/src/shell/titlebar/titlebar.css`, `tab-popover.css`, `tab-nav.css`,
  `recently-closed-tabs-menu.css`, `packages/app/src/settings/settings.css`,
  `packages/app/src/settings/workspaces/project.css`, `packages/app/src/home/sessions/view.css`.
- JSON / JSONC — manifests, `tsconfig.json`, `.oxlintrc.json`, `packages/app/manifest.json` (PWA).
- TOML — `bunfig.toml`, `packages/app/bunfig.toml`.
- YAML — `.github/workflows/*.yml`.
- No Rust, Go, or Python source appears in the scoped directories.

## Runtime

**Environment:**
- Browser renderer (Chromium) as the execution target. `packages/app/vite.config.ts` builds with
  `target: "esnext"` and `assetsDir: "_assets"`.
- Desktop shell is Electron: `docs/designs/build-desktop.md` documents `bun --cwd packages/desktop build`
  and `pack` into an NSIS installer; `package.json` marks `electron` as a trusted dependency and patches
  `electron-updater@6.8.9`, `app-builder-lib@26.15.7`.
- Installable web app: `packages/app/manifest.json` (`display: "standalone"`), service worker registered
  from `packages/app/src/entry.tsx`, `vite-plugin-pwa` 1.3.0 and `packages/app/vite.pwa.ts`.

**Package Manager:**
- Bun 1.4.4 — `package.json` `"packageManager": "bun@1.4.4"` and `bun-types 1.4.4` override.
- Lockfile: no `bun.lock`/`bun.lockb` was observed in the repository root listing; dependency resolution
  is pinned by `bunfig.toml` (`exact = true`) plus the workspace catalog in `package.json`.
- `bunfig.toml` blocks installs of versions younger than 3 days (`minimumReleaseAge = 259200`) except an
  explicit allowlist, and refuses to run tests from the repo root (`[test] root = "./do-not-run-tests-from-root"`).
- Node is a secondary runtime: `@types/node 24.12.2`, CI uses Node 24 for Playwright and Node 26.4.0 for the
  Node build leg (`.github/workflows/check-test.yml`).

## Frameworks

**Core:**
- SolidJS 1.9.17 — reactive UI everywhere in `packages/app/src` (`solid-js`, `solid-js/store`).
- `@solidjs/router` 1.0.0 — route and search-param handling in `packages/app/src/home/route.tsx`,
  `packages/app/src/settings/route.ts`.
- `@solidjs/meta` 0.29.4 — document titles.
- `@tanstack/solid-query` 5.91.4 — server-state caching; e.g.
  `packages/app/src/runtime/server/sync.tsx`, `packages/app/src/workspaces/inventory.ts`,
  `packages/app/src/home/sessions/queries.ts`.
- `@kobalte/core` 0.13.13 and `@corvu/drawer` 0.2.4 — accessible primitives and drawers.
- `@dnd-kit/abstract` / `@dnd-kit/dom` / `@dnd-kit/solid` 0.5.0 — project-group drag ordering in
  `packages/app/src/shell/titlebar/projects.tsx`.
- `@pierre/trees` 1.0.0-beta.6 — directory tree in the workspace picker
  (`packages/app/src/workspaces/selection/dialog.tsx`).
- Tailwind CSS 4.3.3 (`packages/app` direct dependency) with `@tailwindcss/vite` 4.3.3,
  `tw-animate-css` 1.4.0; the workspace catalog pins Tailwind 4.1.11 for other packages.
- Effect 4.1.0 — `Schema`, `Option`, `Result`, `Base64Url` for persisted/decoded data:
  `packages/app/src/runtime/server/persistence.ts`,
  `packages/app/src/settings/providers/console-extensions.ts`,
  `packages/app/src/workspaces/files/types.ts`, `packages/app/src/workspaces/files/view-cache.ts`.
- `fuzzysort` 3.1.0 — fuzzy directory search in `packages/app/src/workspaces/selection/domain.ts`.
- Solid primitives — `@solid-primitives/event-bus` (SDK event fan-out in
  `packages/app/src/runtime/server/client.tsx`), `event-listener`, `resize-observer`, `media`,
  `keyed`, `storage`.

**Testing:**
- `bun test` with happy-dom 20.11.1 and `@happy-dom/global-registrator` 20.0.11 —
  `packages/app/package.json` scripts `test:unit` / `test:browser`, preloads
  `../ui/test/solid-jsx.ts` and `./happydom.ts`; `packages/app/bunfig.toml` sets `root = "./src"`.
- `@playwright/test` 1.60.0 — e2e (`packages/app/playwright.config.ts`, `bun run test:e2e`) and
  component tests (`playwright.components.config.ts`, `bun run test:components`).
- `@hona/strobe` 0.28.0 — performance benchmarks (`strobe.json`; the app requires baselining session/timeline
  changes against `origin/dev`, see `packages/app/AGENTS.md`).
- `knobs` (`@kitlangton/knobs`) — story fixtures under `packages/stories` (used by `*.stories.tsx` in scope).

**Build/Dev:**
- Vite 8.2.4 in `packages/app` (`catalog` still lists 7.3.7 for other packages; `patches/vite@8.2.4.patch`).
- `vite-plugin-solid` 2.11.14, `vite-plugin-pwa` 1.3.0, `@sentry/vite-plugin` 5.4.0.
- Turbo 2.10.2 — task graph in `turbo.json` (`typecheck`, `typecheck:tsc`, `test`, `build`, `transit`).
- oxlint 1.60.0 with custom JS plugins (`script/oxlint/anti-slop/**`, configured in `.oxlintrc.json`),
  ast-grep 0.44.0 (`script/ast-grep/**`), Prettier 3.6.2 (`semi: false`, `printWidth: 120`).
- Husky 9.1.7 for git hooks.

## Key Dependencies

**Critical:**
- `@opencode/client` (workspace) — the OpenCode server SDK. Scoped code uses
  `@opencode/client/promise` (`OpenCode.make`, `OpenCodeClient`, error guards such as
  `isUnauthorizedError`, `isLocationNotFoundError`, `isFileNotFoundError`) and
  `@opencode/client/solid` (`createClientConnection`, `createData`, `Data`). Entry point:
  `packages/app/src/runtime/server/api.ts` and `packages/app/src/runtime/server/client.tsx`.
- `@opencode/schema` (workspace) — `@opencode/schema/mcp` `ServerConfig` in
  `packages/app/src/settings/providers/console-extensions.ts`.
- `@opencode/plugin/gui` (workspace) — plugin host contracts used by the app:
  `ServerState`, `ServerRow`, `FileContent`, `MountedSession`, `BackgroundTask`.
- `@opencode/ui`, `@opencode/session-ui`, `@opencode/util`, `@opencode/gui-plugins` (workspace) — design
  system, session timeline, path/uuid/artifact helpers, built-in GUI plugins.
- `effect` 4.1.0 — see Frameworks.
- `solid-js` 1.9.17 (patched at `patches/solid-js@1.9.17.patch`) — Solid store semantics underpin every
  scoped state machine and store.

**Infrastructure:**
- `@sentry/solid` 10.71.0 — renderer error reporting (`packages/app/src/entry.tsx`).
- `@ibm/plex` 6.4.1 — shipped font faces referenced from `packages/app/src/index.css`.
- `@pierre/highlights`, `@pierre/trees` — syntax highlighting and trees.
- `qr-scanner` 1.4.2 — server pairing camera scanner (lives in `packages/app/src/servers/connect`,
  outside this focus scope; listed because it is an `@opencode/app` dependency).
- `ghostty-web` (GitHub commit pin), `diff` — terminal and diff rendering used outside the scoped dirs.
- Patched transitive dependencies that affect the app runtime (`package.json`
  `patchedDependencies`): `@dnd-kit/dom@0.5.0`, `@pierre/trees@1.0.0-beta.6`,
  `@corvu/drawer@0.2.4`, `@tanstack/virtual-core@3.17.8`, `vite@8.2.4`,
  `@standard-community/standard-openapi@0.2.9`, `solid-js@1.9.17`.

## Configuration

**Environment:**
- `packages/app/vite.js` defines `import.meta.env.VITE_OPENCODE_CHANNEL` from `OPENCODE_CHANNEL`
  (`local | dev | beta | prod`, `latest` maps to `prod`, default `dev`). Scoped code branches on it:
  `packages/app/src/settings/model.tsx`, `packages/app/src/shell/titlebar` consumers, plugin host.
- Web/dev backend discovery: `VITE_OPENCODE_SERVER_MODE` (`none` disables), `VITE_OPENCODE_SERVER_HOST`,
  `VITE_OPENCODE_SERVER_PORT` (default `4096`) in `packages/app/src/runtime/platform/web.ts`.
- Sentry: `VITE_SENTRY_DSN`, `VITE_SENTRY_ENVIRONMENT`, `VITE_SENTRY_RELEASE` for the renderer;
  `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_RELEASE` for source-map upload
  (`packages/app/vite.config.ts`).
- Build/test: `VITE_OPENCODE_TEST_FIXTURES=1` adds e2e fixture entries to the Vite build;
  `PLAYWRIGHT_*` (`PORT`, `BASE_URL`, `BUILD`, `WORKERS`) tune Playwright.
- Turbo globals: `CI`, `OPENCODE_DISABLE_SHARE` (`turbo.json`).
- No `.env` file was read; treat any local `.env*` as untracked developer configuration.

**Build:**
- `packages/app/vite.js` — aliases `@` → `./src`, `@betteroffice/fonts-cjk` to a local stub; excludes
  markdown worker deps (`@pierre/highlights`, `marked`) and Office engines from pre-bundling; injects the
  inline theme preload (`public/oc-theme-preload.js`); Tailwind + Solid plugins; worker format `es`.
- `packages/app/vite.config.ts` — dev server `0.0.0.0:3000` (`allowedHosts: true`), `assetsDir: "_assets"`,
  `sourcemap: true`, Sentry plugin when credentials exist.
- `packages/app/tsconfig.json` — `composite`, `strict`, `noUnusedLocals`, `emitDeclarationOnly`,
  `rootDir: ".."`, `outDir: node_modules/.ts-dist`, path alias `@/*` → `./src/*`.
- Root `tsconfig.json` extends `@tsconfig/bun/tsconfig.json` with `types: ["bun"]`.
- `turbo.json` — dependency-aware typecheck/test/build hashing (`transit` folds workspace dependencies
  into each task hash); CI typecheck waits for `@opencode/core#typecheck:tsc` for cli/sdk/server/tui.

## Platform Requirements

**Development:**
- Bun 1.4.4 (pinned by `packageManager`); Node 24 recommended for Playwright.
- Windows checkout must enable symlinks (`git config core.symlinks true`) because the repo ships ~43
  symlinks; otherwise `packages/app/src/custom-elements.d.ts` breaks `bun run check`
  (`docs/designs/build-desktop.md`).
- Run the app against a local backend: from repo root `bun dev serve --port 4096`, then from
  `packages/app` `bun dev -- --port 4444`; `opencode dev web` proxies production and will not show local
  UI changes (`packages/app/AGENTS.md`).
- Do not start/restart the app or its server process during debugging (`packages/app/AGENTS.md`).

**Production:**
- Electron desktop app packaged with electron-builder/NSIS; locally produced by
  `bun --cwd packages/desktop build` then `pack` (`docs/designs/build-desktop.md`). Upstream releases use
  `electron-updater` plus the GitHub `release` workflow.
- Static web build deployable as a PWA; the CI `deploy`/`deploy-site`/`deploy-files` workflows publish
  through Cloudflare Workers with short-lived tokens minted over AWS OIDC
  (`.github/workflows/deploy.yml`).
- The app always talks to an OpenCode server over HTTP(S); there is no server bundled in `packages/app`.

---

*Stack analysis: 2026-11-12*
