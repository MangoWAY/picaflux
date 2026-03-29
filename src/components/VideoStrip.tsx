import React, { useCallback, useLayoutEffect, useRef } from 'react'
import { LayoutGrid, List, X, FileVideo } from 'lucide-react'
import clsx from 'clsx'

export interface VideoFile {
  path: string
  name: string
  size: number
  durationSec?: number
  width?: number
  height?: number
  status: 'pending' | 'processing' | 'done' | 'error'
  previewUrl?: string
}

export type VideoStripListMode = 'thumbnail' | 'name'

interface VideoStripProps {
  videos: VideoFile[]
  listMode: VideoStripListMode
  onListModeChange: (mode: VideoStripListMode) => void
  checkedPaths: ReadonlySet<string>
  onTogglePath: (path: string, checked: boolean) => void
  onSelectAll: () => void
  onClearSelection: () => void
  previewPath: string | null
  onPreviewPath: (path: string) => void
  onRemoveVideo: (path: string) => void
}

function statusLabel(status: VideoFile['status']): string {
  return status.charAt(0).toUpperCase() + status.slice(1)
}

function formatDuration(sec?: number): string {
  if (sec == null || !Number.isFinite(sec) || sec < 0) return '—'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

export function VideoStrip({
  videos,
  listMode,
  onListModeChange,
  checkedPaths,
  onTogglePath,
  onSelectAll,
  onClearSelection,
  previewPath,
  onPreviewPath,
  onRemoveVideo,
}: VideoStripProps) {
  const selectAllRef = useRef<HTMLInputElement>(null)

  const allChecked = videos.length > 0 && videos.every((v) => checkedPaths.has(v.path))
  const someChecked = videos.some((v) => checkedPaths.has(v.path))

  useLayoutEffect(() => {
    const el = selectAllRef.current
    if (el) el.indeterminate = someChecked && !allChecked
  }, [someChecked, allChecked])

  const handleSelectAllChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.checked) onSelectAll()
      else onClearSelection()
    },
    [onSelectAll, onClearSelection],
  )

  return (
    <div className="flex h-full min-h-0 w-[220px] shrink-0 flex-col border-r border-[#2d2d2d] bg-[#181818]">
      <div className="flex h-14 shrink-0 items-center gap-2 border-b border-[#2d2d2d] px-3">
        <label
          className="flex cursor-pointer items-center gap-2 text-xs text-gray-400"
          title="全选 / 取消全选（用于批量处理）"
        >
          <input
            ref={selectAllRef}
            type="checkbox"
            checked={allChecked}
            onChange={handleSelectAllChange}
            disabled={videos.length === 0}
            className="rounded border-[#3d3d3d] bg-[#121212] text-blue-500 focus:ring-blue-500 focus:ring-offset-0"
          />
          <span className="hidden sm:inline">全选</span>
        </label>
        <div className="ml-auto flex rounded-md border border-[#2d2d2d] bg-[#121212] p-0.5">
          <button
            type="button"
            aria-label="缩略图列表"
            title="缩略图"
            onClick={() => onListModeChange('thumbnail')}
            className={clsx(
              'rounded p-1.5 transition-colors',
              listMode === 'thumbnail'
                ? 'bg-[#2d2d2d] text-white'
                : 'text-gray-500 hover:text-gray-300',
            )}
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="名称列表"
            title="仅名称"
            onClick={() => onListModeChange('name')}
            className={clsx(
              'rounded p-1.5 transition-colors',
              listMode === 'name' ? 'bg-[#2d2d2d] text-white' : 'text-gray-500 hover:text-gray-300',
            )}
          >
            <List className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {videos.length === 0 ? (
          <p className="px-1 pt-2 text-center text-xs text-gray-600">暂无视频</p>
        ) : listMode === 'thumbnail' ? (
          <ul className="flex flex-col gap-2">
            {videos.map((v) => {
              const isPreview = v.path === previewPath
              const isChecked = checkedPaths.has(v.path)
              return (
                <li key={v.path}>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => onPreviewPath(v.path)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        onPreviewPath(v.path)
                      }
                    }}
                    className={clsx(
                      'group relative cursor-pointer rounded-lg border p-2 transition-colors',
                      isPreview
                        ? 'border-blue-500/60 bg-blue-500/10'
                        : 'border-[#2d2d2d] bg-[#1e1e1e] hover:border-[#3d3d3d]',
                    )}
                  >
                    <div className="flex gap-2">
                      <label
                        className="flex shrink-0 cursor-pointer items-start pt-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => onTogglePath(v.path, e.target.checked)}
                          className="rounded border-[#3d3d3d] bg-[#121212] text-blue-500 focus:ring-blue-500 focus:ring-offset-0"
                        />
                      </label>
                      <div className="relative min-w-0 flex-1">
                        <div className="relative aspect-video overflow-hidden rounded-md bg-[#121212]">
                          <div className="flex h-full items-center justify-center">
                            <FileVideo className="h-10 w-10 text-gray-600" />
                          </div>
                          {v.status !== 'pending' && (
                            <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/50">
                              <span
                                className={clsx(
                                  'rounded-full px-2 py-0.5 text-[10px] font-medium',
                                  v.status === 'processing' && 'bg-blue-500/30 text-blue-200',
                                  v.status === 'done' && 'bg-green-500/30 text-green-200',
                                  v.status === 'error' && 'bg-red-500/30 text-red-200',
                                )}
                              >
                                {statusLabel(v.status)}
                              </span>
                            </div>
                          )}
                        </div>
                        <p
                          className="mt-1 truncate text-center text-[11px] text-gray-400"
                          title={v.name}
                        >
                          {v.name}
                        </p>
                        <p className="text-center text-[10px] text-gray-600">
                          {formatDuration(v.durationSec)}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        onRemoveVideo(v.path)
                      }}
                      className="absolute right-1 top-1 z-10 rounded-md bg-black/60 p-1 text-white opacity-0 transition-opacity hover:bg-red-500/80 group-hover:opacity-100"
                      aria-label="移除"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        ) : (
          <ul className="flex flex-col gap-0.5">
            {videos.map((v) => {
              const isPreview = v.path === previewPath
              const isChecked = checkedPaths.has(v.path)
              return (
                <li key={v.path}>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => onPreviewPath(v.path)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        onPreviewPath(v.path)
                      }
                    }}
                    className={clsx(
                      'group flex cursor-pointer items-center gap-2 rounded-md border px-2 py-2 text-left text-sm transition-colors',
                      isPreview
                        ? 'border-blue-500/60 bg-blue-500/10'
                        : 'border-transparent hover:bg-[#252525]',
                    )}
                  >
                    <label
                      className="flex shrink-0 cursor-pointer items-center"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => onTogglePath(v.path, e.target.checked)}
                        className="rounded border-[#3d3d3d] bg-[#121212] text-blue-500 focus:ring-blue-500 focus:ring-offset-0"
                      />
                    </label>
                    <span className="min-w-0 flex-1 truncate text-gray-200" title={v.name}>
                      {v.name}
                    </span>
                    <span className="shrink-0 text-[10px] text-gray-500">
                      {formatDuration(v.durationSec)}
                    </span>
                    <span
                      className={clsx(
                        'shrink-0 text-[10px] font-medium uppercase',
                        v.status === 'pending' && 'text-gray-600',
                        v.status === 'processing' && 'text-blue-400',
                        v.status === 'done' && 'text-green-400',
                        v.status === 'error' && 'text-red-400',
                      )}
                    >
                      {v.status === 'pending' ? '·' : statusLabel(v.status).slice(0, 1)}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        onRemoveVideo(v.path)
                      }}
                      className="shrink-0 rounded p-1 text-gray-500 opacity-0 hover:bg-red-500/20 hover:text-red-300 group-hover:opacity-100"
                      aria-label="移除"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
