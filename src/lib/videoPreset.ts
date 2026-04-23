import type {
  VideoFlipUi,
  VideoModeEnabledMap,
  VideoProcessFormState,
  VideoRotationUi,
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

const ROT: ReadonlySet<VideoRotationUi> = new Set(['0', '90', '180', '270'])
const FLIP: ReadonlySet<VideoFlipUi> = new Set(['none', 'horizontal', 'vertical', 'both'])

export const DEFAULT_VIDEO_PRESET_STORED: VideoProcessPresetStored = {
  mode: 'transcode',
  modeEnabled: createEmptyModeEnabled(),
  transcodePreset: 'web_mp4',
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
  videoTransformEnabled: true,
  videoRotation: '0',
  videoFlip: 'none',
  playbackSpeedStr: '1.5',
}

function pickStr(v: unknown, fallback: string): string {
  return typeof v === 'string' ? v : fallback
}

function pickMode(v: unknown): VideoWorkbenchMode {
  return typeof v === 'string' && MODES.has(v as VideoWorkbenchMode)
    ? (v as VideoWorkbenchMode)
    : DEFAULT_VIDEO_PRESET_STORED.mode
}

function pickTranscodePreset(v: unknown): VideoProcessFormState['transcodePreset'] {
  return typeof v === 'string' && TRANSCODE.has(v as VideoProcessFormState['transcodePreset'])
    ? (v as VideoProcessFormState['transcodePreset'])
    : DEFAULT_VIDEO_PRESET_STORED.transcodePreset
}

function pickRotation(v: unknown): VideoRotationUi {
  return typeof v === 'string' && ROT.has(v as VideoRotationUi)
    ? (v as VideoRotationUi)
    : DEFAULT_VIDEO_PRESET_STORED.videoRotation
}

function pickFlip(v: unknown): VideoFlipUi {
  return typeof v === 'string' && FLIP.has(v as VideoFlipUi)
    ? (v as VideoFlipUi)
    : DEFAULT_VIDEO_PRESET_STORED.videoFlip
}

function pickTransformEnabled(v: unknown): boolean {
  if (typeof v === 'boolean') return v
  if (v === 'false' || v === 0) return false
  return DEFAULT_VIDEO_PRESET_STORED.videoTransformEnabled
}

function pickModeEnabledMap(
  d: Record<string, unknown>,
  legacyMode: VideoWorkbenchMode,
): VideoModeEnabledMap {
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
    return out
  }
  if ('mode' in d && typeof d.mode === 'string' && MODES.has(d.mode as VideoWorkbenchMode)) {
    out[legacyMode] = true
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
  return {
    mode: legacyMode,
    modeEnabled: pickModeEnabledMap(d, legacyMode),
    transcodePreset: pickTranscodePreset(d.transcodePreset),
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
    videoTransformEnabled: pickTransformEnabled(d.videoTransformEnabled),
    videoRotation: pickRotation(d.videoRotation),
    videoFlip: pickFlip(d.videoFlip),
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
