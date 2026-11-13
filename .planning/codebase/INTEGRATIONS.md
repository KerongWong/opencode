---
last_mapped_commit: acdb57123fbf279c585996a507b90f3e79d3e72e
last_mapped_at: 2026-11-12
---
# External Integrations

**Analysis Date:** 2026-11-12

> Scope: `packages/app/src/shell/titlebar`, `packages/app/src/runtime/server`,
> `packages/app/src/workspaces`, `packages/app/src/home`, `packages/app/src/settings`, and `docs/designs`.
> The app is a client: every domain integration below goes through the OpenCode server it is connected to.
> The fork's own feature (project-grouped sessions sidebar) adds no new integration; it consumes the
> session/project data described here.

## APIs & External Services

**OpenCode server (primary integration):**
- Every server the app talks to is an OpenCode HTTP server (local sidecar, remote LAN/Tailscale host, or a
  plugin-contributed SSH/WSL server).
- SDK/client: `@opencode/client/promise` (`OpenCode.make`) and `@opencode/client/solid`
  (`createClientConnection`, `createData`); client construction is wrapped in
  `packages/app/src/runtime/server/api.ts` (`createApiForServer`) and
  `packages/app/src/runtime/server/client.tsx` (`createServerTransport`, `createServerSdkContext`).
- Auth: HTTP Basic, built as `btoa("opencode:" + password)` — `authTokenFromCredentials` /
  `authFromToken` in `packages/app/src/runtime/server/api.ts`. The same credential is used by health probes
  (`packages/app/src/runtime/server/health.ts`) and by the request queue transport.
- Server kinds and lifecycle are declared in `packages/app/src/runtime/server/registry.tsx`:
  - `http` — a stored remote server (`{ type: "http", http: { url, password } }`).
  - `sidecar` — the desktop app's own bundled server (`ServerConnection.builtin`).
  - `plugin` — a server contributed by a GUI plugin (e.g. SSH or WSL), keyed `${plugin}:${id}`, with
    `status` stages, `authenticate`, `connect`, and an optional `reconnect` that re-resolves a tunnel.
- Endpoints exercised by the scoped code (via client method names; HTTP paths shown where the code spells
  them out):
  - `/api/info` — `api.server.info()` health probe; returns `version` and `hostname`
    (`packages/app/src/runtime/server/health.ts`).
  - `/api/event` — the SDK's server-sent event stream (`createClientConnection` in
    `packages/app/src/runtime/server/client.tsx`, `flushInterval: 16`, `pageLifecycle: true`).
  - `/api/location` — `api.location.get()` for directory/project resolution
    (`packages/app/src/runtime/server/global-sync/bootstrap.ts`).
  - `/api/project` — `api.project.list()` and `api.project.update({ projectID, name, ... })`
    (`packages/app/src/runtime/server/sync.tsx`,
    `packages/app/src/settings/workspaces/project-model.ts`,
    `packages/app/src/shell/titlebar/projects.tsx`).
  - `/api/worktree` — `api.worktree.list/refresh/create` for worktree inventories and creation
    (`packages/app/src/workspaces/inventory.ts`, `packages/app/src/workspaces/create.ts`).
  - `/api/session` — `api.session.list({ limit, order, parentID })` for the Home/sidebar session index
    (`packages/app/src/home/sessions/index.ts`, `packages/app/src/home/sessions/queries.ts`).
  - `/api/config` — `api.config.get()`, `api.config.shells()`, and
    `api.experimental.config.update({ shell })` (`packages/app/src/settings/general/controllers.ts`,
    `packages/app/src/settings/providers/console-link.tsx`,
    `packages/app/src/settings/workspaces/project-extensions.tsx`).
  - `/api/plugin` — `api.plugin.list()` global and per-directory
    (`packages/app/src/settings/workspaces/project-extensions.tsx`).
  - Integration/credential APIs — `api.integration.get/list/sync` and `api.credential.remove` for provider
    accounts (`packages/app/src/settings/providers/providers.tsx`,
    `packages/app/src/settings/providers/console-link.tsx`).
  - File and media APIs — `api.file.read` (`packages/app/src/runtime/server/image.ts`),
    `api.experimental.media.get({ hash })` (`packages/app/src/runtime/server/media.ts`), plus a
    ranged `/api/fs/read/<path>` URL for `<img>`/`<video>` when the server needs no password
    (`fileStreamUrl` in `packages/app/src/runtime/server/api.ts`).
  - `/api/vcs` and `/api/worktree` are classified as "slow" in the request queue
    (`packages/app/src/runtime/server/request-queue-machine.ts`).
