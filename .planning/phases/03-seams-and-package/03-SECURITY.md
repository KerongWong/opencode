---
phase: "03"
slug: "seams-and-package"
status: verified
threats_open: 0
asvs_level: 1
created: "2026-11-14"
---

# Phase 03 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

**来源说明：** 本阶段是打包与触点收敛，没有新的运行时输入面。注册表由 orchestrator 在 **ASVS L1** 依据源码推导建立（`service-config.ts`、`database-path.ts`、`constants.ts`），未 spawn `gsd-security-auditor`。

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| 构建渠道 → 后台服务选举 | channel 决定服务注册文件名与端口 | 服务注册 JSON、端口号 |
| 构建渠道 → 用户数据目录 | channel 决定数据库文件名 | 会话与项目数据文件 |
| 安装身份 → 操作系统 | appId / productName 决定安装目录、userData、single-instance lock | 安装路径、用户数据根 |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-03-01 | Tampering（顶替官方后台服务） | `service.json` 选择 | high | mitigate | 用自定义 channel `fork`：`service-config.filename` 只有 `latest\|dev\|beta\|next` 才共享 `service.json`，`fork` 得到 `service-fork.json`；端口由 `10000 + hash%50000` 决定，不与 `0xC0DE` 冲突 | closed |
| T-03-02 | Information Disclosure（数据串用） | 数据库文件 | high | mitigate | `database-path` 对非 `latest\|dev\|beta\|next\|prod` 的 channel 使用 `opencode-fork.db`；不设置 `OPENCODE_DISABLE_CHANNEL_DB`（那会指回官方库） | closed |
| T-03-03 | Spoofing（安装身份冲突） | appId / productName | medium | mitigate | `APP_IDS.fork = "ai.opencode.desktop.fork"`、`appNames.fork = "OpenCode Fork"`；Electron 的 userData 与 single-instance lock 由二者派生 | closed |
| T-03-04 | Elevation of Privilege（类型放宽的副作用） | `packages/plugin/src/gui/core.ts` | low | accept | 只把 `App.channel` 联合加一个成员，不改变任何分支逻辑；插件可见的取值集合扩大一项 | closed — accepted |
| T-03-05 | Repudiation（构建产物来源不明） | `dist/` | medium | accept | 仓库里已有的 `dist/opencode-desktop-win-x64.exe` 是**上一次会话**的产物；本阶段不声称它是本次交付，`03-UAT.md` 明确记录 | closed — accepted |
| T-03-06 | Tampering（未签名安装包） | NSIS 产物 | medium | accept | 个人 fork，不签名、不发布；安装包只在本人机器上使用 | closed — accepted |
| T-03-SC | Tampering | 依赖安装 | high | mitigate | 本阶段未改任何 `package.json` / lockfile；只改 4 个源文件的常量与联合类型 | closed |

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-03-01 | T-03-04 | 联合类型加一个成员是最小改动；替代方案（在桌面端 cast）会把类型漏洞藏起来 | orchestrator (L1) | 2026-11-14 |
| AR-03-02 | T-03-05 | 构建产物的时间戳可核对；文档与 UAT 都不把它算作本次证据 | orchestrator (L1) | 2026-11-14 |
| AR-03-03 | T-03-06 | 不签名、不分发，符合「个人 fork，不参与上游流程」的项目约束 | orchestrator (L1) | 2026-11-14 |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-11-14 | 7 | 7 | 0 | orchestrator (ASVS L1, source-derived) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-11-14 (L1 depth, self-authored)

**未完成项（不属安全计分）：** NSIS 安装包未在本轮产出；`pack` 在 electron-builder 的配置校验阶段报 `unknown property '__esModule' / 'getConfig'`，与 `fork` 键无关（错误信息不含任何本次新增的键），已按预置工具链缺陷记录。
