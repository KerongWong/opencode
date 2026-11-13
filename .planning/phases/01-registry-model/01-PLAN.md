---
phase: 01-registry-model
plan: 1
type: execute
wave: 1
depends_on: []
files_modified:
  - packages/app/src/workspace-sidebar/registry.ts
  - packages/app/src/workspace-sidebar/registry.test.ts
autonomous: true
requirements: [REG-01, REG-02, REG-03, PST-02]
estimate:
  tokens: 42000
  raw_tokens: 28000
  tasks: 3
  confidence: low
must_haves:
  truths:
    - 同一目录换一种写法再次登记会复用既有记录：不产生第二行、`removedAt` 被清空、`title` 与 `order` 原样保留、`directory` 保持首次写入的归一拼写。
    - 新记录存的是 `normalizeDirectory(input, platform)` 的结果，不是选择器给的原始拼写：win32 下 `D:\code\app` 落库为 `D:/code/app`；再次登记 `d:/CODE/app/` 不会改写首次的 `D:/code/app`。
    - 归一由显式 `platform` 参数决定：`\`→`/`、折叠重复分隔符、去尾分隔符、win32 盘符大写且盘符根保留 `C:/`；相等比较只在 `win32` 下忽略大小写，`linux` / `darwin` 保持敏感。
    - 映射 hostPlatform 把宿主 OS（`Platform["os"]`，即 `DesktopOS | undefined`）转换成归一平台：macos→darwin、windows→win32、linux→linux，Web（`os` 缺失）退回 linux；Phase 2 只用它推导平台。
    - 移除只写 `removedAt`，记录不删除；再次登记回到原显示名与原顺序。
    - 新登记追加到 `order` 末尾（大于所有既有序号，含已移除项），默认标题取目录最后一段，根目录取 `/` 或盘符 `C:`（存储形式 `C:/`）。
    - 模块零 I/O：不读目录、不发请求、不写 project；持久化契约是 `Persist.serverGlobal(scope, "workspace-registry.v1")`，其 key 字面量由本模块的测试断言，跨 scope 隔离由 `storage.test.ts` 拥有。
  artifacts:
    - path: packages/app/src/workspace-sidebar/registry.ts
      provides: 归一、认领/复用、移除/恢复、order、默认标题、hostPlatform 映射、按 server 的持久化目标
    - path: packages/app/src/workspace-sidebar/registry.test.ts
      provides: 上述全部契约的唯一 owner（每条用例在实现前失败）
  key_links:
    - from: packages/app/src/workspace-sidebar/registry.ts
      to: packages/app/src/runtime/persistence/storage.ts
      via: Persist.serverGlobal(scope, "workspace-registry.v1") 生成登记表存储目标（PST-02）
    - from: packages/app/src/workspace-sidebar/registry.test.ts
      to: packages/app/src/workspace-sidebar/registry.ts
      via: 归一矩阵、hostPlatform 表、重复登记复用、移除/恢复、order、默认标题、持久化 key 字面量
---

<objective>
把「哪些本地文件夹是工作区」变成可单测的唯一真相：一个纯模块 `packages/app/src/workspace-sidebar/registry.ts`，以归一后的绝对路径为主键，负责认领/复用、移除/恢复、order 与默认标题，并以 `Persist.serverGlobal(scope, "workspace-registry.v1")` 声明按 server 隔离的持久化形状；全部语义由 `registry.test.ts` 在实现前先失败地钉住。

Purpose: Phase 2 的行渲染、会话投影与全部交互都只能从这张表读行；表本身的语义一旦含糊（重复登记、移除、顺序、大小写），后面的可见性规则就会以「双真相」的形式补丁化。SPEC §5.3 已经把「让兜底分组不存在」定为成本最低的鲁棒性来源，前提就是这里没有第二条行源。

Output: `registry.ts` + `registry.test.ts`；映射 REG-01、REG-02、REG-03、PST-02。

Scope boundaries（显式不做）：
- 不做 `rename` / 拖拽 `reorder`（UX-01、UX-03 属 Phase 2）、不做 `session.list` 与 REG-04 的服务端拼写校准、不做事件映射与任何 UI。
- 不 import `fs`、`location`、`session`、`project`；不发请求；模块顶层不读全局。
- 不改 `packages/server`、`packages/protocol`、`packages/core`；不新增迁移或端点。
- 交接说明：本 phase 在 win32 下把盘符大写，服务端保存的会话拼写可能不同；Phase 2 的 REG-04（登记后用 `session.list` 返回的 `location.directory` 校准）负责两端一致，此处只做归一后的内部主键，不要在本 phase 引入查询。Phase 2 取平台必须走 `hostPlatform(os)`，由本 phase 定义并测试。
</objective>

<execution_context>
@C:/Users/theso/.config/opencode/gsd-core/workflows/execute-plan.md
@C:/Users/theso/.config/opencode/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/REQUIREMENTS.md
@.planning/phases/01-registry-model/01-CONTEXT.md
@docs/designs/workspace-registry-sidebar.md

必需先读（执行前重读，不要凭记忆）：
- `packages/app/src/runtime/persistence/storage.ts` — `persisted()` 签名与 `Persist.serverGlobal` 的返回形状。注意 `PersistTarget` **没有导出**，返回类型用 `ReturnType<typeof Persist.serverGlobal>`（`serverGlobal` 见 `:456-460`）。
- `packages/app/src/settings/models/models.tsx` 第 55–59 行 — `persisted(Persist.serverGlobal(scope, key), schema, initial)` 的既有先例。
- `packages/app/src/composer/schema.ts` 第 32 行 — `Persistence.struct` 的既有写法（`TextPart`）。
- `packages/app/src/runtime/persistence/schema.ts` — `Persistence.struct` / `optional` / `array` 的语义（`array` 已自带逐条恢复，其契约由 `schema.test.ts` 拥有，不要在本 phase 重复测）。
- `packages/app/src/runtime/platform/platform.tsx` — 宿主 OS 的既有词汇是 `DesktopOS = "macos" | "windows" | "linux"`（`:26`）：桌面端有可选 `os`（`:147`），Web 端 `os?: never`（`:144`）。`DesktopOS` **没有导出**，所以参数类型写 `Platform["os"]`（已导出的 `Platform` 上它解析为 `DesktopOS | undefined`），不要复制一份字面量联合；本 phase 的 `HostPlatform` 只能从这个词汇映射出来。
- `packages/app/src/shell/tabs/tabs.test.ts` 第 184–214 行 — `setSystemTime` + `afterEach(() => setSystemTime())` 的既有用法；时间必须用这种方式控制。
- `packages/app/AGENTS.md` §Tests — 一个契约一个 owner；不读目录内容；测试必须能失败；**不为测试加生产 seam（无 `now` / `delay` / `budget` 参数），时间用 `setSystemTime` 控制**。

既有前提：
- 本分支从 `upstream/dev` 切出，v1.0 的 `projects.*` 文件不存在，不要引用它们。
- `comparablePath` 定义在 `@opencode/util/path`（`packages/util/src/path.ts:51`）；`packages/app/src/workspaces/path-key.ts` 只是把它包成 `pathKey`。它不能复用：按字符串形状猜平台、不折叠重复分隔符、没有盘符大写，无法满足 REG-03 的显式平台契约。
- 本机整包 `bun typecheck` 因 `custom-elements.d.ts` 符号链接缺陷失败，与本 phase 无关；门用文件级 `bun check --no-script <files>`。
</context>

<tasks>

<task type="tracer" tdd="true">
  <name>任务 1：端到端「重复登记复用既有记录」— 只走一条路径</name>
  <files>packages/app/src/workspace-sidebar/registry.test.ts, packages/app/src/workspace-sidebar/registry.ts</files>
  <read_first>
    - .planning/phases/01-registry-model/01-CONTEXT.md（锁定取舍与验收门）
    - docs/designs/workspace-registry-sidebar.md §4.3（记录形状）、§4.4（归一步骤与 realpath 限制）、§9（语义表）
    - packages/app/src/runtime/persistence/storage.ts（`persisted()`、`Persist.serverGlobal`、`ServerScope` 的用法）
    - packages/app/src/settings/models/models.tsx 第 55–59 行（`persisted(Persist.serverGlobal(...))` 的既有写法）
    - packages/app/src/composer/schema.ts 第 32 行（`Persistence.struct` 的既有写法）
    - packages/app/src/runtime/platform/platform.tsx 第 24–33、142–152 行（`DesktopOS` 与 Web 端的 `os?: never`）
    - packages/app/src/shell/tabs/tabs.test.ts 第 183–214 行（`setSystemTime` 与 `afterEach` 复位）
    - packages/app/AGENTS.md §Tests（测试必须先能失败；不加生产 seam；时间用 `setSystemTime`）
  </read_first>
  <behavior>
    - 先写测试：一条已登记、带 `removedAt` 的记录，用同一目录的另一种写法（大小写/分隔符不同）再次 `register` → `entries` 长度不变，该记录 `removedAt` 清空，`title`/`order`/`createdAt` 原样保留，返回的 `entry` 就是这条记录。
    - 同一用例断言存储形式：首次 `register([], { directory: "D:\\code\\app", platform: "win32" })` 后 `entry.directory === "D:/code/app"`；再用 `d:/CODE/app/` 登记，`entries[0].directory` 仍是 `"D:/code/app"`（归一拼写不随第二次写法改写）。
    - 先写另一条：用一个已可见记录再次 `register` → 返回的 `entries` 是同一个引用（不产生无意义的 store 写入）。
    - 先写第三条：未登记目录 `register` → 追加一条，`directory` 等于 `normalizeDirectory(input, platform)`，`title` 为归一目录的最后一段，`createdAt` 等于 `setSystemTime(...)` 设定的时刻，`order` 大于既有序号。
    - 时间用 `setSystemTime(1_000)` 设定、`afterEach(() => setSystemTime())` 复位；`register` 不接受 `now` 之类的参数。
    - 三条用例在 `registry.ts` 存在之前必须因模块不存在而失败；实现后全绿。
  </behavior>
  <action>
    按 TDD 顺序：先建 `packages/app/src/workspace-sidebar/registry.test.ts` 写上述用例并运行测试命令确认 RED（模块不存在就是 RED，不要先写实现），再建 `registry.ts` 让其转绿。

    `registry.ts` 本任务只交付这一条路径所需的最小面：
    - 导出 `HostPlatform = "win32" | "darwin" | "linux"`，导出 `REGISTRY_KEY = "workspace-registry.v1"`。
    - 用 `Persistence.struct`（字段 `directory: Schema.String`、`title: Schema.String`、`order: Schema.Number`、`createdAt: Schema.Number`、`removedAt: Persistence.optional(Schema.Number)`）定义 `WorkspaceEntrySchema`，并 `export type WorkspaceEntry = typeof WorkspaceEntrySchema.Type`（与本仓 `src/composer/schema.ts` 的 `TextPart` 同形）。
    - `normalizeDirectory(input, platform)`：把 `\` 全量换成 `/`，后续交给任务 2 的折叠/尾分隔符/盘符规则；本任务先把结果作为主键使用。用注释写明：客户端没有 `fs`，无法 realpath，符号链接别名会登记成两个工作区，这是已承认的残余。
    - `directoryKey(directory, platform)`：`win32` 返回归一后的小写形式，其余平台返回归一后的原样；它只用于比较，不用于存储。
    - `register(entries, input)`，`input` 形如 `{ directory, platform }`，返回 `{ entries, entry }`：先按 `directoryKey` 查既有记录。命中且 `removedAt !== undefined` 时返回新数组，该记录写成 `{ ...existing, removedAt: undefined }`（`directory`/`title`/`order`/`createdAt` 不动）；命中且已可见时原样返回同一个 `entries` 引用（复用即无操作，避免无谓写入）。未命中则追加新记录：`directory` 存 `normalizeDirectory(input, platform)`（**不是**选择器给的原始拼写），本任务先用 `order = entries.length`、`title` 取归一目录的最后一段（朴素切分）、`createdAt = Date.now()`；任务 3 再补齐「大于所有既有序号」与根目录标题。
    - 时间在模块内读取：`register` 自己调用一次 `Date.now()` 作为 `createdAt`。测试用 `setSystemTime(...)` 控制它，不要给生产函数加 `now` / `delay` / `budget` 参数。

    硬约束：本文件不 import `fs` / `location` / `session` / `project`，不发请求，模块顶层不读全局；`platform` 一律显式传参。不要调用 `comparablePath`（理由见 context）。注释只解释非显然约束（realpath 残余、`directoryKey` 仅用于比较），不要写空泛说明。
  </action>
  <verify>
    <automated>cd packages/app && bun test --conditions=solid --isolate --preload ../ui/test/solid-jsx.ts --preload ./happydom.ts src/workspace-sidebar</automated>
    <automated>cd packages/app && bun check --no-script src/workspace-sidebar/registry.ts src/workspace-sidebar/registry.test.ts</automated>
  </verify>
  <acceptance_criteria>
    - 用例先失败（模块不存在）后全绿。
    - 测试没有为测试新增生产导出、参数（`now` / `delay` / `budget`）、开关或 `data-*`；时间用 `setSystemTime` 设定、`afterEach` 复位，生产签名里没有时间参数。
    - 重复登记在任何大小写/分隔符写法下都只有一条记录，`removedAt` 清空，`title` 与 `order` 未被改写，`directory` 保持首次写入的归一拼写。
    - 新增记录存 `normalizeDirectory(input, platform)` 的结果：`D:\code\app` → `D:/code/app`，第二次用 `d:/CODE/app/` 登记不改写它。
    - `registry.ts` 无 `fs` / `session` / `location` / `project` import。
    - 文件级 type gate 0 诊断。
  </acceptance_criteria>
  <done>重复登记复用既有记录这条路径端到端跑通（测试 → 实现 → 绿），两条命令均通过且已提交。</done>
</task>

<task type="auto" tdd="true">
  <name>任务 2：REG-03 归一与比较的完整平台矩阵 + `hostPlatform` 映射</name>
  <files>packages/app/src/workspace-sidebar/registry.test.ts, packages/app/src/workspace-sidebar/registry.ts</files>
  <read_first>
    - docs/designs/workspace-registry-sidebar.md §4.4（归一步骤固定为：`\`→`/` → 折叠重复分隔符 → 去尾分隔符 → Windows 盘符大写；比较时 win32 不区分大小写）
    - packages/util/src/path.ts 第 35–72 行（`comparablePath` / `sameDirectory` 已覆盖与未覆盖的边界；注意它把盘符根保留为 `C:/`，确认不能直接复用）
    - packages/core/src/database/path.ts 第 1–30 行（服务端只做 `\`→`/`、不改大小写、不 realpath；`isWindowsStoragePath` 需要 `^[A-Za-z]:/`，所以 `C:` 会被判为非法）
    - packages/app/src/runtime/platform/platform.tsx 第 24–33、142–152 行（`DesktopOS` 词汇与 Web 端 `os?: never`；`DesktopOS` 未导出，用 `Platform["os"]`）
    - .planning/phases/01-registry-model/01-CONTEXT.md（归一与比较的锁定取舍）
  </read_first>
  <behavior>
    先扩充 `registry.test.ts`，用表驱动（`test.each` 或同一 `describe` 下的用例数组）覆盖 `normalizeDirectory`：
    - win32：`D:\code\app\` → `D:/code/app`；`D:/a//b/` → `D:/a/b`；`c:/x` → `C:/x`；`c:/` → `C:/`；`C:` → `C:/`；`C:\` → `C:/`；`\\server\share\x\` → `//server/share/x`（前导双斜杠保留，不得退化成正斜杠绝对路径）。
    - 盘符根必须保留 `C:/` 而不是 `C:`：服务端 `isWindowsStoragePath` 只认 `^[A-Za-z]:/`，Phase 2 会把 `entry.directory` 原样发给 `session.list`，`C:` 会匹配零条会话；`C:/` 的默认标题是 `C:`（由任务 3 的 `defaultTitle` 用例从 `C:/` 出发断言）。
    - linux：`/home/me/proj/` → `/home/me/proj`；`/a//b` → `/a/b`；`/` → `/`；大小写原样保留。
    - darwin：分隔符与尾斜杠规则同 linux，大小写原样保留。
    再覆盖 `directoryKey`：
    - win32 下 `D:/Proj` 与 `d:/proj` 相等（复用即靠它）。
    - linux 与 darwin 下 `D:/Proj` 与 `D:/proj` 不相等，并在实现处注释说明：大小写不敏感文件系统（默认 APFS / NTFS）上可能出现两条指向同一目录的行，与符号链接别名同属已承认的残余。
    再为 `hostPlatform` 建一张小表（参数类型 `Platform["os"]`，即 `DesktopOS | undefined`）：
    - `hostPlatform("macos") === "darwin"`；`hostPlatform("windows") === "win32"`；`hostPlatform("linux") === "linux"`；`hostPlatform(undefined) === "linux"`（Web 无宿主 OS，目录选择器也仅桌面可用，按 POSIX 规则处理）。
    这些行必须先在任务 1 的实现上失败（重复分隔符、UNC、盘符根、平台差异、缺少 `hostPlatform`），补齐实现后全绿。
  </behavior>
  <action>
    先写测试并运行确认 RED，再改 `normalizeDirectory` 与导出面：
    - 折叠重复分隔符时先判前导前缀：输入以 `//` 开头且不是 `///` 时保留 `//`（UNC），其余部分才把连续 `/` 折成一个。
    - 盘符处理：`platform === "win32"` 时把行首单个字母加冒号大写；随后判根——结果为 `/` 时原样返回 `/`；匹配 `^[A-Za-z]:$`（如 `C:`）时返回 `${value}/`；匹配 `^[A-Za-z]:/$` 时保留并返回（`C:/`）；其余情况去掉尾部 `/` 直到只剩路径本体。**不要**把盘符根剥成 `C:`：服务端的 `isWindowsStoragePath` 只认 `^[A-Za-z]:/`。
    - 导出 `hostPlatform(os: Platform["os"]): HostPlatform`（`DesktopOS` 未导出，从已导出的 `Platform` 取同一词汇）：`macos → "darwin"`、`windows → "win32"`、`linux → "linux"`、`undefined → "linux"`。这是本 phase 对「宿主 OS 词汇」的唯一边界；Phase 2 必须用 `hostPlatform(platform.platform === "desktop" ? platform.os : undefined)` 取平台，不要自己猜字符串形状或复制一份映射。
    - 导出 `directoryKey`，并让它成为 `register` /（任务 3 的）`remove` 唯一的比较入口，避免在别处重复写「win32 才小写化」。
    不要借 `comparablePath`：它按 `value[1] === ":"` 判断 Windows、不折叠重复分隔符、没有盘符大写，且无法接受平台参数；这里需要的是「同一路径的不同写法 → 同一主键」这一条可由单测逐条断言的契约。
  </action>
  <verify>
    <automated>cd packages/app && bun test --conditions=solid --isolate --preload ../ui/test/solid-jsx.ts --preload ./happydom.ts src/workspace-sidebar</automated>
    <automated>cd packages/app && bun check --no-script src/workspace-sidebar/registry.ts src/workspace-sidebar/registry.test.ts</automated>
  </verify>
  <acceptance_criteria>
    - 归一矩阵每一行在实现前失败、实现后通过，且每行只出现一次（不按平台重复同一行为）。
    - win32 的盘符大写、盘符根保留 `C:/`、重复分隔符折叠、UNC 前缀保留、POSIX 根 `/` 五类边界都被覆盖。
    - `c:/`、`C:`、`C:\` 都归一到 `C:/`（存储形式），并说明标题 `C:` 由任务 3 断言。
    - `hostPlatform` 四行映射（macos/windows/linux/undefined）由表驱动用例钉住；生产代码里没有第二份平台映射。
    - `directoryKey` 的 win32 不敏感 / linux 与 darwin 敏感由用例分别钉住，且 `register` 只通过它做比较。
    - 文件级 type gate 0 诊断。
  </acceptance_criteria>
  <done>REG-03 的归一与比较契约全部由表驱动用例钉住，`hostPlatform` 成为宿主 OS 的唯一映射，实现在任意机器上按显式 `platform` 可测。</done>
</task>

<task type="auto" tdd="true">
  <name>任务 3：移除/恢复、order、默认标题与按 server 隔离的持久化形状</name>
  <files>packages/app/src/workspace-sidebar/registry.test.ts, packages/app/src/workspace-sidebar/registry.ts</files>
  <read_first>
    - docs/designs/workspace-registry-sidebar.md §4.3（`persisted(Persist.serverGlobal(serverScope, "workspace-registry.v1"), schema, { entries: [], scrollTop: 0 })`）、§9（移除、恢复、排序、默认名）
    - packages/app/src/runtime/persistence/storage.ts（`Persist.serverGlobal` 的 `key` 形状：local 原样、远端由 `ScopedKey.from` 组成；跨 scope 隔离契约归 `storage.test.ts`，这里只为读懂 key 字面量）
    - packages/app/src/runtime/persistence/storage.test.ts 第 59–65 行（server global 的跨 scope 隔离由它拥有，本 phase 不重复断言）
    - packages/app/src/runtime/persistence/schema.ts（`Persistence.array` 的逐条恢复已由 `schema.test.ts` 拥有，本任务只断言登记表自身的编解码形状）
    - packages/app/src/runtime/server/scope.ts（`ServerScope.local`、`ScopedKey.from` 的 key 组成）
  </read_first>
  <behavior>
    先补测试并确认 RED，再补齐实现：
    - `defaultTitle`：`/` → `/`；`C:/` → `C:`；`D:/code/app` → `app`；`//server/share` → `share`。
    - 追加顺序：既有 `order` 为 0 与 5、且 5 那条已移除时，新登记 `order` 为 6；不插进中间，也不复用已移除项的序号。
    - `remove(entries, { directory, platform })`：只写 `removedAt = Date.now()`，记录仍在、长度不变；对已移除项再次移除保持首个时间戳并返回同一个 `entries` 引用；对未登记目录是无操作（返回同一个引用，不追加）。时间同样用 `setSystemTime` 控制。
    - 移除后再 `register`：`title` 与 `order` 与移除前一致（用手工构造的、带自定义 `title` 的记录做 fixture，证明标题不跟随目录名），`removedAt` 清空。
    - `visible(entries)`：过滤 `removedAt !== undefined`，按 `order` 升序。
    - 持久化形状：`WorkspaceRegistrySchema` 编解码保留 `{ directory, title, order, createdAt, removedAt? }` 与 `scrollTop`；没有 `removedAt` 的记录编码后不带该键。
    - PST-02（只断言 registry 拥有的那一半）：`registryTarget(ServerScope.local).key === "workspace-registry.v1"`。跨 scope 的 key/storage 隔离由 `storage.test.ts:59-65` 拥有，这里不再断言。
  </behavior>
  <action>
    先写测试并运行确认 RED，再补齐：
    - 导出 `WorkspaceRegistrySchema`（`Persistence.struct({ entries: Persistence.array(WorkspaceEntrySchema), scrollTop: Schema.Number })`）、`type WorkspaceRegistry = typeof WorkspaceRegistrySchema.Type`、`initialRegistry: WorkspaceRegistry = { entries: [], scrollTop: 0 }`。`scrollTop` 属于 SPEC §4.3 的持久化形状，本 phase 只声明字段，不读写滚动。
    - 导出 `registryTarget(scope: ServerScope)`，实现就是 `Persist.serverGlobal(scope, REGISTRY_KEY)`，返回类型写 `ReturnType<typeof Persist.serverGlobal>`（`PersistTarget` 未导出）。不要把 `persisted(...)` 的调用搬进本模块：Phase 2 在自己的组件里调用 `persisted(registryTarget(scope), WorkspaceRegistrySchema, initialRegistry)`，本 phase 只负责 key 与 scope 契约，避免把 Solid owner 依赖带进纯模块。
    - 加 `defaultTitle(directory)`：先去掉尾部 `/`，取最后一个 `/` 之后的部分；结果为空时返回 `directory` 本身（`/` 因此成立，`C:/` 因此得到 `C:`）；`register` 的新增分支改用它。
    - `register` 的新增分支把序号改为「所有既有记录（含已移除）的 `order` 最大值 + 1」，空表从 0 开始。
    - 加 `remove(entries, input)`，`input` 形如 `{ directory, platform }`：按 `directoryKey` 命中且未移除时返回新数组并写 `removedAt = Date.now()`；其余情况原样返回同一个 `entries` 引用。移除绝不删除记录、不做任何 I/O、不接受 `now` 参数。
    - 加 `visible`：过滤后按 `order` 升序返回新数组（`Array.prototype.sort` 稳定，序号由构造保证唯一，不要额外编造 tie-break）。
    - 保留 `register` 复用分支的语义不变：清 `removedAt`、保留 `title` 与 `order`。
    不要再为「持久化数组逐条恢复」写用例 —— 那是 `Persistence.array` 的契约，`schema.test.ts` 已是 owner；也不要再为跨 scope 隔离写用例 —— `storage.test.ts:59-65` 是 owner。这里只测登记表自己的编解码形状与 key 字面量。
  </action>
  <verify>
    <automated>cd packages/app && bun test --conditions=solid --isolate --preload ../ui/test/solid-jsx.ts --preload ./happydom.ts src/workspace-sidebar</automated>
    <automated>cd packages/app && bun check --no-script src/workspace-sidebar/registry.ts src/workspace-sidebar/registry.test.ts</automated>
  </verify>
  <acceptance_criteria>
    - 移除只写 `removedAt`（模块内读 `Date.now()`，测试用 `setSystemTime`）；再次登记回到原 `title` 与原 `order`；新登记序号大于所有既有序号（含已移除）。
    - 默认标题对 `/`、`C:/`、普通目录、UNC 共享四种输入正确（`C:/` → `C:`）。
    - `registryTarget(ServerScope.local).key` 等于 `"workspace-registry.v1"`（persisted key 即契约）；跨 scope 隔离由 `storage.test.ts:59-65` 证明，本 phase 不重复断言。
    - 编解码后记录字段与 `scrollTop` 完整，缺少 `removedAt` 的记录不会凭空得到该键。
    - 文件级 type gate 0 诊断。
  </acceptance_criteria>
  <done>登记表生命周期（追加/复用/移除/恢复）、顺序、默认标题与按 server 隔离的持久化 key 全部由测试钉住，模块仍为零 I/O 且生产签名无时间参数。</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | 描述 |
