import React, { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Aperture, ChevronDown, ChevronUp, UploadCloud } from 'lucide-react'
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

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

/** 用于默认保存文件名中的时间片段 */
function formatTimeForFilename(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '0s'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  const ms = Math.floor((sec % 1) * 1000)
  if (ms > 0) return `${m}m${s}s${String(ms).padStart(3, '0')}`
  return `${m}m${s}s`
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
  const [savingFrame, setSavingFrame] = useState(false)
  /** 预览区底部媒体信息卡：默认展开 */
  const [videoMetaExpanded, setVideoMetaExpanded] = useState(true)

  useEffect(() => {
    setVideoMetaExpanded(true)
  }, [previewVideo?.path])

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
  const showTimeline = Boolean(previewVideo)

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

  /** 信息卡两行「标签：值」；路径仅在顶栏，悬停可看含路径的完整说明 */
  const previewMetaLines = useMemo(() => {
    if (!previewVideo) return null
    const v = previewVideo
    const res = v.width && v.height ? `${v.width}×${v.height}` : '—'
    const row1: { label: string; value: string }[] = [
      { label: '分辨率', value: res },
      { label: '时长', value: formatDuration(v.durationSec) },
      { label: '体积', value: formatSize(v.size) },
    ]
    if (v.formatName) row1.push({ label: '封装', value: v.formatName })
    row1.push({
      label: '编码',
      value: `${v.videoCodec ?? '—'} / ${v.audioCodec ?? '—'}`,
    })
    const row2: { label: string; value: string }[] = [
      { label: '视频码率', value: formatBitrate(v.videoBitRateBps) },
      { label: '音频码率', value: formatBitrate(v.audioBitRateBps) },
      { label: '合计码率', value: formatBitrate(v.bitRateBps) },
    ]
    const title = [
      row1.map((s) => `${s.label}：${s.value}`).join(' · '),
      row2.map((s) => `${s.label}：${s.value}`).join(' · '),
      v.path,
    ].join('\n')
    return { row1, row2, title }
  }, [previewVideo])

  const onSavePreviewFrame = useCallback(async () => {
    const el = videoRef.current
    if (!previewVideo || !el || savingFrame) return
    const dur = el.duration
    let t = el.currentTime
    if (Number.isFinite(dur) && dur > 0) {
      t = clamp(t, 0, dur)
    } else {
      t = Math.max(0, t)
    }
    const stem = previewVideo.name.replace(/\.[^/.]+$/, '') || 'frame'
    const defaultFileName = `${stem}_${formatTimeForFilename(t)}.png`
    setSavingFrame(true)
    try {
      const r = await window.picafluxAPI.saveVideoPreviewFrame({
        inputPath: previewVideo.path,
        timeSec: t,
        defaultFileName,
      })
      if (!r.success && !r.canceled && r.error) {
        window.alert(r.error)
      }
    } finally {
      setSavingFrame(false)
    }
  }, [previewVideo, savingFrame])

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
          <div className="flex h-full min-h-0 flex-col gap-2">
            <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden rounded-xl border border-[#2d2d2d] bg-[#0d0d0d] p-3">
              <div className="flex min-w-0 shrink-0 items-center justify-between gap-3">
                <p
                  className="min-w-0 flex-1 truncate text-[12px] leading-snug"
                  title={`${previewVideo.name}\n${previewVideo.path}`}
                >
                  <span className="font-semibold text-gray-200">{previewVideo.name}</span>
                  <span className="select-none text-gray-700"> · </span>
                  <span className="font-mono text-[11px] font-normal text-gray-500">
                    {previewVideo.path}
                  </span>
                </p>
                <button
                  type="button"
                  onClick={() => void onSavePreviewFrame()}
                  disabled={isProcessing || savingFrame}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-[#3d3d3d] bg-[#161616] px-2.5 py-1 text-[12px] font-medium text-gray-200 transition-colors hover:border-blue-500/35 hover:bg-[#1c1c1c] disabled:cursor-not-allowed disabled:opacity-45"
                  title="保存当前播放时刻的画面（PNG / JPEG）"
                >
                  <Aperture className="h-3.5 w-3.5 text-gray-400" aria-hidden />
                  {savingFrame ? '导出中…' : '截帧'}
                </button>
              </div>
              <div className="flex min-h-0 min-w-0 flex-1 items-center justify-center overflow-hidden">
                <video
                  ref={videoRef}
                  key={previewVideo.path}
                  src={src}
                  controls
                  className="max-h-full max-w-full rounded-lg bg-black object-contain shadow-[0_0_0_1px_rgba(255,255,255,0.06)]"
                />
              </div>
              {showTimeline ? (
                <div className="shrink-0 border-t border-[#2a2a2a] pt-3">
                  <VideoTimeline
                    videoEl={videoRef.current}
                    filmstripVideoPath={previewVideo.path}
                    durationSec={previewVideo.durationSec}
                    startSecStr={form.startSecStr}
                    durationSecStr={form.durationSecStr}
                    disabled={isProcessing}
                    onChange={(patch) => {
                      onFormChange({ ...form, ...patch })
                    }}
                  />
                </div>
              ) : null}
            </div>

            {previewMetaLines ? (
              <div
                role="region"
                aria-label="媒体信息"
                className="shrink-0 rounded-lg border border-[#2a2a2a] bg-[#141414]"
              >
                <div
                  className={`flex min-w-0 items-start gap-1.5 px-2.5 py-1.5 ${videoMetaExpanded ? '' : 'justify-end py-1'}`}
                >
                  <div
                    id="video-preview-meta-details"
                    hidden={!videoMetaExpanded}
                    className="min-w-0 flex-1 space-y-0.5"
                  >
                    <p
                      className="min-w-0 truncate text-[11px] leading-snug"
                      title={previewMetaLines.title}
                    >
                      {previewMetaLines.row1.map((s, i) => (
                        <Fragment key={`${s.label}-${i}`}>
                          {i > 0 ? <span className="select-none text-gray-700"> · </span> : null}
                          <span className="text-gray-600">{s.label}：</span>
                          <span className="tabular-nums text-gray-400">{s.value}</span>
                        </Fragment>
                      ))}
                    </p>
                    <p
                      className="min-w-0 truncate text-[11px] leading-snug"
                      title={previewMetaLines.title}
                    >
                      {previewMetaLines.row2.map((s, i) => (
                        <Fragment key={`${s.label}-${i}`}>
                          {i > 0 ? <span className="select-none text-gray-700"> · </span> : null}
                          <span className="text-gray-600">{s.label}：</span>
                          <span className="tabular-nums text-gray-400">{s.value}</span>
                        </Fragment>
                      ))}
                    </p>
                  </div>
                  <button
                    type="button"
                    id="video-preview-meta-toggle"
                    onClick={() => setVideoMetaExpanded((v) => !v)}
                    aria-expanded={videoMetaExpanded}
                    aria-controls="video-preview-meta-details"
                    aria-label={videoMetaExpanded ? '收起媒体信息' : '展开媒体信息'}
                    title={videoMetaExpanded ? '收起媒体信息' : '展开媒体信息'}
                    className={
                      videoMetaExpanded
                        ? 'shrink-0 rounded p-0.5 text-gray-500 transition-colors hover:bg-[#252525] hover:text-gray-300'
                        : 'inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] text-gray-500 transition-colors hover:bg-[#252525] hover:text-gray-300'
                    }
                  >
                    {videoMetaExpanded ? (
                      <ChevronDown className="h-4 w-4" aria-hidden />
                    ) : (
                      <>
                        <ChevronUp className="h-3.5 w-3.5 shrink-0" aria-hidden />
                        <span aria-hidden>媒体信息</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : null}
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
