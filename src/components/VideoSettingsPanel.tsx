import React from 'react'
import clsx from 'clsx'
import { FolderOpen, Play, Square } from 'lucide-react'
import type { VideoProcessFormState, VideoWorkbenchMode } from '@/lib/videoFormPayload'

const MODE_GROUPS: {
  id: 'encode' | 'time' | 'audio' | 'merge'
  label: string
  modes: { id: VideoWorkbenchMode; label: string }[]
}[] = [
  {
    id: 'encode',
    label: '编码与封装',
    modes: [
      { id: 'transcode', label: '转码 / 压缩' },
      { id: 'speed', label: '变速' },
    ],
  },
  {
    id: 'time',
    label: '时间与导出',
    modes: [
      { id: 'trim', label: '裁剪片段' },
      { id: 'extract_frame', label: '截帧' },
      { id: 'gif', label: '导出 GIF' },
      { id: 'webp_anim', label: '导出 WebP（动图）' },
    ],
  },
  {
    id: 'audio',
    label: '音轨',
    modes: [
      { id: 'audio_extract', label: '抽取音频' },
      { id: 'strip_audio', label: '去除音轨' },
    ],
  },
  {
    id: 'merge',
    label: '合并',
    modes: [{ id: 'concat', label: '合并片段' }],
  },
]

function parseSecForDisplay(s: string): number {
  const n = parseFloat(String(s).trim().replace(',', '.'))
  if (!Number.isFinite(n) || n < 0) return NaN
  return n
}

