import React, { useCallback } from 'react'
import { UploadCloud, FileImage } from 'lucide-react'
import type { ImageFile } from './ImageStrip'

const IMAGE_EXT = /\.(jpe?g|png|webp|avif)$/i

interface ImagePreviewPaneProps {
  images: ImageFile[]
  previewImage: ImageFile | null
  selectedCount: number
  onAddImages: () => void
  onDropPaths: (paths: string[]) => void
}

function formatFormatLabel(format?: string): string {
  if (!format) return ''
  const f = format.toLowerCase()
  if (f === 'jpeg' || f === 'jpg') return 'JPEG'
  return f.toUpperCase()
}

function formatSize(bytes: number): string {
  if (bytes <= 0) return '—'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
}

export function ImagePreviewPane({
  images,
  previewImage,
  selectedCount,
  onAddImages,
  onDropPaths,
}: ImagePreviewPaneProps) {
  const collectPathsFromDataTransfer = useCallback((dt: DataTransfer): string[] => {
    const paths: string[] = []
    const files = Array.from(dt.files)
    for (const file of files) {
      try {
        const p = window.picafluxAPI.getPathForFile(file)
        if (p && IMAGE_EXT.test(p)) paths.push(p)
      } catch {
        // ignore
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

  const dim =
    previewImage?.width != null && previewImage?.height != null
      ? `${previewImage.width}×${previewImage.height}`
      : '—'
  const fmt = formatFormatLabel(previewImage?.format) || '—'

  return (
    <div
      className="flex min-h-0 min-w-0 flex-1 flex-col bg-[#121212]"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-[#2d2d2d] px-6">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold text-white">Image Processing</h1>
          {images.length > 0 && (
            <p className="truncate text-xs text-gray-500">
              已选 {selectedCount} / {images.length} 张将使用右侧参数处理
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onAddImages}
          className="shrink-0 rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
        >
          Add Images
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden p-6">
        {images.length === 0 ? (
          <div
            className="flex h-full min-h-[280px] flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#2d2d2d] bg-[#1a1a1a] text-gray-500"
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          >
            <UploadCloud className="mb-4 h-12 w-12 text-gray-600" />
            <p className="mb-1 text-lg font-medium text-gray-300">拖放图片到此处</p>
            <p className="text-sm">或点击右上角「Add Images」</p>
          </div>
        ) : previewImage ? (
          <div className="flex h-full min-h-0 flex-col gap-4">
            <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-[#2d2d2d] bg-[#1a1a1a]">
              <div className="flex h-full items-center justify-center p-4">
                {previewImage.previewUrl ? (
                  <img
                    src={previewImage.previewUrl}
                    alt={previewImage.name}
                    className="max-h-full max-w-full object-contain"
                  />
                ) : (
                  <FileImage className="h-24 w-24 text-gray-600" />
                )}
              </div>
            </div>
            <div className="shrink-0 space-y-1 text-sm text-gray-400">
              <p className="truncate font-medium text-gray-200" title={previewImage.name}>
                {previewImage.name}
              </p>
              <p className="text-xs text-gray-500">
                {dim} · {fmt} · {formatSize(previewImage.size)}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex h-full items-center justify-center text-gray-500">
            在左侧选择一张图片预览
          </div>
        )}
      </div>
    </div>
  )
}
