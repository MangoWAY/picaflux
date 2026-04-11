import { describe, expect, it } from 'vitest'
import { sanitizeVideoPresetStored, DEFAULT_VIDEO_PRESET_STORED } from '../src/lib/videoPreset'

describe('sanitizeVideoPresetStored', () => {
  it('fills defaults for empty input', () => {
    const s = sanitizeVideoPresetStored({})
    expect(s.mode).toBe(DEFAULT_VIDEO_PRESET_STORED.mode)
    expect(s.transcodePreset).toBe(DEFAULT_VIDEO_PRESET_STORED.transcodePreset)
  })

  it('accepts valid mode', () => {
    const s = sanitizeVideoPresetStored({ mode: 'gif' })
    expect(s.mode).toBe('gif')
  })

  it('rejects invalid mode', () => {
    const s = sanitizeVideoPresetStored({ mode: 'nope' })
    expect(s.mode).toBe(DEFAULT_VIDEO_PRESET_STORED.mode)
  })
})
