# 桌面端本地打包说明（Windows）

本文件记录把本分支打成 Windows 安装包的步骤，以及两个必须绕开的坑。只对个人 fork 有效，不适用于上游发布流程。

## 环境

- bun `1.4.4`（仓库 `packageManager` 固定）
- Windows 10/11
- **建议开启开发者模式**：仓库有 43 个符号链接，未开启时克隆会把它们变成文本文件，`packages/app/src/custom-elements.d.ts` 会因此让 `bun run check` 报 TS1128。开启后在仓库执行：

  ```powershell
  git config core.symlinks true
  git rm --cached -r . | Out-Null
  git reset --hard
  ```

## 打包步骤

```powershell
cd D:\01-project\02-opensource\opencode
bun install

# 1. 构建应用资源到 packages/desktop/out
bun --cwd packages/desktop build

# 2. 生成免安装目录 dist/desktop/app
bun --cwd packages/desktop pack

# 3. 生成 NSIS 安装包
$env:OPENCODE_DESKTOP_APP = "C:\path\to\a\copy\of\dist\desktop\app"
bun --cwd packages/desktop pack
```

产物：`dist\desktop\opencode-desktop-win-x64.exe`

第 3 步必须先把 `dist\desktop\app` 复制到仓库外，因为 `pack` 会先删除 `dist/`；直接把 `OPENCODE_DESKTOP_APP` 指向仓库内的 `app` 会在使用前被删掉。

## 坑 1：dev 渠道的 CLI 包是空的

`packages/desktop/script/build.ts` 在本地没有 CLI 构建产物时会下载 dev 渠道的 CLI。当前发布的 `@opencode/cli-windows-x64-baseline@0.0.0-dev-566` 缺少 `bin/opencode.exe`，`build` 会以 ENOENT 失败。

绕过方式：用与桌面端同版本的 CLI 填充构建期望的目录（本分支使用官方 2.2.5）：

```powershell
$dst = "packages\cli\dist\cli-windows-x64-baseline"
New-Item -ItemType Directory -Force "$dst\bin" | Out-Null
Copy-Item "C:\Users\<you>\AppData\Local\Programs\ai.opencode.desktop\resources\opencode-cli.exe" "$dst\bin\opencode.exe"
[IO.File]::WriteAllText((Resolve-Path "$dst\package.json"), '{"version":"2.2.5"}', (New-Object System.Text.UTF8Encoding($false)))
```

版本必须与二进制自报的 `--version` 一致。桌面端信任这个版本号而不去启动二进制询问，写错会导致后台服务反复重启并以 “Timed out waiting for the background service to start” 失败。

## 坑 2：electron-builder 下载工具链超时

`pack` 会从 GitHub 下载 electron、nsis 等工具链，网络不通时卡到 600 秒超时。设置镜像：

```powershell
$env:ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/"
$env:ELECTRON_BUILDER_BINARIES_MIRROR="https://npmmirror.com/mirrors/electron-builder-binaries/"
```

## 不提交的东西

以下均为构建产物或本机依赖，已在 `.gitignore` 或其他包的 `.gitignore` 中忽略：

- `node_modules/`
- `dist/`（安装包与免安装目录）
- `packages/cli/dist/`
- `packages/desktop/resources/opencode-cli.exe`（约 250 MB）
