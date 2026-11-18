# Phase 6: @ 引用短路径（composer 与已发消息） - Context

**Gathered:** 2026-11-17
**Status:** Ready for planning

<domain>
## Phase Boundary

App 端 @ 文件引用的**渲染层**缩短：composer 输入框 chip 与已发消息内的 file mention 显示 basename（作用域内同名时显示最短区分后缀），hover/title 保留完整路径。正文与 wire/协议层永远写全路径（TUI 等其他端行为不变）。不动 session 类 mention、不动 TUI、不引入 chip 卡片化改造。

</domain>

<decisions>
## Implementation Decisions

> 决策来源：任务简报（v2.2 启动）+ 2026-11-17 事实复核（explore 核实 opencode 与 dsh 两侧代码）；用户授权 autonomous 按最优方案定案。

### 显示名策略
- 默认显示 basename（路径最后一段，`\` 与 `/` 均为分隔符）
- 同一 draft（composer）/ 同一条消息（渲染）内出现同名 basename 时，各自显示**最短区分后缀**（对齐 dsh `distinguishingPathSuffixes()` 语义：从尾部取 n 个段直到不被作用域内同名 peer 共享，跳过空后缀）
- 无冲突时不带父目录（保持最简显示）
- 不做全局 workspace 消歧（dsh 的 WorkspacePicker 场景不属于本阶段）

### hover / 全路径暴露
- 原生 `title` 属性显示完整路径（**不含** `@` 前缀）；不引入 Tooltip 组件（mention span 最小侵入；附件 chip 的 Tooltip 模式不迁移到 mention）
- chip 的其余交互行为（点击、删除、编辑）完全不变

### 消歧实现位置
- 纯函数单一实现放在 `packages/session-ui`（新建导出，如 `src/message/mention-label.ts`），App composer 从 session-ui 复用（app 已依赖 session-ui）
- 算法移植 dsh `path-suffix.ts:11-27` 的段窗口语义；输入为作用域内 `{path}[]`，输出 `Map<path, label>` 或同名函数签名
- 纯函数单测跟随所在包测试惯例

### 渲染侵入面
- 已发消息：仅改 `packages/session-ui/src/message/message-content.tsx` 的 `CurrentHighlightedText` 中 `data-highlight="file"` segment 的显示文本（加 `title`），保持现有高亮样式，不做 chip 卡片化
- composer：仅改 `packages/app/src/composer/editor/editor.tsx` mention span 的渲染文本（`part.content` 仍为全路径，`data-path` 已存全路径，加 `title`）；提交序列化路径不变（`request.ts` 仍发全路径）
- 不动 `type: "session"` 的 mention；不动 TUI 的相对路径写入逻辑

### the agent's Discretion
- 纯函数的具体命名与文件位置（session-ui 内部路径）由实现阶段决定
- 同名消歧函数对 quoted path（`@"..."`）的边界处理细节（opencode 写入侧目前不产生 quoted mention，渲染侧按现有 segment 切分即可）

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- dsh 参照（只读）：`packages/client/ui-workspace/src/client/path-suffix.ts`（distinguishingPathSuffixes 纯函数 + path-suffix.client.spec.ts 测试）；`packages/client/ui-reference/src/client/user-text-rules.ts:16-29`（basename label 提取）；`packages/client/ui-reference/src/client/FileReference.tsx:42-49`（label + title=raw）
- opencode 现状：`packages/app/src/composer/editor/editor.tsx:570-605`（mention span 渲染，`data-path` 已存全路径、file 类无 title）；`packages/session-ui/src/message/message-content.tsx:822-884`（CurrentHighlightedText 按 `files[].mention {start,end}` 切 segment，`data-highlight="file"` 显示正文切片即全路径）

### Established Patterns
- session-ui 是宿主无关组件库：SDK 调用全部在 App 宿主，session-ui 只收 props（actions.ts 惯例）
- wire/正文层保持全路径：dsh `serializeReference` 同款策略（渲染缩短、序列化还原）——opencode 的 `request.ts`/`submit.ts` 已天然满足，无需改动
- i18n：新 UI 文案走现有体系（参照 `sidebar.workspace.sessions.more` 写法），提供 en

### Integration Points
- composer chip：`packages/app/src/composer/editor/editor.tsx` `renderComposerEditor()`
- 已发消息：`packages/session-ui/src/message/message-content.tsx` `CurrentHighlightedText()`
- 消歧纯函数：新建 session-ui 导出 → app composer import；session-ui 渲染处内部调用

</code_context>

<specifics>
## Specific Ideas

- 与 dsh 行为逐项对齐：显示 basename（`label = path.split(/[\\/]/).filter(Boolean).at(-1)`）、title 携带全路径、双轨（正文全路径 + 显示名）
- 作用域限定：composer 内以整个 draft 的 file mention parts 为作用域；消息渲染以该消息 `files[]` 为作用域
- 上游接缝预算（PROJECT.md Constraints）：优先只增不改，宿主文件 diff 控制在几行内

</specifics>

<deferred>
## Deferred Ideas

- 全局 workspace 同名消歧（dsh WorkspacePicker 场景）— 已记入 REQUIREMENTS Out of Scope
- @ 引用 chip 卡片化（图标 + 删除按钮的富 chip）— 超出最小渲染缩短范围
- quoted path（路径含空格）的完整支持 — opencode 写入侧当前不产生，出现后再议

</deferred>
