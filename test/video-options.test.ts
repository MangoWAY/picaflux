import { describe, it, expect } from 'vitest'
import { sanitizeProcessVideoOptions } from '../electron/main/video-options'

describe('sanitizeProcessVideoOptions', () => {
  it('defaults invalid mode to transcode', () => {
    const o = sanitizeProcessVideoOptions({ mode: 'nope' })
    expect(o.mode).toBe('transcode')
    expect(o.videoCrf).toBe(23)
    expect(o.x264Preset).toBe('fast')
    expect(o.audioBitrateAac).toBe('128k')
  })

  it('parses videoCrf x264Preset and audioBitrateAac', () => {
    const o = sanitizeProcessVideoOptions({
      mode: 'transcode',
      transcodePreset: 'web_mp4',
      videoCrf: 26,
      x264Preset: 'slow',
      audioBitrateAac: '160k',
    })
    expect(o.videoCrf).toBe(26)
    expect(o.x264Preset).toBe('slow')
    expect(o.audioBitrateAac).toBe('160k')
  })

  it('clamps videoCrf and rejects bad audio bitrate', () => {
    const o = sanitizeProcessVideoOptions({
      mode: 'transcode',
      videoCrf: 99,
      audioBitrateAac: 'not-a-rate',
    })
    expect(o.videoCrf).toBe(40)
    expect(o.audioBitrateAac).toBe('128k')
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

  it('coerces string startSec and durationSec for gif', () => {
    const o = sanitizeProcessVideoOptions({
      mode: 'gif',
      startSec: '1.5',
      durationSec: '8',
      gifFps: '12',
    })
    expect(o.startSec).toBeCloseTo(1.5, 5)
    expect(o.durationSec).toBe(8)
    expect(o.gifFps).toBe(12)
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

  it('coerces speed to web_mp4, clears maxWidth, and clamps playbackSpeed', () => {
    const o = sanitizeProcessVideoOptions({
      mode: 'speed',
      transcodePreset: 'copy_streams',
      maxWidth: 720,
      playbackSpeed: 10,
    })
    expect(o.transcodePreset).toBe('web_mp4')
    expect(o.maxWidth).toBe(0)
    expect(o.playbackSpeed).toBe(8)
    const o2 = sanitizeProcessVideoOptions({ mode: 'speed', playbackSpeed: 0.05 })
    expect(o2.playbackSpeed).toBe(0.1)
    const o3 = sanitizeProcessVideoOptions({ mode: 'speed', playbackSpeed: '0,3' })
    expect(o3.playbackSpeed).toBeCloseTo(0.3, 5)
  })
})
