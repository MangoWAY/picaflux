import { describe, expect, it } from 'vitest'
import { createEmptyModeEnabled } from '../src/lib/videoFormPayload'
import { sanitizeVideoPresetStored, DEFAULT_VIDEO_PRESET_STORED } from '../src/lib/videoPreset'

describe('sanitizeVideoPresetStored', () => {
  it('fills defaults for empty input', () => {
    const s = sanitizeVideoPresetStored({})
    expect(s.mode).toBe(DEFAULT_VIDEO_PRESET_STORED.mode)
    expect(s.modeEnabled).toEqual(createEmptyModeEnabled())
    expect(s.transcodePreset).toBe(DEFAULT_VIDEO_PRESET_STORED.transcodePreset)
  })

  it('accepts valid mode', () => {
    const s = sanitizeVideoPresetStored({ mode: 'gif' })
    expect(s.mode).toBe('gif')
    expect(s.modeEnabled).toEqual({ ...createEmptyModeEnabled(), gif: true })
  })

  it('rejects invalid mode', () => {
    const s = sanitizeVideoPresetStored({ mode: 'nope' })
    expect(s.mode).toBe(DEFAULT_VIDEO_PRESET_STORED.mode)
  })

  it('maps legacy trim mode to default and clears trim flag', () => {
    const s = sanitizeVideoPresetStored({ mode: 'trim' })
    expect(s.mode).toBe(DEFAULT_VIDEO_PRESET_STORED.mode)
    expect(s.modeEnabled.trim).toBe(false)
  })

  it('clears trim in modeEnabled map', () => {
    const empty = createEmptyModeEnabled()
    const s = sanitizeVideoPresetStored({
      modeEnabled: { ...empty, transcode: true, trim: true },
    })
    expect(s.modeEnabled.trim).toBe(false)
    expect(s.modeEnabled.transcode).toBe(true)
  })
})
