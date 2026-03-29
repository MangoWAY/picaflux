import React from 'react'
import clsx from 'clsx'
import { FolderOpen, Play, Square } from 'lucide-react'
import type { VideoProcessFormState, VideoWorkbenchMode } from '@/lib/videoFormPayload'

const MODE_OPTIONS: { id: VideoWorkbenchMode; label: string }[] = [
  { id: 'transcode', label: '转码 / 压缩' },
  { id: 'trim', label: '裁剪片段' },
  { id: 'extract_frame', label: '截帧' },
  { id: 'audio_extract', label: '抽取音频' },
  { id: 'strip_audio', label: '去除音轨' },
  { id: 'gif', label: '导出 GIF' },
]

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

  const canStart = selectedForProcessCount > 0 && Boolean(state.outputDir.trim())

  return (
    <div className="flex h-full w-[320px] shrink-0 flex-col border-l border-[#2d2d2d] bg-[#1a1a1a]">
      <div className="border-b border-[#2d2d2d] px-4 py-3">
        <h2 className="text-sm font-semibold text-white">视频处理</h2>
        <p className="text-xs text-gray-500">与图片模块相同：勾选 → 参数 → 输出目录</p>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        <div>
          <label className="mb-2 block text-xs font-medium text-gray-400">处理类型</label>
          <select
            value={state.mode}
            onChange={(e) => update('mode', e.target.value as VideoWorkbenchMode)}
            disabled={isProcessing}
            className="w-full rounded-lg border border-[#2d2d2d] bg-[#121212] px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            {MODE_OPTIONS.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

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

        {state.mode === 'trim' || state.mode === 'gif' ? (
          <>
            <div>
              <label className="mb-2 block text-xs font-medium text-gray-400">起始时间（秒）</label>
              <input
                type="text"
                inputMode="decimal"
                value={state.startSecStr}
                onChange={(e) => update('startSecStr', e.target.value)}
                disabled={isProcessing}
                className="w-full rounded-lg border border-[#2d2d2d] bg-[#121212] px-3 py-2 text-sm text-white"
              />
            </div>
            <div>
              <label className="mb-2 block text-xs font-medium text-gray-400">时长（秒）</label>
              <input
                type="text"
                inputMode="decimal"
                value={state.durationSecStr}
                onChange={(e) => update('durationSecStr', e.target.value)}
                disabled={isProcessing}
                className="w-full rounded-lg border border-[#2d2d2d] bg-[#121212] px-3 py-2 text-sm text-white"
              />
            </div>
          </>
        ) : null}

        {state.mode === 'gif' ? (
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
              <label className="mb-2 block text-xs font-medium text-gray-400">GIF 最大宽度</label>
              <input
                type="number"
                min={160}
                value={state.gifMaxWidthStr}
                onChange={(e) => update('gifMaxWidthStr', e.target.value)}
                disabled={isProcessing}
                className="w-full rounded-lg border border-[#2d2d2d] bg-[#121212] px-3 py-2 text-sm text-white"
              />
            </div>
          </>
        ) : null}

        {state.mode === 'extract_frame' ? (
          <>
            <div>
              <label className="mb-2 block text-xs font-medium text-gray-400">截取时刻（秒）</label>
              <input
                type="text"
                inputMode="decimal"
                value={state.timeSecStr}
                onChange={(e) => update('timeSecStr', e.target.value)}
                disabled={isProcessing}
                className="w-full rounded-lg border border-[#2d2d2d] bg-[#121212] px-3 py-2 text-sm text-white"
              />
            </div>
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
