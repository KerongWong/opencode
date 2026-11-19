# 从源码打包 opencode（Windows）

本文记录从这个仓库构建可分发产物的完整流程：独立 CLI、CLI 压缩包/npm 产物、Windows 桌面 NSIS 安装包，以及版本号和包名（productName / appId）的决定规则。配套的 skill 见 `.opencode/skills/opencode-packaging/SKILL.md`。

## 一、版本号是怎么来的

版本由 `packages/script/src/index.ts` 的 `Script.version` 决定：

- 设置了环境变量 `OPENCODE_VERSION` → 直接使用它（此时 channel 视为 `latest`）。
- 否则，channel 取 `OPENCODE_CHANNEL` 环境变量；没有则取 **git 分支名**（如 `workspace-registry`）。
- 非 `latest` channel 的版本号一律是 `0.0.0-<channel>-<序号/时间戳>`，例如本次构建：

  ```
  opencode v0.0.0-workspace-registry-202611190614
  ```

分支上的开发构建**永远不会**显示成 `2.3.x`（那是发布版才用的版本），这是预期行为，不要手动改版本号去"修复"它。

## 二、包名 / appId：由渠道（channel）决定

桌面端的身份不是写死的，由打包时的渠道映射（`packages/desktop/electron-builder.config.ts` 的 `APP_IDS` / `getConfig()`）：

| channel | productName | appId | 自动更新源 |
|---|---|---|---|
| `dev` | OpenCode Dev | `ai.opencode.desktop.dev` | 有（opencode.ai dev） |
| `beta` | OpenCode Beta | `ai.opencode.desktop.beta` | 有 |
| `prod` | OpenCode | `ai.opencode.desktop` | 有（latest） |
| `projects` | OpenCode Projects | `ai.opencode.desktop.projects` | **无** |
| `test` | OpenCode Test | `ai.opencode.desktop.test` | 无 |

渠道优先级：`OPENCODE_CHANNEL` 环境变量 > `packages/desktop/.env`。要指定某个 appId，设置对应 channel 即可，不要改 electron-builder 配置。

> 注意：`dev` 渠道自带官方 dev 更新源，装好后可能被 opencode.ai 的 dev 构建自动覆盖。想长期用本地这版，用 `projects`（无更新源、独立身份、与正式版共存）。

## 三、构建 CLI（桌面端的前提）

在 `packages/cli` 下：

```powershell
bun run build -- --single --baseline --skip-install
```

- `--single`：只构建当前平台（win32/x64）。
- `--baseline`：**桌面端必需**。`packages/desktop/script/utils.ts` 的 `CLI_BINARIES` 把 `windows-x64` 映射到 `@opencode/cli-windows-x64-baseline`；只构建普通版 `cli-windows-x64` 会被桌面端忽略，回退去下载已发布的 CLI（等于白打）。
- `--skip-install`：跳过跨平台原生依赖安装；当前平台的原生包（node-pty、parcel/watcher、opencode-pty、fff、ffi-rs）确认在 `node_modules` 里即可。

产物：`packages/cli/dist/cli-windows-x64{,-baseline}/bin/opencode.exe`，旁边 `package.json` 的 `version` 就是可执行文件 `--version` 打印的内容。

## 四、桌面端安装包（两步走）

在 `packages/desktop` 下：

```powershell
# 0. 首次构建需要 Electron 运行时（postinstall 被跳过的话）
node node_modules\electron\install.js

# 1. 构建应用本体（electron-vite + 把 CLI 拷入 resources/）
bun run build

# 2. 第一步 pack：产出解压版应用
bun run pack                          # -> 仓库根 dist/desktop/app（electron-builder --dir）

# 3. 复制到旁路目录（关键！见下面的坑）
Copy-Item ..\..\dist\desktop\app ..\..\dist\desktop-prepackaged -Recurse

# 4. 第二步 pack：NSIS 安装程序
$env:OPENCODE_CHANNEL = "projects"     # 选渠道 = 选 appId/包名
$env:OPENCODE_DESKTOP_APP = "D:\01-project\02-opensource\opencode\dist\desktop-prepackaged"
bun run pack                          # -> 仓库根 dist/desktop/opencode-desktop-win-x64.exe
```

### 必须知道的坑

1. **`OPENCODE_DESKTOP_APP` 不能指向 `dist/desktop` 里的目录**。`script/pack.ts` 每次运行先 `rm -rf` 仓库根的 `dist/desktop` 和 `packages/desktop/dist`。直接拿 `dist\desktop\app` 当预打包目录，第二步会先把它删掉，然后在拷贝 `elevate.exe` 时报 `ENOENT`。所以要先复制到 `dist/desktop-prepackaged` 这类旁路位置。
2. **GitHub 下载超时**。electron-builder 默认从 GitHub 下载 electron zip（约 158 MB），国内网络可能卡在 100% 直到 10 分钟超时。改用 npmmirror 镜像：
   ```powershell
   $env:ELECTRON_MIRROR = "https://cdn.npmmirror.com/binaries/electron/"
   ```
   `@electron/get` 会读取该变量。镜像地址验证：`https://cdn.npmmirror.com/binaries/electron/v<版本>/electron-v<版本>-win32-x64.zip` 返回 200 即可用。
3. **electron-builder 缓存**。所有下载的工具链在 `%LOCALAPPDATA%\electron-builder\Cache`（electron zip、NSIS、winCodeSign、7zip）。失败后重试通常直接命中缓存，不用重下。
4. **签名**。本地打出来的包是自签名，Windows SmartScreen 会提示"未知发布者"，点"仍要运行"。发布 CI 才会做正式签名。
5. **`bun run` 自动加载 `.env`**。在 `packages/desktop` 下跑 pack 会读到 `packages/desktop/.env`；里面若设了 `OPENCODE_CHANNEL=dev`，你不显式覆盖就会打成 dev 渠道（OpenCode Dev + dev 更新源）。

## 五、验证产物

```powershell
# 安装程序存在且产品名正确
(Get-Item dist\desktop\opencode-desktop-win-x64.exe).VersionInfo.ProductName   # -> OpenCode Projects

# 无更新源的渠道不应有 app-update.yml
Test-Path dist\desktop-prepackaged\resources\app-update.yml                   # -> False

# 内置 CLI 版本（桌面构建时本来就会校验二者一致）
packages\desktop\resources\opencode-cli.exe --version
```

## 六、产物位置与清理

| 产物 | 位置 |
|---|---|
| Windows 安装包（NSIS） | `dist/desktop/opencode-desktop-win-x64.exe` |
| 解压版桌面应用 | `dist/desktop/app` 或 `packages/desktop/dist/win-unpacked` |
| 独立 CLI 可执行文件 | `packages/cli/dist/cli-windows-x64*/bin/opencode.exe` |
| CLI zip 包 | `dist/archives/opencode-windows-x64-*.zip` |

以上构建输出全部被 gitignore。临时目录（`dist/desktop-prepackaged`、`packages/desktop/dist`、`packages/desktop/out`）确认安装包没问题后可以删。

## 七、Linux / macOS 桌面包

`script/pack.ts` 第一步按平台产出：Linux → AppImage/deb/rpm，macOS → `.app` 目录打包成 tar（`--dir -c.mac.identity=null`，本地无签名）。流程与 Windows 相同，只是第二步（NSIS）是 Windows 独有。
