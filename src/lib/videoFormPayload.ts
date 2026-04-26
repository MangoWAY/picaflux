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

/** 压缩质量：低 / 中 / 高 / 自定义 CRF */
export type TranscodeQualityTier = 'low' | 'medium' | 'high' | 'custom'

/** 各档位对应 libx264 CRF（数值越大体积越小） */
export const TRANSCODE_TIER_CRF: Record<Exclude<TranscodeQualityTier, 'custom'>, number> = {
  low: 28,
  medium: 23,
  high: 20,
}

/** 各处理模式独立开关（可多项同时开启）；默认全关 */
export type VideoModeEnabledMap = Record<VideoWorkbenchMode, boolean>

export interface VideoProcessFormState {
  /** 兼容旧预设与载荷；执行时以 modeEnabled + build 时传入的 mode 为准 */
  mode: VideoWorkbenchMode
  modeEnabled: VideoModeEnabledMap
  outputDir: string
  transcodePreset: 'web_mp4' | 'copy_streams' | 'high_quality_mp4'
  /** 压缩质量档位；合并仍使用 transcodePreset */
  transcodeQualityTier: TranscodeQualityTier
  /** 自定义档位时的 libx264 CRF（整数，约 18–32） */
  transcodeCrfStr: string
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
  /** 是否对输出应用旋转/翻转（关闭时载荷中不携带变换） */
  videoTransformEnabled: boolean
  /** 顺时针旋转 */
  videoRotation: VideoRotationUi
  videoFlip: VideoFlipUi
  /** 变速倍率（>1 快放，<1 慢放），主进程限制在 0.1–8 */
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
  return Math.min(8, Math.max(0.1, n))
}

/** libx264 CRF：常用 18–32，此处夹紧到 16–40 以防异常输入 */
export function parseTranscodeCrf(s: string, fallback: number): number {
  const n = Number.parseFloat(String(s).trim().replace(',', '.'))
  if (!Number.isFinite(n)) return fallback
  const r = Math.round(n)
  return Math.min(40, Math.max(16, r))
}

export function createEmptyModeEnabled(): VideoModeEnabledMap {
  return {
    transcode: false,
    trim: false,
    extract_frame: false,
    audio_extract: false,
    strip_audio: false,
    gif: false,
    webp_anim: false,
    concat: false,
    speed: false,
  }
}

/** 批量执行时的顺序（合并放最后）；截帧改为预览区按钮，不在此队列 */
export const VIDEO_PROCESSING_ORDER: readonly VideoWorkbenchMode[] = [
  'transcode',
  'speed',
  'trim',
  'gif',
  'audio_extract',
  'strip_audio',
  'concat',
] as const

export function listEnabledModesInOrder(modeEnabled: VideoModeEnabledMap): VideoWorkbenchMode[] {
  return VIDEO_PROCESSING_ORDER.filter((m) => modeEnabled[m])
}

/** 与预览时间轴 `formatSec` 一致，用于整段时长写入表单 */
export function formatDurationSecStr(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '0'
  const s = sec.toFixed(3).replace(/\.?0+$/, '')
  return s === '-0' ? '0' : s
}

const CLIP_EPS = 0.06

/** 起点/终点是否未贴满整段（视为用户已做时间轴裁剪） */
export function isClipShortenedVsDuration(
  state: VideoProcessFormState,
  fullDurationSec: number | undefined,
): boolean {
  if (fullDurationSec == null || !Number.isFinite(fullDurationSec) || fullDurationSec <= CLIP_EPS) {
    return false
  }
  const start = parsePositiveFloat(state.startSecStr, 0)
  const durParsed = parsePositiveFloat(state.durationSecStr, fullDurationSec)
  const dur = durParsed > 0 ? durParsed : fullDurationSec
  const end = start + dur
  return start > CLIP_EPS || end < fullDurationSec - CLIP_EPS
}

const MODES_WITH_BUILTIN_TIMELINE_CLIP: ReadonlySet<VideoWorkbenchMode> = new Set(['gif'])

/**
 * 时间轴已缩短时，是否要在队列前插入独立 trim。
 * gif 已在 ffmpeg 中按起止截取，无需前置 trim。
 */
export function shouldPrependImplicitTrim(
  state: VideoProcessFormState,
  fullDurationSec: number | undefined,
  modes: readonly VideoWorkbenchMode[],
): boolean {
  if (!isClipShortenedVsDuration(state, fullDurationSec)) return false
  const relevant = modes.filter((m) => m !== 'trim' && m !== 'concat')
  if (relevant.length === 0) return false
  return relevant.some((m) => !MODES_WITH_BUILTIN_TIMELINE_CLIP.has(m))
}

export function hasAnyModeEnabled(modeEnabled: VideoModeEnabledMap): boolean {
  return VIDEO_PROCESSING_ORDER.some((m) => modeEnabled[m])
}

function videoTransformPayload(state: VideoProcessFormState): {
  videoRotationDeg: number
  videoFlip: VideoFlipUi
} {
  if (state.videoTransformEnabled === false) {
    return { videoRotationDeg: 0, videoFlip: 'none' }
  }
  const deg = parseInt(state.videoRotation, 10)
  return {
    videoRotationDeg: deg === 90 || deg === 180 || deg === 270 ? deg : 0,
    videoFlip: state.videoFlip,
  }
}

export function buildVideoProcessPayload(
  state: VideoProcessFormState,
  /** 指定本次 IPC 使用的模式（与 modeEnabled 独立） */
  modeForPayload: VideoWorkbenchMode = state.mode,
): Record<string, unknown> {
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

  const base: Record<string, unknown> = { mode: modeForPayload }

  switch (modeForPayload) {
    case 'transcode': {
      const tier = state.transcodeQualityTier
      const crfCustom = parseTranscodeCrf(state.transcodeCrfStr, TRANSCODE_TIER_CRF.medium)
      const enc =
        tier === 'low'
          ? {
              transcodePreset: 'web_mp4' as const,
              videoCrf: TRANSCODE_TIER_CRF.low,
              x264Preset: 'fast' as const,
              audioBitrateAac: '96k' as const,
            }
          : tier === 'high'
            ? {
                transcodePreset: 'web_mp4' as const,
                videoCrf: TRANSCODE_TIER_CRF.high,
                x264Preset: 'slow' as const,
                audioBitrateAac: '192k' as const,
              }
            : tier === 'custom'
              ? {
                  transcodePreset: 'web_mp4' as const,
                  videoCrf: crfCustom,
                  x264Preset: 'fast' as const,
                  audioBitrateAac: '128k' as const,
                }
              : {
                  transcodePreset: 'web_mp4' as const,
                  videoCrf: TRANSCODE_TIER_CRF.medium,
                  x264Preset: 'fast' as const,
                  audioBitrateAac: '128k' as const,
                }
      return {
        ...base,
        ...enc,
        ...tx,
      }
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
        transcodePreset: 'web_mp4',
        playbackSpeed,
        ...tx,
      }
    default:
      return base
  }
}
