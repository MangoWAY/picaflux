import sharp from 'sharp'
import path from 'node:path'
import fs from 'node:fs/promises'
import { getBackgroundRemovalBackend } from './background-removal/registry'

/** 固定水印透明区域默认（相对图像宽高的百分比） */
export const DEFAULT_FIXED_WATERMARK_REGION_PERCENT = {
  leftPercent: 80,
  topPercent: 90,
  widthPercent: 20,
  heightPercent: 10,
} as const

export type FixedWatermarkRegionPercent = {
  leftPercent: number
  topPercent: number
  widthPercent: number
  heightPercent: number
}

export interface ProcessImageOptions {
  format?: 'original' | 'png' | 'jpeg' | 'webp' | 'avif'
  width?: number
  height?: number
  quality?: number // 1-100
  /** 为 true 时先走抠图后端，再走 sharp（输出仍由 format/quality 等决定；JPEG 会丢失透明） */
  removeBackground?: boolean
  /** 抠图实现，默认由 registry 的 DEFAULT；换后端时传对应 id */
  backgroundRemovalBackendId?: string
  /** 将矩形区域内像素 alpha 置 0（用于固定位置水印）；在缩放前、相对当前图像尺寸取百分比 */
  clearFixedWatermark?: boolean
  fixedWatermarkRegion?: FixedWatermarkRegionPercent
}

function clampPercent(n: number, fallback: number): number {
  if (!Number.isFinite(n)) return fallback
  return Math.min(100, Math.max(0, n))
}

function sanitizeFixedWatermarkRegion(raw: unknown): FixedWatermarkRegionPercent {
  const d = DEFAULT_FIXED_WATERMARK_REGION_PERCENT
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ...d }
  }
  const r = raw as Record<string, unknown>
  const num = (v: unknown, fb: number) => clampPercent(typeof v === 'number' ? v : fb, fb)
  const w = Math.max(0.5, num(r.widthPercent, d.widthPercent))
  const h = Math.max(0.5, num(r.heightPercent, d.heightPercent))
  return {
    leftPercent: num(r.leftPercent, d.leftPercent),
    topPercent: num(r.topPercent, d.topPercent),
    widthPercent: w,
    heightPercent: h,
  }
}

/** 将指定百分比矩形内 alpha 清零，输出 PNG buffer 供后续 sharp 管线使用 */
async function applyFixedWatermarkTransparency(
  input: string | Buffer,
  region: FixedWatermarkRegionPercent
): Promise<Buffer> {
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const w = info.width ?? 0
  const h = info.height ?? 0
  const channels = info.channels ?? 0
  if (!w || !h || channels < 4) {
    throw new Error('Image must have dimensions and alpha channel')
  }
  const buf = Buffer.from(data)
  let left = Math.round((region.leftPercent / 100) * w)
  let top = Math.round((region.topPercent / 100) * h)
  let rw = Math.round((region.widthPercent / 100) * w)
  let rh = Math.round((region.heightPercent / 100) * h)
  left = Math.max(0, Math.min(w - 1, left))
  top = Math.max(0, Math.min(h - 1, top))
  rw = Math.max(1, Math.min(w - left, rw))
  rh = Math.max(1, Math.min(h - top, rh))
  for (let y = top; y < top + rh; y++) {
    for (let x = left; x < left + rw; x++) {
      const i = (y * w + x) * 4
      buf[i + 3] = 0
    }
  }
  return sharp(buf, { raw: { width: w, height: h, channels: 4 } }).png().toBuffer()
}

const FORMAT_VALUES = ['original', 'png', 'jpeg', 'webp', 'avif'] as const

