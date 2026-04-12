import type {
  OutputFormatOption,
  ProcessOptions,
  ResizePercentPreset,
} from '@/lib/imageProcessOptions'
import { FIXED_WATERMARK_DEFAULTS } from '../constants/fixedWatermark'

/** 写入磁盘的预设体：不含输出目录与裁剪（与当前素材绑定） */
export type ImageProcessPresetStored = Omit<
  ProcessOptions,
  'outputDir' | 'cropEnabled' | 'cropNorm'
>

export interface ImageProcessPresetRecord {
  id: string
  name: string
  updatedAt: number
  options: ImageProcessPresetStored
}

const FORMATS: ReadonlySet<OutputFormatOption> = new Set([
  'original',
  'png',
  'jpeg',
  'webp',
  'avif',
])

const RESIZE_PRESETS: ReadonlySet<ResizePercentPreset> = new Set([
  'none',
  'p75',
  'p50',
  'p25',
  'custom',
])

export const DEFAULT_IMAGE_PRESET_STORED: ImageProcessPresetStored = {
  format: 'png',
  rotateMirrorEnabled: false,
  rotateQuarterTurns: 0,
  flipHorizontal: false,
  flipVertical: false,
  sliceEnabled: false,
  sliceRows: '4',
  sliceCols: '4',
  sliceXLines: undefined,
  sliceYLines: undefined,
  resizeMode: 'percent',
  resizePercentPreset: 'none',
  resizeCustomPercentStr: '100',
  resizePixelsExpanded: false,
  width: '',
  height: '',
  keepAspectRatio: true,
  quality: 80,
  overwriteOriginal: false,
  removeBackground: false,
  clearFixedWatermark: false,
  watermarkLeftPct: FIXED_WATERMARK_DEFAULTS.leftPercent,
  watermarkTopPct: FIXED_WATERMARK_DEFAULTS.topPercent,
  watermarkWidthPct: FIXED_WATERMARK_DEFAULTS.widthPercent,
  watermarkHeightPct: FIXED_WATERMARK_DEFAULTS.heightPercent,
  trimTransparent: false,
  trimPaddingPx: '2',
}

function pickStr(v: unknown, fallback: string): string {
  return typeof v === 'string' ? v : fallback
}

function pickBool(v: unknown, fallback: boolean): boolean {
  return typeof v === 'boolean' ? v : fallback
}

function pickIntClamped(v: unknown, fallback: number, min: number, max: number): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) return fallback
  return Math.min(max, Math.max(min, Math.round(v)))
}

function pickFormat(v: unknown): OutputFormatOption {
  return typeof v === 'string' && FORMATS.has(v as OutputFormatOption)
    ? (v as OutputFormatOption)
    : DEFAULT_IMAGE_PRESET_STORED.format
}

function pickResizePreset(v: unknown): ResizePercentPreset {
  return typeof v === 'string' && RESIZE_PRESETS.has(v as ResizePercentPreset)
    ? (v as ResizePercentPreset)
    : DEFAULT_IMAGE_PRESET_STORED.resizePercentPreset
}

function pickResizeMode(v: unknown): 'percent' | 'pixels' {
  return v === 'pixels' ? 'pixels' : 'percent'
}

function pickSliceLines(v: unknown): number[] | undefined {
  if (!Array.isArray(v)) return undefined
  const out: number[] = []
  for (const x of v) {
    if (typeof x !== 'number' || !Number.isFinite(x)) return undefined
    if (x <= 0 || x >= 1) return undefined
    out.push(x)
  }
  return out
}

/**
 * 将 IPC / 磁盘读出的对象规整为可合并进表单的预设（缺字段用默认值）
 */
export function sanitizeImagePresetStored(raw: unknown): ImageProcessPresetStored {
  const d =
    raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {}
  const base = DEFAULT_IMAGE_PRESET_STORED

  return {
    format: pickFormat(d.format),
    rotateMirrorEnabled: pickBool(d.rotateMirrorEnabled, base.rotateMirrorEnabled),
    rotateQuarterTurns: pickIntClamped(d.rotateQuarterTurns, base.rotateQuarterTurns, -1000, 1000),
    flipHorizontal: pickBool(d.flipHorizontal, base.flipHorizontal),
    flipVertical: pickBool(d.flipVertical, base.flipVertical),
    sliceEnabled: pickBool(d.sliceEnabled, base.sliceEnabled),
    sliceRows: pickStr(d.sliceRows, base.sliceRows),
    sliceCols: pickStr(d.sliceCols, base.sliceCols),
    sliceXLines: pickSliceLines(d.sliceXLines),
    sliceYLines: pickSliceLines(d.sliceYLines),
    resizeMode: pickResizeMode(d.resizeMode),
    resizePercentPreset: pickResizePreset(d.resizePercentPreset),
    resizeCustomPercentStr: pickStr(d.resizeCustomPercentStr, base.resizeCustomPercentStr),
    resizePixelsExpanded: pickBool(d.resizePixelsExpanded, base.resizePixelsExpanded),
    width: pickStr(d.width, base.width),
    height: pickStr(d.height, base.height),
    keepAspectRatio: pickBool(d.keepAspectRatio, base.keepAspectRatio),
    quality: pickIntClamped(d.quality, base.quality, 1, 100),
    overwriteOriginal: pickBool(d.overwriteOriginal, base.overwriteOriginal),
    removeBackground: pickBool(d.removeBackground, base.removeBackground),
    clearFixedWatermark: pickBool(d.clearFixedWatermark, base.clearFixedWatermark),
    watermarkLeftPct: pickStr(d.watermarkLeftPct, base.watermarkLeftPct),
    watermarkTopPct: pickStr(d.watermarkTopPct, base.watermarkTopPct),
    watermarkWidthPct: pickStr(d.watermarkWidthPct, base.watermarkWidthPct),
    watermarkHeightPct: pickStr(d.watermarkHeightPct, base.watermarkHeightPct),
    trimTransparent: pickBool(d.trimTransparent, base.trimTransparent),
    trimPaddingPx: pickStr(d.trimPaddingPx, base.trimPaddingPx),
  }
}

export function toPresetPayload(options: ProcessOptions): ImageProcessPresetStored {
  const { outputDir: _o, cropEnabled: _c, cropNorm: _n, ...rest } = options
  return sanitizeImagePresetStored(rest)
}

export function mergePresetIntoOptions(
  preset: ImageProcessPresetStored,
  current: ProcessOptions,
): ProcessOptions {
  const s = sanitizeImagePresetStored(preset)
  return {
    ...s,
    outputDir: current.outputDir,
    overwriteOriginal: current.overwriteOriginal,
    cropEnabled: current.cropEnabled,
    cropNorm: { ...current.cropNorm },
  }
}
