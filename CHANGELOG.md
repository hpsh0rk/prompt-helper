# Prompt Helper Changelog

## [2.2.0] - 2026-09-24

### Added
- **新建提示词 (Create Prompt)**：
  - 新增 `Cmd + N` 快捷键唤出 `CreatePromptForm` 表单，支持快速录入标题、类型、正文、标签、推荐模型与使用说明；
  - 创建成功后自动将新提示词记录至「🕒 最近使用」首位，并自动刷新当前列表；
  - 适配本地免 PAT 端点（`POST /library-items`）与云端 PAT 端点（`POST /api/v1/prompts`）；
- **删除提示词 (Delete Prompt)**：
  - 新增 `Ctrl + X` 快捷键触发安全删除动作，弹出 Raycast 官方 `confirmAlert` 破坏性二次确认框；
  - 确认后执行软删除，并同步从「🕒 最近使用」及当前列表中清理；
  - 适配本地免 PAT 端点（`DELETE /library-items?id=...`）与云端 PAT 端点（`DELETE /api/v1/prompts/...`）；
- **默认视图首选项配置 (Default View Preference)**：
  - 在 Raycast 设置中新增「默认展示视图」下拉配置（全部提示词 / ⭐ 我的收藏 / 🕒 最近使用）；
  - 启动插件时自动根据用户偏好停留在预设视图；
- **测试覆盖**：
  - 补充 `tests/create-delete.test.ts`，涵盖本地/云端创建与删除、偏好配置读取等 6 项测试（全套共 21 项测试全部通过）。

## [2.1.0] - 2026-09-23

### Added
- **智能综合流 (Smart Sections)**：
  - 默认无搜索输入时，列表自动按三段分组：`🕒 最近使用` → `⭐ 我的收藏` → `全部提示词`，无需切换直达高频提示词；
  - 搜索状态下自动打平为全局结果流，支持键盘快速匹配；
- **收藏与星标支持**：
  - 增加 `Cmd + D` 快捷键，支持直接在卡片上加入/取消收藏，双向同步至 PromptHub 后端；
  - 顶部下拉菜单新增 `⭐ 我的收藏` 专有视图，支持在收藏库内二次检索；
- **最近使用追踪 (Recent Usage)**：
  - 用户触发粘贴、复制或表单填词后自动追踪使用记录，持久化于本地 LocalStorage（最多保留 30 条）；
  - 顶部下拉菜单新增 `🕒 最近使用` 专有视图，并支持在操作面板一键清空历史；
- **单元测试与环境加固**：
  - 补充 `tests/recent-favorites.test.ts` 全覆盖测试套件（15/15 全部通过）；
  - 集成 `node-fetch` 解决 Raycast 1.69.0 环境无全局 `fetch` 问题。

## [2.0.0] - 2026-09-23

### Changed
- **全面重构为 PromptHub 原生桌面伴侣**：
  - 数据真源收归 PromptHub，废弃孤立的 LocalStorage 机制；
  - 接入 PromptHub REST / library-items 端点，支持无鉴权本地模式与 PAT 鉴权多端模式；
  - 采用现代 `@raycast/api` 2.x 与 `@raycast/utils` 的 `useFetch` 架构，支持防抖搜索与追加分页；
  - 增加视觉生图提示词效果图与缩略图预览（Detail 面板渲染）；
  - 智能占位符代入表单：同时支持 `[占位符]` 与 `{{变量}}`，表单自动预填 PromptHub 默认参考值；
  - 升级类型过滤（全部 / 生图 / 文本 / 代码 / 视频 / 音频）；
  - 补齐 Vitest 单元测试、ESLint 9 Flat Config 与 Prettier 代码规范。

## [1.0.0] - 2023-05-29

### Added
- 初始版本：基于 Raycast LocalStorage 的提示词管理与快速粘贴。