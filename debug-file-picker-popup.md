# 问题记录：add-open 挂起（hang）排查与复现

> 状态：**根因之一已定位**（"文件选择器异常"实为复现脚本自身行为）；add-open hang 本体待修复
> 记录时间：2026-11-18 下午（事发同日）
> 最后更新：2026-11-18（commit 前）

## 当前主线问题

**add-open hang**：桌面版点击 "Add local folder" 打开本地文件夹后，会话发送卡住。
相关历史提交：`docs: correct add-open hang record (queue fix was not the cause, todo reopened)`。

## 插曲已结案："文件选择器自动弹出并输入地址" 不是外部 Agent 干的

- 现象：约 16:17–16:18 观察到文件选择器被自动打开并输入地址。
- **根因**：`packages/app/repro.debug.ts` —— 我们自己的 Playwright CDP 复现脚本：
  - 点击 "Add local folder" → 触发系统原生文件夹对话框；
  - 用 PowerShell `WScript.Shell.AppActivate('选择文件夹')` + `SendKeys('^l')` 聚焦地址栏 + 输入 `REPO` 路径 + 回车。
  - 完整复现了用户看到的"弹窗 + 输地址"。
- 另外，本会话收到的两条奇怪消息 `repro control ping` / `repro hang test` 也是该脚本 typed 进桌面版 composer 后发出来的——不是真人输入。
- 之前的嫌疑名单（Codex computer-use、Kimi Code、OpenCode Projects 桌面版）均为常驻进程，**与本次事件无关**，排除。

## 待办（回家继续）

1. 运行/调试 `packages/app/repro.debug.ts`（需桌面版开着 CDP 9222，REPO 指向 `Temp\opencode\repro-repo`），复现 add-open 后 send 的 hang。
2. 脚本中 `state("repro: 3s/13s/28s after send")` 的快照输出是关键对比点：控制组 vs add-open 组的 api requests / console / send 按钮状态。
3. 注意脚本文件本身编码疑似有问题（源码里中文是乱码，如 `'�½��Ự'`、`'ѡ���ļ���'`，本应是 "新会话"、"选择文件夹"）——先修编码再跑，否则 AppActivate 匹配不到窗口标题。

## 本地运行记录位置（排查用）

| 位置 | 内容 |
|---|---|
| `C:\Users\theso\.local\share\opencode\log\` | 服务端日志：`opencode.log`（44MB）、`opencode-local.log` |
| `C:\Users\theso\.local\share\opencode\shell\` | 各会话 shell 命令输出，按内容哈希存文件 |
| `C:\Users\theso\.local\share\opencode\opencode-projects.db` | 桌面版 Projects 应用数据 |
| 各项目下 `.opencode\` | 项目级会话/transcript |
| `C:\Users\theso\AppData\Local\Temp\opencode\repro-*.png` | 复现脚本的截图输出 |

## 经验备注

- 机器上常驻多个能操作桌面的 Agent（Codex computer-use、Kimi Code 等）——出事先怀疑它们虽是合理直觉，但这次教训是：**先搜本仓库有没有 repro 脚本在跑**，一分钟能省一小时。
- Playwright 驱动桌面应用时，脚本的输入会以"真人消息"的形式出现在会话里，看到怪消息先想想是不是自动化脚本发的。
