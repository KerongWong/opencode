# Phase 2: 每个本地 checkout 成行 - Pattern Map

**Mapped:** 2026-11-13
**Files analyzed:** 4 个修改文件（+ 1 个可选 bench 文件）
**Analogs found:** 4 / 4（100%）；另附 6 个只读契约文件，planner 不得改动

范围约束（来自 CONTEXT.md / PROJECT.md）：只改 `packages/app`，不碰 `packages/server` / `packages/protocol`，不改 Phase 1 已收敛的行源（`mergeRootSessionIndex`、`inbox-sessions` 请求参数、`items()` 推导）。

---

## File Classification

| New/Modified File | Action | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|--------|------|-----------|----------------|---------------|
| `packages/app/src/shell/titlebar/projects.tsx` | modify | component | event-driven（挂载期一次性 fetch，fire-and-forget） | `packages/app/src/shell/titlebar/recent-sessions.tsx`（挂载期 `Map` 守卫 effect）+ `packages/app/src/home/model.ts`（`worktrees.list` 调用点） | role match（同组件族 + `.list` 驱动），flow 部分匹配 |
| `packages/app/src/shell/titlebar/projects-groups.ts` | modify | utility（纯函数） | transform | `packages/app/src/workspaces/paths.ts`（`workspaceSelectionDirectories` 合并去重）+ `packages/app/src/shell/layout/helpers.ts`（`projectForSession` 最近包含者排序） | exact（同工具族、同 `@opencode/util/path` 语义） |
| `packages/app/src/shell/titlebar/projects-groups.test.ts` | modify | test | transform | 自身现有 `describe` 表 + `packages/app/src/workspaces/inventory.test.ts`（表结构 / 失败即回归写法） | exact |
| `docs/designs/project-grouped-sessions-sidebar.md` | modify | doc | — | 自身 §已知取舍（126-131 行） | exact |
| `packages/app/perf/projects-groups.ts` + `packages/app/perf/projects-groups.bench.ts` | create（可选，仅当 D-09 需要 strobe） | test/bench | batch | `packages/app/perf/session-index.ts` + `packages/app/perf/session-index.bench.ts` | exact |

### Reference-only（**只读契约，本 phase 禁止修改**）

| File | 为什么读 | 为什么不能改 |
|------|----------|--------------|
| `packages/app/src/workspaces/inventory.ts` | `cached` / `list` / `refresh` 语义、`staleTime: 0` | 契约已有 owner（`inventory.test.ts`）；D-03 要求只用 `list` |
| `packages/app/src/runtime/server/sync.tsx` | `updated` 回调写回 `globalStore.project`；`worktree.updated` 重新 `list` | D-01 明确拒绝把请求挂在 `sync.tsx` / bootstrap（会为每个项目发请求） |
| `packages/app/src/runtime/server/global-sync/utils.ts` | `normalizeProjectInfo` 只把 canonical 放进 `worktrees` | 兜底动机来源，改动会扩散到 Phase 3 |
| `packages/app/src/shell/layout/helpers.ts` | `projectForSession` 的 sandbox/目录解析顺序 | 只借鉴思路，本 phase 不改归属解析 |
| `packages/app/src/workspaces/paths.ts` | `sandboxes` 语义（不含 canonical）、合并去重写法 | 不做 group key 统一（Phase 3） |
| `packages/app/src/shell/titlebar/inbox-model.ts` | `InboxEntry.ctx` / `entries()` 形状 | Phase 1 已收敛，禁改 `inbox-sessions` 与 `items()` |

---

## Pattern Assignments

### `packages/app/src/shell/titlebar/projects.tsx` (component, event-driven)

**Analog 组合：** `recent-sessions.tsx` 301-320（effect 内维护挂载期 `Map` 守卫）+ `home/model.ts` 66-81（`worktrees.list` 的唯一既有调用形态）

**是否需要新 import：** 不需要。`createEffect` / `on` 已在第 1 行导入：

```tsx
import { For, Match, Show, Switch, createEffect, createMemo, createSignal, on, onCleanup } from "solid-js"
```

#### 1. 读取入口形状（必须遵守）

`InboxEntry` 已带 `server`、`ctx`、`session`，无需再查 registry（`inbox-model.ts` 48-56）：

