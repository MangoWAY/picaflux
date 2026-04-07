import { describe, it, expect } from 'vitest'
import {
  DEFAULT_IMAGE_PRESET_STORED,
  mergePresetIntoOptions,
  sanitizeImagePresetStored,
  toPresetPayload,
  type ImageProcessPresetStored,
} from '../src/lib/imagePreset'
import type { ProcessOptions } from '../src/components/SettingsPanel'

const fullOptions = (): ProcessOptions => ({
  format: 'webp',
  rotateQuarterTurns: 2,
  flipHorizontal: true,
  flipVertical: false,
  sliceEnabled: true,
  sliceRows: '3',
  sliceCols: '2',
  sliceXLines: [0.5],
  sliceYLines: [1 / 3, 2 / 3],
  resizeMode: 'pixels',
  resizePercentPreset: 'custom',
  resizeCustomPercentStr: '88',
  resizePixelsExpanded: true,
  width: '800',
  height: '600',
  keepAspectRatio: true,
  quality: 65,
  outputDir: '/tmp/out',
  removeBackground: true,
  clearFixedWatermark: true,
  watermarkLeftPct: '10',
  watermarkTopPct: '20',
  watermarkWidthPct: '30',
  watermarkHeightPct: '15',
  cropEnabled: true,
  cropNorm: { x: 0.1, y: 0.2, w: 0.5, h: 0.6 },
  trimTransparent: true,
  trimPaddingPx: '4',
})

describe('imagePreset', () => {
  it('toPresetPayload strips outputDir and crop fields', () => {
    const p = toPresetPayload(fullOptions())
    expect(p).not.toHaveProperty('outputDir')
    expect(p).not.toHaveProperty('cropEnabled')
    expect(p).not.toHaveProperty('cropNorm')
    expect(p.format).toBe('webp')
    expect(p.sliceXLines).toEqual([0.5])
  })

  it('mergePresetIntoOptions keeps outputDir and crop from current', () => {
    const preset: ImageProcessPresetStored = {
      ...DEFAULT_IMAGE_PRESET_STORED,
      format: 'jpeg',
      quality: 42,
    }
    const current = fullOptions()
    const merged = mergePresetIntoOptions(preset, current)
    expect(merged.format).toBe('jpeg')
    expect(merged.quality).toBe(42)
    expect(merged.outputDir).toBe('/tmp/out')
    expect(merged.cropEnabled).toBe(true)
    expect(merged.cropNorm).toEqual({ x: 0.1, y: 0.2, w: 0.5, h: 0.6 })
  })

  it('sanitizeImagePresetStored clamps invalid values', () => {
    const s = sanitizeImagePresetStored({
      format: 'nope',
      quality: 999,
      sliceXLines: [2],
      resizePercentPreset: 'bogus',
    })
    expect(s.format).toBe(DEFAULT_IMAGE_PRESET_STORED.format)
    expect(s.quality).toBe(100)
    expect(s.sliceXLines).toBeUndefined()
    expect(s.resizePercentPreset).toBe(DEFAULT_IMAGE_PRESET_STORED.resizePercentPreset)
  })
})
