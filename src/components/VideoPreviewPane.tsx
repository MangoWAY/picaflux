import React, { useCallback, useMemo, useRef, useState } from 'react'
import { UploadCloud, FileVideo } from 'lucide-react'
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
}: VideoPreviewPaneProps) {
  const [dragOver, setDragOver] = useState(false)
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

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(true)
  }

  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(false)
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(false)
    const paths = collectPathsFromDataTransfer(e.dataTransfer)
    if (paths.length) onDropPaths(paths)
  }

  const src = previewVideo?.previewUrl
  const showTimeline = Boolean(
    previewVideo && (form.mode === 'trim' || form.mode === 'gif' || form.mode === 'extract_frame'),
  )

  const timelineMode = useMemo(() => {
    if (form.mode === 'trim' || form.mode === 'gif' || form.mode === 'extract_frame')
      return form.mode
    return null
  }, [form.mode])

  return (
    <div
      className="relative flex min-h-0 min-w-0 flex-1 flex-col border-r border-[#2d2d2d] bg-[#141414]"
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-[#2d2d2d] px-4">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold text-white">预览</h2>
          <p className="truncate text-xs text-gray-500">
            {videos.length === 0
              ? '拖入视频或点击添加'
              : `${selectedCount} 项已选 · 共 ${videos.length} 个文件`}
          </p>
        </div>
        <button
          type="button"
          onClick={onAddVideos}
          className="flex shrink-0 items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500"
        >
          <UploadCloud className="h-4 w-4" />
          添加视频
        </button>
      </div>

      <div
        className={`flex min-h-0 flex-1 flex-col items-center justify-center p-6 ${
          dragOver ? 'bg-blue-500/5 ring-2 ring-inset ring-blue-500/40' : ''
        }`}
      >
        {!previewVideo ? (
          <div className="flex max-w-md flex-col items-center text-center text-gray-500">
            <FileVideo className="mb-4 h-16 w-16 opacity-40" />
            <p className="text-sm">选择左侧列表中的视频，或拖放文件到此处</p>
          </div>
        ) : (
          <div className="flex h-full w-full max-w-4xl flex-col gap-4">
            <video
              ref={videoRef}
              key={previewVideo.path}
              src={src}
              controls
              className="max-h-[min(60vh,520px)] w-full rounded-lg bg-black object-contain"
            />
            {showTimeline && timelineMode ? (
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
            ) : null}
            <div className="grid grid-cols-2 gap-2 text-xs text-gray-400 sm:grid-cols-4">
              <div>
                <span className="text-gray-600">时长</span>
                <p className="text-gray-300">{formatDuration(previewVideo.durationSec)}</p>
              </div>
              <div>
                <span className="text-gray-600">分辨率</span>
                <p className="text-gray-300">
                  {previewVideo.width && previewVideo.height
                    ? `${previewVideo.width}×${previewVideo.height}`
                    : '—'}
                </p>
              </div>
              <div>
                <span className="text-gray-600">大小</span>
                <p className="text-gray-300">{formatSize(previewVideo.size)}</p>
              </div>
              <div>
                <span className="text-gray-600">路径</span>
                <p className="truncate text-gray-300" title={previewVideo.path}>
                  {previewVideo.name}
                </p>
              </div>
              <div>
                <span className="text-gray-600">封装</span>
                <p className="truncate text-gray-300" title={previewVideo.formatName}>
                  {previewVideo.formatName ?? '—'}
                </p>
              </div>
              <div>
                <span className="text-gray-600">编码</span>
                <p
                  className="truncate text-gray-300"
                  title={`${previewVideo.videoCodec ?? '—'} / ${previewVideo.audioCodec ?? '—'}`}
                >
                  {(previewVideo.videoCodec ?? '—') + ' / ' + (previewVideo.audioCodec ?? '—')}
                </p>
              </div>
              <div>
                <span className="text-gray-600">码率</span>
                <p className="text-gray-300">{formatBitrate(previewVideo.bitRateBps)}</p>
              </div>
              <div>
                <span className="text-gray-600">视频/音频码率</span>
                <p className="text-gray-300">
                  {formatBitrate(previewVideo.videoBitRateBps)} /{' '}
                  {formatBitrate(previewVideo.audioBitRateBps)}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
