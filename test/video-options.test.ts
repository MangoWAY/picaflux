import { describe, it, expect } from 'vitest'
import { sanitizeProcessVideoOptions } from '../electron/main/video-options'

describe('sanitizeProcessVideoOptions', () => {
  it('defaults invalid mode to transcode', () => {
    const o = sanitizeProcessVideoOptions({ mode: 'nope' })
    expect(o.mode).toBe('transcode')
  })

  it('clamps gif duration and fps', () => {
    const o = sanitizeProcessVideoOptions({
      mode: 'gif',
      durationSec: 999,
      gifFps: 30,
    })
    expect(o.durationSec).toBeLessThanOrEqual(12)
    expect(o.gifFps).toBeLessThanOrEqual(15)
  })

  it('preserves extract_frame interval and max count', () => {
    const o = sanitizeProcessVideoOptions({
      mode: 'extract_frame',
      frameIntervalSec: 2,
      maxFrameCount: 5,
      timeSec: 1,
    })
    expect(o.frameIntervalSec).toBe(2)
    expect(o.maxFrameCount).toBe(5)
    expect(o.timeSec).toBe(1)
  })

  it('defaults trim duration when missing', () => {
    const o = sanitizeProcessVideoOptions({ mode: 'trim', durationSec: 0 })
    expect(o.durationSec).toBe(60)
  })
})
