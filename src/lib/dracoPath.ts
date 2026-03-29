/**
 * Draco WASM/JS 解码器随应用打包在 `public/draco/gltf/`（来自 three.js 自带副本）。
 * 使用相对当前页面 URL 解析，兼容 Vite 开发服与 Electron `file://` 下的 `dist/index.html`。
 */
export function getDracoDecoderPath(): string {
  if (typeof window === 'undefined') {
    return '/draco/gltf/'
  }
  return new URL('draco/gltf/', window.location.href).href
}