|----------|------|
| 用户/本机 → 登记表持久化文档 | `opencode.global.dat`（Web 落 `localStorage`，桌面落 `drafts.sqlite` 经 IPC）里的 JSON 可被用户、扩展或旧版本写坏 |
| 系统目录选择器 → `registry.ts` | 外部输入是一段绝对路径字符串，本 phase 只做字符串归一，不触碰文件系统 |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-01-01 | Tampering | 持久化的 registry 文档（`REGISTRY_KEY`） | medium | mitigate | 用 `Persistence.struct` / `optional` / `array` 声明形状，使坏字段与坏记录被逐条丢弃而不是让整表解码失败；本 phase 不写任何目录或会话数据 |
| T-01-02 | Information Disclosure | 归一后的绝对路径写入客户端持久化 | low | accept | 与本仓既有 `Persist.workspace`（key 已内嵌路径摘要）同一信任层级；不含凭据，不新增服务端面 |
| T-01-03 | Denial of Service | `entries` 数量无上限 | low | accept | 只能由用户逐个登记产生，无网络、无递归；查找为线性扫描，规模与手排工作区数量同阶 |
| T-01-SC | Tampering | 依赖安装 | low | accept | 本 phase 不新增任何依赖、不运行包管理器安装，无供应链面 |
</threat_model>

