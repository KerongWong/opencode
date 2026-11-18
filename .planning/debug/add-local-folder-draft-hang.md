---
slug: add-local-folder-draft-hang
status: resolved
trigger: Add local folder 新增的工程，自动打开的草稿发送挂起（转圈、零网络请求），且会话头不显示 git 分支名
created: 2026-11-18
updated: 2026-11-18
---

# Debug: add-local-folder-draft-hang

## Symptoms

- expected: Add local folder 后自动打开的草稿可正常发送；会话头/草稿栏显示 git 分支名
- actual: 发送后按钮一直转圈，零网络请求、零报错；分支图标旁无分支名（截图复现：codex-proxy 草稿发 hello 挂起）；30s 超时回滚也无效
- error: 无报错。服务端无辜（POST /api/session 对不存在目录也仅 68ms）；挂起在客户端 `tabs.prepareSession` 的 `startTransition` 永不 settle
- timeline: v2.1 NAV-01（add-open-machine）起；2026-11-18 两次误诊已排除 —— ①"目录不存在"说（被真实 git 仓库复现推翻）；②"请求队列饱和"说（slow 分类修复 a3f18c8d5f 已入库但已证实非本 bug 根因）
- repro: 侧栏 Add local folder → 自动展开该行并打开草稿（"No sessions yet"）→ 输入发送 → 挂起。普通"新建会话"草稿发送正常（同应用同服务）

## Prior records（先前排查，勿重复推翻已证事实）

- `.planning/todos/pending/add-open-draft-hang.md` — 主记录：已确认 hang 在客户端、发出 fetch 之前（`new-session/composer-adapter.ts` 的 `await pending.ready` 永不 settle）；与普通草稿唯一差异是 draft tab 的 `directory` 值；worktree create 路径与 MCP phase 已排除；附带的"文件夹选择器允许登记不存在的路径"为独立待修项
- `debug-file-picker-popup.md`（仓库根）— 复现脚本插曲记录；日志位置：`C:\Users\theso\.local\share\opencode\log\opencode.log`
- `packages/app/repro.debug.ts` — CDP 复现脚本（注意：文件内中文字符串乱码，'新建会话'/'选择文件夹' 需修编码后才能 AppActivate 匹配窗口标题）
- 分支不显示：分支名来自 `server.ctx.data.location.vcs.info({ directory })?.branch.current`（session-identity-header.tsx SessionLocation），依赖对该 directory 的 vcs.sync 完成；add-folder 流程是否触发/完成该 sync 未排查

## Current Focus

- hypothesis: 已解决——locationResource 的 alias 缺失 + 跨拼写刷新不传播（见 Resolution）
- test: 已完成（web 端到端复验 + client 单测回归）
- expecting: —
- next_action: 用户审阅工作区改动（未提交：`packages/client/src/solid/data.ts`、`packages/client/test/solid-data.test.ts`）

## Evidence

- 2026-11-18 (web 复现环境搭建): 4096 后端密码为启动时随机生成且不可恢复（service.json 是 service 模式的，dev serve 不写）；已另起第二个后端 `OPENCODE_PASSWORD=debugpw-gsd-4097` 于 127.0.0.1:4097（用户进程未动），用现有 4444 app dev server + Playwright(msedge headless) 连接成功
- 复现仓库： `C:\Users\theso\AppData\Local\Temp\opencode\repro-repo*`（真实 git 仓库，分支 main）
- **WEB 端成功复现挂起**：workspace sidebar（需设置 tabLayout=Projects）Add local folder → 自动草稿（`/new-session?draftId=...`）→ 输入发送 → URL 停留草稿页、25s 内仅 `/api/info` 轮询、零 session 请求（与桌面端症状完全一致）
- 运行时证据链（临时插桩日志，已验证）：
  1. 发送后 composer submit 机器进入 `held` 状态且永不退出（`[dbg] submit dispatch submit -> held`，无后续 effects）
  2. `held` 等待的条件 `composer/selection.ts loading()` 永真：`selection.ready=true`、`providers.ready=true`，但 **`agentMissing=true` 永远不变**
  3. `data.location.agent.list({ directory })` 对 add-folder 草稿目录永不返回——服务器把目录规范化为反斜杠形式（实测响应 `location.directory=C:\Users\theso\AppData\Local\Temp\opencode\repro-repo5`），而草稿 tab 的 directory 是客户端规范化正斜杠形式（`C:/Users/.../repro-repo5`，workspace-sidebar/registry.ts `normalizeDirectory` 刻意折叠）
  4. SDK `packages/client/src/solid/data.ts` 的 `locationResource` 只在 `alias: true` 时把响应同时发布到"请求的 key"：`model`/`provider` 有 alias（所以 ready 能变 true），**`agent`（2178 行）与 `vcs`（1528 行）没有 alias** → 响应只发布到反斜杠 canonical key，正斜杠 key 永远读不到
