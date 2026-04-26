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
  /** 变速：>1 快放，<1 慢放（重编码；无声视频仅处理画面） */
  | 'speed'

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
  /** 播放倍速，如 2=两倍速，0.5=半速；变速模式会限制在 0.1–8 */
  playbackSpeed?: number
  /** libx264 CRF（重编码时）；流拷贝忽略 */
  videoCrf?: number
  /** x264 -preset，如 fast、slow */
  x264Preset?: string
  /** AAC 音频码率，如 128k */
  audioBitrateAac?: string
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
  playbackSpeed: number
  videoCrf: number
  x264Preset: string
  audioBitrateAac: string
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
  'speed',
])

const FLIPS: ReadonlySet<VideoFlipOption> = new Set(['none', 'horizontal', 'vertical', 'both'])

const PSETS: ReadonlySet<TranscodePreset> = new Set(['web_mp4', 'copy_streams', 'high_quality_mp4'])

const X264_PRESETS = new Set([
  'ultrafast',
  'superfast',
  'veryfast',
  'faster',
  'fast',
  'medium',
  'slow',
  'slower',
  'veryslow',
])
const AFORMATS: ReadonlySet<AudioExtractFormat> = new Set(['aac', 'mp3', 'wav'])
const FFMT: ReadonlySet<FrameImageFormat> = new Set(['png', 'jpeg'])

function num(v: unknown, fallback: number, min: number, max: number): number {
  let n: number
  if (typeof v === 'number' && Number.isFinite(v)) {
    n = v
  } else if (typeof v === 'string') {
    const p = parseFloat(String(v).trim().replace(',', '.'))
    n = Number.isFinite(p) ? p : NaN
  } else {
    return fallback
  }
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, n))
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

  let maxWidth = Math.round(num(d.maxWidth, 0, 0, 7680))
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
  if (mode === 'speed') {
    transcodePreset = 'web_mp4'
    maxWidth = 0
  }

  const playbackRaw =
    typeof d.playbackSpeed === 'number' && Number.isFinite(d.playbackSpeed)
      ? d.playbackSpeed
      : typeof d.playbackSpeed === 'string'
        ? parseFloat(String(d.playbackSpeed).replace(',', '.'))
        : NaN
  const playbackSpeed = Number.isFinite(playbackRaw) ? Math.min(8, Math.max(0.1, playbackRaw)) : 1

  const crfNum = (() => {
    const v = d.videoCrf
    if (typeof v === 'number' && Number.isFinite(v)) return Math.round(v)
    if (typeof v === 'string') {
      const n = parseFloat(String(v).trim().replace(',', '.'))
      return Number.isFinite(n) ? Math.round(n) : NaN
    }
    return NaN
  })()
  let videoCrf = Number.isFinite(crfNum) ? crfNum : 23
  videoCrf = Math.min(40, Math.max(16, videoCrf))

  const presetRaw = typeof d.x264Preset === 'string' ? d.x264Preset.trim() : ''
  let x264Preset = X264_PRESETS.has(presetRaw) ? presetRaw : 'fast'

  const abRaw = typeof d.audioBitrateAac === 'string' ? d.audioBitrateAac.trim().toLowerCase() : ''
  let audioBitrateAac = /^[1-9]\d*k$/.test(abRaw) ? abRaw : '128k'

  if (transcodePreset === 'high_quality_mp4') {
    transcodePreset = 'web_mp4'
    videoCrf = 20
    x264Preset = 'slow'
    audioBitrateAac = '192k'
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
    playbackSpeed,
    videoCrf,
    x264Preset,
    audioBitrateAac,
  }
}
