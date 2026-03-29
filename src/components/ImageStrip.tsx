import React, { useCallback, useLayoutEffect, useRef } from 'react'
import { LayoutGrid, List, X, FileImage } from 'lucide-react'
import clsx from 'clsx'

export interface ImageFile {
  path: string
  name: string
  size: number
  width?: number
  height?: number
  format?: string
  status: 'pending' | 'processing' | 'done' | 'error'
  previewUrl?: string
}

export type ImageStripListMode = 'thumbnail' | 'name'

interface ImageStripProps {
  images: ImageFile[]
  listMode: ImageStripListMode
  onListModeChange: (mode: ImageStripListMode) => void
  checkedPaths: ReadonlySet<string>
  onTogglePath: (path: string, checked: boolean) => void
  onSelectAll: () => void
  onClearSelection: () => void
  previewPath: string | null
  onPreviewPath: (path: string) => void
  onRemoveImage: (path: string) => void
}

function statusLabel(status: ImageFile['status']): string {
  return status.charAt(0).toUpperCase() + status.slice(1)
}

export function ImageStrip({
  images,
  listMode,
  onListModeChange,
  checkedPaths,
  onTogglePath,
  onSelectAll,
  onClearSelection,
  previewPath,
  onPreviewPath,
  onRemoveImage,
}: ImageStripProps) {
  const selectAllRef = useRef<HTMLInputElement>(null)

  const allChecked = images.length > 0 && images.every((img) => checkedPaths.has(img.path))
  const someChecked = images.some((img) => checkedPaths.has(img.path))

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
    <div className="flex h-full w-[220px] shrink-0 flex-col border-r border-[#2d2d2d] bg-[#181818]">
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
            disabled={images.length === 0}
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
        {images.length === 0 ? (
          <p className="px-1 pt-2 text-center text-xs text-gray-600">暂无图片</p>
        ) : listMode === 'thumbnail' ? (
          <ul className="flex flex-col gap-2">
            {images.map((img) => {
              const isPreview = img.path === previewPath
              const isChecked = checkedPaths.has(img.path)
              return (
                <li key={img.path}>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => onPreviewPath(img.path)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        onPreviewPath(img.path)
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
                          onChange={(e) => onTogglePath(img.path, e.target.checked)}
                          className="rounded border-[#3d3d3d] bg-[#121212] text-blue-500 focus:ring-blue-500 focus:ring-offset-0"
                        />
                      </label>
                      <div className="relative min-w-0 flex-1">
                        <div className="relative aspect-square overflow-hidden rounded-md bg-[#121212]">
                          {img.previewUrl ? (
                            <img
                              src={img.previewUrl}
                              alt=""
                              className="h-full w-full object-contain"
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center">
                              <FileImage className="h-8 w-8 text-gray-600" />
                            </div>
                          )}
                          {img.status !== 'pending' && (
                            <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/50">
                              <span
                                className={clsx(
                                  'rounded-full px-2 py-0.5 text-[10px] font-medium',
                                  img.status === 'processing' && 'bg-blue-500/30 text-blue-200',
                                  img.status === 'done' && 'bg-green-500/30 text-green-200',
                                  img.status === 'error' && 'bg-red-500/30 text-red-200',
                                )}
                              >
                                {statusLabel(img.status)}
                              </span>
                            </div>
                          )}
                        </div>
                        <p
                          className="mt-1 truncate text-center text-[11px] text-gray-400"
                          title={img.name}
                        >
                          {img.name}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        onRemoveImage(img.path)
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
            {images.map((img) => {
              const isPreview = img.path === previewPath
              const isChecked = checkedPaths.has(img.path)
              return (
                <li key={img.path}>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => onPreviewPath(img.path)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        onPreviewPath(img.path)
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
                        onChange={(e) => onTogglePath(img.path, e.target.checked)}
                        className="rounded border-[#3d3d3d] bg-[#121212] text-blue-500 focus:ring-blue-500 focus:ring-offset-0"
                      />
                    </label>
                    <span className="min-w-0 flex-1 truncate text-gray-200" title={img.name}>
                      {img.name}
                    </span>
                    <span
                      className={clsx(
                        'shrink-0 text-[10px] font-medium uppercase',
                        img.status === 'pending' && 'text-gray-600',
                        img.status === 'processing' && 'text-blue-400',
                        img.status === 'done' && 'text-green-400',
                        img.status === 'error' && 'text-red-400',
                      )}
                    >
                      {img.status === 'pending' ? '·' : statusLabel(img.status).slice(0, 1)}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        onRemoveImage(img.path)
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