```ts
export type InboxEntry = {
  key: string
  conn: ServerConnection.Any
  server: ServerConnection.Key
  ctx: ServerCtx
  session: SessionInfo
  status: InboxStatus
  since: number | undefined
}
```

`ServerCtx.sync.worktrees` 是每服务器分区后的 query 封装（`sync.tsx` 191-199），只能服务自己的 scope：

```tsx
  return {
    data: globalStore,
    set: setGlobalStore,
    child: children.child,
    // bootstrap,
    updateConfig: updateConfigMutation.mutateAsync,
    project: projectApi,
    worktrees,
  }
```

项目归属沿用 `groups()` 已有的那一行（`projects.tsx` 77）：

```tsx
const project = entry.ctx.projects.forSession(entry.session)
```

#### 2. 挂载期守卫 effect（D-01 / D-02 / D-03 / D-04）

Analog（`recent-sessions.tsx` 301-320）：在一个 `createEffect` 里遍历连接，用模块外的 `Map` 记录「已经处理过谁」，并识别 ctx 被替换的服务器。

```tsx
  // First pages follow connection state: load on the first connect, refresh the snapshot on every reconnect or
  // context replacement, and forget pages whose server no longer has a controller.
  createEffect(() => {
    const list = connections()
    const visible = new Set<string>(list.map((item) => item.server))

    list.forEach((item) => {
      const status = item.ctx.sdk.connection.status()
      const previous = statuses.get(item.server)
      const replaced = !!previous && previous.ctx !== item.ctx

      statuses.set(item.server, { ctx: item.ctx, status })

      // A replaced controller owns no old requests or pin snapshots, even before it reconnects.
      if (replaced) dropServer(item.server)

      if (status !== "connected") return
```

本 phase 在 `SidebarProjects` 内（`projects.tsx` 55-67 附近，`removedKeys` 之前或 `groups` memo 之前）落一个同形状的 effect。建议形态（planner 可微调顺序，但双保险必须都在）：

```tsx
  // A project's metadata carries no worktrees, so the session index lists a checkout rather than the worktrees
  // inside it. Ask once per project per mount and skip anything already cached: `list` reads saved inventory with
  // `staleTime: 0`, so without the cache check every session update would refetch. Never `refresh` here: that
  // discovers external worktrees, and a failed read degrades to the `sandboxes` fallback until the next mount.
  const requestedWorktrees = new Set<string>()

  createEffect(() => {
    inbox.entries().forEach((entry) => {
      const project = entry.ctx.projects.forSession(entry.session)

      if (!project) return
      const key = `${entry.server}\u0000${project.id}`

      if (requestedWorktrees.has(key)) return
      requestedWorktrees.add(key)

      if (entry.ctx.sync.worktrees.cached(project.id) !== undefined) return
      void entry.ctx.sync.worktrees.list(project.id)
    })
  })
```

必须满足的语义（planner 在 plan 的 action 里逐条对齐）：

- **D-01**：请求只在这里发生。不进 `createSessionInbox`（Inbox 视图复用），不进 `sync.tsx` / bootstrap。
- **D-02**：`Set<`${server}\0${projectID}`>` **加** `cached(projectID) === undefined` 双保险。`Set` 挡住同挂载期重跑；`cached()` 挡住切走再切回（`inventory.ts` 57 的 `staleTime: 0` 不判空必然重发）。
- **D-03**：只调 `list`，永不 `refresh`。
- **D-04**：`.list` 自带 `.catch(() => undefined)`（`inventory.ts` 57），调用点不再包 try/catch、不 toast、不重试。
- **D-05**：不引入 loading / Suspense、不改滚动容器；首帧由 `sandboxes` 分组，清单到达后经 `sync.tsx` 的 `updated` → `setGlobalStore("project", …)` → `projects.list()` → `groups()` 自动重算。
- 不要用 `createMemo` 包 `cached()`：它是非响应式读（TanStack `getQueryData`），包成 memo 不会产生新的失效信号，只会误导。

#### 3. 禁止照搬的形态

`home/model.ts` 66-81 在 effect 里会 `refresh`（显式外部发现）：

```ts
    if (effect.type === "worktrees.refresh")
      return void global.serverCtx(effect.server)?.sync.worktrees.refresh(effect.projectID)
```

