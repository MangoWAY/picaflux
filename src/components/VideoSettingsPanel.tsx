import React, { useEffect, useState } from 'react'
import clsx from 'clsx'
import type { LucideIcon } from 'lucide-react'
import {
  BookmarkPlus,
  Clapperboard,
  Film,
  FolderOpen,
  Image,
  Gauge,
  Layers2,
  ListVideo,
  Music,
  Play,
  Scissors,
  Sparkles,
  Square,
  Trash2,
  VolumeX,
} from 'lucide-react'
import {
  hasAnyModeEnabled,
  TRANSCODE_TIER_CRF,
  VIDEO_PROCESSING_ORDER,
  type VideoModeEnabledMap,
  type VideoProcessFormState,
  type VideoWorkbenchMode,
} from '@/lib/videoFormPayload'
import type { VideoProcessPresetRecord } from '@/lib/videoPreset'
import { PanelToggle } from './PanelToggle'

/** 侧栏处理项（无分组标题）；执行顺序见 `VIDEO_PROCESSING_ORDER` */
const VIDEO_MODE_ROWS: { id: VideoWorkbenchMode; label: string }[] = [
  { id: 'transcode', label: '压缩' },
  { id: 'speed', label: '变速' },
  { id: 'audio_extract', label: '抽取音频' },
  { id: 'strip_audio', label: '去除音轨' },
  { id: 'concat', label: '合并片段' },
  { id: 'gif', label: '导出 GIF' },
]

/** 与图片侧栏一致：功能标题前小图标 */
const MODE_ROW_ICONS: Record<VideoWorkbenchMode, LucideIcon> = {
  transcode: Film,
  speed: Gauge,
  trim: Scissors,
  extract_frame: Image,
  gif: Sparkles,
  webp_anim: Layers2,
  audio_extract: Music,
  strip_audio: VolumeX,
  concat: ListVideo,
}

const FIELD =
  'w-full rounded-md border border-[#3d3d3d] bg-[#121212] px-2 py-1.5 text-xs text-white focus:border-blue-500 focus:outline-none disabled:opacity-50'
const LABEL = 'mb-1 block text-[11px] font-medium text-gray-400'

function pickPrimaryModeField(
  modeEnabled: VideoModeEnabledMap,
  previous: VideoWorkbenchMode,
): VideoWorkbenchMode {
  if (modeEnabled[previous]) return previous
  const next = VIDEO_PROCESSING_ORDER.find((m) => modeEnabled[m])
  return next ?? 'transcode'
}

interface VideoSettingsPanelProps {
  state: VideoProcessFormState
  onChange: (s: VideoProcessFormState) => void
  onSelectOutputDir: () => void
  onStartProcessing: () => void
  onCancelProcessing: () => void
  isProcessing: boolean
  selectedForProcessCount: number
  totalVideoCount: number
  progressPercent: number | null
  /** 多文件顺序处理时的当前序号；仅当 total 大于 1 时在界面展示 */
  batchProgress: { current: number; total: number } | null
  videoPresets: VideoProcessPresetRecord[]
  onApplyVideoPreset: (id: string) => void
  onSaveVideoPreset: (name: string) => Promise<{ success: boolean; error?: string }>
  onDeleteVideoPreset: (id: string) => Promise<{ success: boolean; error?: string }>
}