- Event vocabulary consumed by scoped code (SSE `OpenCodeEvent["type"]`):
  `session.inbox.enqueued`, `session.step.started|ended|failed`, `session.renamed`, `session.moved`,
  `session.archived|unarchived`, `session.revert.staged|cleared|committed`, `session.deleted`,
  `session.execution.succeeded|failed|interrupted`, `project.updated`, `worktree.updated`,
  `config.updated`, `agent.updated`, `plugin.updated`, `model.updated`.
  See `packages/app/src/shell/titlebar/sidebar-sessions.ts`,
  `packages/app/src/runtime/server/data.ts`, `packages/app/src/runtime/server/sync.tsx`.

**Connection robustness:**
- Health polling: 10 s interval (`SERVER_HEALTH_POLL_MS`), 30 s probe timeout, 2 retries with
  `100 ms * (n + 1)` backoff, 750 ms result cache; states `healthy | unauthorized | unreachable |
  checking | incompatible | starting | auth | stopped` (`packages/app/src/runtime/server/health.ts`,
  `health-machine.ts`).
- Request queue: 4 concurrent requests, 2 reserved slow slots, 2 s stall detection, 60 s header timeout,
  10 min for setup requests (worktree creation runs install scripts)
  (`packages/app/src/runtime/server/request-queue.ts`, `request-queue-machine.ts`).
- Per-server isolation: every cache, store, and scope key includes the server key
  (`packages/app/src/runtime/server/scope.ts`, `scoped-cache.ts`, `refcount.ts`).

**OpenCode Console (`https://opencode.ai/console`):**
- Console is the account/integration service behind managed providers and extensions.
- Managed provider group (`opencode`, `opencode-go`, `console-*`) connects through the `opencode`
  integration; credentials are OAuth grants or API keys (`method: "key" | "oauth"`).
  `packages/app/src/settings/providers/providers.tsx` resolves state via
  `integrationID ?? provider.id` because Console-managed providers share the Console integration.
- Console-delivered MCP servers use a gateway URL of the form
  `<server>/api/integration-gateway/<slug>/mcp`; the bearer token is
  `ocgw_<base64url claims>.<signature>` and the `w` claim names the workspace. Only remote, non-OAuth
  entries matching that path are treated as Console-managed
  (`packages/app/src/settings/providers/console-extensions.ts`).
- Links out: provider/manage/connect pages under `https://opencode.ai/console/<workspace>/extensions/...`,
  opened with `platform.openExternal` (`consoleMcpLinks`, `ConsoleName` in
  `packages/app/src/settings/providers/console-link.tsx`).