以及 `location-missing.tsx` 51-58 是 `refresh().then(list)`。**两者都不适用于本 phase**：D-03/STATE.md 明确「未加载是正常状态，不能在渲染中 refresh」。只抄 `list` 那一支与其 `.then` 收尾方式。

---

### `packages/app/src/shell/titlebar/projects-groups.ts` (utility, transform)

**Analog：** 同文件 + `workspaces/paths.ts` 16-24（合并去重）+ `shell/layout/helpers.ts` 31-66（最近包含者）

#### 1. 当前实现（要改的就是这一支）

`projects-groups.ts` 1-20：

```ts
import { comparablePath, containsDirectory } from "@opencode/util/path"

type ProjectDirectory = { readonly directory: string }

/**
 * The known project directory that owns a session directory, preferring the closest one. Sessions can run in a
 * subdirectory of a checkout, so a group follows the checkout instead of every subdirectory becoming its own row.
 */
export function sessionProjectDirectory(
  project: { readonly worktrees?: readonly ProjectDirectory[] } | undefined,
  directory: string,
) {
  const roots = project?.worktrees?.map((item) => item.directory) ?? []

  const owner = roots
    .filter((root) => containsDirectory(root, directory))
    .toSorted((a, b) => comparablePath(b).length - comparablePath(a).length)[0]

  return owner ?? directory
}
```

#### 2. 去重写法（照抄 `paths.ts` 的 `findIndex` 惯用法）

`paths.ts` 16-24：

```ts
/** Every non-root directory a new session can run in, from the server inventory and the project's cached lists. */
export function workspaceSelectionDirectories(project: WorkspaceProject, listed: readonly WorktreeDirectory[]) {
  return [
    ...listed.map((item) => item.directory),
    ...(project.worktrees ?? []).map((item) => item.directory),
    ...(project.sandboxes ?? []),
  ]
    .filter((directory) => !sameDirectory(project.worktree, directory))
    .filter((directory, index, items) => items.findIndex((item) => sameDirectory(item, directory)) === index)
}
```

注意：`paths.ts` 里**排除** canonical，本 phase 的根集合**包含** canonical（D-06）。只借用「合并 + `findIndex` 去重」这一步，不要抄 `!sameDirectory(project.worktree, …)` 的排除。

#### 3. 目标形态（D-06）

```ts
type ProjectDirectory = { readonly directory: string }

type ProjectRoots = {
  readonly worktree?: string
  readonly sandboxes?: readonly string[]
  readonly worktrees?: readonly ProjectDirectory[]
}

export function sessionProjectDirectory(project: ProjectRoots | undefined, directory: string) {
  // The canonical worktree is always in `worktrees`, but listing it explicitly keeps a project whose inventory has
  // not arrived from degrading to one row per session directory.
  const roots = [
    ...(project?.worktrees ?? []).map((item) => item.directory),
    ...(project?.sandboxes ?? []),
    ...(project?.worktree ? [project.worktree] : []),
  ].filter((root, index, items) => items.findIndex((item) => sameDirectory(item, root)) === index)

  const owner = roots
    .filter((root) => containsDirectory(root, directory))
    .toSorted((a, b) => comparablePath(b).length - comparablePath(a).length)[0]

  return owner ?? directory
}
```

- 需要新增 `sameDirectory` 到第 1 行 import；不新增别名、不用 star import（仓库 AGENTS.md）。
- 比较方式（`sameDirectory` vs `comparablePath` 字符串）属 Agent's Discretion，默认选 `sameDirectory`，与 `paths.ts` 一致。
- `projectGroupFor`（27-37）**不改**：它只消费 `sessionProjectDirectory` 的结果并拼 `${server}\u0000${comparablePath(checkout)}`。这正是 D-08 的落点——key 随 checkout 身份变化，不随清单到达而改写。
- D-07：不做「目录 → checkout」缓存，也不过滤「清单只能补充不与已有根嵌套的目录」。`withWorktreeInventory`（`inventory.ts` 17-27）已把 `sandboxes` 重算为「清单目录 − canonical」，两者是同一集合的两种视图。

#### 4. 性能注意（D-09）

`roots` 数组每次 `groups()` 重算都会构造一次（`projects.tsx` 72-151 是热路径 memo）。先按现状实现，**不加缓存分块**；只有 strobe 实测 `groups()` / `entries()` 对 `origin/dev` 有回归时才加。命令见「Verification」。

