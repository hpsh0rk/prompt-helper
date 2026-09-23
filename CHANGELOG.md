# Prompt Helper Changelog

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