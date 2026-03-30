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
  /** 顺时针 90° 的倍数，仅取 0–3 */
  rotateQuarterTurns?: number
  /** 水平镜像（左右翻转），对应 sharp flop */
  flipHorizontal?: boolean
  /** 垂直镜像（上下翻转），对应 sharp flip */
  flipVertical?: boolean
  width?: number
  height?: number
  /** 像素缩放时是否保持比例（inside）；为 false 时尽量按给定宽高拉伸 */
  keepAspectRatio?: boolean
  /** 相对当前图像宽高的缩放百分比（1–400），与 width/height 互斥；100 表示不缩放 */
  scalePercent?: number
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
  region: FixedWatermarkRegionPercent,
): Promise<Buffer> {
  const { data, info } = await sharp(input)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
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
  return sharp(buf, { raw: { width: w, height: h, channels: 4 } })
    .png()
    .toBuffer()
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
  const hasPixelResize = (width ?? 0) > 0 || (height ?? 0) > 0

  let scalePercent: number | undefined
  if (!hasPixelResize && typeof o.scalePercent === 'number' && Number.isFinite(o.scalePercent)) {
    const p = Math.round(o.scalePercent)
    const clamped = Math.min(400, Math.max(1, p))
    if (clamped !== 100) scalePercent = clamped
  }

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
  let rotateQuarterTurns: number | undefined
  if (typeof o.rotateQuarterTurns === 'number' && Number.isFinite(o.rotateQuarterTurns)) {
    const n = Math.floor(o.rotateQuarterTurns) % 4
    rotateQuarterTurns = n < 0 ? n + 4 : n
    if (rotateQuarterTurns === 0) rotateQuarterTurns = undefined
  }

  return {
    format,
    rotateQuarterTurns,
    flipHorizontal: o.flipHorizontal === true,
    flipVertical: o.flipVertical === true,
    width,
    height,
    keepAspectRatio: o.keepAspectRatio !== false,
    scalePercent,
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

export interface SliceImageGridOptions extends ProcessImageOptions {
  rows: number
  cols: number
  /** Optional custom slice lines (fractions 0.0 to 1.0) for X axis (vertical lines) */
  xLines?: number[]
  /** Optional custom slice lines (fractions 0.0 to 1.0) for Y axis (horizontal lines) */
  yLines?: number[]
}

export interface SliceImageGridResult {
  success: boolean
  outputPaths?: string[]
  error?: string
}

export interface ImageFileInfo {
  size: number
  width?: number
  height?: number
  /** sharp metadata format, e.g. jpeg, png, webp */
  format?: string
}

export interface ImageAlphaPreviewResult {
  success: boolean
  dataUrl?: string
  error?: string
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

export function sanitizeGetImageAlphaPreviewOptions(raw: unknown): { maxSize: number } {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { maxSize: 1024 }
  }
  const o = raw as Record<string, unknown>
  const maxSizeRaw = o.maxSize
  const maxSize =
    typeof maxSizeRaw === 'number' && Number.isFinite(maxSizeRaw) ? Math.floor(maxSizeRaw) : 1024
  return { maxSize: Math.min(4096, Math.max(64, maxSize)) }
}

export async function getImageAlphaPreviewDataUrl(
  inputPath: string,
  options: { maxSize: number },
): Promise<ImageAlphaPreviewResult> {
  try {
    const maxSize = options.maxSize
    const buf = await sharp(inputPath)
      .ensureAlpha()
      .resize({ width: maxSize, height: maxSize, fit: 'inside', withoutEnlargement: true })
      .extractChannel(3)
      .png()
      .toBuffer()
    return { success: true, dataUrl: `data:image/png;base64,${buf.toString('base64')}` }
  } catch (error: unknown) {
    console.error('Error building alpha preview:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return { success: false, error: message }
  }
}

export function sanitizeSliceImageGridOptions(raw: unknown): SliceImageGridOptions | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return null
  }
  const o = raw as Record<string, unknown>

  const rowsRaw = o.rows
  const colsRaw = o.cols
  const rows =
    typeof rowsRaw === 'number' && Number.isFinite(rowsRaw) ? Math.floor(rowsRaw) : undefined
  const cols =
    typeof colsRaw === 'number' && Number.isFinite(colsRaw) ? Math.floor(colsRaw) : undefined

  if (!rows || !cols) return null
  if (rows < 1 || cols < 1) return null
  if (rows > 64 || cols > 64) return null

  const xLinesRaw = o.xLines
  const yLinesRaw = o.yLines
  let xLines: number[] | undefined
  let yLines: number[] | undefined
  if (Array.isArray(xLinesRaw)) {
    xLines = xLinesRaw
      .filter((v) => typeof v === 'number' && Number.isFinite(v) && v > 0 && v < 1)
      .sort((a, b) => a - b)
  }
  if (Array.isArray(yLinesRaw)) {
    yLines = yLinesRaw
      .filter((v) => typeof v === 'number' && Number.isFinite(v) && v > 0 && v < 1)
      .sort((a, b) => a - b)
  }

  return {
    ...sanitizeProcessImageOptions(raw),
    rows,
    cols,
    xLines,
    yLines,
  }
}

function resolveOutputFormatAndExt(
  inputPath: string,
  requested: ProcessImageOptions['format'] | undefined,
): { format: 'png' | 'jpeg' | 'webp' | 'avif'; outputExt: string } {
  const parsedPath = path.parse(inputPath)
  const extToFormat: Record<string, 'png' | 'jpeg' | 'webp' | 'avif'> = {
    png: 'png',
    jpeg: 'jpeg',
    jpg: 'jpeg',
    webp: 'webp',
    avif: 'avif',
  }
  let format: 'png' | 'jpeg' | 'webp' | 'avif'
  if ((requested || 'original') === 'original') {
    const ext = parsedPath.ext.toLowerCase().replace('.', '')
    format = extToFormat[ext] ?? 'png'
  } else {
    format = requested as 'png' | 'jpeg' | 'webp' | 'avif'
  }
  const outputExt = format === 'jpeg' ? 'jpg' : format
  return { format, outputExt }
}

function applyFormatAndQuality(
  pipeline: sharp.Sharp,
  format: 'png' | 'jpeg' | 'webp' | 'avif',
  quality: number,
): sharp.Sharp {
  switch (format) {
    case 'png':
      return pipeline.png({ quality })
    case 'jpeg':
      return pipeline.jpeg({ quality })
    case 'webp':
      return pipeline.webp({ quality })
    case 'avif':
      return pipeline.avif({ quality })
  }
}

type ExtractRect = {
  left: number
  top: number
  width: number
  height: number
  row: number
  col: number
}

function computeGridRects(
  width: number,
  height: number,
  rows: number,
  cols: number,
): ExtractRect[] {
  const rects: ExtractRect[] = []
  const baseW = Math.floor(width / cols)
  const baseH = Math.floor(height / rows)
  const remW = width - baseW * cols
  const remH = height - baseH * rows

  let top = 0
  for (let r = 0; r < rows; r++) {
    const h = baseH + (r === rows - 1 ? remH : 0)
    let left = 0
    for (let c = 0; c < cols; c++) {
      const w = baseW + (c === cols - 1 ? remW : 0)
      if (w > 0 && h > 0) {
        rects.push({ left, top, width: w, height: h, row: r, col: c })
      }
      left += w
    }
    top += h
  }
  return rects
}

function computeCustomGridRects(
  width: number,
  height: number,
  xLines: number[],
  yLines: number[],
): ExtractRect[] {
  const rects: ExtractRect[] = []
  const xs = [0, ...xLines.map((f) => Math.round(f * width)), width]
  const ys = [0, ...yLines.map((f) => Math.round(f * height)), height]

  for (let r = 0; r < ys.length - 1; r++) {
    const top = ys[r]
    const bottom = ys[r + 1]
    const h = bottom - top
    for (let c = 0; c < xs.length - 1; c++) {
      const left = xs[c]
      const right = xs[c + 1]
      const w = right - left
      if (w > 0 && h > 0) {
        rects.push({ left, top, width: w, height: h, row: r, col: c })
      }
    }
  }
  return rects
}

export async function processImage(
  inputPath: string,
  outputDir: string,
  options: ProcessImageOptions,
): Promise<ProcessImageResult> {
  try {
    // Ensure output directory exists
    await fs.mkdir(outputDir, { recursive: true })

    const parsedPath = path.parse(inputPath)
    const requested = options.format || 'original'

    const { format, outputExt } = resolveOutputFormatAndExt(inputPath, requested)
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
        const region = options.fixedWatermarkRegion ?? { ...DEFAULT_FIXED_WATERMARK_REGION_PERCENT }
        pipelineInput = await applyFixedWatermarkTransparency(pipelineInput, region)
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Watermark region clear failed'
        console.error('Fixed watermark clear error:', error)
        return { success: false, error: message }
      }
    }

    let pipeline = sharp(pipelineInput)

    const rq =
      typeof options.rotateQuarterTurns === 'number' && Number.isFinite(options.rotateQuarterTurns)
        ? ((((Math.floor(options.rotateQuarterTurns) % 4) + 4) % 4) as 0 | 1 | 2 | 3)
        : 0
    if (rq !== 0) {
      pipeline = pipeline.rotate(rq * 90)
    }
    if (options.flipHorizontal === true) {
      pipeline = pipeline.flop()
    }
    if (options.flipVertical === true) {
      pipeline = pipeline.flip()
    }

    // Resize：优先像素尺寸；否则按比例缩放
    const hasPixelResize =
      (typeof options.width === 'number' && options.width > 0) ||
      (typeof options.height === 'number' && options.height > 0)

    if (hasPixelResize) {
      const keepAR = options.keepAspectRatio !== false
      pipeline = pipeline.resize({
        width: options.width,
        height: options.height,
        fit: keepAR ? 'inside' : 'fill',
        withoutEnlargement: true,
      })
    } else if (
      typeof options.scalePercent === 'number' &&
      Number.isFinite(options.scalePercent) &&
      options.scalePercent !== 100
    ) {
      const p = Math.min(400, Math.max(1, Math.round(options.scalePercent)))
      const meta = await pipeline.metadata()
      const w0 = meta.width
      const h0 = meta.height
      if (w0 && h0) {
        const factor = p / 100
        const newW = Math.max(1, Math.round(w0 * factor))
        pipeline = pipeline.resize({
          width: newW,
          withoutEnlargement: p <= 100,
        })
      }
    }

    // Format & Quality
    const quality = options.quality || 80
    pipeline = applyFormatAndQuality(pipeline, format, quality)

    await pipeline.toFile(outputPath)

    return {
      success: true,
      outputPath,
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

export async function sliceImageGrid(
  inputPath: string,
  outputDir: string,
  options: SliceImageGridOptions,
): Promise<SliceImageGridResult> {
  try {
    await fs.mkdir(outputDir, { recursive: true })

    const parsedPath = path.parse(inputPath)
    const requested = options.format || 'original'
    const { format, outputExt } = resolveOutputFormatAndExt(inputPath, requested)
    const quality = options.quality || 80

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
        const region = options.fixedWatermarkRegion ?? { ...DEFAULT_FIXED_WATERMARK_REGION_PERCENT }
        pipelineInput = await applyFixedWatermarkTransparency(pipelineInput, region)
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Watermark region clear failed'
        console.error('Fixed watermark clear error:', error)
        return { success: false, error: message }
      }
    }

    let base = sharp(pipelineInput)

    const rq =
      typeof options.rotateQuarterTurns === 'number' && Number.isFinite(options.rotateQuarterTurns)
        ? ((((Math.floor(options.rotateQuarterTurns) % 4) + 4) % 4) as 0 | 1 | 2 | 3)
        : 0
    if (rq !== 0) base = base.rotate(rq * 90)
    if (options.flipHorizontal === true) base = base.flop()
    if (options.flipVertical === true) base = base.flip()

    const hasPixelResize =
      (typeof options.width === 'number' && options.width > 0) ||
      (typeof options.height === 'number' && options.height > 0)
    if (hasPixelResize) {
      const keepAR = options.keepAspectRatio !== false
      base = base.resize({
        width: options.width,
        height: options.height,
        fit: keepAR ? 'inside' : 'fill',
        withoutEnlargement: true,
      })
    } else if (
      typeof options.scalePercent === 'number' &&
      Number.isFinite(options.scalePercent) &&
      options.scalePercent !== 100
    ) {
      const p = Math.min(400, Math.max(1, Math.round(options.scalePercent)))
      const meta0 = await base.clone().metadata()
      const w0 = meta0.width
      const h0 = meta0.height
      if (w0 && h0) {
        const factor = p / 100
        const newW = Math.max(1, Math.round(w0 * factor))
        base = base.resize({
          width: newW,
          withoutEnlargement: p <= 100,
        })
      }
    }

    const meta = await base.clone().metadata()
    const w = meta.width ?? 0
    const h = meta.height ?? 0
    if (!w || !h) {
      return { success: false, error: 'Failed to read image dimensions' }
    }

    let rects: ExtractRect[]
    if (options.xLines && options.yLines) {
      rects = computeCustomGridRects(w, h, options.xLines, options.yLines)
    } else {
      rects = computeGridRects(w, h, options.rows, options.cols)
    }

    if (rects.length === 0) {
      return { success: false, error: 'Invalid grid slicing geometry' }
    }

    const outputs: string[] = []
    for (const r of rects) {
      const outName = `${parsedPath.name}_slice_${options.rows}x${options.cols}_r${r.row + 1}c${r.col + 1}.${outputExt}`
      const outPath = path.join(outputDir, outName)
      const p = applyFormatAndQuality(base.clone().extract(r), format, quality)
      await p.toFile(outPath)
      outputs.push(outPath)
    }

    return { success: true, outputPaths: outputs }
  } catch (error: unknown) {
    console.error('Error slicing image:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return { success: false, error: message }
  }
}