---

### `packages/app/src/shell/titlebar/projects-groups.test.ts` (test, transform)

**Analog：** 自身 4-46 行（`describe` + 直接调用纯函数）；`inventory.test.ts` 39-64 提供「断言调用序列 / 失败即回归」的写法。

#### 1. 现有结构（扩充点）

`projects-groups.test.ts` 4-20：

```ts
describe("sessionProjectDirectory", () => {
  test("uses the closest known project directory", () => {
    const project = { worktrees: [{ directory: "C:/work/app" }, { directory: "C:/work/app/.worktrees/feature" }] }

    expect(sessionProjectDirectory(project, "C:/work/app/.worktrees/feature/src")).toBe(
      "C:/work/app/.worktrees/feature",
    )
    expect(sessionProjectDirectory(project, "C:/work/app/packages/ui")).toBe("C:/work/app")
  })
```

`projects-groups.test.ts` 22-34 是 key 断言，正是 D-12 要求「两条路径产出相同 key」的落点：

```ts
describe("projectGroupFor", () => {
  test("keys the checkout that owns the session directory", () => {
    const project = { worktrees: [{ directory: "C:/work/app" }, { directory: "C:/work/app/.worktrees/feature" }] }

    expect(projectGroupFor("srv", project, "C:/work/app/packages/ui")).toEqual({
      key: "srv\u0000C:/work/app",
      directory: "C:/work/app",
    })
```

#### 2. 新增回归（D-12，修复前必须失败）

在 `projectGroupFor` 的 `describe` 内加一条双路径用例，同一批会话两个输入必须产出**相同 key**：

```ts
  test("keys the same sessions the same way before and after the inventory arrives", () => {
    const sessions = ["C:/work/app/packages/ui", "C:/work/app/.worktrees/feature/src"]

    // Before the inventory: metadata carries only the canonical worktree, and `sandboxes` is the fallback.
    const sandboxesOnly = {
      worktree: "C:/work/app",
      sandboxes: ["C:/work/app/.worktrees/feature"],
      worktrees: [{ directory: "C:/work/app" }],
    }
    // After: `withWorktreeInventory` recomputes `sandboxes` from the listed inventory minus the canonical root.
    const inventoried = {
      worktree: "C:/work/app",
      sandboxes: ["C:/work/app/.worktrees/feature"],
      worktrees: [{ directory: "C:/work/app" }, { directory: "C:/work/app/.worktrees/feature" }],
    }

    expect(sessions.map((directory) => projectGroupFor("srv", sandboxesOnly, directory).key)).toEqual(
      sessions.map((directory) => projectGroupFor("srv", inventoried, directory).key),
    )
  })
```

同时给 `sessionProjectDirectory` 的 `describe` 补一条最直接的兜底断言（可选但更易定位）：

```ts
    expect(
      sessionProjectDirectory({ worktree: "C:/work/app", sandboxes: ["C:/work/app/.worktrees/feature"] }, "C:/work/app/.worktrees/feature/src"),
    ).toBe("C:/work/app/.worktrees/feature")
```

约束：

- `projects-groups.test.ts` 是分组契约的**唯一** owner（D-12 / `packages/app/AGENTS.md` §Tests）。不要为此新建测试文件。
- 不为「每个 projectID 只请求一次」加测试或生产 seam（D-13）；`createWorktreeInventory` 的在途合并已由 `inventory.test.ts` 40-64 拥有。Set 的验证走 dev 服务器观察请求次数，写进验证记录。
- 测试必须能在修复前失败：修复前 `sessionProjectDirectory` 只读 `worktrees`，`sandboxesOnly` 会把 feature 会话归到 `C:/work/app`，key 不同。

---

### `docs/designs/project-grouped-sessions-sidebar.md` (doc)

**Analog：** 同文件 §已知取舍（126-131），沿用「编号 + 加粗标题 + 代价/理由」的写法：

```markdown
### 已知取舍（复查时不要「顺手修」）

1. **与上游 `SidebarOrganized` 并存**：…代价：…
2. **`ActivityRing` 观感**：…根因修法是把该规则放进 layer，但那会同时改变所有调用点的实际观感，无法在当前环境验证，故不做。
3. **持久化降级**：…不崩溃，但会丢设置；fork 内部升级/回退不受影响。
```

