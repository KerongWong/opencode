---
status: complete
phase: 01-登记表数据模型与纯函数
source: [01-SUMMARY.md]
started: 2026-11-14T00:20:00.000Z
updated: 2026-11-14T00:20:00.000Z
---

## Agent-Run Evidence

本阶段没有可人工观察的行为：交付物是一个零 I/O 纯模块 + 它的单测。`uat.classify-coverage` 对 `01-SUMMARY.md` 的判定是 **`all_auto_covered: true`**（4/4 由 passing 单测覆盖，`present: []`），因此这里不生成需要人点的检查项，只记录覆盖关系。

独立复跑（orchestrator 执行，不采信 SUMMARY 自述）：

```
cd packages/app && bun test --conditions=solid --isolate \
  --preload ../ui/test/solid-jsx.ts --preload ./happydom.ts src/workspace-sidebar
→ 48 pass / 0 fail（52+ expect）
```

`bun check --no-script src/workspace-sidebar/registry.ts src/workspace-sidebar/registry.test.ts` → 0 diagnostics；
`bun script/lint-changed.ts` → 0 problems；
`git diff --stat upstream/dev -- packages/` → 只有 `registry.ts`（+149→+172）与 `registry.test.ts`（+204→+252）。

## Tests

### 1. 同一目录的不同写法归一到同一个键
expected: 分隔符折叠、重复分隔符、尾斜杠、Windows 盘符大小写、UNC 前缀、盘符根（`C:/` 而非 `C:`）都在 `normalizeDirectory` 下收敛；`directoryKey` 在 win32 忽略大小写、在 linux/darwin 敏感。
result: pass
source: automated
coverage_id: 01:D1
requirement: REG-03
evidence: `registry.test.ts#normalizeDirectory` + `#directoryKey`（含 WR-02 修复后新增的 `/a\b` vs `/a/b` 平台矩阵）

### 2. 重复登记复用既有记录
expected: 同一目录换一种写法再登记不产生第二行，`removedAt` 被清空、`title` 与 `order` 保留。
result: pass
source: automated
coverage_id: 01:D2
requirement: REG-01

### 3. 移除只遮蔽、恢复回到原名原序、新登记追加末尾
expected: `remove` 只写 `removedAt`（记录不删）；再次登记恢复原显示名与原顺序；新项 `order = max + 1`；默认标题取目录最后一段、根目录取 `/` 或盘符 `C:`。
result: pass
source: automated
coverage_id: 01:D3
requirement: REG-02

### 4. 登记表落在按 server 隔离的键下
expected: `registryTarget(scope)` 生成 `Persist.serverGlobal(scope, "workspace-registry.v1")` 的存储目标，文档形状可编解码。
result: pass
source: automated
coverage_id: 01:D4
requirement: PST-02
evidence: 键字面量断言在本文件；**跨 scope 隔离**由 `runtime/persistence/storage.test.ts:59-65` 拥有（不在本阶段重复证明）

## Summary

total: 4
passed: 4
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps
