import type {
  OutputFormatOption,
  ProcessOptions,
  ResizePercentPreset,
} from '@/lib/imageProcessOptions'
import { FIXED_WATERMARK_DEFAULTS } from '../constants/fixedWatermark'

/** 与预览叠加层、主进程 `fixedWatermarkRegion` 语义一致（相对原图宽高百分比） */
export type WatermarkRegionPercents = {
  leftPercent: number
  topPercent: number
  widthPercent: number
  heightPercent: number
}

function parseWatermarkPct(s: string, fallback: number): number {
  const n = parseFloat(s)
  if (!Number.isFinite(n)) return fallback
  return Math.min(100, Math.max(0, n))
}

const WM_DEFAULTS = {
  left: parseFloat(FIXED_WATERMARK_DEFAULTS.leftPercent),
  top: parseFloat(FIXED_WATERMARK_DEFAULTS.topPercent),
  width: parseFloat(FIXED_WATERMARK_DEFAULTS.widthPercent),
  height: parseFloat(FIXED_WATERMARK_DEFAULTS.heightPercent),
}

/**
 * 从表单选项解析固定透明区域百分比；未开启时返回 null。
 * 预览与 `processImage` IPC 共用，避免两套解析不一致。
 */
export function getWatermarkRegionPercents(
  options: ProcessOptions,
): WatermarkRegionPercents | null {
  if (!options.clearFixedWatermark) return null
  return {
    leftPercent: parseWatermarkPct(options.watermarkLeftPct, WM_DEFAULTS.left),
    topPercent: parseWatermarkPct(options.watermarkTopPct, WM_DEFAULTS.top),
    widthPercent: Math.max(0.5, parseWatermarkPct(options.watermarkWidthPct, WM_DEFAULTS.width)),
    heightPercent: Math.max(0.5, parseWatermarkPct(options.watermarkHeightPct, WM_DEFAULTS.height)),
  }
}

export function effectiveResizeScalePercent(options: ProcessOptions): number {
  if (options.resizeMode !== 'percent') return 100
  if (options.resizePercentPreset === 'none') return 100
  if (options.resizePercentPreset === 'custom') {
    const n = parseFloat(String(options.resizeCustomPercentStr).replace(',', '.'))
    if (!Number.isFinite(n)) return 100
    return Math.min(400, Math.max(1, Math.round(n)))
  }
  const map: Record<Exclude<ResizePercentPreset, 'custom' | 'none'>, number> = {
    p75: 75,
    p50: 50,
    p25: 25,
  }
  return map[options.resizePercentPreset]
}

/** 导出管线使用的 0–3 顺时针 90° 倍数 */
export function normalizedRotateQuarterTurnsForIpc(rotateQuarterTurns: number): number {
  return ((rotateQuarterTurns % 4) + 4) % 4
}

export function parseTrimPaddingForIpc(trimPaddingPx: string): number {
  const n = parseInt(String(trimPaddingPx), 10)
  return Number.isFinite(n) ? Math.min(512, Math.max(0, n)) : 2
}

function parsePixelDim(s: string): number | undefined {
  const n = parseInt(s, 10)
  return Number.isFinite(n) && n > 0 ? n : undefined
}

export function parseSliceGridDimension(s: string, fallback: number): number {
  const n = parseInt(s, 10)
  if (!Number.isFinite(n)) return fallback
  return Math.min(64, Math.max(1, n))
}

/** 与主进程 `resolveOutputFormatAndExt` 中扩展名映射一致 */
const EXT_TO_FORMAT: Record<string, 'png' | 'jpeg' | 'webp' | 'avif'> = {
  png: 'png',
  jpeg: 'jpeg',
  jpg: 'jpeg',
  webp: 'webp',
  avif: 'avif',
}

function lastPathSegment(inputPath: string): string {
  const norm = inputPath.replace(/\\/g, '/')
  const slash = norm.lastIndexOf('/')
  return slash >= 0 ? norm.slice(slash + 1) : norm
}

function splitStemAndExt(base: string): { stem: string; extNoDot: string } {
  if (!base) return { stem: '', extNoDot: '' }
  const lastDot = base.lastIndexOf('.')
  if (lastDot <= 0) return { stem: base, extNoDot: '' }
  return { stem: base.slice(0, lastDot), extNoDot: base.slice(lastDot + 1) }
}

function normalizeExtForCompare(ext: string): string {
  const e = ext.toLowerCase()
  return e === 'jpeg' ? 'jpg' : e
}

/**
 * 当前「格式」选项下导出文件扩展名（不含点），与主进程管线一致。
 */
export function resolvedOutputExtensionForPath(
  inputPath: string,
  format: OutputFormatOption,
): string {
  const base = lastPathSegment(inputPath)
  const { extNoDot } = splitStemAndExt(base)
  const key = extNoDot.toLowerCase()

  let fmt: 'png' | 'jpeg' | 'webp' | 'avif'
  if (format === 'original') {
    fmt = EXT_TO_FORMAT[key] ?? 'png'
  } else {
    fmt = format === 'jpeg' ? 'jpeg' : format
  }
  return fmt === 'jpeg' ? 'jpg' : fmt
}

/**
 * 覆盖原图仅当导出路径与源路径相同（即扩展名与当前格式一致，含 jpeg/jpg 等价）时允许。
 */
export function isOverwriteCompatibleWithSourcePath(
  inputPath: string,
  format: OutputFormatOption,
): boolean {
  const base = lastPathSegment(inputPath)
  const { extNoDot } = splitStemAndExt(base)
  const outExt = resolvedOutputExtensionForPath(inputPath, format)
  return normalizeExtForCompare(extNoDot) === normalizeExtForCompare(outExt)
}

/**
 * 传给 `picafluxAPI.processImage` / `sliceImageGrid` 的 options 对象（与主进程 sanitize 对齐前的形态）。
 */
export function buildProcessImageInvokeOptions(
  options: ProcessOptions,
  removalBackendId: string | undefined,
): Record<string, unknown> {
  const mirrorOn = options.rotateMirrorEnabled !== false
  const rq = mirrorOn ? normalizedRotateQuarterTurnsForIpc(options.rotateQuarterTurns) : 0
  const pixelW = options.resizeMode === 'pixels' ? parsePixelDim(options.width) : undefined
  const pixelH = options.resizeMode === 'pixels' ? parsePixelDim(options.height) : undefined
  const scalePct = options.resizeMode === 'percent' ? effectiveResizeScalePercent(options) : 100
  const wm = getWatermarkRegionPercents(options)

  const base: Record<string, unknown> = {
    format: options.format,
    ...(rq !== 0 ? { rotateQuarterTurns: rq } : {}),
    ...(mirrorOn && options.flipHorizontal ? { flipHorizontal: true } : {}),
    ...(mirrorOn && options.flipVertical ? { flipVertical: true } : {}),
    quality: options.quality,
    ...(pixelW !== undefined || pixelH !== undefined
      ? {
          width: pixelW,
          height: pixelH,
          keepAspectRatio: options.keepAspectRatio,
        }
      : {}),
    ...(options.resizeMode === 'percent' && scalePct !== 100 ? { scalePercent: scalePct } : {}),
    removeBackground: options.removeBackground,
    backgroundRemovalBackendId: removalBackendId,
    clearFixedWatermark: options.clearFixedWatermark,
    ...(wm
      ? {
          fixedWatermarkRegion: {
            leftPercent: wm.leftPercent,
            topPercent: wm.topPercent,
            widthPercent: wm.widthPercent,
            heightPercent: wm.heightPercent,
          },
        }
      : {}),
    ...(options.cropEnabled
      ? {
          crop: {
            x: options.cropNorm.x,
            y: options.cropNorm.y,
            width: options.cropNorm.w,
            height: options.cropNorm.h,
          },
        }
      : {}),
    ...(options.trimTransparent
      ? {
          trimTransparent: true,
          trimPaddingPx: parseTrimPaddingForIpc(options.trimPaddingPx),
        }
      : {}),
    ...(options.overwriteOriginal ? { overwriteOriginal: true } : {}),
  }

  return base
}
