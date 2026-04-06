export type ProcessVideoMode =
  | 'transcode'
  | 'trim'
  | 'extract_frame'
  | 'audio_extract'
  | 'strip_audio'
  | 'gif'
  /** 动图 WebP：ffmpeg `libwebp`（需当前使用的 ffmpeg 已编译启用 libwebp） */
  | 'webp_anim'
  /** 按路径顺序合并多段（统一分辨率画布，需各段均有音轨） */
  | 'concat'

export type VideoFlipOption = 'none' | 'horizontal' | 'vertical' | 'both'

export type TranscodePreset = 'web_mp4' | 'copy_streams' | 'high_quality_mp4'

export type AudioExtractFormat = 'aac' | 'mp3' | 'wav'

export type FrameImageFormat = 'png' | 'jpeg'

export interface ProcessVideoOptions {
  mode: ProcessVideoMode
  /** transcode */
  transcodePreset?: TranscodePreset
  /** 最长边上限（像素），0 表示不缩放 */
  maxWidth?: number
  /** trim / extract_frame / gif / webp_anim */
  startSec?: number
  /** trim / gif / webp_anim：时长（秒） */
  durationSec?: number
  /** extract_frame：截取时刻（秒），默认 0 */
  timeSec?: number
  /** extract_frame：若 > 0，按间隔导出多帧，最多 maxFrameCount 张 */
  frameIntervalSec?: number
  maxFrameCount?: number
  frameFormat?: FrameImageFormat
  /** audio_extract */
  audioFormat?: AudioExtractFormat
  /** gif / webp_anim */
  gifFps?: number
  gifMaxWidth?: number
  /** webp_anim：质量 1–100，越高越清晰 */
  webpQuality?: number
  /** 顺时针旋转角度，仅允许 0 / 90 / 180 / 270 */
  videoRotationDeg?: number
  videoFlip?: VideoFlipOption
}

export interface SanitizedVideoOptions {
  mode: ProcessVideoMode
  transcodePreset: TranscodePreset
  maxWidth: number
  startSec: number
  durationSec: number
  timeSec: number
  frameIntervalSec: number
  maxFrameCount: number
  frameFormat: FrameImageFormat
  audioFormat: AudioExtractFormat
  gifFps: number
  gifMaxWidth: number
  webpQuality: number
  videoRotationDeg: 0 | 90 | 180 | 270
  videoFlip: VideoFlipOption
}

const MODES: ReadonlySet<ProcessVideoMode> = new Set([
  'transcode',
  'trim',
  'extract_frame',
  'audio_extract',
  'strip_audio',
  'gif',
  'webp_anim',
  'concat',
])

const FLIPS: ReadonlySet<VideoFlipOption> = new Set(['none', 'horizontal', 'vertical', 'both'])

const PSETS: ReadonlySet<TranscodePreset> = new Set(['web_mp4', 'copy_streams', 'high_quality_mp4'])
const AFORMATS: ReadonlySet<AudioExtractFormat> = new Set(['aac', 'mp3', 'wav'])
const FFMT: ReadonlySet<FrameImageFormat> = new Set(['png', 'jpeg'])

function num(v: unknown, fallback: number, min: number, max: number): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) return fallback
  return Math.min(max, Math.max(min, v))
}

export function sanitizeProcessVideoOptions(raw: unknown): SanitizedVideoOptions {
  const d: ProcessVideoOptions =
    raw && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw as ProcessVideoOptions)
      : { mode: 'transcode' }

  const mode: ProcessVideoMode = MODES.has(d.mode) ? d.mode : 'transcode'

  let transcodePreset: TranscodePreset = 'web_mp4'
  if (typeof d.transcodePreset === 'string' && PSETS.has(d.transcodePreset as TranscodePreset)) {
    transcodePreset = d.transcodePreset as TranscodePreset
  }

  const maxWidth = Math.round(num(d.maxWidth, 0, 0, 7680))
  const startSec = num(d.startSec, 0, 0, 86400 * 7)
  let durationSec = num(d.durationSec, 0, 0, 86400)
  const timeSec = num(d.timeSec, 0, 0, 86400 * 7)
  const frameIntervalSec = num(d.frameIntervalSec, 0, 0, 3600)
  let maxFrameCount = Math.round(num(d.maxFrameCount, 60, 1, 500))
  const frameFormat: FrameImageFormat =
    typeof d.frameFormat === 'string' && FFMT.has(d.frameFormat as FrameImageFormat)
      ? (d.frameFormat as FrameImageFormat)
      : 'png'

  const audioFormat: AudioExtractFormat =
    typeof d.audioFormat === 'string' && AFORMATS.has(d.audioFormat as AudioExtractFormat)
      ? (d.audioFormat as AudioExtractFormat)
      : 'aac'

  let gifFps = num(d.gifFps, 10, 1, 24)
  const gifMaxWidth = Math.round(num(d.gifMaxWidth, 480, 160, 1280))
  const webpQuality = Math.round(num(d.webpQuality, 75, 1, 100))

  let videoRotationDeg = 0 as 0 | 90 | 180 | 270
  const rotRaw = typeof d.videoRotationDeg === 'number' ? d.videoRotationDeg : 0
  if (rotRaw === 90 || rotRaw === 180 || rotRaw === 270) {
    videoRotationDeg = rotRaw
  }

  const videoFlip: VideoFlipOption =
    typeof d.videoFlip === 'string' && FLIPS.has(d.videoFlip as VideoFlipOption)
      ? (d.videoFlip as VideoFlipOption)
      : 'none'

  if (mode === 'trim' || mode === 'gif' || mode === 'webp_anim') {
    if (durationSec <= 0) durationSec = 60
  }
  if (mode === 'gif' || mode === 'webp_anim') {
    durationSec = Math.min(durationSec, 12)
    gifFps = Math.min(gifFps, 15)
  }
  if (mode === 'extract_frame') {
    if (frameIntervalSec > 0) {
      maxFrameCount = Math.round(num(d.maxFrameCount, 60, 1, 100))
    }
  }

  if (mode === 'concat' && transcodePreset === 'copy_streams') {
    transcodePreset = 'web_mp4'
  }

  return {
    mode,
    transcodePreset,
    maxWidth,
    startSec,
    durationSec,
    timeSec,
    frameIntervalSec,
    maxFrameCount,
    frameFormat,
    audioFormat,
    gifFps,
    gifMaxWidth,
    webpQuality,
    videoRotationDeg,
    videoFlip,
  }
}
