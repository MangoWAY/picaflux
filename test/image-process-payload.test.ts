import { describe, expect, it } from 'vitest'
import {
  buildProcessImageInvokeOptions,
  effectiveResizeScalePercent,
  getWatermarkRegionPercents,
  isOverwriteCompatibleWithSourcePath,
  normalizedRotateQuarterTurnsForIpc,
  parseSliceGridDimension,
  parseTrimPaddingForIpc,
  resolvedOutputExtensionForPath,
} from '../src/lib/imageProcessPayload'
import type { ProcessOptions } from '../src/lib/imageProcessOptions'
import { FIXED_WATERMARK_DEFAULTS } from '../src/constants/fixedWatermark'

function baseOptions(over: Partial<ProcessOptions> = {}): ProcessOptions {
  return {
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
    outputDir: '/out',
    overwriteOriginal: false,
    removeBackground: false,
    clearFixedWatermark: false,
    watermarkLeftPct: FIXED_WATERMARK_DEFAULTS.leftPercent,
    watermarkTopPct: FIXED_WATERMARK_DEFAULTS.topPercent,
    watermarkWidthPct: FIXED_WATERMARK_DEFAULTS.widthPercent,
    watermarkHeightPct: FIXED_WATERMARK_DEFAULTS.heightPercent,
    cropEnabled: false,
    cropNorm: { x: 0, y: 0, w: 1, h: 1 },
    trimTransparent: false,
    trimPaddingPx: '2',
    ...over,
  }
}

describe('imageProcessPayload', () => {
  it('normalizedRotateQuarterTurnsForIpc maps to 0–3', () => {
    expect(normalizedRotateQuarterTurnsForIpc(0)).toBe(0)
    expect(normalizedRotateQuarterTurnsForIpc(5)).toBe(1)
    expect(normalizedRotateQuarterTurnsForIpc(-1)).toBe(3)
  })

  it('getWatermarkRegionPercents returns null when disabled', () => {
    expect(getWatermarkRegionPercents(baseOptions({ clearFixedWatermark: false }))).toBeNull()
  })

  it('getWatermarkRegionPercents clamps width/height to min 0.5', () => {
    const r = getWatermarkRegionPercents(
      baseOptions({
        clearFixedWatermark: true,
        watermarkWidthPct: '0',
        watermarkHeightPct: '0',
      }),
    )
    expect(r).not.toBeNull()
    expect(r!.widthPercent).toBe(0.5)
    expect(r!.heightPercent).toBe(0.5)
  })

  it('effectiveResizeScalePercent handles presets and custom', () => {
    expect(effectiveResizeScalePercent(baseOptions())).toBe(100)
    expect(effectiveResizeScalePercent(baseOptions({ resizePercentPreset: 'p50' }))).toBe(50)
    expect(
      effectiveResizeScalePercent(
        baseOptions({ resizePercentPreset: 'custom', resizeCustomPercentStr: '150' }),
      ),
    ).toBe(150)
  })

  it('parseTrimPaddingForIpc', () => {
    expect(parseTrimPaddingForIpc('2')).toBe(2)
    expect(parseTrimPaddingForIpc('x')).toBe(2)
    expect(parseTrimPaddingForIpc('600')).toBe(512)
  })

  it('parseSliceGridDimension', () => {
    expect(parseSliceGridDimension('4', 1)).toBe(4)
    expect(parseSliceGridDimension('bad', 3)).toBe(3)
    expect(parseSliceGridDimension('100', 1)).toBe(64)
  })

  it('buildProcessImageInvokeOptions includes crop when enabled', () => {
    const o = buildProcessImageInvokeOptions(
      baseOptions({
        cropEnabled: true,
        cropNorm: { x: 0.1, y: 0.2, w: 0.5, h: 0.6 },
      }),
      undefined,
    )
    expect(o.crop).toEqual({ x: 0.1, y: 0.2, width: 0.5, height: 0.6 })
  })

  it('buildProcessImageInvokeOptions omits rotate/flip when rotateMirrorEnabled is false', () => {
    const o = buildProcessImageInvokeOptions(
      baseOptions({
        rotateMirrorEnabled: false,
        rotateQuarterTurns: 1,
        flipHorizontal: true,
        flipVertical: true,
      }),
      undefined,
    )
    expect(o).not.toHaveProperty('rotateQuarterTurns')
    expect(o).not.toHaveProperty('flipHorizontal')
    expect(o).not.toHaveProperty('flipVertical')
  })

  it('buildProcessImageInvokeOptions passes overwriteOriginal when enabled', () => {
    const o = buildProcessImageInvokeOptions(baseOptions({ overwriteOriginal: true }), undefined)
    expect(o.overwriteOriginal).toBe(true)
  })

  it('isOverwriteCompatibleWithSourcePath matches main-process extension rules', () => {
    expect(isOverwriteCompatibleWithSourcePath('/a/b.jpg', 'jpeg')).toBe(true)
    expect(isOverwriteCompatibleWithSourcePath('/a/b.jpg', 'png')).toBe(false)
    expect(isOverwriteCompatibleWithSourcePath('/a/b.jpeg', 'original')).toBe(true)
    expect(resolvedOutputExtensionForPath('/x/y.jpeg', 'original')).toBe('jpg')
    expect(isOverwriteCompatibleWithSourcePath('/a/b.png', 'original')).toBe(true)
    expect(isOverwriteCompatibleWithSourcePath('/a/b.png', 'webp')).toBe(false)
  })
})