/** IPC 入参清洗，避免渲染进程传入非预期字段 */
export function sanitizeProcessImageOptions(raw: unknown): ProcessImageOptions {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {}
  }
  const o = raw as Record<string, unknown>
  const format =
    typeof o.format === 'string' && (FORMAT_VALUES as readonly string[]).includes(o.format)
      ? (o.format as ProcessImageOptions['format'])
      : undefined
  const width =
    typeof o.width === 'number' && Number.isFinite(o.width) && o.width > 0
      ? Math.min(65535, Math.floor(o.width))
      : undefined
  const height =
    typeof o.height === 'number' && Number.isFinite(o.height) && o.height > 0
      ? Math.min(65535, Math.floor(o.height))
      : undefined
  const quality =
    typeof o.quality === 'number' && Number.isFinite(o.quality)
      ? Math.min(100, Math.max(1, Math.round(o.quality)))
      : undefined
  const bid = o.backgroundRemovalBackendId
  const backgroundRemovalBackendId =
    typeof bid === 'string' && bid.length > 0 && bid.length <= 64 && /^[a-z0-9_-]+$/i.test(bid)
      ? bid
      : undefined

  const clearFixedWatermark = o.clearFixedWatermark === true
  const fixedWatermarkRegion = clearFixedWatermark
    ? sanitizeFixedWatermarkRegion(o.fixedWatermarkRegion)
    : undefined

  return {
    format,
    width,
    height,
    quality,
    removeBackground: o.removeBackground === true,
    backgroundRemovalBackendId,
    clearFixedWatermark,
    fixedWatermarkRegion,
  }
}

export interface ProcessImageResult {
  success: boolean
  outputPath?: string
  error?: string
}

export interface ImageFileInfo {
  size: number
  width?: number
  height?: number
  /** sharp metadata format, e.g. jpeg, png, webp */
  format?: string
}

export async function getImageFileInfo(inputPath: string): Promise<ImageFileInfo | null> {
  try {
    const stat = await fs.stat(inputPath)
    const meta = await sharp(inputPath).metadata()
    return {
      size: stat.size,
      width: meta.width,
      height: meta.height,
      format: meta.format,
    }
  } catch {
    return null
  }
}

export async function processImage(
  inputPath: string,
  outputDir: string,
  options: ProcessImageOptions
): Promise<ProcessImageResult> {
  try {
    // Ensure output directory exists
    await fs.mkdir(outputDir, { recursive: true })

    const parsedPath = path.parse(inputPath)
    const requested = options.format || 'original'

    const extToFormat: Record<string, 'png' | 'jpeg' | 'webp' | 'avif'> = {
      png: 'png',
      jpeg: 'jpeg',
      jpg: 'jpeg',
      webp: 'webp',
      avif: 'avif',
    }

    let format: 'png' | 'jpeg' | 'webp' | 'avif'
    if (requested === 'original') {
      const ext = parsedPath.ext.toLowerCase().replace('.', '')
      format = extToFormat[ext] ?? 'png'
    } else {
      format = requested
    }

    const outputExt = format === 'jpeg' ? 'jpg' : format
    const outputFileName = `${parsedPath.name}_processed.${outputExt}`
    const outputPath = path.join(outputDir, outputFileName)

    let pipelineInput: string | Buffer = inputPath
    if (options.removeBackground) {
      try {
        const backend = getBackgroundRemovalBackend(options.backgroundRemovalBackendId)
        pipelineInput = await backend.removeFromFile(inputPath)
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Background removal failed'
        console.error('Background removal error:', error)
        return { success: false, error: message }
      }
    }

    if (options.clearFixedWatermark) {
      try {
        const region =
          options.fixedWatermarkRegion ?? { ...DEFAULT_FIXED_WATERMARK_REGION_PERCENT }
        pipelineInput = await applyFixedWatermarkTransparency(pipelineInput, region)
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Watermark region clear failed'
        console.error('Fixed watermark clear error:', error)
        return { success: false, error: message }
      }
    }

    let pipeline = sharp(pipelineInput)

    // Resize
    if (options.width || options.height) {
      pipeline = pipeline.resize({
        width: options.width,
        height: options.height,
        fit: 'inside', // Keep aspect ratio by default
        withoutEnlargement: true, // Don't upscale
      })
    }

    // Format & Quality
    const quality = options.quality || 80
    switch (format) {
      case 'png':
        pipeline = pipeline.png({ quality })
        break
      case 'jpeg':
        pipeline = pipeline.jpeg({ quality })
        break
      case 'webp':
        pipeline = pipeline.webp({ quality })
        break
      case 'avif':
        pipeline = pipeline.avif({ quality })
        break
    }

    await pipeline.toFile(outputPath)

    return {
      success: true,
      outputPath
    }
  } catch (error: unknown) {
    console.error('Error processing image:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return {
      success: false,
      error: message,
    }
  }
}
