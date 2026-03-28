import React, { useCallback } from 'react'
import { UploadCloud, X, FileImage } from 'lucide-react'

export interface ImageFile {
  path: string
  name: string
  size: number
  width?: number
  height?: number
  /** e.g. jpeg, png from sharp metadata */
  format?: string
  status: 'pending' | 'processing' | 'done' | 'error'
  previewUrl?: string
}

interface ImageGridProps {
  images: ImageFile[]
  onAddImages: () => void
  onRemoveImage: (path: string) => void
  onDropPaths: (paths: string[]) => void
}

const IMAGE_EXT = /\.(jpe?g|png|webp|avif)$/i

function formatFormatLabel(format?: string): string {
  if (!format) return ''
  const f = format.toLowerCase()
  if (f === 'jpeg' || f === 'jpg') return 'JPEG'
  return f.toUpperCase()
}

export function ImageGrid({ images, onAddImages, onRemoveImage, onDropPaths }: ImageGridProps) {
  const formatSize = (bytes: number) => {
    if (bytes <= 0) return '—'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
  }

  const collectPathsFromDataTransfer = useCallback((dt: DataTransfer): string[] => {
    const paths: string[] = []
    const files = Array.from(dt.files)
    for (const file of files) {
      try {
        const p = window.picafluxAPI.getPathForFile(file)
        if (p && IMAGE_EXT.test(p)) paths.push(p)
      } catch {
        // ignore invalid file
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
      if (paths.length > 0) {
        onDropPaths(paths)
      }
    },
    [collectPathsFromDataTransfer, onDropPaths]
  )

  return (
    <div
      className="flex-1 flex flex-col bg-[#121212] min-h-0"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <div className="h-14 border-b border-[#2d2d2d] flex items-center justify-between px-6 shrink-0">
        <h1 className="text-lg font-semibold text-white">Image Processing</h1>
        <button
          type="button"
          onClick={onAddImages}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded-md text-sm font-medium transition-colors"
        >
          Add Images
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 min-h-0">
        {images.length === 0 ? (
          <div
            className="h-full min-h-[280px] flex flex-col items-center justify-center text-gray-500 border-2 border-dashed border-[#2d2d2d] rounded-xl bg-[#1a1a1a]"
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          >
            <UploadCloud className="w-12 h-12 mb-4 text-gray-600" />
            <p className="text-lg font-medium text-gray-300 mb-1">Drag & drop images here</p>
            <p className="text-sm">or click &quot;Add Images&quot; to browse</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {images.map((img) => {
              const dim =
                img.width != null && img.height != null
                  ? `${img.width}×${img.height}`
                  : '—'
              const fmt = formatFormatLabel(img.format) || '—'
              return (
                <div
                  key={img.path}
                  className="group relative bg-[#1e1e1e] rounded-lg border border-[#2d2d2d] overflow-hidden flex flex-col"
                >
                  <div className="aspect-square bg-[#121212] flex items-center justify-center relative">
                    {img.previewUrl ? (
                      <img
                        src={img.previewUrl}
                        alt={img.name}
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <FileImage className="w-10 h-10 text-gray-600" />
                    )}

                    {img.status !== 'pending' && (
                      <div className="absolute inset-0 pointer-events-none flex items-center justify-center bg-black/60 backdrop-blur-sm">
                        <span
                          className={`pointer-events-none px-3 py-1 rounded-full text-xs font-medium ${
                            img.status === 'processing'
                              ? 'bg-blue-500/20 text-blue-400'
                              : img.status === 'done'
                                ? 'bg-green-500/20 text-green-400'
                                : 'bg-red-500/20 text-red-400'
                          }`}
                        >
                          {img.status.charAt(0).toUpperCase() + img.status.slice(1)}
                        </span>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        onRemoveImage(img.path)
                      }}
                      className={`absolute top-2 right-2 z-20 p-1.5 bg-black/50 hover:bg-red-500/80 text-white rounded-md pointer-events-auto transition-opacity ${
                        img.status === 'done' || img.status === 'error'
                          ? 'opacity-100'
                          : 'opacity-0 group-hover:opacity-100'
                      }`}
                      aria-label="Remove image"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="p-3">
                    <div className="text-sm text-gray-200 truncate" title={img.name}>
                      {img.name}
                    </div>
                    <div className="text-xs text-gray-500 mt-1 space-y-0.5">
                      <div>
                        {dim} · {fmt} · {formatSize(img.size)}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
