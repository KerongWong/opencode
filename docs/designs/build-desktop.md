# 桌面端本地打包说明（Windows）

本文件记录把本分支打成 Windows 安装包的步骤，以及必须绕开的坑和出过的故障。只对个人 fork 有效，不适用于上游发布流程。

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

版本必须与二进制自报的 `--version` 一致。桌面端信任这个版本号而不去启动二进制询问，写错会导致后台服务反复重启并以 “Timed out waiting for the background service to start” 失败。`script/utils.ts` 现在会在 `build` 时启动二进制核对一次，不一致直接报错退出，不会再产出坏包。

## 坑 2：electron-builder 下载工具链超时

`pack` 会从 GitHub 下载 electron、nsis 等工具链，网络不通时卡到 600 秒超时。设置镜像：

```powershell
$env:ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/"
$env:ELECTRON_BUILDER_BINARIES_MIRROR="https://npmmirror.com/mirrors/electron-builder-binaries/"
```

## 坑 3：桌面端探测的注册文件与 CLI 写入的不一致（自定义渠道才会踩）

**现象**：启动后 bundled CLI 反复打印 “Restarting Service”，最终桌面端报 `Timed out waiting for the background service to start`。若默认的 `service.json` 被其他渠道的服务占用（如 npm 全局安装的官方 CLI），桌面端还会把它杀掉——日志里表现为 `background service starting { reason: 'version-mismatch', previousVersion: '2.2.7' }`。

**根因**：CLI 按编译渠道选注册文件名——`latest/dev/beta/next` 写 `service.json`，其他渠道写 `service-<channel>.json`（fork → `service-fork.json`，见 `packages/cli/src/services/service-config.ts` 的 `filename()`）。桌面端此前只探测 `service.json`（`background-service.ts` 的 `prepare()` 与 `sidecar-probe.ts`）；上游渠道文件名恰好相同所以从未暴露，fork 渠道下桌面端永远等不到注册，进入杀起循环。

**修复**：`packages/desktop/src/main/service/registration-file.ts` 镜像 CLI 的 `filename()` 规则，`ensure`/`adopt`/`sidecar-probe` 统一按 `CHANNEL` 计算注册文件；契约测试 `registration-file.test.ts` 按渠道成表。改动 CLI 文件名规则时必须同步改这个函数。

**验证**：启动后看 `%APPDATA%\ai.opencode.desktop.<channel>\logs\<最新目录>\main.log`——出现 `v2 CLI background service ready`（fork 的 url 端口是 28698）即正常；若看到 `version-mismatch` 后超时，先怀疑两侧注册文件不一致。

## 历史故障记录

| 日期 | 现象 | 根因 | 修复 |
|------|------|------|------|
| 2026-11-14 | 首装的包启动即超时 | `opencode-cli.version`（2.2.7）与二进制自报（0.0.0-dev-…）不一致，桌面端精确比较版本反复 replace | 坑 1 的 build 期校验 |
| 2026-11-14 | 换修正版安装包后仍超时，看到“官方 CLI 在 Starting Service” | 旧的 OpenCode Dev（dev 渠道）未卸载，两个桌面共存，启动的是旧程序；它与官方 CLI 抢 `service.json` | 卸载 `ai.opencode.desktop.dev`；fork 与官方的服务文件、端口、数据库互相隔离，天然不抢 |
| 2026-11-14 | 卸载重装后仍超时，CLI 反复 Restarting Service | 桌面端探测 `service.json`，而 fork CLI 注册进 `service-fork.json`，桌面端等不到注册 | 坑 3 的 `registration-file.ts` |

排查的共同入口：主进程日志 `%APPDATA%\<appId>\logs\<最新>\main.log`（`background service starting { reason }` 与 `ready`）加 `%USERPROFILE%\.local\state\opencode\service*.json` 注册内容。

## 不提交的东西

以下均为构建产物或本机依赖，已在 `.gitignore` 或其他包的 `.gitignore` 中忽略：

- `node_modules/`
- `dist/`（安装包与免安装目录）
- `packages/cli/dist/`
- `packages/desktop/resources/opencode-cli.exe`（约 250 MB）