本 phase 追加第 4 条（D-11），与之一致：

```markdown
4. **不显示空 checkout 行**：某份 checkout 在会话窗口内没有会话时不生成行（成功标准 4 的「不显示」分支）。行源保持「由会话推导」，因为空行要遍历 projects × checkouts，会重新引入没打开过的项目（相位 1 刚关掉的幽灵项目）和已无活动的 checkout。若要改为「显示」，必须先解决行源这条保证。
```

不要改「§实测接缝清单」，那是 DOC-01 的条目，不属于本 phase。

---

### 可选：`packages/app/perf/projects-groups.ts` + `.bench.ts`（create，仅当 D-09 需要）

**Analog：** `perf/session-index.ts` 1-36 + `perf/session-index.bench.ts` 1-14（Phase 1 为纯函数做的 strobe 基准，git 已跟踪）。

脚本模块的写法（`session-index.ts` 1-4、27-36）：

```ts
// The sidebar's row source: one index page plus a large locally known list. strobe's script host loads this module
// once per block and calls `merge` (perf/session-index.bench.ts). No DOM, Solid or timers.
import { mergeRootSessionIndex } from "../src/runtime/server/session-index"
```

```ts
export function merge(count: number) {
  for (let i = 0; i < count; i++) {
    rows = mergeRootSessionIndex(indexed, known, { includeArchived: false, boundedKnown: true }).length
  }

  return rows
}
```

bench 声明（`session-index.bench.ts` 3-14）：

```ts
export default bench({
  targets: { app: script("./session-index.ts") },
  cases: {
    // 200 merges of a 50-row index page with a 5,000-session known list.
    "merge the session index": {
      primary: "cpu.work",
      async run(ctx) {
        await ctx.call("merge", 200)
      },
    },
  },
})
```

- 只有 `projectGroupFor` / `sessionProjectDirectory` 是已导出的纯函数，可以直接 bench；`groups()` 是组件内 memo，**不要**为它加导出或任何生产 seam（`packages/app/AGENTS.md` §Tests）。
- 若 planner 判断「不新增文件、只按现状实现 + 观察」即可满足 D-09，跳过此项，并在验证记录里写明未做基准的理由。

---

## Shared Patterns

### 跨服务器分区
**Source:** `packages/app/src/shell/titlebar/inbox-model.ts` 158-164, `packages/app/src/workspaces/inventory.ts` 8-10

每个服务器的 `sync.worktrees` 只服务自己的 scope，查询键已按 scope 分区：

```ts
export function worktreeInventoryKey(scope: ServerScope, projectID: string) {
  return [scope, "worktree", projectID] as const
}
```

**Apply to:** `projects.tsx` 的 effect 必须经 `entry.ctx.sync.worktrees`（按 `entry.server` 已分区），不要用 `global.serverCtx(...)` 自己去解析，也不要用裸 `projectID` 做本地缓存键——local key 用 `${entry.server}\u0000${project.id}`。

### 清单回写与重算（不要绕过）
**Source:** `packages/app/src/runtime/server/sync.tsx` 56-74、151-164、191-199

```tsx
  const worktrees = createWorktreeInventory({
    scope: serverSDK.scope,
    queryClient,
    api: () => serverSDK.api.worktree,
    updated: (projectID, items) => {
      setGlobalStore("project", (projects) =>
        projects.map((project) => (project.id === projectID ? withWorktreeInventory(project, items) : project)),
      )
```

```tsx
    if (event.type === "worktree.updated") {
      void worktrees.list(event.data.projectID)
      void bootstrap.refetch()

      return
    }
```

**Apply to:** 所有回写路径。`projects.tsx` 不订阅查询、不写 store；清单到达 → `projects.list()` → `groups()` 重算，这是唯一回流。

### sandboxes 与 inventory 是同一集合的两种视图
**Source:** `packages/app/src/workspaces/inventory.ts` 16-27

```ts
// Project metadata arrives without worktrees; a loaded inventory supplies the workspace list.
export function withWorktreeInventory(project: Project, worktrees: readonly WorktreeDirectory[] | undefined): Project {
  if (!worktrees) return project

  return {
    ...project,
    worktrees: [...worktrees],
    sandboxes: worktrees
      .map((item) => item.directory)
      .filter((directory) => !sameDirectory(project.worktree, directory)),
  }
}
```

