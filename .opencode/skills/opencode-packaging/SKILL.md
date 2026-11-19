---
name: opencode-packaging
description: Use when the user asks to 打包 / build an installer / 出安装包 from this repo, or mentions packaging problems (版本号 0.0.0-<channel>-*, 包名 OpenCode Dev/Projects, GitHub 下载超时, NSIS pack 报错). Default action builds the Windows desktop NSIS installer with the projects channel (appId ai.opencode.desktop.projects, no auto-update) from the current branch HEAD. Do NOT ask which channel or what to build — just run the default flow below unless the user explicitly asks for something else (dev/beta/prod channel, CLI-only, or debugging an error).
---

# Packaging opencode from source

**默认动作：打出 projects 渠道（appId `ai.opencode.desktop.projects`，无自动更新）的 Windows x64 桌面安装包，代码取当前分支 HEAD。** 不要反问渠道/产物类型，直接执行下面的流程；用户明确说打别的渠道或只构建 CLI 时才走变体。

```powershell
# 1. 构建 CLI（桌面端必须 baseline 目标）
cd packages/cli
bun run build -- --single --baseline --skip-install

# 2. 构建桌面应用本体
cd ..\desktop
bun run build

# 3. 第一步 pack：解压版应用
bun run pack

# 4. 复制到旁路目录（必须，见"坑"）
Copy-Item ..\..\dist\desktop\app ..\..\dist\desktop-prepackaged -Recurse -Force

# 5. 第二步 pack：NSIS 安装程序
$env:OPENCODE_CHANNEL = "projects"   # 覆盖 .env 里的 dev，否则打出 OpenCode Dev 且带 dev 更新源
$env:OPENCODE_DESKTOP_APP = (Resolve-Path ..\..\dist\desktop-prepackaged).Path
bun run pack
```

产物：**仓库根 `dist/desktop/opencode-desktop-win-x64.exe`**。

验证：`(Get-Item dist\desktop\opencode-desktop-win-x64.exe).VersionInfo.ProductName` → `OpenCode Projects`；`Test-Path dist\desktop-prepackaged\resources\app-update.yml` → `False`。

## 坑（按踩坑频率排序）

1. **`OPENCODE_DESKTOP_APP` 不能指向 `dist/desktop` 里的目录**：`script/pack.ts` 每次先 `rm -rf` 仓库根 `dist/desktop`，会删掉自己的输入，第二步在拷贝 `elevate.exe` 时报 `ENOENT`。必须先复制到旁路目录（如 `dist/desktop-prepackaged`）。
2. **`.env` 把渠道定成 dev**：`packages/desktop/.env` 设了 `OPENCODE_CHANNEL=dev`，不显式覆盖就会打出 "OpenCode Dev"（带官方 dev 更新源，装完可能被远程 dev 构建覆盖）。要 projects 身份必须 ` $env:OPENCODE_CHANNEL = "projects"`。
3. **桌面端只认 baseline CLI**：`packages/desktop/script/utils.ts` 的 `CLI_BINARIES` 把 windows-x64 映射到 `@opencode/cli-windows-x64-baseline`。漏了 `--baseline` 时桌面端会忽略本地 CLI、静默下载已发布版，等于白打。
4. **GitHub 下载超时（electron zip 卡 100% 十分钟）**：设镜像 `$env:ELECTRON_MIRROR = "https://cdn.npmmirror.com/binaries/electron/"`。electron-builder 缓存都在 `%LOCALAPPDATA%\electron-builder\Cache`，失败后重试命中缓存。
5. **首次打包缺 Electron 运行时**：`node node_modules\electron\install.js`（在 `packages/desktop/node_modules/electron` 下）。
6. **本地包是自签名**：安装时 SmartScreen 报"未知发布者"，点"仍要运行"。

## 版本号与包名规则（解释现象用）

- 版本来自 `packages/script/src/index.ts`：`OPENCODE_VERSION` 未设时，非 latest 渠道一律 `0.0.0-<channel|git分支名>-<序号>`。分支构建永远不会显示 2.3.x，是预期行为，不要"修"。
- productName/appId 由渠道决定：dev→OpenCode Dev、beta→OpenCode Beta、prod→OpenCode、projects→OpenCode Projects、test→OpenCode Test。只通过 `OPENCODE_CHANNEL` 切换，不改 `electron-builder.config.ts`。

## 变体（仅当用户明确要求）

- **其他渠道**：第 5 步把 `projects` 换成 dev/beta/prod/test（prod 要求 CLI 已先构建，否则报错）。
- **只构建 CLI**：只跑第 1 步，产物 `packages/cli/dist/cli-windows-x64*/bin/opencode.exe`。
- **排错**：用户贴报错时按上面 6 个坑对照排查。

完整背景见 `docs/packaging.md`。
