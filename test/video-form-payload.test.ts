import { describe, it, expect } from 'vitest'
import {
  buildVideoProcessPayload,
  createEmptyModeEnabled,
  formatDurationSecStr,
  isClipShortenedVsDuration,
  shouldPrependImplicitTrim,
  type VideoProcessFormState,
} from '../src/lib/videoFormPayload'

const base: VideoProcessFormState = {
  mode: 'transcode',
  modeEnabled: createEmptyModeEnabled(),
  outputDir: '/tmp',
  transcodePreset: 'web_mp4',
  transcodeQualityTier: 'medium',
  transcodeCrfStr: '23',
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
  videoTransformEnabled: false,
  videoRotation: '0',
  videoFlip: 'none',
  playbackSpeedStr: '1',
}

describe('buildVideoProcessPayload', () => {
  it('builds transcode encode params without maxWidth', () => {
    expect(buildVideoProcessPayload({ ...base, mode: 'transcode', maxWidthStr: '720' })).toEqual({
      mode: 'transcode',
      transcodePreset: 'web_mp4',
      videoCrf: 23,
      x264Preset: 'fast',
      audioBitrateAac: '128k',
      videoRotationDeg: 0,
      videoFlip: 'none',
    })
    expect(buildVideoProcessPayload({ ...base, mode: 'transcode' })).not.toHaveProperty('maxWidth')
  })

  it('maps transcode quality tiers', () => {
    expect(buildVideoProcessPayload({ ...base, transcodeQualityTier: 'low' })).toMatchObject({
      videoCrf: 28,
      audioBitrateAac: '96k',
      x264Preset: 'fast',
    })
    expect(buildVideoProcessPayload({ ...base, transcodeQualityTier: 'high' })).toMatchObject({
      videoCrf: 20,
      audioBitrateAac: '192k',
      x264Preset: 'slow',
    })
    expect(
      buildVideoProcessPayload({
        ...base,
        transcodeQualityTier: 'custom',
        transcodeCrfStr: '26',
      }),
    ).toMatchObject({ videoCrf: 26, transcodePreset: 'web_mp4' })
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

  it('includes rotation and flip on transcode when transform enabled', () => {
    const p = buildVideoProcessPayload({
      ...base,
      mode: 'transcode',
      videoTransformEnabled: true,
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

  it('builds speed with playbackSpeed and fixed web_mp4 (no maxWidth)', () => {
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
    const p = buildVideoProcessPayload({
      ...base,
      mode: 'speed',
      playbackSpeedStr: '0,5',
      maxWidthStr: '720',
    })
    expect(p).toMatchObject({
      playbackSpeed: 0.5,
      transcodePreset: 'web_mp4',
      mode: 'speed',
    })
    expect(p).not.toHaveProperty('maxWidth')
  })

  it('builds concat with preset and transform', () => {
    const p = buildVideoProcessPayload({
      ...base,
      mode: 'concat',
      transcodePreset: 'high_quality_mp4',
      maxWidthStr: '960',
      videoTransformEnabled: true,
      videoRotation: '180',
    })
    expect(p).toMatchObject({
      mode: 'concat',
      transcodePreset: 'high_quality_mp4',
      maxWidth: 960,
      videoRotationDeg: 180,
    })
  })
})

describe('timeline clip helpers', () => {
  it('formats duration string like timeline', () => {
    expect(formatDurationSecStr(46.613)).toBe('46.613')
    expect(formatDurationSecStr(10)).toBe('10')
  })

  it('detects full-span vs shortened clip', () => {
    const full: VideoProcessFormState = {
      ...base,
      startSecStr: '0',
      durationSecStr: '46.613',
    }
    expect(isClipShortenedVsDuration(full, 46.613)).toBe(false)
    expect(isClipShortenedVsDuration({ ...full, startSecStr: '1' }, 46.613)).toBe(true)
    expect(isClipShortenedVsDuration({ ...full, durationSecStr: '10' }, 46.613)).toBe(true)
  })

  it('shouldPrependImplicitTrim skips when only gif', () => {
    expect(shouldPrependImplicitTrim({ ...base, durationSecStr: '5' }, 60, ['gif'])).toBe(false)
  })

  it('shouldPrependImplicitTrim when transcode needs clip', () => {
    expect(shouldPrependImplicitTrim({ ...base, durationSecStr: '5' }, 60, ['transcode'])).toBe(
      true,
    )
  })
})
