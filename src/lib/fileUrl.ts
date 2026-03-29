/** 将本地绝对路径转为可在 WebGL / fetch 中使用的 file URL（Electron 下与现有图片预览一致） */
export function pathToFileUrl(absPath: string): string {
  if (!absPath) return ''
  if (absPath.startsWith('file:')) return absPath
  const normalized = absPath.replace(/\\/g, '/')
  if (normalized.startsWith('/')) {
    return `file://${normalized}`
  }
  if (/^[A-Za-z]:\//.test(normalized)) {
    return `file:///${normalized}`
  }
  return `file:///${normalized}`
}