export function VideoSettingsPanel({
  state,
  onChange,
  onSelectOutputDir,
  onStartProcessing,
  onCancelProcessing,
  isProcessing,
  selectedForProcessCount,
  totalVideoCount,
  progressPercent,
  batchProgress,
  videoPresets,
  onApplyVideoPreset,
  onSaveVideoPreset,
  onDeleteVideoPreset,
}: VideoSettingsPanelProps) {
  const [selectedPresetId, setSelectedPresetId] = useState('')
  const [newPresetName, setNewPresetName] = useState('')
  const [presetMessage, setPresetMessage] = useState<string | null>(null)
  const [presetSectionEnabled, setPresetSectionEnabled] = useState(false)

  useEffect(() => {
    if (selectedPresetId && !videoPresets.some((p) => p.id === selectedPresetId)) {
      setSelectedPresetId('')
    }
  }, [videoPresets, selectedPresetId])

  const update = <K extends keyof VideoProcessFormState>(
    key: K,
    value: VideoProcessFormState[K],
  ) => {
    onChange({ ...state, [key]: value })
  }

  const setModeToggle = (mode: VideoWorkbenchMode, checked: boolean) => {
    if (isProcessing) return
    const modeEnabled = { ...state.modeEnabled, [mode]: checked }
    const nextMode = pickPrimaryModeField(modeEnabled, state.mode)
    onChange({ ...state, modeEnabled, mode: nextMode })
  }

  const canStart =
    hasAnyModeEnabled(state.modeEnabled) &&
    selectedForProcessCount > 0 &&
    Boolean(state.outputDir.trim()) &&
    (!state.modeEnabled.concat || selectedForProcessCount >= 2)

  return (
    <div
      className="flex h-full min-h-0 w-[min(100%,22rem)] shrink-0 flex-col border-l border-[#2d2d2d] bg-[#1e1e1e] text-gray-300"
      style={{ overflow: 'hidden' }}
    >
      <div className="h-14 shrink-0 flex flex-col justify-center border-b border-[#2d2d2d] px-4">
        <div className="flex items-center">
          <Clapperboard className="mr-2 h-5 w-5 text-gray-400" aria-hidden />
          <h2 className="font-semibold text-white">视频处理</h2>
        </div>
        {totalVideoCount > 0 ? (
          <p
            className="mt-0.5 pl-7 text-[11px] text-gray-500"
            title="将使用当前右侧参数处理的勾选视频数"
          >
            已选 {selectedForProcessCount} 个
          </p>
        ) : null}
      </div>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[#1e1e1e]">
        <div
          className="min-h-0 flex-1 space-y-4 overflow-x-hidden overflow-y-auto px-4 py-3"
          style={{ overscrollBehavior: 'none' }}
        >
          <div
            className="overflow-hidden rounded-xl border border-[#2d2d2d] bg-[#181818]"
            title="保存当前全部处理参数（不含输出目录）。最多 40 条，超出时删除最旧一条。"
          >
            <div className="flex items-center justify-between gap-3 px-3 py-2">
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <BookmarkPlus className="h-4 w-4 shrink-0 text-gray-400" aria-hidden />
                <span className="shrink-0 text-sm font-medium text-gray-200">预设</span>
              </div>
              <PanelToggle
                checked={presetSectionEnabled}
                onChange={(v) => {
                  setPresetSectionEnabled(v)
                  if (!v) setPresetMessage(null)
                }}
                ariaLabel="启用预设管理"
              />
            </div>
            {presetSectionEnabled ? (
              <div className="space-y-1.5 border-t border-[#2d2d2d] px-3 pb-3 pt-2">
                <p className="text-[10px] leading-snug text-gray-500">
                  载入后输出目录不变；不含输出路径。
                </p>
                <div className="flex min-w-0 gap-1">
                  <select
                    value={selectedPresetId}
                    onChange={(e) => {
                      setSelectedPresetId(e.target.value)
                      setPresetMessage(null)
                    }}
                    disabled={isProcessing}
                    className="min-w-0 flex-1 rounded-md border border-[#3d3d3d] bg-[#121212] px-2 py-1.5 text-xs text-white focus:border-blue-500 focus:outline-none"
                  >
                    <option value="">选择…</option>
                    {videoPresets.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={isProcessing || !selectedPresetId}
                    title="载入预设"
                    onClick={() => {
                      setPresetMessage(null)
                      onApplyVideoPreset(selectedPresetId)
                    }}
                    className="shrink-0 rounded-md border border-[#3d3d3d] bg-[#121212] px-2 py-1.5 text-[11px] font-medium text-gray-200 transition-colors hover:border-blue-500/40 hover:bg-[#1e1e1e] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    载入
                  </button>
                  <button
                    type="button"
                    disabled={isProcessing || !selectedPresetId}
                    title="删除预设"
                    onClick={async () => {
                      setPresetMessage(null)
                      const r = await onDeleteVideoPreset(selectedPresetId)
                      if (!r.success) setPresetMessage(r.error ?? '删除失败')
                    }}
                    className="shrink-0 rounded-md border border-[#3d3d3d] bg-[#121212] p-1.5 text-gray-400 transition-colors hover:border-red-500/40 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="flex min-w-0 gap-1">
                  <input
                    type="text"
                    value={newPresetName}
                    onChange={(e) => {
                      setNewPresetName(e.target.value)
                      setPresetMessage(null)
                    }}
                    placeholder="新名称"
                    disabled={isProcessing}
                    maxLength={80}
                    className="min-w-0 flex-1 rounded-md border border-[#3d3d3d] bg-[#121212] px-2 py-1.5 text-xs text-white placeholder-gray-600 focus:border-blue-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    disabled={isProcessing || !newPresetName.trim()}
                    onClick={async () => {
                      setPresetMessage(null)
                      const r = await onSaveVideoPreset(newPresetName.trim())
                      if (r.success) setNewPresetName('')
                      else setPresetMessage(r.error ?? '保存失败')
                    }}
                    className="shrink-0 rounded-md bg-blue-600 px-2.5 py-1.5 text-[11px] font-medium text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-gray-700 disabled:text-gray-500"
                  >
                    保存
                  </button>
                </div>
                {presetMessage ? (
                  <p className="text-[10px] leading-snug text-amber-500/95">{presetMessage}</p>
                ) : null}
              </div>
            ) : null}
          </div>

          <div
            className="overflow-hidden rounded-xl border border-[#2d2d2d] bg-[#181818]"
            aria-label="处理选项"
          >
            <div className="flex flex-col gap-1.5 px-2 py-2">
              {VIDEO_MODE_ROWS.map((m) => {
                const enabled = state.modeEnabled[m.id]
                const ModeIcon = MODE_ROW_ICONS[m.id]
                return (
                  <div
                    key={m.id}
                    className={clsx(
                      'overflow-hidden rounded-lg border border-[#2d2d2d] bg-[#141414]',
                      enabled && 'border-blue-500/35 ring-1 ring-blue-500/20',
                    )}
                  >
                    <div className="flex items-center justify-between gap-2 px-2.5 py-2">
                      <div className="flex min-w-0 flex-1 items-start gap-2">
                        <ModeIcon className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" aria-hidden />
                        <div className="min-w-0 flex-1">
                          <span className="block text-sm font-medium text-gray-200">{m.label}</span>
                        </div>
                      </div>
                      <PanelToggle
                        checked={enabled}
                        onChange={(v) => setModeToggle(m.id, v)}
                        ariaLabel={`${enabled ? '关闭' : '启用'}：${m.label}`}
                      />
                    </div>
                    {enabled ? (
                      <div className="space-y-2 border-t border-[#2d2d2d] bg-[#121212]/80 px-2.5 pb-2.5 pt-2">
                        {m.id === 'transcode' ? (
                          <div className="space-y-2">
                            <div>
                              <label className={LABEL}>压缩质量</label>
                              <select
                                value={state.transcodeQualityTier}
                                onChange={(e) =>
                                  update(
                                    'transcodeQualityTier',
                                    e.target.value as VideoProcessFormState['transcodeQualityTier'],
                                  )
                                }
                                disabled={isProcessing}
                                className={FIELD}
                              >
                                <option value="low">低（CRF {TRANSCODE_TIER_CRF.low}）</option>
                                <option value="medium">
                                  中（CRF {TRANSCODE_TIER_CRF.medium}）
                                </option>
                                <option value="high">高（CRF {TRANSCODE_TIER_CRF.high}）</option>
                                <option value="custom">自定义</option>
                              </select>
                            </div>
                            {state.transcodeQualityTier === 'custom' ? (
                              <div>
                                <label className={LABEL}>CRF</label>
                                <p className="mb-1.5 text-[10px] leading-relaxed text-gray-500">
                                  数值越小画质越好、文件越大；越大则更易压缩体积、画质略降。网页常用约
                                  18–28。
                                </p>
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  value={state.transcodeCrfStr}
                                  onChange={(e) => update('transcodeCrfStr', e.target.value)}
                                  disabled={isProcessing}
                                  className={FIELD}
                                  placeholder="23"
                                />
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                        {m.id === 'speed' ? (
                          <div>
                            <label className={LABEL}>倍速</label>
                            <input
                              type="text"
                              inputMode="decimal"
                              value={state.playbackSpeedStr}
                              onChange={(e) => update('playbackSpeedStr', e.target.value)}
                              disabled={isProcessing}
                              className={FIELD}
                              placeholder="1"
                            />
                          </div>
                        ) : null}
                        {m.id === 'concat' ? (
                          <div className="space-y-2">
                            <div>
                              <label className={LABEL}>编码预设</label>
                              <select
                                value={state.transcodePreset}
                                onChange={(e) =>
                                  update(
                                    'transcodePreset',
                                    e.target.value as VideoProcessFormState['transcodePreset'],
                                  )
                                }
                                disabled={isProcessing}
                                className={FIELD}
                              >
                                <option value="web_mp4">Web MP4（H.264 + AAC）</option>
                                <option value="high_quality_mp4">高质量 MP4</option>
                                <option value="copy_streams">流拷贝（合并时可能改为重编码）</option>
                              </select>
                            </div>
                            <div>
                              <label className={LABEL}>最长边</label>
                              <input
                                type="number"
                                min={0}
                                value={state.maxWidthStr}
                                onChange={(e) => update('maxWidthStr', e.target.value)}
                                disabled={isProcessing}
                                className={FIELD}
                              />
                            </div>
                          </div>
                        ) : null}
                        {m.id === 'gif' ? (
                          <div className="space-y-2">
                            <div>
                              <label className={LABEL}>帧率</label>
                              <input
                                type="text"
                                inputMode="decimal"
                                value={state.gifFpsStr}
                                onChange={(e) => update('gifFpsStr', e.target.value)}
                                disabled={isProcessing}
                                className={FIELD}
                              />
                            </div>
                            <div>
                              <label className={LABEL}>GIF 最大宽度</label>
                              <input
                                type="number"
                                min={160}
                                value={state.gifMaxWidthStr}
                                onChange={(e) => update('gifMaxWidthStr', e.target.value)}
                                disabled={isProcessing}
                                className={FIELD}
                              />
                            </div>
                          </div>
                        ) : null}
                        {m.id === 'audio_extract' ? (
                          <div>
                            <label className={LABEL}>音频格式</label>
                            <select
                              value={state.audioFormat}
                              onChange={(e) =>
                                update('audioFormat', e.target.value as 'aac' | 'mp3' | 'wav')
                              }
                              disabled={isProcessing}
                              className={FIELD}
                            >
                              <option value="aac">M4A (AAC)</option>
                              <option value="mp3">MP3</option>
                              <option value="wav">WAV</option>
                            </select>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        <div className="shrink-0 space-y-2 border-t border-[#2d2d2d] bg-[#1e1e1e] px-4 py-2.5">
          <label className="text-sm font-medium text-gray-400">输出目录</label>
          <div className="flex gap-2">
            <div
              className="min-w-0 flex-1 truncate rounded-md border border-[#3d3d3d] bg-[#121212] px-3 py-2 text-sm text-gray-400"
              title={state.outputDir || '未选择'}
            >
              {state.outputDir || '请选择文件夹…'}
            </div>
            <button
              type="button"
              onClick={onSelectOutputDir}
              disabled={isProcessing}
              className="rounded-md bg-[#2d2d2d] p-2 text-gray-300 transition-colors hover:bg-[#3d3d3d] disabled:cursor-not-allowed disabled:opacity-50"
              title="选择文件夹"
            >
              <FolderOpen className="h-5 w-5" />
            </button>
          </div>

          {progressPercent != null && isProcessing ? (
            <div>
              <div className="mb-1 flex justify-between text-xs text-gray-500">
                <span>进度</span>
                <span>{progressPercent}%</span>
              </div>
              {batchProgress && batchProgress.total > 1 ? (
                <p className="mb-1 text-[11px] text-gray-400">
                  正在处理第 {batchProgress.current} / {batchProgress.total} 个文件
                </p>
              ) : null}
              <div className="h-2 overflow-hidden rounded-full bg-[#2d2d2d]">
                <div
                  className="h-full bg-blue-600 transition-all duration-300"
                  style={{ width: `${Math.min(100, progressPercent)}%` }}
                />
              </div>
            </div>
          ) : null}

          {!canStart && !isProcessing ? (
            <p className="text-xs text-amber-500/90">
              {selectedForProcessCount === 0
                ? '请至少勾选一个视频。'
                : !hasAnyModeEnabled(state.modeEnabled)
                  ? '请至少开启一种处理方式。'
                  : !state.outputDir.trim()
                    ? '请选择输出目录。'
                    : state.modeEnabled.concat && selectedForProcessCount < 2
                      ? '合并至少需要勾选 2 个视频。'
                      : ''}
            </p>
          ) : null}

          <button
            type="button"
            onClick={onStartProcessing}
            disabled={!canStart || isProcessing}
            className="flex w-full items-center justify-center gap-2 rounded-md bg-blue-600 py-2.5 font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-700 disabled:text-gray-500"
          >
            {isProcessing ? (
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            ) : (
              <Play className="h-5 w-5" />
            )}
            {isProcessing
              ? '处理中…'
              : selectedForProcessCount > 0
                ? `开始处理（${selectedForProcessCount}）`
                : '开始处理'}
          </button>
          <button
            type="button"
            onClick={onCancelProcessing}
            disabled={!isProcessing}
            className="flex w-full items-center justify-center gap-2 rounded-md border border-[#3d3d3d] py-2 text-sm text-gray-300 transition-colors hover:bg-[#252525] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Square className="h-4 w-4" />
            取消当前任务
          </button>
        </div>
      </div>
    </div>
  )
}