<verification>
在 `packages/app` 下按顺序执行（全部必须通过）：

1. 目标单测（本 phase 的 contract owner）
   `bun test --conditions=solid --isolate --preload ../ui/test/solid-jsx.ts --preload ./happydom.ts src/workspace-sidebar`
2. 文件级 type gate（整包 `bun typecheck` 因 `custom-elements.d.ts` 符号链接缺陷失败，与本 phase 无关，不计入判定）
   `bun check --no-script src/workspace-sidebar/registry.ts src/workspace-sidebar/registry.test.ts`
3. 改动文件 lint（在仓库根执行；未跟踪的新文件也会被检查）
   `bun script/lint-changed.ts`
4. 无越界改动（在仓库根执行）
   `git diff --name-only upstream/dev -- packages/` 只出现 `packages/app/src/workspace-sidebar/registry.ts` 与 `registry.test.ts`；`packages/server`、`packages/protocol`、`packages/core` 的 diff 为空。

人工复核（非阻塞）：打开 `registry.ts` 确认无 `fs` / `session` / `location` / `project` import，生产签名不含 `now` / `delay` / `budget`（时间在函数内用 `Date.now()` 读取），且 realpath 限制写在注释里。
</verification>

<success_criteria>
对齐 ROADMAP Phase 1 的五条：

