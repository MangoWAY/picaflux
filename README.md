# PicaFlux

AI 时代的开源创意素材中枢：统一管理图片、视频、3D、Prompt 与生成物，并规划通过 MCP 等协议连接工具链。详见 [`docs/PRODUCT_PLAN.md`](docs/PRODUCT_PLAN.md)。

## 技术栈

Electron · Vite · React · TypeScript · Tailwind CSS（基于 [electron-vite-react](https://github.com/electron-vite/electron-vite-react) 模板）

## 开发

```bash
npm install
npm run dev
```

## 质量检查

```bash
npm run typecheck
npm run lint
npm run format:check
```

## AI / Agent 协作

修改本仓库前请先阅读 **[AGENTS.md](./AGENTS.md)**。Cursor 规则位于 `.cursor/rules/`。

## 许可证

MIT（与上游模板一致；若你调整 `LICENSE` 请同步说明）。
