export type VideoWorkbenchMode =
  | 'transcode'
  | 'trim'
  | 'extract_frame'
  | 'audio_extract'
  | 'strip_audio'
  | 'gif'
  | 'webp_anim'
  | 'concat'
  | 'speed'

export type VideoRotationUi = '0' | '90' | '180' | '270'

export type VideoFlipUi = 'none' | 'horizontal' | 'vertical' | 'both'

export interface VideoProcessFormState {
  mode: VideoWorkbenchMode
  outputDir: string
  transcodePreset: 'web_mp4' | 'copy_streams' | 'high_quality_mp4'
  maxWidthStr: string
  startSecStr: string
  durationSecStr: string
  timeSecStr: string
  frameIntervalStr: string
  maxFrameCountStr: string
  frameFormat: 'png' | 'jpeg'
  audioFormat: 'aac' | 'mp3' | 'wav'
  gifFpsStr: string
  gifMaxWidthStr: string
  /** 动图 WebP 质量 1–100 */
  webpQualityStr: string
  /** 顺时针旋转 */
  videoRotation: VideoRotationUi
  videoFlip: VideoFlipUi
  /** 变速倍率（>1 快放，<1 慢放），主进程会限制在 0.25–4 */
  playbackSpeedStr: string
}

function parsePositiveFloat(s: string, fallback: number): number {
  const n = parseFloat(String(s).replace(',', '.'))
  if (!Number.isFinite(n) || n < 0) return fallback
  return n
}

function parsePositiveInt(s: string, fallback: number): number {
  const n = parseInt(s, 10)
  if (!Number.isFinite(n) || n < 0) return fallback
  return n
}

function parsePlaybackSpeed(s: string, fallback: number): number {
  const n = parseFloat(String(s).replace(',', '.'))
  if (!Number.isFinite(n) || n <= 0) return fallback
  return n
}

function videoTransformPayload(state: VideoProcessFormState): {
  videoRotationDeg: number
  videoFlip: VideoFlipUi
} {
  const deg = parseInt(state.videoRotation, 10)
  return {
    videoRotationDeg: deg === 90 || deg === 180 || deg === 270 ? deg : 0,
    videoFlip: state.videoFlip,
  }
}

export function buildVideoProcessPayload(state: VideoProcessFormState): Record<string, unknown> {
  const maxWidth = parsePositiveInt(state.maxWidthStr, 0)
  const startSec = parsePositiveFloat(state.startSecStr, 0)
  const durationSec = parsePositiveFloat(state.durationSecStr, 60)
  const timeSec = parsePositiveFloat(state.timeSecStr, 0)
  const frameIntervalSec = parsePositiveFloat(state.frameIntervalStr, 0)
  const maxFrameCount = parsePositiveInt(state.maxFrameCountStr, 60)
  const gifFps = parsePositiveFloat(state.gifFpsStr, 10)
  const gifMaxWidth = parsePositiveInt(state.gifMaxWidthStr, 480)
  const webpQuality = parsePositiveInt(state.webpQualityStr, 75)
  const playbackSpeed = parsePlaybackSpeed(state.playbackSpeedStr, 1)
  const tx = videoTransformPayload(state)

  const base: Record<string, unknown> = { mode: state.mode }

  switch (state.mode) {
    case 'transcode':
      return {
        ...base,
        transcodePreset: state.transcodePreset,
        ...(maxWidth > 0 ? { maxWidth } : {}),
        ...tx,
      }
    case 'trim':
      return {
        ...base,
        startSec,
        durationSec: durationSec > 0 ? durationSec : 60,
        ...(maxWidth > 0 ? { maxWidth } : {}),
        ...tx,
      }
    case 'extract_frame':
      return {
        ...base,
        timeSec,
        frameFormat: state.frameFormat,
        ...(frameIntervalSec > 0
          ? { frameIntervalSec, maxFrameCount: maxFrameCount > 0 ? maxFrameCount : 60 }
          : {}),
        ...tx,
      }
    case 'audio_extract':
      return { ...base, audioFormat: state.audioFormat }
    case 'strip_audio':
      return { ...base, ...tx }
    case 'gif':
      return {
        ...base,
        startSec,
        durationSec: durationSec > 0 ? durationSec : 4,
        gifFps,
        gifMaxWidth: gifMaxWidth > 0 ? gifMaxWidth : 480,
        ...tx,
      }
    case 'webp_anim':
      return {
        ...base,
        startSec,
        durationSec: durationSec > 0 ? durationSec : 4,
        gifFps,
        gifMaxWidth: gifMaxWidth > 0 ? gifMaxWidth : 480,
        webpQuality: webpQuality > 0 ? webpQuality : 75,
        ...tx,
      }
    case 'concat':
      return {
        ...base,
        transcodePreset: state.transcodePreset,
        ...(maxWidth > 0 ? { maxWidth } : {}),
        ...tx,
      }
    case 'speed':
      return {
        ...base,
        transcodePreset: state.transcodePreset,
        playbackSpeed,
        ...(maxWidth > 0 ? { maxWidth } : {}),
        ...tx,
      }
    default:
      return base
  }
}
