import type {
  TranscodeQualityTier,
  VideoModeEnabledMap,
  VideoProcessFormState,
  VideoWorkbenchMode,
} from './videoFormPayload'
import { createEmptyModeEnabled } from './videoFormPayload'

/** 写入磁盘的预设体：不含输出目录 */
export type VideoProcessPresetStored = Omit<VideoProcessFormState, 'outputDir'>

export interface VideoProcessPresetRecord {
  id: string
  name: string
  updatedAt: number
  options: VideoProcessPresetStored
}

const MODES: ReadonlySet<VideoWorkbenchMode> = new Set([
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

const TRANSCODE: ReadonlySet<VideoProcessFormState['transcodePreset']> = new Set([
  'web_mp4',
  'copy_streams',
  'high_quality_mp4',
])

export const DEFAULT_VIDEO_PRESET_STORED: VideoProcessPresetStored = {
  mode: 'transcode',
  modeEnabled: createEmptyModeEnabled(),
  transcodePreset: 'web_mp4',
  transcodeQualityTier: 'medium',
  transcodeCrfStr: '23',
  maxWidthStr: '1280',
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

function pickStr(v: unknown, fallback: string): string {
  return typeof v === 'string' ? v : fallback
}

function pickMode(v: unknown): VideoWorkbenchMode {
  if (typeof v !== 'string' || !MODES.has(v as VideoWorkbenchMode)) {
    return DEFAULT_VIDEO_PRESET_STORED.mode
  }
  const m = v as VideoWorkbenchMode
  /** 裁剪已并入预览时间轴，旧预设中的独立 trim 模式映射为默认 */
  if (m === 'trim') return DEFAULT_VIDEO_PRESET_STORED.mode
  return m
}

function pickTranscodePreset(v: unknown): VideoProcessFormState['transcodePreset'] {
  return typeof v === 'string' && TRANSCODE.has(v as VideoProcessFormState['transcodePreset'])
    ? (v as VideoProcessFormState['transcodePreset'])
    : DEFAULT_VIDEO_PRESET_STORED.transcodePreset
}

function isTranscodeQualityTier(v: unknown): v is TranscodeQualityTier {
  return v === 'low' || v === 'medium' || v === 'high' || v === 'custom'
}

function pickTranscodeQualityTier(
  rawTier: unknown,
  legacyTranscodePreset: VideoProcessFormState['transcodePreset'],
): TranscodeQualityTier {
  if (rawTier === 'remux') return 'medium'
  if (isTranscodeQualityTier(rawTier)) return rawTier
  if (legacyTranscodePreset === 'copy_streams') return 'medium'
  if (legacyTranscodePreset === 'high_quality_mp4') return 'high'
  return DEFAULT_VIDEO_PRESET_STORED.transcodeQualityTier
}

function pickModeEnabledMap(d: Record<string, unknown>): VideoModeEnabledMap {
  const out = createEmptyModeEnabled()
  if (
    'modeEnabled' in d &&
    d.modeEnabled &&
    typeof d.modeEnabled === 'object' &&
    !Array.isArray(d.modeEnabled)
  ) {
    const o = d.modeEnabled as Record<string, unknown>
    for (const m of MODES) {
      if (o[m] === true) {
        out[m] = true
      } else if (o[m] === false) {
        out[m] = false
      }
    }
    out.extract_frame = false
    out.trim = false
    out.webp_anim = false
    return out
  }
  if ('mode' in d && typeof d.mode === 'string' && MODES.has(d.mode as VideoWorkbenchMode)) {
    const lm = d.mode as VideoWorkbenchMode
    if (lm !== 'extract_frame' && lm !== 'trim') {
      out[lm] = true
    }
    out.trim = false
    out.webp_anim = false
    return out
  }
  return out
}

function pickFrameFormat(v: unknown): 'png' | 'jpeg' {
  return v === 'jpeg' ? 'jpeg' : 'png'
}

function pickAudioFormat(v: unknown): 'aac' | 'mp3' | 'wav' {
  if (v === 'mp3' || v === 'wav' || v === 'aac') return v
  return DEFAULT_VIDEO_PRESET_STORED.audioFormat
}

/**
 * 将 IPC / 磁盘读出的对象规整为可合并进表单的预设（缺字段用默认值）
 */
export function sanitizeVideoPresetStored(raw: unknown): VideoProcessPresetStored {
  const d =
    raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {}
  const base = DEFAULT_VIDEO_PRESET_STORED

  const legacyMode = pickMode(d.mode)
  const transcodePreset = pickTranscodePreset(d.transcodePreset)
  return {
    mode: legacyMode,
    modeEnabled: pickModeEnabledMap(d),
    transcodePreset,
    transcodeQualityTier: pickTranscodeQualityTier(d.transcodeQualityTier, transcodePreset),
    transcodeCrfStr: pickStr(d.transcodeCrfStr, base.transcodeCrfStr),
    maxWidthStr: pickStr(d.maxWidthStr, base.maxWidthStr),
    startSecStr: pickStr(d.startSecStr, base.startSecStr),
    durationSecStr: pickStr(d.durationSecStr, base.durationSecStr),
    timeSecStr: pickStr(d.timeSecStr, base.timeSecStr),
    frameIntervalStr: pickStr(d.frameIntervalStr, base.frameIntervalStr),
    maxFrameCountStr: pickStr(d.maxFrameCountStr, base.maxFrameCountStr),
    frameFormat: pickFrameFormat(d.frameFormat),
    audioFormat: pickAudioFormat(d.audioFormat),
    gifFpsStr: pickStr(d.gifFpsStr, base.gifFpsStr),
    gifMaxWidthStr: pickStr(d.gifMaxWidthStr, base.gifMaxWidthStr),
    webpQualityStr: pickStr(d.webpQualityStr, base.webpQualityStr),
    /** 画面旋转/翻转已自界面移除，读入预设时一律关闭 */
    videoTransformEnabled: false,
    videoRotation: '0',
    videoFlip: 'none',
    playbackSpeedStr: pickStr(d.playbackSpeedStr, base.playbackSpeedStr),
  }
}

export function toVideoPresetPayload(form: VideoProcessFormState): VideoProcessPresetStored {
  const { outputDir: _o, ...rest } = form
  return sanitizeVideoPresetStored(rest)
}

export function mergeVideoPresetIntoForm(
  preset: VideoProcessPresetStored,
  current: VideoProcessFormState,
): VideoProcessFormState {
  const s = sanitizeVideoPresetStored(preset)
  return {
    ...s,
    outputDir: current.outputDir,
  }
}
