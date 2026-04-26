import React, { useCallback, useLayoutEffect, useRef } from 'react'
import { LayoutGrid, List, X, Box } from 'lucide-react'
import clsx from 'clsx'

export interface Model3dFile {
  path: string
  name: string
  size: number
  meshCount?: number
  materialCount?: number
  textureCount?: number
  animationCount?: number
  status: 'pending' | 'processing' | 'done' | 'error'
}

export type ThreeStripListMode = 'thumbnail' | 'name'

interface ThreeStripProps {
  models: Model3dFile[]
  listMode: ThreeStripListMode
  onListModeChange: (mode: ThreeStripListMode) => void
  checkedPaths: ReadonlySet<string>
  onTogglePath: (path: string, checked: boolean) => void
  onSelectAll: () => void
  onClearSelection: () => void
  previewPath: string | null
  onPreviewPath: (path: string) => void
  onRemoveModel: (path: string) => void
}

function statusLabel(status: Model3dFile['status']): string {
  return status.charAt(0).toUpperCase() + status.slice(1)
}

function metaLine(m: Model3dFile): string {
  if (m.meshCount == null && m.materialCount == null) return '—'
  const parts: string[] = []
  if (m.meshCount != null) parts.push(`M:${m.meshCount}`)
  if (m.materialCount != null) parts.push(`Mat:${m.materialCount}`)
  return parts.join(' ')
}

export function ThreeStrip({
  models,
  listMode,
  onListModeChange,
  checkedPaths,
  onTogglePath,
  onSelectAll,
  onClearSelection,
  previewPath,
  onPreviewPath,
  onRemoveModel,
}: ThreeStripProps) {
  const selectAllRef = useRef<HTMLInputElement>(null)

  const allChecked = models.length > 0 && models.every((m) => checkedPaths.has(m.path))
  const someChecked = models.some((m) => checkedPaths.has(m.path))

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
    <div className="flex h-full min-h-0 w-[11.5rem] shrink-0 flex-col border-r border-[#2d2d2d] bg-[#181818]">
      <div className="flex h-12 shrink-0 items-center gap-2 border-b border-[#2d2d2d] px-2">
        <label
          className="flex cursor-pointer items-center gap-2 text-xs text-gray-400"
          title="全选 / 取消全选（用于批量处理）"
        >
          <input
            ref={selectAllRef}
            type="checkbox"
            checked={allChecked}
            onChange={handleSelectAllChange}
            disabled={models.length === 0}
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

      <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
        {models.length === 0 ? (
          <p className="px-1 pt-2 text-center text-xs text-gray-600">暂无 3D 文件</p>
        ) : listMode === 'thumbnail' ? (
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {models.map((m) => {
              const isPreview = m.path === previewPath
              const isChecked = checkedPaths.has(m.path)
              return (
                <li key={m.path} className="list-none">
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => onPreviewPath(m.path)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        onPreviewPath(m.path)
                      }
                    }}
                    className={clsx(
                      'group relative cursor-pointer rounded-lg border p-1.5 transition-colors',
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
                          onChange={(e) => onTogglePath(m.path, e.target.checked)}
                          className="rounded border-[#3d3d3d] bg-[#121212] text-blue-500 focus:ring-blue-500 focus:ring-offset-0"
                        />
                      </label>
                      <div className="relative min-w-0 flex-1">
                        <div className="relative flex aspect-square items-center justify-center overflow-hidden rounded-md bg-[#121212]">
                          <Box className="h-10 w-10 text-gray-600" />
                          {m.status !== 'pending' && (
                            <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/50">
                              <span
                                className={clsx(
                                  'rounded-full px-2 py-0.5 text-[10px] font-medium',
                                  m.status === 'processing' && 'bg-blue-500/30 text-blue-200',
                                  m.status === 'done' && 'bg-green-500/30 text-green-200',
                                  m.status === 'error' && 'bg-red-500/30 text-red-200',
                                )}
                              >
                                {statusLabel(m.status)}
                              </span>
                            </div>
                          )}
                        </div>
                        <p
                          className="mt-1 truncate text-center text-[11px] text-gray-400"
                          title={m.name}
                        >
                          {m.name}
                        </p>
                        <p className="text-center text-[10px] text-gray-600">{metaLine(m)}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        onRemoveModel(m.path)
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
          <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
            {models.map((m) => {
              const isPreview = m.path === previewPath
              const isChecked = checkedPaths.has(m.path)
              return (
                <li key={m.path} className="list-none">
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => onPreviewPath(m.path)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        onPreviewPath(m.path)
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
                        onChange={(e) => onTogglePath(m.path, e.target.checked)}
                        className="rounded border-[#3d3d3d] bg-[#121212] text-blue-500 focus:ring-blue-500 focus:ring-offset-0"
                      />
                    </label>
                    <span className="min-w-0 flex-1 truncate text-gray-200" title={m.name}>
                      {m.name}
                    </span>
                    <span
                      className={clsx(
                        'shrink-0 text-[10px] font-medium uppercase',
                        m.status === 'pending' && 'text-gray-600',
                        m.status === 'processing' && 'text-blue-400',
                        m.status === 'done' && 'text-green-400',
                        m.status === 'error' && 'text-red-400',
                      )}
                    >
                      {m.status === 'pending' ? '' : statusLabel(m.status).slice(0, 1)}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        onRemoveModel(m.path)
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
