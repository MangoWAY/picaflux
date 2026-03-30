# PicaFlux — AI / Agent 协作说明

本文档供 **Cursor、GitHub Copilot、Claude Code** 等工具在修改本仓库时优先阅读。

## 项目是什么

- **PicaFlux**：面向 AI 时代的开源创意素材中枢（图片 / 视频 / 3D / Prompt 与生成物关联等），见 [`docs/PRODUCT_PLAN.md`](docs/PRODUCT_PLAN.md)。
- **当前阶段**：脚手架与基建；业务功能尚未实现。

## 技术栈

| 层级            | 技术                                                              |
| --------------- | ----------------------------------------------------------------- |
| 桌面            | Electron                                                          |
| 构建            | Vite 5 + `vite-plugin-electron` + `vite-plugin-electron-renderer` |
| 渲染进程 UI     | React 18 + TypeScript + Tailwind CSS                              |
| 主进程 / 预加载 | TypeScript（`electron/main`、`electron/preload`）                 |

> 说明：本仓库基于 [electron-vite-react](https://github.com/electron-vite/electron-vite-react) 模板，使用 **Vite + vite-plugin-electron**，与 npm 包名 `electron-vite`（另一套 CLI）不是同一产物，但同属 Electron+Vite 生态。

## 目录约定（建议保持）

```
electron/main/     # 主进程：窗口、系统能力、将来 IPC 业务实现
electron/preload/  # 预加载：仅通过 contextBridge 暴露安全 API
src/               # 渲染进程 React 应用
docs/              # 产品与设计文档
test/              # Vitest / E2E
```

- **安全**：渲染进程默认 **禁止** `nodeIntegration`；不通过预加载暴露的文件系统 / `shell` 等敏感能力，除非有明确需求并评审。
- **IPC**：新增通道时，在 `preload` 中显式暴露类型安全封装，避免把 `ipcRenderer` 整对象暴露给页面（当前模板为过渡形态，后续应收窄 API）。

## 常用命令

```bash
npm install          # 安装依赖
npm run dev          # 开发（Vite + Electron）
npm run build        # 类型检查 + 打包应用
npm run typecheck    # 仅 TypeScript 检查
npm run lint         # ESLint
npm run lint:fix     # ESLint 自动修复
npm run format       # Prettier 格式化
npm run format:check # Prettier 检查
npm test             # Vitest
```

## 修改代码时的原则

1. **最小改动**：只改与任务相关的文件；不做无关重构。
2. **风格一致**：遵循现有 Prettier / ESLint；`@/` 映射到 `src/`。
3. **类型**：保持 `strict`；避免 `any`，必要时用 `unknown` 收窄。
4. **Electron 边界**：区分 main / preload / renderer，不要把 Node API 混进 React 组件。

## MCP / 未来集成

- 产品规划中会接入 **Model Context Protocol (MCP)**；实现时优先使用官方 **`@modelcontextprotocol/sdk`（TypeScript）**，放在主进程或独立 Node 子进程，勿在渲染进程直连密钥。
- 具体 Server/Client 设计未定稿前，不要硬编码第三方 API Key；使用环境变量或用户配置目录（后续统一约定）。

## 人类贡献者

- PR 前请运行：**`npm run validate`**（依次：`typecheck` → `lint` → `format:check` → `test`，与 CI `quality` 工作流一致）。
- 克隆后 `npm install` 会执行 **Husky** `prepare`；提交前 **pre-commit** 钩子会对**暂存文件**运行 **lint-staged**（`eslint --fix --max-warnings 0` + `prettier --write`）。
- 代码风格约定：**`.editorconfig`**（字符集、缩进、换行、尾随空格）、**`.prettierrc.json`**（分号/引号/行长等）、**`eslint.config.js`**（与 Prettier 通过 `eslint-config-prettier` 关闭冲突规则）。
- 重大行为或数据模型变更请同步更新 `docs/` 与本文档相关小节。
