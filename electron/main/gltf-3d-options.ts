export type Convert3dPreset = 'optimize' | 'reserialize'

export interface Process3dOptions {
  preset?: Convert3dPreset
  /** 贴图最长边上限（像素），0 表示不处理贴图 */
  textureMaxSize?: number
  /** 贴图输出格式：keep=保持原样；webp/jpeg=重编码（若有透明且选 jpeg，会自动改为 webp） */
  textureFormat?: 'keep' | 'webp' | 'jpeg'
  /** 贴图质量（1–100），仅 webp/jpeg 生效 */
  textureQuality?: number
}

export interface SanitizedProcess3dOptions {
  preset: Convert3dPreset
  textureMaxSize: number
  textureFormat: 'keep' | 'webp' | 'jpeg'
  textureQuality: number
}

export function sanitizeProcess3dOptions(raw: unknown): SanitizedProcess3dOptions {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { preset: 'optimize', textureMaxSize: 0, textureFormat: 'keep', textureQuality: 100 }
  }
  const d = raw as Process3dOptions
  const preset: Convert3dPreset = d.preset === 'reserialize' ? 'reserialize' : 'optimize'
  const textureMaxSize = (() => {
    const n = typeof d.textureMaxSize === 'number' ? d.textureMaxSize : 0
    if (!Number.isFinite(n) || n <= 0) return 0
    return Math.min(8192, Math.max(128, Math.round(n)))
  })()
  const textureFormat: SanitizedProcess3dOptions['textureFormat'] =
    d.textureFormat === 'webp' || d.textureFormat === 'jpeg' ? d.textureFormat : 'keep'
  const textureQuality = (() => {
    const n = typeof d.textureQuality === 'number' ? d.textureQuality : 100
    if (!Number.isFinite(n)) return 100
    return Math.min(100, Math.max(1, Math.round(n)))
  })()
  return { preset, textureMaxSize, textureFormat, textureQuality }
}
