---
name: opencode-packaging
description: Use when building a distributable from this repo (Windows installer, CLI binary, zip, npm tarball), when packaging reports wrong version strings like 0.0.0-<channel>-<num>, or when the product name/appId comes out unexpected (OpenCode Dev vs OpenCode Projects vs OpenCode). Covers channel selection (dev/beta/prod/projects/test), the desktop CLI baseline-target requirement, the two-step NSIS pack flow, and the ELECTRON_MIRROR fix for stalled GitHub downloads. Also triggered by 打包, 安装包, 包名, 版本号.
---

# Packaging opencode from source

Builds distributables from this repo: the standalone CLI (`opencode.exe`), CLI zip/npm artifacts, and the Windows desktop NSIS installer. Full detail in `docs/packaging.md`; this file is the workflow summary.

## Version and naming rules (the usual surprises)

- Version comes from `packages/script/src/index.ts` (`Script.version`): `OPENCODE_VERSION` env if set, otherwise `0.0.0-<channel>-<timestamp>` on any non-`latest` channel. Channel is `OPENCODE_CHANNEL` env, else the git branch name. A branch build is never `2.3.x`; do not "fix" this, it is intentional.
- Desktop product identity is the channel, from `packages/desktop/.env` or the `OPENCODE_CHANNEL` env var (env wins):
  | channel | productName | appId | update feed |
  |---|---|---|---|
  | dev | OpenCode Dev | ai.opencode.desktop.dev | yes (opencode.ai dev) |
  | beta | OpenCode Beta | ai.opencode.desktop.beta | yes |
  | prod | OpenCode | ai.opencode.desktop | yes (latest) |
  | projects | OpenCode Projects | ai.opencode.desktop.projects | **none** |
  | test | OpenCode Test | ai.opencode.desktop.test | none |
- To get a specific appId/productName, set `OPENCODE_CHANNEL` accordingly; do not hand-edit `electron-builder.config.ts`.

## Build the CLI first (desktop requires the *baseline* target)

```powershell
# in packages/cli
bun run build -- --single --baseline --skip-install
```

- `--single` builds only the current platform; `--baseline` is **required for the desktop on windows-x64**: `packages/desktop/script/utils.ts` maps `windows-x64` to package `@opencode/cli-windows-x64-baseline`, so plain `cli-windows-x64` is ignored and the desktop silently falls back to downloading a published CLI.
- Outputs: `packages/cli/dist/cli-windows-x64*/bin/opencode.exe` plus a `package.json` carrying the version string. Verify with `opencode.exe --version`.

## Desktop: two-step pack (Windows NSIS installer)

```powershell
# in packages/desktop
bun run build                       # electron-vite build + stage CLI into resources/

# Step 1: unpacked app
bun run pack                        # -> repo dist/desktop/app  (--dir)

# Step 2: NSIS installer around a COPY of the unpacked app
Copy-Item ..\..\dist\desktop\app ..\..\dist\desktop-prepackaged -Recurse
$env:OPENCODE_CHANNEL = "projects"   # pick the channel/appId
$env:OPENCODE_DESKTOP_APP = "D:\...\dist\desktop-prepackaged"
bun run pack                        # -> repo dist/desktop/opencode-desktop-win-x64.exe
```

- **Pitfall**: `script/pack.ts` does `rm -rf` on repo `dist/desktop` at the start of every run. `OPENCODE_DESKTOP_APP` must point to a copy **outside** `dist/desktop`, or step 2 deletes its own input (manifests as ENOENT copying `elevate.exe`).
- Installers are self-signed locally: expect a SmartScreen "unknown publisher" prompt; release CI re-signs.

## Network stalls (GitHub too slow / 10-min timeout)

- First desktop build needs the Electron runtime: `node install.js` in `packages/desktop/node_modules/electron`.
- electron-builder downloads the electron zip from GitHub by default and can stall at 100 % for 10 minutes. Use the mirror: `$env:ELECTRON_MIRROR = "https://cdn.npmmirror.com/binaries/electron/"` (bun/@electron/get reads it).
- electron-builder caches everything under `%LOCALAPPDATA%\electron-builder\Cache`; a retry after a partial failure usually resumes from cache.

## Verify

- `dist/desktop/opencode-desktop-win-x64.exe` exists; `(Get-Item ...).VersionInfo.ProductName` matches the intended channel.
- No `resources/app-update.yml` in the unpacked app when the channel has no feed (projects/test).
- The bundled CLI version: `packages/desktop/resources/opencode-cli.exe --version` (desktop build asserts this matches at pack time).

## Cleanup

`dist/desktop-prepackaged` and `packages/desktop/dist` are temporary; the deliverables are repo `dist/desktop/*.exe` and `packages/cli/dist/**`. All build outputs are gitignored.