1. 归一契约逐条可断言：`\`→`/`、折叠重复分隔符、去尾分隔符、win32 盘符大写且盘符根保留 `C:/`、比较不敏感；其余平台敏感；同一路径的不同写法归一到同一主键，用例实现前红、实现后绿。
2. 同一目录重复登记（含已移除记录）返回既有记录：不产生第二行、`removedAt` 清空、`title` 与 `order` 保留、`directory` 保持首次归一拼写；存储 key 字面量为 `workspace-registry.v1`，跨 serverScope 隔离由 `storage.test.ts` 证明。
3. 移除只写 `removedAt`，记录不删除；模块无 `fs`、无 `location.get`、无 project 写入；移除后再登记回到原显示名与原顺序。
4. 新登记追加到 `order` 末尾而不插进既有序列；默认标题取目录最后一段，根目录取 `/` 或盘符 `C:`（存储形式 `C:/`）；用户改过的标题在再登记时不被目录名覆盖。
5. 持久化契约落在 `Persist.serverGlobal(scope, "workspace-registry.v1")`；`hostPlatform` 是宿主 OS 的唯一映射；`packages/server`、`packages/protocol`、`packages/core` diff 为空。
</success_criteria>

<output>
Create `.planning/phases/01-registry-model/01-SUMMARY.md` when done
</output>