- 结论：`agent` 无 alias → composer loading 永真 → submit 永久 held（发送挂死，零网络请求）；`vcs` 无 alias → 草稿栏/会话头分支名读不到（同一根因的两个症状）
- 临时插桩位置（修复验证后必须移除）：sidebar.tsx（3 处 [dbg]）、tabs.tsx（newDraft/prepareSession）、composer-adapter.ts（adapter.start）、submit.ts（dispatch/session.start/startSession）、selection.ts（loading）

## Eliminated

- hypothesis: 目录不存在导致挂起 — eliminated: 真实 git 仓库（opencode-usage-document、codex-proxy）同样复现（2026-11-18 记录）
- hypothesis: 请求队列饱和堵死 session.create — eliminated: 服务端 68ms 实测 + 挂起期间 /api/info 轮询正常 + slow 分类修复后新安装包仍复现（a3f18c8d5f 非根因）
- hypothesis: worktree create / MCP phase 卡住 — eliminated: 草稿未动 MCP 时直达 session.create；worktree 默认 "last-used"→"main"（2026-11-18 记录）

## Resolution

**根因（AND 两门，同一根源）**：客户端对目录有两种拼写——workspace registry 的规范化正斜杠拼写（`C:/Users/...`，`normalizeDirectory` 刻意折叠）与服务端规范化反斜杠拼写（`C:\Users\...`，实测 `/api/agent`、`/api/vcs` 响应的 `location.directory`）。SDK `packages/client/src/solid/data.ts` 的 `locationResource` 把同步响应只发布到服务端 canonical key，`alias: true` 才会同时发布到请求的 key：

1. **发送挂死**：`agent` 资源（原 2178 行）缺 `alias: true` → add-folder 草稿用正斜杠 key 永远读不到 agent 列表 → `composer/selection.ts loading()` 永真 → composer submit 机器永久停在 `held`（运行时日志实证：`submit -> held` 后无后续；`agentMissing=true` 永不翻转）→ 零网络请求转圈。普通草稿不挂是因为其目录在服务端记录的 canonical 拼写恰好与客户端一致（无拼写分叉）。
2. **分支名不显示**：`vcs` 资源（原 1528 行）同样缺 alias；且首sync（正斜杠）返回空 `{branch:{}}`（provider 未就绪），后续带完整分支数据的刷新走反斜杠 key，正斜杠 key 永远停在空数据。

**修复**（`packages/client/src/solid/data.ts`，未提交，留在工作区）：
- `vcs`、`agent` 的 `locationResource` 加 `{ alias: true }`（与 `model`/`provider` 一致）
- `locationResource` 新增 canonical→requested-key 注册表（`aliases` Map）：alias 资源在 sync 响应 canonical≠requested 时登记，之后**任何**拼写下的 sync 发布到 canonical 时同步刷新所有已登记别名——解决"首响应空数据、后续刷新走另一拼写"的跨拼写陈旧问题
- 回归测试 `packages/client/test/solid-data.test.ts`："answers agent and VCS reads from the requested spelling when the server canonicalizes the directory"（无修复时失败、有修复时通过，含跨拼写刷新断言）

**验证**：
- web 端完整复现→修复→复验：add-folder 草稿发送后晋升真实 session（URL `/session/ses_...`，`POST /api/session` 发出），草稿栏显示分支 `main`；截图 `shot-60-branch-fixed.png`（临时目录已清理）
- `cd packages/client && bun check --no-script`：无类型错误；`bun test`：259 pass / 0 fail（exit 1 为预先存在的环境告警"Background service is unresponsive"，与本修复无关，首次全量测试即存在）
- 临时插桩已全部移除（`git diff --stat` 仅 2 个文件：data.ts + solid-data.test.ts）
- 桌面端即用构建（2026-11-19）：`OPENCODE_CHANNEL=projects` 源码构建 CLI（v2.3.2-projects.1，独立 service-projects.json/端口/数据库，与官方安装并存不顶替）+ desktop build/pack；产物 `dist/desktop/app/OpenCode Projects.exe`（免安装）；修复已确认编入 app.asar（renderer sourcemap 含 `canonical → requested-key registry`）；待用户运行复验原两症状

**遗留/预防**：
- 同类 latent 风险：`locationResource` 无 alias 的其它资源（`command`、`integration`、`mcpServer`、`reference`、`shell`、`usageLimits`、`config`、`websearch`）在目录拼写分叉时同样可能读到陈旧/缺失数据，本次无症状未动（最小变更原则）
- `location.syncInfo` 的 `info` 仍只发布 canonical key（`data.location.info({正斜杠})` 会 miss 并回落）——本次症状不依赖它，未动
- 为什么没早被发现：无 gate 覆盖"客户端规范化拼写 ≠ 服务端 canonical 拼写"的路径（旧测试 mock 均让响应 location 与请求一致）；守卫 = 本次新增的 alias 回归测试
- 附带待修项（独立于本 bug，沿用既有记录）：文件夹选择器允许登记不存在的路径
- 复验副作用说明：packages/client 全量测试会与本机 background service 交互（预先存在的测试行为），用户 4096 dev 后端与桌面进程均未受影响、仍在运行