**Apply to:** `projects-groups.ts` 的根集合设计。集合一致时 key 完全不变（D-07 的前提）。

### canonical 只在 `worktrees` 里
**Source:** `packages/app/src/runtime/server/global-sync/utils.ts` 148-156

```ts
export function normalizeProjectInfo(project: Project | CurrentProject): Project {
  const worktree = "canonical" in project ? project.canonical : project.worktree

  return {
    ...project,
    worktree,
    worktrees: "worktrees" in project ? project.worktrees : [{ directory: worktree }],
  }
}
```

**Apply to:** 这是 D-06 的动机。`sandboxes` 从不含 canonical，所以只靠 `sandboxes` 兜底会漏掉 canonical 根下的会话；根集合必须显式加入 `project.worktree`。

### 最近包含者（owner 选择）
**Source:** `packages/app/src/shell/layout/helpers.ts` 48-52

```ts
    return (
      matching
        .filter((project) => isProjectDirectory(project, session.location.directory))
        .sort((a, b) => b.worktree.length - a.worktree.length)[0] ?? matching.at(-1)
    )
```

**Apply to:** `sessionProjectDirectory` 的 `toSorted((a, b) => comparablePath(b).length - comparablePath(a).length)[0]`。不要换成 `helpers.ts` 的 `pathKey`（`helpers.ts` 用的是另一套 key），分组必须留在 `comparablePath` / `containsDirectory` 语义内。

### 路径工具的唯一来源
**Source:** `@opencode/util/path`

- `comparablePath`：跨平台大小写与分隔符归一化后的字符串（用于长度比较、key 拼接）。
- `containsDirectory(root, directory)`：包含判断。
- `sameDirectory(a, b)`：等价判断（去重用）。

**Apply to:** `projects-groups.ts`（新增 `sameDirectory` import）。不要自己写字符串前缀/分隔符比较。

### 仓库风格（`AGENTS.md`）
- 不用别名 import / star import / 类型位置 `import("...")`；需要命名空间时按名导入模块自身导出的 namespace。
- 不用 `any`；优先 `const`、早返回，避免 `else`。
- 不为测试加生产 seam（不导出仅供测试的函数、不加 `data-*`、不加 `now`/`delay` 参数）。
- 用户可见文案必须走 i18n；本 phase 不应新增任何 UI 文案（无 loading、无 toast）。
- 热路径改动先按 `packages/app/perf/README.md` 用 strobe 对 `origin/dev` 度量。

---

## No Analog Found

无。四个修改文件都有同角色、最近修改过的既有 analog。

唯一需要自行判断的是「挂载期一次性请求」的**具体写法**：既有 analog（`recent-sessions.tsx` 的 `statuses` Map）是「跟踪状态」，本 phase 是「只学一次」，语义更弱。这不构成缺口——D-02 已把双保险写死，实现照上面第 2 段即可。

---

## Verification（plan 的 verify 段可直接引用）

```bash
# 单元测试（测试不能从仓库根跑）
cd packages/app && bun test --conditions=solid --preload ../ui/test/solid-jsx.ts --preload ./happydom.ts src/shell/titlebar/projects-groups.test.ts

# 回归有效性：先 stash 修复再跑，必须失败
# 类型检查
cd packages/app && bun typecheck
```

- 请求次数（D-13）：`bun dev serve --port 4096`（仓库根）+ `cd packages/app && bun dev -- --port 4444`，在 Network 面板观察：进入 Projects 模式后每个可见 `projectID` 的 `worktree` 列表请求只出现一次；切走再切回若 `cached()` 有值则不再发请求。
- 性能（D-09）：`strobe bench packages/app/perf/<area>.bench.ts --base origin/dev --head .`（只有新建 bench 时才需要，见「可选」一节）。
- 首帧观感（D-05 / `specifics`）：同时挂 4–9 个项目，首帧不得出现「一个 checkout 裂成多行」的长中间态。

---

## Metadata

**Analog search scope:** `packages/app/src/{shell,workspaces,runtime,home,session}`, `packages/app/perf`, `docs/designs`
**Files scanned:** 16（全部经 `git ls-files` 校验为 tracked source，无 gitignored 镜像路径）
**Pattern extraction date:** 2026-11-13
