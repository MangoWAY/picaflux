export type VideoWorkbenchMode =
  | 'transcode'
  | 'trim'
  | 'extract_frame'
  | 'audio_extract'
  | 'strip_audio'
  | 'gif'

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

export function buildVideoProcessPayload(state: VideoProcessFormState): Record<string, unknown> {
  const maxWidth = parsePositiveInt(state.maxWidthStr, 0)
  const startSec = parsePositiveFloat(state.startSecStr, 0)
  const durationSec = parsePositiveFloat(state.durationSecStr, 60)
  const timeSec = parsePositiveFloat(state.timeSecStr, 0)
  const frameIntervalSec = parsePositiveFloat(state.frameIntervalStr, 0)
  const maxFrameCount = parsePositiveInt(state.maxFrameCountStr, 60)
  const gifFps = parsePositiveFloat(state.gifFpsStr, 10)
  const gifMaxWidth = parsePositiveInt(state.gifMaxWidthStr, 480)

  const base: Record<string, unknown> = { mode: state.mode }

  switch (state.mode) {
    case 'transcode':
      return {
        ...base,
        transcodePreset: state.transcodePreset,
        ...(maxWidth > 0 ? { maxWidth } : {}),
      }
    case 'trim':
      return {
        ...base,
        startSec,
        durationSec: durationSec > 0 ? durationSec : 60,
        ...(maxWidth > 0 ? { maxWidth } : {}),
      }
    case 'extract_frame':
      return {
        ...base,
        timeSec,
        frameFormat: state.frameFormat,
        ...(frameIntervalSec > 0
          ? { frameIntervalSec, maxFrameCount: maxFrameCount > 0 ? maxFrameCount : 60 }
          : {}),
      }
    case 'audio_extract':
      return { ...base, audioFormat: state.audioFormat }
    case 'strip_audio':
      return base
    case 'gif':
      return {
        ...base,
        startSec,
        durationSec: durationSec > 0 ? durationSec : 4,
        gifFps,
        gifMaxWidth: gifMaxWidth > 0 ? gifMaxWidth : 480,
      }
    default:
      return base
  }
}
