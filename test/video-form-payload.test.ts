import { describe, it, expect } from 'vitest'
import {
  buildVideoProcessPayload,
  createEmptyModeEnabled,
  type VideoProcessFormState,
} from '../src/lib/videoFormPayload'

const base: VideoProcessFormState = {
  mode: 'transcode',
  modeEnabled: createEmptyModeEnabled(),
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
  videoTransformEnabled: true,
  videoRotation: '0',
  videoFlip: 'none',
  playbackSpeedStr: '1',
}

describe('buildVideoProcessPayload', () => {
  it('builds transcode with optional maxWidth', () => {
    expect(buildVideoProcessPayload({ ...base, mode: 'transcode', maxWidthStr: '0' })).toEqual({
      mode: 'transcode',
      transcodePreset: 'web_mp4',
      videoRotationDeg: 0,
      videoFlip: 'none',
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

  it('includes rotation and flip on transcode', () => {
    const p = buildVideoProcessPayload({
      ...base,
      mode: 'transcode',
      videoRotation: '90',
      videoFlip: 'horizontal',
    })
    expect(p).toMatchObject({
      videoRotationDeg: 90,
      videoFlip: 'horizontal',
    })
  })

  it('omits rotation and flip when videoTransformEnabled is false', () => {
    const p = buildVideoProcessPayload({
      ...base,
      mode: 'transcode',
      videoTransformEnabled: false,
      videoRotation: '90',
      videoFlip: 'horizontal',
    })
    expect(p).toMatchObject({
      videoRotationDeg: 0,
      videoFlip: 'none',
    })
  })

  it('builds speed with playbackSpeed and optional maxWidth', () => {
    expect(
      buildVideoProcessPayload({
        ...base,
        mode: 'speed',
        playbackSpeedStr: '2',
        maxWidthStr: '0',
      }),
    ).toMatchObject({
      mode: 'speed',
      playbackSpeed: 2,
      transcodePreset: 'web_mp4',
    })
    expect(
      buildVideoProcessPayload({
        ...base,
        mode: 'speed',
        playbackSpeedStr: '0,5',
        maxWidthStr: '720',
      }),
    ).toMatchObject({
      playbackSpeed: 0.5,
      maxWidth: 720,
    })
  })

  it('builds concat with preset and transform', () => {
    const p = buildVideoProcessPayload({
      ...base,
      mode: 'concat',
      transcodePreset: 'high_quality_mp4',
      maxWidthStr: '960',
      videoRotation: '180',
    })
    expect(p).toMatchObject({
      mode: 'concat',
      transcodePreset: 'high_quality_mp4',
      maxWidth: 960,
      videoRotationDeg: 180,
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
