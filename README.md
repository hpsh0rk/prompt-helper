# Prompt Helper (Raycast Extension for PromptHub)

> PromptHub 的原生 Raycast 桌面伴侣插件 —— 呼之即来，即搜即填，一键贴入任意应用。

## 🌟 核心特性

- **PromptHub 为唯一真源**：直接连接本地或远端 PromptHub 实例，无缝消费库内全量提示词（生图、文本、代码、视频、音频）。
- **多维实时检索**：输入关键词防抖联想，同时匹配提示词标题、正文模板、关联标签（Tags）与生成模型（Models）。
- **智能占位符代入**：
  - 同时支持 PromptHub 原生 `[占位符]` 与经典 `{{变量}}` 语法。
  - 选中带参条目自动呼出参数填写表单，**预填 PromptHub 记录的推荐参考值**，直接回车即可使用最佳效果。
- **效果图缩略图预览**：视觉生图类提示词直接在 Raycast Detail 面板内联渲染效果图与缩略图。
- **无缝桌面工作流**：
  - 回车一键粘贴至当前最前台活跃窗口（Terminal、Slack、Cursor、浏览器等）。
  - 支持快捷复制已渲染文本、复制原始模板，或在浏览器中快速打开 PromptHub 网页端深入使用。

## ⚙️ 配置说明 (Preferences)

在 Raycast 插件偏好设置中可配置以下选项：

| 配置项 | 说明 | 默认值 | 必填 |
|---|---|---|---|
| **PromptHub Server URL** | PromptHub 服务地址 | `http://127.0.0.1:3210` | 否 |
| **API Key (PAT)** | Personal Access Token。本地实例免填（自动回落至本地免鉴权端点）；连接云端/远端实例时填入 PAT | 空 | 否 |

## 🛠️ 本地开发与测试

```bash
# 1. 安装依赖
npm install

# 2. 运行单测 (Vitest)
npm run test

# 3. 代码检查与格式化
npm run lint
npm run fix-lint

# 4. 构建插件
npm run build

# 5. 启动 Raycast 开发模式
npm run dev
```

## 快捷键一览

- `Enter`：填入占位符并粘贴到当前应用（若无占位符则直接粘贴）。
- `Cmd + Shift + V`：直接粘贴原始模板。
- `Cmd + C`：复制原始模板至剪贴板。
- `Cmd + O`：在浏览器中打开 PromptHub 详情/使用页。
- `Cmd + R`：强制刷新列表。
- `Cmd + Shift + ,`：打开插件偏好设置。