- Skills: virtual `skill://<slug>/...` skills are treated as Console's while the Console account is
  signed in (except OpenCode's own `opencode`, `report`, `browser` skills).

**Provider integrations (server-mediated):**
- Provider/model catalogs are server data, not client calls to a vendor API. The relevant shapes are in
  `packages/app/src/runtime/server/types.ts` (`Provider`, `Model` with `api.url`/`api.npm`, cost, limits,
  capabilities; `ProviderAuthResponse`).
- Connect/disconnect/accounts: `settings/providers/providers.tsx` plus the server `integration` and
  `credential` APIs. Provider identifiers recognized with custom copy:
  `opencode`, `opencode-go`, `anthropic`, `claude-agent`, `github-copilot*`, `openai`, `google`,
  `openrouter`, `vercel`.
- Provider source classification: `env`, `api` (key), `account` (OAuth), `config`, `custom`
  (`packages/app/src/settings/providers/providers.tsx`).

**MCP (Model Context Protocol) servers:**
- Configured server-side (`config.mcp.servers`), surfaced in
  `packages/app/src/settings/workspaces/project-extensions.tsx` and the server-wide extension pages.
- Statuses rendered: `connected`, `failed`, `needs_auth`, `disabled`, `pending`; a row needing sign-in
  offers sign-in when the server carries an `integrationID`, otherwise a toggle.
- Console-managed MCPs can be overridden by a same-named user config entry; the UI keeps a link back to
  Console in that case.

**LSP (language servers):**
- Read-only integration: the app lists configured language servers from `config.lsp` and their
  `disabled`/`extensions` fields (`packages/app/src/settings/workspaces/project-lsp.ts`,
  `ProjectLanguageServers` in `project-extensions.tsx`). No direct LSP connection from the client.

**Git / VCS:**
- Branch and `default_branch` come from server data (`VcsInfo` in
  `packages/app/src/runtime/server/types.ts`, persisted shape `VcsState` in
  `packages/app/src/runtime/server/persistence.ts`).
- Worktrees are created/listed through `/api/worktree`; the client never invokes `git` directly
  (`packages/app/src/workspaces/create.ts`, `inventory.ts`).

## Data Storage

**Databases:**
- None in the client. All durable domain data (sessions, messages, projects, worktrees, config,
  credentials, MCP/LSP state) lives in the OpenCode server.
- Client-persisted per-server pointers are stored in browser storage through
  `Persist`/`persisted` (`packages/app/src/runtime/persistence/storage.ts`) using the schema in
  `packages/app/src/runtime/server/persistence.ts`: `list`, `hidden`, `lastProjectID`,
  `usedProjectIDs`, `hostnames`, legacy `projects`. Provider: `Persist.global("server")`, previous key
  `server.v3` (`packages/app/src/runtime/server/registry.tsx`).
- `packages/app/src/runtime/server/persistence.ts` also defines `ModelState`, `VcsState`, and
  `ProjectState` (name, icon override/color, startup command) persisted in the same storage layer.

**File Storage:**
- No cloud object storage from the client. Project icons are read locally with `FileReader` as data URLs
  and saved through `api.project.update` / local project metadata
  (`packages/app/src/settings/workspaces/project-model.ts`).
- Server-side files are streamed/read through `/api/fs/read` and `api.file.read`; images outside the
  project are read by scoping the request to their parent directory
  (`packages/app/src/runtime/server/image.ts`).
- Media bytes are cached as object URLs and revoked on dispose
  (`packages/app/src/runtime/server/media.ts`).

**Caching:**
- TanStack Solid Query caches (`queryKey` includes the server scope): global config/path/projects,
  Home session index (30 s stale, `gcTime: Infinity`), worktree inventories (`staleTime: Infinity`,
  invalidated by `worktree.updated`).
- In-memory caches: health results (750 ms), `createScopedCache` (optional TTL/LRU) used for per-server
  contexts, media object URLs, session recency/mutation maps bounded to 512 sessions
  (`packages/app/src/runtime/server/data.ts`).

## Authentication & Identity

**Auth Provider:**
- Custom, per server: HTTP Basic with the server password; no third-party identity provider for the app
  itself.
  - Credential → header: `Basic base64("opencode:<password>")` —
    `packages/app/src/runtime/server/api.ts`.
  - Token → password: `authFromToken` decodes the stored base64 token.
  - 401 handling: a probe result of `unauthorized` moves the server to `signed-out` and releases its
    controller until credentials change (`packages/app/src/runtime/server/machine.ts`,
    `health.ts`).
- Plugin-contributed servers own their sign-in: `authenticate(onConnected)` / `connect()` on
  `ServerConnection.Plugin` (`packages/app/src/runtime/server/registry.tsx`).
- Account-level identity for model providers is the Console `opencode` integration (OAuth credential or
  API key), managed by the server; the client lists accounts and can activate/rename/remove them
  (`packages/app/src/settings/providers/accounts.ts`, `machine.ts`, `account-actions.ts`).

## Monitoring & Observability

**Error Tracking:**
- Sentry for the renderer: `@sentry/solid` `init` in `packages/app/src/entry.tsx` when
  `VITE_SENTRY_DSN` is set, with environment/release from `VITE_SENTRY_ENVIRONMENT` /
  `VITE_SENTRY_RELEASE` (default release `web@<version>`).
- Source maps uploaded by `@sentry/vite-plugin` when `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, and
  `SENTRY_PROJECT` are set; uploaded maps are deleted from the bundle
  (`packages/app/vite.config.ts`).

**Logs:**
- `console.*` only; no logging SDK. Notable signals:
  - `[global-sdk] event stream disconnected` with URL/managed flag —
    `packages/app/src/runtime/server/client.tsx`.
  - `[server-request-queue] server thrashing detected` with an inflight/queued snapshot —
    `packages/app/src/runtime/server/request-queue.ts`.
- Server health is observable in-product: Settings › Servers rows show `healthy/connecting/auth/
  unreachable` from the same probes (`packages/app/src/settings/servers/inventory.ts`,
  `machine.ts`).

## CI/CD & Deployment

**Hosting:**
- Desktop: Electron app distributed as an NSIS installer (`docs/designs/build-desktop.md`); upstream
  release artifacts are published to Cloudflare R2 and updated via `electron-updater`
  (`.github/workflows/release.yml`).
- Web/PWA: static Vite build behind Cloudflare Workers (`deploy.yml`, `deploy-site.yml`,
  `deploy-files.yml`, `deploy-update.yml`).

**CI Pipeline:**
- GitHub Actions on Blacksmith runners.
  - `.github/workflows/check.yml` — `bun run lint`, `bun run typecheck:tsc` (TypeScript 7.1), and
    `lint:changed HEAD^1` for PRs.
  - `.github/workflows/check-test.yml` — affected `turbo test` on Linux (Windows on pushes/nightly),
    workspace library builds, CLI/Node build smoke tests, Playwright app e2e (2 shards), service-worker
    suite, session-ui and app component suites.
  - `.github/workflows/release.yml` — plan → build → sign → publish for CLI and desktop; signing and
    publishing run only `.github/release/` scripts with credentials from AWS Secrets Manager via GitHub
    OIDC (`arn:aws:iam::604439173067:role/github/opencode-release`) and a 30-minute Cloudflare R2 token.
  - `nightly-beta.yml`, `deploy.yml`, `deploy-site.yml`, `deploy-files.yml`, `deploy-update.yml`,
    `update`/triage bots.

## Environment Configuration

**Required env vars:**
- `OPENCODE_CHANNEL` — build channel (`local|dev|beta|prod`; `latest` → `prod`, default `dev`).
- `VITE_OPENCODE_SERVER_MODE`, `VITE_OPENCODE_SERVER_HOST`, `VITE_OPENCODE_SERVER_PORT` — which backend
  the web build targets (`packages/app/src/runtime/platform/web.ts`).
- `VITE_SENTRY_DSN`, `VITE_SENTRY_ENVIRONMENT`, `VITE_SENTRY_RELEASE` — renderer telemetry.
- `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_RELEASE` — source-map upload.
- `CI`, `OPENCODE_DISABLE_SHARE` — turbo globals; `VITE_OPENCODE_TEST_FIXTURES`, `PLAYWRIGHT_*` — tests.
- Server credentials are not environment variables in the app: they are entered/stored per server and
  encoded as the Basic token described above.

**Secrets location:**
- Developer machine: shell environment (`bunfig.toml` notes; desktop CLI password is fetched by
  `dev:live` via `opencode service get password`, never stored in the repo).
- CI: AWS Secrets Manager assumed over GitHub OIDC for release/sign/publish; Cloudflare tokens minted
  per run and passed as step outputs/file, never argv (`.github/workflows/release.yml`,
  `deploy.yml`).
- No `.env` contents were read for this analysis.

## Webhooks & Callbacks

**Incoming:**
- None. The app receives server push over the SSE event stream (`/api/event`), not webhooks.
- `packages/app/src/shell/titlebar/session-events.ts` filters the event types that may touch sidebar
  sessions; `packages/app/src/runtime/server/sync.tsx` reacts to `project.updated` /
  `worktree.updated` / `config.updated` / `agent.updated`.

**Outgoing:**
- No HTTP callbacks or webhook delivery from the client.
- External navigation only, via `platform.openExternal`: `https://opencode.ai`,
  `https://opencode.ai/docs/themes`, `https://opencode.ai/docs/skills`,
  `https://opencode.ai/console`, `https://opencode.ai/desktop-feedback`
  (`packages/app/src/settings/about/about.tsx`,
  `packages/app/src/settings/appearance/appearance.tsx`,
  `packages/app/src/settings/providers/console-link.tsx`,
  `packages/app/src/home/projects/controller.tsx`).

---

*Integration audit: 2026-11-12*
