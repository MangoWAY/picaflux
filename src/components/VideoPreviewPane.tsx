import React, { useCallback, useEffect, useMemo, useRef } from 'react'
import { UploadCloud } from 'lucide-react'
import type { VideoFile } from './VideoStrip'
import type { VideoProcessFormState } from '@/lib/videoFormPayload'
import { VideoTimeline } from './VideoTimeline'

const VIDEO_EXT = /\.(mp4|mov|mkv|webm|m4v|avi|mpeg|mpg)$/i

function formatSize(bytes: number): string {
  if (bytes <= 0) return '—'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
}

function formatDuration(sec?: number): string {
  if (sec == null || !Number.isFinite(sec) || sec < 0) return '—'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  const ms = Math.floor((sec % 1) * 1000)
  if (ms > 0) return `${m}:${String(s).padStart(2, '0')}.${String(ms).padStart(3, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

function formatBitrate(bps?: number): string {
  if (bps == null || !Number.isFinite(bps) || bps <= 0) return '—'
  const kbps = bps / 1000
  if (kbps < 1000) return `${kbps.toFixed(0)} kbps`
  const mbps = kbps / 1000
  return `${mbps.toFixed(2)} Mbps`
}

interface VideoPreviewPaneProps {
  videos: VideoFile[]
  previewVideo: VideoFile | null
  selectedCount: number
  onAddVideos: () => void
  onDropPaths: (paths: string[]) => void
  form: VideoProcessFormState
  onFormChange: (next: VideoProcessFormState) => void
  isProcessing: boolean
  /** 与图片模块一致：← / → 切换列表中的上一个 / 下一个 */
  onNavigatePreview?: (delta: -1 | 1) => void
}

export function VideoPreviewPane({
  videos,
  previewVideo,
  selectedCount,
  onAddVideos,
  onDropPaths,
  form,
  onFormChange,
  isProcessing,
  onNavigatePreview,
}: VideoPreviewPaneProps) {
  const videoRef = useRef<HTMLVideoElement>(null)

  const collectPathsFromDataTransfer = useCallback((dt: DataTransfer): string[] => {
    const paths: string[] = []
    const files = Array.from(dt.files)
    for (const file of files) {
      try {
        const p = window.picafluxAPI.getPathForFile(file)
        if (p && VIDEO_EXT.test(p)) paths.push(p)
      } catch {
        /* ignore */
      }
    }
    return paths
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.dataTransfer.types.includes('Files')) {
      e.dataTransfer.dropEffect = 'copy'
    }
  }, [])

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      const paths = collectPathsFromDataTransfer(e.dataTransfer)
      if (paths.length > 0) onDropPaths(paths)
    },
    [collectPathsFromDataTransfer, onDropPaths],
  )

  const src = previewVideo?.previewUrl
  const showTimeline = Boolean(
    previewVideo &&
    (form.mode === 'trim' ||
      form.mode === 'gif' ||
      form.mode === 'webp_anim' ||
      form.mode === 'extract_frame'),
  )

  const timelineMode = useMemo(() => {
    if (
      form.mode === 'trim' ||
      form.mode === 'gif' ||
      form.mode === 'webp_anim' ||
      form.mode === 'extract_frame'
    )
      return form.mode
    return null
  }, [form.mode])

  useEffect(() => {
    if (!onNavigatePreview || videos.length === 0) return
    const onKeyDown = (e: KeyboardEvent) => {
      const elTarget = e.target as HTMLElement | null
      if (elTarget?.closest('input, textarea, select, [contenteditable="true"]')) return
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        onNavigatePreview(-1)
        return
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault()
        onNavigatePreview(1)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onNavigatePreview, videos.length])

  useEffect(() => {
    if (!previewVideo) return
    const onKeyDown = (e: KeyboardEvent) => {
      const elTarget = e.target as HTMLElement | null
      if (elTarget?.closest('input, textarea, select, [contenteditable="true"]')) return
      if (elTarget?.closest('button') && e.code === 'Space') return
      const el = videoRef.current
      if (!el) return
      if (e.code === 'Space') {
        e.preventDefault()
        if (el.paused) void el.play().catch(() => {})
        else el.pause()
        return
      }
      const jump = 3
      if (e.key === 'j' || e.key === 'J') {
        e.preventDefault()
        el.currentTime = Math.max(0, el.currentTime - jump)
        return
      }
      if (e.key === 'l' || e.key === 'L') {
        e.preventDefault()
        const d = el.duration
        const next = el.currentTime + jump
        el.currentTime = Number.isFinite(d) && d > 0 ? Math.min(d, next) : next
        return
      }
      if (e.key === 'k' || e.key === 'K') {
        e.preventDefault()
        el.pause()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [previewVideo])

  const headerSubtitle = useMemo(() => {
    if (videos.length === 0) return null
    const base = `已选 ${selectedCount}/${videos.length} 个 · ←→ 切换预览`
    if (showTimeline) return `${base} · 片段与时间线在下方调整`
    return base
  }, [videos.length, selectedCount, showTimeline])

  return (
    <div
      className="flex h-full min-h-0 min-w-0 flex-1 flex-col bg-[#121212]"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-[#2d2d2d] px-6">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold text-white">视频预览</h1>
          {headerSubtitle ? (
            <p className="truncate text-xs text-gray-500" title={headerSubtitle}>
              {headerSubtitle}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onAddVideos}
          className="shrink-0 rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
        >
          添加视频
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden p-6">
        {videos.length === 0 ? (
          <div
            className="flex h-full min-h-[280px] flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#2d2d2d] bg-[#1a1a1a] text-gray-500"
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          >
            <UploadCloud className="mb-3 h-10 w-10 text-gray-600" />
            <p className="text-sm text-gray-400">拖入视频或点击添加</p>
          </div>
        ) : previewVideo ? (
          <div className="flex h-full min-h-0 flex-col gap-3">
            <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden rounded-xl border border-[#2d2d2d] bg-[#0d0d0d] p-3">
              <div className="flex min-h-0 min-w-0 flex-1 items-center justify-center overflow-hidden">
                <video
                  ref={videoRef}
                  key={previewVideo.path}
                  src={src}
                  controls
                  className="max-h-full max-w-full rounded-lg bg-black object-contain shadow-[0_0_0_1px_rgba(255,255,255,0.06)]"
                />
              </div>
              {showTimeline && timelineMode ? (
                <div className="shrink-0 border-t border-[#2a2a2a] pt-3">
                  <VideoTimeline
                    mode={timelineMode}
                    videoEl={videoRef.current}
                    durationSec={previewVideo.durationSec}
                    startSecStr={form.startSecStr}
                    durationSecStr={form.durationSecStr}
                    timeSecStr={form.timeSecStr}
                    disabled={isProcessing}
                    onChange={(patch) => {
                      onFormChange({ ...form, ...patch })
                    }}
                  />
                </div>
              ) : null}
              <p className="shrink-0 text-center text-[10px] text-gray-600">
                Space 播放/暂停 · J／K／L 快退/暂停/快进 · 时间轴可用控件拖动
              </p>
            </div>

            <div className="shrink-0 space-y-2 text-sm text-gray-400">
              <p className="truncate font-medium text-gray-200" title={previewVideo.name}>
                {previewVideo.name}
              </p>
              <p className="text-xs text-gray-500">
                {previewVideo.width && previewVideo.height
                  ? `${previewVideo.width}×${previewVideo.height}`
                  : '—'}{' '}
                · {formatDuration(previewVideo.durationSec)} · {formatSize(previewVideo.size)}
                {previewVideo.formatName ? ` · ${previewVideo.formatName}` : ''}
              </p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs sm:grid-cols-3">
                <div>
                  <span className="text-gray-600">视频编码</span>
                  <p className="truncate text-gray-300" title={previewVideo.videoCodec ?? ''}>
                    {previewVideo.videoCodec ?? '—'}
                  </p>
                </div>
                <div>
                  <span className="text-gray-600">音频编码</span>
                  <p className="truncate text-gray-300" title={previewVideo.audioCodec ?? ''}>
                    {previewVideo.audioCodec ?? '—'}
                  </p>
                </div>
                <div>
                  <span className="text-gray-600">总码率</span>
                  <p className="text-gray-300">{formatBitrate(previewVideo.bitRateBps)}</p>
                </div>
                <div>
                  <span className="text-gray-600">视频 / 音频码率</span>
                  <p className="text-gray-300">
                    {formatBitrate(previewVideo.videoBitRateBps)} /{' '}
                    {formatBitrate(previewVideo.audioBitRateBps)}
                  </p>
                </div>
                <div className="sm:col-span-2">
                  <span className="text-gray-600">路径</span>
                  <p
                    className="truncate font-mono text-[11px] text-gray-400"
                    title={previewVideo.path}
                  >
                    {previewVideo.path}
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex h-full items-center justify-center text-gray-500">
            在左侧选择一个视频预览
          </div>
        )}
      </div>
    </div>
  )
}
