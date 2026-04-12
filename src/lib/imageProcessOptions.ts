/** 图片处理右侧表单与 IPC 载荷共用的选项类型（与 SettingsPanel UI 绑定） */

export type OutputFormatOption = 'original' | 'png' | 'jpeg' | 'webp' | 'avif'

/** 裁剪框归一化坐标的最小边长比例（与预览拖动一致） */
export const MIN_CROP_NORM = 0.02

/** none：不按比例缩放；再点同一百分比可回到 none */
export type ResizePercentPreset = 'none' | 'p75' | 'p50' | 'p25' | 'custom'

export interface ProcessOptions {
  format: OutputFormatOption
  /** 是否应用旋转与镜像；关闭时预览与导出均不应用，但仍保留下方数值 */
  rotateMirrorEnabled: boolean
  /** 累计 90° 步数（可正可负、不取模），导出时对 4 取模；预览用此值算角度以保证动画走最短弧 */
  rotateQuarterTurns: number
  flipHorizontal: boolean
  flipVertical: boolean
  /** 切图：按网格均分输出 */
  sliceEnabled: boolean
  sliceRows: string
  sliceCols: string
  /** 自定义切图线（0.0~1.0 的比例），如果为空则使用均分 */
  sliceXLines?: number[]
  sliceYLines?: number[]
  /** 百分比缩放与像素缩放二选一 */
  resizeMode: 'percent' | 'pixels'
  resizePercentPreset: ResizePercentPreset
  /** 选择「自定义」时的百分比字符串，1–400 */
  resizeCustomPercentStr: string
  /** 像素输入区是否展开 */
  resizePixelsExpanded: boolean
  width: string
  height: string
  keepAspectRatio: boolean
  quality: number
  outputDir: string
  removeBackground: boolean
  clearFixedWatermark: boolean
  watermarkLeftPct: string
  watermarkTopPct: string
  watermarkWidthPct: string
  watermarkHeightPct: string
  /** 与中间预览一致的裁剪框（相对当前「视觉」宽高的 0–1 归一化，含旋转/镜像后） */
  cropEnabled: boolean
  cropNorm: { x: number; y: number; w: number; h: number }
  /** 裁掉完全透明的边缘像素（用于减小导出尺寸） */
  trimTransparent: boolean
  /** 额外保留的透明边（像素） */
  trimPaddingPx: string
}

export const OUTPUT_FORMAT_VALUES: OutputFormatOption[] = [
  'original',
  'png',
  'jpeg',
  'webp',
  'avif',
]

export function isOutputFormatOption(v: string): v is OutputFormatOption {
  return (OUTPUT_FORMAT_VALUES as readonly string[]).includes(v)
}
