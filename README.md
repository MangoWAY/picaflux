# PicaFlux

**Creative assets, in flow** — an open-source desktop hub for creative media: manage and process **images**, **video**, and **glTF / GLB** assets, with a roadmap toward a full library, AI workflows, and MCP integration.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org/)

**Repository:** [github.com/MangoWAY/picaflux](https://github.com/MangoWAY/picaflux)  
**Product vision & roadmap:** [`docs/PRODUCT_PLAN.md`](docs/PRODUCT_PLAN.md)

---

## Features (current)

| Module    | What you can do                                                                                                                                                                                                                              |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Image** | Crop, scale, format conversion, quality, optional background removal, fixed-region watermark clear — batch with output folder.                                                                                                               |
| **Video** | Transcode (H.264 presets, stream copy), trim, frame extract (single or interval), audio extract, strip audio, short GIF — via **ffmpeg**; progress + cancel current task.                                                                    |
| **3D**    | Preview **.glb / .gltf** (React Three Fiber), orbit controls, stats; export viewport **PNG** thumbnail; **optimize / re-pack** GLB with `@gltf-transform` (prune + dedup). **Draco** decoders ship under `public/draco/gltf` (from `three`). |

Stack: **Electron** · **Vite** · **React 18** · **TypeScript** · **Tailwind CSS** · `vite-plugin-electron` (based on [electron-vite-react](https://github.com/electron-vite/electron-vite-react)).

---

## Prerequisites

- **Node.js** ≥ 18 (20 LTS recommended)
- **npm** 9+

Video processing uses **`ffmpeg-static`** / **`ffprobe-static`** (broader codecs including **libwebp**); you may set `FFMPEG_PATH` and `FFPROBE_PATH` to override.

---

## Quick start

```bash
git clone https://github.com/MangoWAY/picaflux.git
cd picaflux
npm install
npm run dev
```

---

## Scripts

| Command                                   | Description                                          |
| ----------------------------------------- | ---------------------------------------------------- |
| `npm run dev`                             | Dev: Vite + Electron                                 |
| `npm run build`                           | `tsc` + Vite production build + **electron-builder** |
| `npm run typecheck`                       | TypeScript only                                      |
| `npm run lint` / `npm run lint:fix`       | ESLint                                               |
| `npm run format` / `npm run format:check` | Prettier                                             |
| `npm run validate`                        | typecheck + ESLint + format check + test (CI gate)   |
| `npm test`                                | Vitest (unit tests)                                  |

Pre-commit (after `npm install`): **Husky** runs **lint-staged** — ESLint fixes and Prettier on staged files. Formatting defaults: [.editorconfig](./.editorconfig), [.prettierrc.json](./.prettierrc.json).

---

## Repository layout

```
electron/main/     Main process (IPC, ffmpeg, glTF, image pipeline)
electron/preload/  contextBridge API exposed to the renderer
src/               React renderer (workbenches: Image / Video / 3D)
docs/              Product & design
public/draco/      Bundled Draco glTF decoders (from three.js)
test/              Vitest specs
```

---

## Contributing & AI assistants

Before large changes, read **[AGENTS.md](./AGENTS.md)**. Cursor rules live under `.cursor/rules/`.

---

## Third-party notices

- **electron-vite-react** (MIT) — original scaffolding; copyright retained in [LICENSE](./LICENSE).
- **Draco** binaries under `public/draco/gltf/` — from the **three.js** package examples (`examples/jsm/libs/draco/gltf/`); see `public/draco/README.txt`.
- Other dependencies: see `package.json` and respective licenses.

---

## License

This project is licensed under the **MIT License** — see [LICENSE](./LICENSE).

- **PicaFlux** code: Copyright (c) 2026 PicaFlux contributors.
- **Upstream template** (electron-vite-react): Copyright (c) 2023 caoxiemeihao (retained in LICENSE).

---

中文说明见 [README.zh-CN.md](./README.zh-CN.md).
