import { describe, it, expect } from 'vitest'
import { buildVideoProcessPayload, type VideoProcessFormState } from '../src/lib/videoFormPayload'

const base: VideoProcessFormState = {
  mode: 'transcode',
  outputDir: '/tmp',
  transcodePreset: 'web_mp4',
  maxWidthStr: '0',
  startSecStr: '0',
  durationSecStr: '10',
  timeSecStr: '0',
  frameIntervalStr: '0',
  maxFrameCountStr: '30',
  frameFormat: 'png',
  audioFormat: 'aac',
  gifFpsStr: '10',
  gifMaxWidthStr: '480',
  webpQualityStr: '75',
}

describe('buildVideoProcessPayload', () => {
  it('builds transcode with optional maxWidth', () => {
    expect(buildVideoProcessPayload({ ...base, mode: 'transcode', maxWidthStr: '0' })).toEqual({
      mode: 'transcode',
      transcodePreset: 'web_mp4',
    })
    expect(
      buildVideoProcessPayload({ ...base, mode: 'transcode', maxWidthStr: '720' }),
    ).toMatchObject({
      maxWidth: 720,
    })
  })

  it('builds extract_frame with interval', () => {
    const p = buildVideoProcessPayload({
      ...base,
      mode: 'extract_frame',
      timeSecStr: '1.5',
      frameIntervalStr: '2',
      maxFrameCountStr: '5',
    })
    expect(p).toMatchObject({
      mode: 'extract_frame',
      timeSec: 1.5,
      frameIntervalSec: 2,
      maxFrameCount: 5,
    })
  })

  it('builds webp_anim with quality', () => {
    const p = buildVideoProcessPayload({
      ...base,
      mode: 'webp_anim',
      startSecStr: '1',
      durationSecStr: '3',
      webpQualityStr: '80',
    })
    expect(p).toMatchObject({
      mode: 'webp_anim',
      startSec: 1,
      durationSec: 3,
      webpQuality: 80,
    })
  })
})
