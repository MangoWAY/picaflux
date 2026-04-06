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

  it('clamps webp_anim like gif and quality', () => {
    const o = sanitizeProcessVideoOptions({
      mode: 'webp_anim',
      durationSec: 999,
      gifFps: 30,
      webpQuality: 200,
    })
    expect(o.durationSec).toBeLessThanOrEqual(12)
    expect(o.gifFps).toBeLessThanOrEqual(15)
    expect(o.webpQuality).toBeLessThanOrEqual(100)
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

  it('coerces concat copy_streams to web_mp4', () => {
    const o = sanitizeProcessVideoOptions({ mode: 'concat', transcodePreset: 'copy_streams' })
    expect(o.mode).toBe('concat')
    expect(o.transcodePreset).toBe('web_mp4')
  })

  it('coerces speed copy_streams to web_mp4 and clamps playbackSpeed', () => {
    const o = sanitizeProcessVideoOptions({
      mode: 'speed',
      transcodePreset: 'copy_streams',
      playbackSpeed: 10,
    })
    expect(o.transcodePreset).toBe('web_mp4')
    expect(o.playbackSpeed).toBe(4)
    const o2 = sanitizeProcessVideoOptions({ mode: 'speed', playbackSpeed: 0.05 })
    expect(o2.playbackSpeed).toBe(0.25)
    const o3 = sanitizeProcessVideoOptions({ mode: 'speed', playbackSpeed: '0,3' })
    expect(o3.playbackSpeed).toBeCloseTo(0.3, 5)
  })
})
