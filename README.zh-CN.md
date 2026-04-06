# PicaFlux

**让创意素材流动起来** — 开源桌面端创意素材中枢：对**图片**、**视频**、**glTF / GLB** 等进行管理与处理；长期目标是素材库、AI 工作流与 MCP 等能力（见 [`docs/PRODUCT_PLAN.md`](docs/PRODUCT_PLAN.md)）。

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org/)

**仓库：** [github.com/MangoWAY/picaflux](https://github.com/MangoWAY/picaflux)  
[English](README.md) | 简体中文

---

## 当前功能

| 模块     | 能力概览                                                                                                                                                                                                          |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **图片** | 裁剪、缩放、格式与质量、可选抠图与固定区域水印处理；勾选批量 + 输出目录。                                                                                                                                         |
| **视频** | 转码（H.264 预设、流拷贝）、按时间段裁剪、截帧（单帧或间隔序列）、抽取音频、去除音轨、短 GIF；基于 **ffmpeg**，支持进度与取消当前任务。                                                                           |
| **3D**   | **.glb / .gltf** 预览（React Three Fiber）、轨道控制、统计信息；导出当前视口 **PNG 缩略图**；用 **@gltf-transform** 做 GLB 优化 / 重打包。**Draco** 解码文件内置在 `public/draco/gltf`（来自 `three` 自带副本）。 |

技术栈：**Electron** · **Vite** · **React 18** · **TypeScript** · **Tailwind** · `vite-plugin-electron`；脚手架源自 [electron-vite-react](https://github.com/electron-vite/electron-vite-react)。

---

## 环境要求

- **Node.js** ≥ 18（建议 20 LTS）
- **npm** 9+

视频处理使用 **`ffmpeg-static` / `ffprobe-static`**（编码器更全，含 **libwebp**）；也可通过环境变量 `FFMPEG_PATH`、`FFPROBE_PATH` 指定本机二进制。

---

## 快速开始

```bash
git clone https://github.com/MangoWAY/picaflux.git
cd picaflux
npm install
npm run dev
```

---

## 常用命令

| 命令                                      | 说明                                            |
| ----------------------------------------- | ----------------------------------------------- |
| `npm run dev`                             | 开发：Vite + Electron                           |
| `npm run build`                           | 类型检查 + 生产构建 + **electron-builder** 打包 |
| `npm run typecheck`                       | 仅 TypeScript                                   |
| `npm run lint` / `npm run lint:fix`       | ESLint                                          |
| `npm run format` / `npm run format:check` | Prettier                                        |
| `npm run validate`                        | typecheck + ESLint + 格式检查 + 测试（CI 门禁） |
| `npm test`                                | Vitest 单元测试                                 |

提交前（`npm install` 后）：**Husky** 会触发 **lint-staged**，对暂存文件自动 ESLint 修复与 Prettier。格式约定见 [.editorconfig](./.editorconfig)、[.prettierrc.json](./.prettierrc.json)。

---

## 目录结构

```
electron/main/     主进程（IPC、ffmpeg、glTF、图片管线等）
electron/preload/  通过 contextBridge 暴露给渲染进程的 API
src/               React 渲染进程（图片 / 视频 / 3D 工作台）
docs/              产品与规划文档
public/draco/      内置 Draco glTF 解码文件（来源见 README.txt）
test/              Vitest 测试
```

---

## 参与贡献与 AI 协作

较大改动前请先阅读 **[AGENTS.md](./AGENTS.md)**；Cursor 规则在 `.cursor/rules/`。

---

## 第三方说明

- **electron-vite-react**（MIT）— 初始模板；上游版权保留在 [LICENSE](./LICENSE)。
- **`public/draco/gltf/`** — 拷贝自 **three.js** `examples/jsm/libs/draco/gltf/`，详见 `public/draco/README.txt`。
- 其余依赖见 `package.json` 及各包许可证。

---

## 许可证

本项目采用 **MIT 许可证**，全文见 [LICENSE](./LICENSE)。

- **PicaFlux** 项目代码：Copyright (c) 2026 PicaFlux contributors。
- **上游模板**（electron-vite-react）：Copyright (c) 2023 caoxiemeihao（在 LICENSE 中保留）。