function formatDisplayClock(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '—'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  const ms = Math.floor((sec % 1) * 1000)
  if (ms > 0) return `${m}:${String(s).padStart(2, '0')}.${String(ms).padStart(3, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
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
}: VideoSettingsPanelProps) {
  const update = <K extends keyof VideoProcessFormState>(
    key: K,
    value: VideoProcessFormState[K],
  ) => {
    onChange({ ...state, [key]: value })
  }

  const activeGroup =
    MODE_GROUPS.find((g) => g.modes.some((m) => m.id === state.mode)) ?? MODE_GROUPS[0]

  const selectGroup = (groupId: (typeof MODE_GROUPS)[number]['id']) => {
    const g = MODE_GROUPS.find((x) => x.id === groupId)
    if (!g) return
    if (g.modes.some((m) => m.id === state.mode)) return
    onChange({ ...state, mode: g.modes[0].id })
  }

  const selectMode = (mode: VideoWorkbenchMode) => {
    if (mode === state.mode || isProcessing) return
    onChange({ ...state, mode })
  }

  const canStart =
    selectedForProcessCount > 0 &&
    Boolean(state.outputDir.trim()) &&
    (state.mode !== 'concat' || selectedForProcessCount >= 2)

  const trimLikeSummary =
    state.mode === 'trim' || state.mode === 'gif' || state.mode === 'webp_anim'
  const startSec = parseSecForDisplay(state.startSecStr)
  const clipDurSec = parseSecForDisplay(state.durationSecStr)
  const endSec =
    Number.isFinite(startSec) && Number.isFinite(clipDurSec) ? startSec + clipDurSec : NaN
  const extractTimeSec = parseSecForDisplay(state.timeSecStr)

  return (
    <div className="flex h-full w-[320px] shrink-0 flex-col border-l border-[#2d2d2d] bg-[#1a1a1a]">
      <div className="border-b border-[#2d2d2d] px-4 py-3">
        <h2 className="text-sm font-semibold text-white">视频处理</h2>
        <p className="text-xs text-gray-500">勾选素材 → 选择处理方式 → 参数与输出目录</p>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        <div>
          <span className="mb-2 block text-xs font-medium text-gray-400">处理类型</span>
          <div className="flex flex-wrap gap-1 border-b border-[#2d2d2d] pb-2" role="tablist">
            {MODE_GROUPS.map((g) => {
              const inGroup = g.modes.some((m) => m.id === state.mode)
              return (
                <button
                  key={g.id}
                  type="button"
                  role="tab"
                  aria-selected={inGroup}
                  disabled={isProcessing}
                  onClick={() => selectGroup(g.id)}
                  className={clsx(
                    'rounded-md px-2 py-1.5 text-[11px] font-medium transition-colors',
                    inGroup
                      ? 'bg-blue-500/15 text-blue-300'
                      : 'text-gray-500 hover:bg-[#252525] hover:text-gray-300',
                  )}
                >
                  {g.label}
                </button>
              )
            })}
          </div>
          <div className="mt-2 flex flex-col gap-1.5">
            {activeGroup.modes.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => selectMode(m.id)}
                disabled={isProcessing}
                className={clsx(
                  'rounded-lg border px-3 py-2 text-left text-sm transition-colors',
                  m.id === state.mode
                    ? 'border-blue-500/50 bg-blue-500/10 text-white'
                    : 'border-[#2d2d2d] bg-[#121212] text-gray-300 hover:border-[#3d3d3d]',
                )}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {trimLikeSummary ? (
          <div className="rounded-lg border border-[#2d2d2d] bg-[#121212] px-3 py-2 text-xs">
            <p className="mb-1 font-medium text-gray-500">片段范围（在中间预览区时间线调整）</p>
            <p className="text-gray-300">
              起点 {formatDisplayClock(startSec)} · 终点 {formatDisplayClock(endSec)} · 时长{' '}
              {Number.isFinite(clipDurSec)
                ? `${clipDurSec.toFixed(3).replace(/\.?0+$/, '')} s`
                : '—'}
            </p>
          </div>
        ) : null}

        {state.mode === 'extract_frame' ? (
          <div className="rounded-lg border border-[#2d2d2d] bg-[#121212] px-3 py-2 text-xs">
            <p className="mb-1 font-medium text-gray-500">截取时刻（在中间预览区时间线调整）</p>
            <p className="text-gray-300">{formatDisplayClock(extractTimeSec)}</p>
          </div>
        ) : null}

        {state.mode === 'transcode' ? (
          <>
            <div>
              <label className="mb-2 block text-xs font-medium text-gray-400">预设</label>
              <select
                value={state.transcodePreset}
                onChange={(e) =>
                  update(
                    'transcodePreset',
                    e.target.value as VideoProcessFormState['transcodePreset'],
                  )
                }
                disabled={isProcessing}
                className="w-full rounded-lg border border-[#2d2d2d] bg-[#121212] px-3 py-2 text-sm text-white"
              >
                <option value="web_mp4">Web MP4（H.264 + AAC）</option>
                <option value="high_quality_mp4">高质量 MP4</option>
                <option value="copy_streams">流拷贝（重封装）</option>
              </select>
            </div>
            <div>
              <label className="mb-2 block text-xs font-medium text-gray-400">
                最长边上限（像素，0=不缩放）
              </label>
              <input
                type="number"
                min={0}
                value={state.maxWidthStr}
                onChange={(e) => update('maxWidthStr', e.target.value)}
                disabled={isProcessing}
                className="w-full rounded-lg border border-[#2d2d2d] bg-[#121212] px-3 py-2 text-sm text-white"
              />
            </div>
          </>
        ) : null}

        {state.mode === 'speed' ? (
          <>
            <p className="text-xs leading-relaxed text-gray-500">
              对<strong>整段</strong>视频改变播放速度（需重编码）。倍速 &gt; 1 快放，&lt; 1
              慢放；有效范围约 0.25–4。无声素材仅变速画面。
            </p>
            <div>
              <label className="mb-2 block text-xs font-medium text-gray-400">预设</label>
              <select
                value={state.transcodePreset}
                onChange={(e) =>
                  update(
                    'transcodePreset',
                    e.target.value as VideoProcessFormState['transcodePreset'],
                  )
                }
                disabled={isProcessing}
                className="w-full rounded-lg border border-[#2d2d2d] bg-[#121212] px-3 py-2 text-sm text-white"
              >
                <option value="web_mp4">Web MP4（H.264 + AAC）</option>
                <option value="high_quality_mp4">高质量 MP4</option>
                <option value="copy_streams">流拷贝（变速时会自动改为 Web MP4 重编码）</option>
              </select>
            </div>
            <div>
              <label className="mb-2 block text-xs font-medium text-gray-400">
                播放倍速（如 2=两倍速，0.5=半速）
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={state.playbackSpeedStr}
                onChange={(e) => update('playbackSpeedStr', e.target.value)}
                disabled={isProcessing}
                className="w-full rounded-lg border border-[#2d2d2d] bg-[#121212] px-3 py-2 text-sm text-white"
              />
            </div>
            <div>
              <label className="mb-2 block text-xs font-medium text-gray-400">
                最长边上限（像素，0=不缩放）
              </label>
              <input
                type="number"
                min={0}
                value={state.maxWidthStr}
                onChange={(e) => update('maxWidthStr', e.target.value)}
                disabled={isProcessing}
                className="w-full rounded-lg border border-[#2d2d2d] bg-[#121212] px-3 py-2 text-sm text-white"
              />
            </div>
          </>
        ) : null}

        {state.mode === 'concat' ? (
          <>
            <p className="text-xs leading-relaxed text-gray-500">
              按左侧列表<strong>从上到下</strong>的顺序拼接<strong>已勾选</strong>的片段（至少 2
              个）。各段需<strong>均含音轨</strong>。
            </p>
            <div>
              <label className="mb-2 block text-xs font-medium text-gray-400">预设</label>
              <select
                value={state.transcodePreset}
                onChange={(e) =>
                  update(
                    'transcodePreset',
                    e.target.value as VideoProcessFormState['transcodePreset'],
                  )
                }
                disabled={isProcessing}
                className="w-full rounded-lg border border-[#2d2d2d] bg-[#121212] px-3 py-2 text-sm text-white"
              >
                <option value="web_mp4">Web MP4（H.264 + AAC）</option>
                <option value="high_quality_mp4">高质量 MP4</option>
                <option value="copy_streams">流拷贝（合并时会自动改为 Web MP4 重编码）</option>
              </select>
            </div>
            <div>
              <label className="mb-2 block text-xs font-medium text-gray-400">
                最长边上限（像素，0=按素材最大宽度统一画布）
              </label>
              <input
                type="number"
                min={0}
                value={state.maxWidthStr}
                onChange={(e) => update('maxWidthStr', e.target.value)}
                disabled={isProcessing}
                className="w-full rounded-lg border border-[#2d2d2d] bg-[#121212] px-3 py-2 text-sm text-white"
              />
            </div>
          </>
        ) : null}

        {state.mode === 'gif' || state.mode === 'webp_anim' ? (
          <>
            <div>
              <label className="mb-2 block text-xs font-medium text-gray-400">帧率（1–15）</label>
              <input
                type="text"
                inputMode="decimal"
                value={state.gifFpsStr}
                onChange={(e) => update('gifFpsStr', e.target.value)}
                disabled={isProcessing}
                className="w-full rounded-lg border border-[#2d2d2d] bg-[#121212] px-3 py-2 text-sm text-white"
              />
            </div>
            <div>
              <label className="mb-2 block text-xs font-medium text-gray-400">
                {state.mode === 'webp_anim' ? 'WebP 最大宽度' : 'GIF 最大宽度'}
              </label>
              <input
                type="number"
                min={160}
                value={state.gifMaxWidthStr}
                onChange={(e) => update('gifMaxWidthStr', e.target.value)}
                disabled={isProcessing}
                className="w-full rounded-lg border border-[#2d2d2d] bg-[#121212] px-3 py-2 text-sm text-white"
              />
            </div>
            {state.mode === 'webp_anim' ? (
              <div>
                <label className="mb-2 block text-xs font-medium text-gray-400">
                  WebP 质量（1–100，越高越清晰；需 ffmpeg 启用 libwebp）
                </label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={state.webpQualityStr}
                  onChange={(e) => update('webpQualityStr', e.target.value)}
                  disabled={isProcessing}
                  className="w-full rounded-lg border border-[#2d2d2d] bg-[#121212] px-3 py-2 text-sm text-white"
                />
              </div>
            ) : null}
          </>
        ) : null}

        {state.mode === 'extract_frame' ? (
          <>
            <div>
              <label className="mb-2 block text-xs font-medium text-gray-400">
                间隔序列（秒，0=仅单帧）
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={state.frameIntervalStr}
                onChange={(e) => update('frameIntervalStr', e.target.value)}
                disabled={isProcessing}
                className="w-full rounded-lg border border-[#2d2d2d] bg-[#121212] px-3 py-2 text-sm text-white"
              />
            </div>
            <div>
              <label className="mb-2 block text-xs font-medium text-gray-400">序列最多帧数</label>
              <input
                type="number"
                min={1}
                value={state.maxFrameCountStr}
                onChange={(e) => update('maxFrameCountStr', e.target.value)}
                disabled={isProcessing}
                className="w-full rounded-lg border border-[#2d2d2d] bg-[#121212] px-3 py-2 text-sm text-white"
              />
            </div>
            <div>
              <label className="mb-2 block text-xs font-medium text-gray-400">图片格式</label>
              <select
                value={state.frameFormat}
                onChange={(e) => update('frameFormat', e.target.value as 'png' | 'jpeg')}
                disabled={isProcessing}
                className="w-full rounded-lg border border-[#2d2d2d] bg-[#121212] px-3 py-2 text-sm text-white"
              >
                <option value="png">PNG</option>
                <option value="jpeg">JPEG</option>
              </select>
            </div>
          </>
        ) : null}

        {state.mode === 'trim' && (
          <div>
            <label className="mb-2 block text-xs font-medium text-gray-400">
              可选：最长边上限（0=不缩放）
            </label>
            <input
              type="number"
              min={0}
              value={state.maxWidthStr}
              onChange={(e) => update('maxWidthStr', e.target.value)}
              disabled={isProcessing}
              className="w-full rounded-lg border border-[#2d2d2d] bg-[#121212] px-3 py-2 text-sm text-white"
            />
          </div>
        )}

        {state.mode === 'transcode' ||
        state.mode === 'trim' ||
        state.mode === 'speed' ||
        state.mode === 'strip_audio' ||
        state.mode === 'gif' ||
        state.mode === 'webp_anim' ||
        state.mode === 'extract_frame' ||
        state.mode === 'concat' ? (
          <>
            <div>
              <label className="mb-2 block text-xs font-medium text-gray-400">旋转（顺时针）</label>
              <select
                value={state.videoRotation}
                onChange={(e) =>
                  update('videoRotation', e.target.value as VideoProcessFormState['videoRotation'])
                }
                disabled={isProcessing}
                className="w-full rounded-lg border border-[#2d2d2d] bg-[#121212] px-3 py-2 text-sm text-white"
              >
                <option value="0">不旋转</option>
                <option value="90">90°</option>
                <option value="180">180°</option>
                <option value="270">270°</option>
              </select>
            </div>
            <div>
              <label className="mb-2 block text-xs font-medium text-gray-400">翻转</label>
              <select
                value={state.videoFlip}
                onChange={(e) =>
                  update('videoFlip', e.target.value as VideoProcessFormState['videoFlip'])
                }
                disabled={isProcessing}
                className="w-full rounded-lg border border-[#2d2d2d] bg-[#121212] px-3 py-2 text-sm text-white"
              >
                <option value="none">无</option>
                <option value="horizontal">水平</option>
                <option value="vertical">垂直</option>
                <option value="both">水平 + 垂直</option>
              </select>
            </div>
            {state.mode === 'transcode' &&
            state.transcodePreset === 'copy_streams' &&
            (state.videoRotation !== '0' || state.videoFlip !== 'none') ? (
              <p className="text-xs text-amber-500/90">
                流拷贝不能与旋转/翻转同时进行，请改用转码预设或关闭变换。
              </p>
            ) : null}
          </>
        ) : null}

        {state.mode === 'audio_extract' ? (
          <div>
            <label className="mb-2 block text-xs font-medium text-gray-400">音频格式</label>
            <select
              value={state.audioFormat}
              onChange={(e) => update('audioFormat', e.target.value as 'aac' | 'mp3' | 'wav')}
              disabled={isProcessing}
              className="w-full rounded-lg border border-[#2d2d2d] bg-[#121212] px-3 py-2 text-sm text-white"
            >
              <option value="aac">M4A (AAC)</option>
              <option value="mp3">MP3</option>
              <option value="wav">WAV</option>
            </select>
          </div>
        ) : null}

        <div>
          <label className="mb-2 block text-xs font-medium text-gray-400">输出目录</label>
          <div className="flex gap-2">
            <div
              className="min-w-0 flex-1 truncate rounded-lg border border-[#2d2d2d] bg-[#121212] px-3 py-2 text-xs text-gray-400"
              title={state.outputDir || '未选择'}
            >
              {state.outputDir || '未选择'}
            </div>
            <button
              type="button"
              onClick={onSelectOutputDir}
              disabled={isProcessing}
              className="shrink-0 rounded-lg border border-[#2d2d2d] bg-[#252525] p-2 text-gray-300 hover:bg-[#2d2d2d]"
              title="选择文件夹"
            >
              <FolderOpen className="h-5 w-5" />
            </button>
          </div>
        </div>

        {progressPercent != null && isProcessing ? (
          <div>
            <div className="mb-1 flex justify-between text-xs text-gray-500">
              <span>进度</span>
              <span>{progressPercent}%</span>
            </div>
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
              : !state.outputDir.trim()
                ? '请选择输出目录。'
                : state.mode === 'concat' && selectedForProcessCount < 2
                  ? '合并至少需要勾选 2 个视频。'
                  : ''}
          </p>
        ) : null}
      </div>

      <div className="space-y-2 border-t border-[#2d2d2d] p-4">
        <button
          type="button"
          onClick={onStartProcessing}
          disabled={!canStart || isProcessing}
          className={clsx(
            'flex w-full items-center justify-center gap-2 rounded-lg py-3 text-sm font-semibold text-white transition-colors',
            canStart && !isProcessing
              ? 'bg-blue-600 hover:bg-blue-500'
              : 'cursor-not-allowed bg-gray-700 text-gray-500',
          )}
        >
          <Play className="h-4 w-4" />
          开始处理（{selectedForProcessCount}/{totalVideoCount}）
        </button>
        <button
          type="button"
          onClick={onCancelProcessing}
          disabled={!isProcessing}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-[#3d3d3d] py-2 text-sm text-gray-300 transition-colors hover:bg-[#252525] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Square className="h-4 w-4" />
          取消当前任务
        </button>
      </div>
    </div>
  )
}
