import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { Sidebar } from './Sidebar'
import { ImageStrip, ImageFile, type ImageStripListMode } from './ImageStrip'
import { ImagePreviewPane } from './ImagePreviewPane'
import { SettingsPanel, ProcessOptions } from './SettingsPanel'
import { AppSettingsPage, BACKGROUND_REMOVAL_BACKEND_STORAGE_KEY } from './AppSettingsPage'
import { FIXED_WATERMARK_DEFAULTS } from '@/constants/fixedWatermark'

const IMAGE_EXT = /\.(jpe?g|png|webp|avif)$/i

async function buildImageEntries(paths: string[]): Promise<ImageFile[]> {
  const filtered = paths.filter((p) => IMAGE_EXT.test(p))
  const entries = await Promise.all(
    filtered.map(async (filePath) => {
      const name = filePath.split(/[/\\]/).pop() || 'unknown'
      const info = await window.picafluxAPI.getImageFileInfo(filePath)
      return {
        path: filePath,
        name,
        size: info?.size ?? 0,
        width: info?.width,
        height: info?.height,
        format: info?.format,
        status: 'pending' as const,
        previewUrl: `file://${filePath}`,
      }
    }),
  )
  return entries
}

function readStoredBackgroundRemovalBackendId(): string {
  try {
    return window.localStorage.getItem(BACKGROUND_REMOVAL_BACKEND_STORAGE_KEY) || 'imgly'
  } catch {
    return 'imgly'
  }
}

export function ImageWorkbench() {
  const [activeTab, setActiveTab] = useState('image')
  const [images, setImages] = useState<ImageFile[]>([])
  const [stripListMode, setStripListMode] = useState<ImageStripListMode>('thumbnail')
  const [checkedPaths, setCheckedPaths] = useState<Set<string>>(() => new Set())
  const [previewPath, setPreviewPath] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [backgroundRemovalBackendId, setBackgroundRemovalBackendId] = useState(
    readStoredBackgroundRemovalBackendId,
  )
  const [options, setOptions] = useState<ProcessOptions>({
    format: 'original',
    width: '',
    height: '',
    keepAspectRatio: true,
    quality: 80,
    outputDir: '',
    removeBackground: false,
    clearFixedWatermark: false,
    watermarkLeftPct: FIXED_WATERMARK_DEFAULTS.leftPercent,
    watermarkTopPct: FIXED_WATERMARK_DEFAULTS.topPercent,
    watermarkWidthPct: FIXED_WATERMARK_DEFAULTS.widthPercent,
    watermarkHeightPct: FIXED_WATERMARK_DEFAULTS.heightPercent,
  })

  const imagePathsKey = useMemo(() => images.map((i) => i.path).join('\n'), [images])
  const imagesRef = useRef(images)
  imagesRef.current = images

  useEffect(() => {
    const list = imagesRef.current
    setPreviewPath((prev) => {
      if (list.length === 0) return null
      if (prev && list.some((i) => i.path === prev)) return prev
      return list[0].path
    })
  }, [imagePathsKey])

  useEffect(() => {
    const valid = new Set(imagesRef.current.map((i) => i.path))
    setCheckedPaths((prev) => {
      const next = new Set<string>()
      for (const p of prev) {
        if (valid.has(p)) next.add(p)
      }
      return next
    })
  }, [imagePathsKey])

  const mergeNewImages = useCallback((newEntries: ImageFile[]) => {
    setImages((prev) => {
      const existingPaths = new Set(prev.map((i) => i.path))
      const uniqueNew = newEntries.filter((i) => !existingPaths.has(i.path))
      return uniqueNew.length ? [...prev, ...uniqueNew] : prev
    })
    setCheckedPaths((prev) => {
      const n = new Set(prev)
      for (const e of newEntries) {
        n.add(e.path)
      }
      return n
    })
  }, [])

  const handleAddImages = async () => {
    try {
      const filePaths = await window.picafluxAPI.openFiles()
      if (filePaths && filePaths.length > 0) {
        const entries = await buildImageEntries(filePaths)
        mergeNewImages(entries)
      }
    } catch (error) {
      console.error('Failed to open files:', error)
    }
  }

  const handleDropPaths = useCallback(
    async (paths: string[]) => {
      if (paths.length === 0) return
      const entries = await buildImageEntries(paths)
      mergeNewImages(entries)
    },
    [mergeNewImages],
  )

  const handleRemoveImage = (path: string) => {
    setImages((prev) => prev.filter((img) => img.path !== path))
    setCheckedPaths((prev) => {
      const n = new Set(prev)
      n.delete(path)
      return n
    })
    setPreviewPath((prev) => (prev === path ? null : prev))
  }

  const handleTogglePath = useCallback((path: string, checked: boolean) => {
    setCheckedPaths((prev) => {
      const n = new Set(prev)
      if (checked) n.add(path)
      else n.delete(path)
      return n
    })
  }, [])

  const handleSelectAllForProcess = useCallback(() => {
    setCheckedPaths(new Set(images.map((i) => i.path)))
  }, [images])

  const handleClearProcessSelection = useCallback(() => {
    setCheckedPaths(new Set())
  }, [])

  const handleSelectOutputDir = async () => {
    try {
      const dir = await window.picafluxAPI.openDirectory()
      if (dir) {
        setOptions((prev) => ({ ...prev, outputDir: dir }))
      }
    } catch (error) {
      console.error('Failed to select directory:', error)
    }
  }

  const handleStartProcessing = async () => {
    const batch = images.filter((img) => checkedPaths.has(img.path))
    if (batch.length === 0 || !options.outputDir) return

    setIsProcessing(true)
    setImages((prev) =>
      prev.map((img) =>
        checkedPaths.has(img.path) ? { ...img, status: 'processing' as const } : img,
      ),
    )

    let removalBackendId: string | undefined
    if (options.removeBackground) {
      try {
        const backends = await window.picafluxAPI.listBackgroundRemovalBackends()
        removalBackendId = backends.some((b) => b.id === backgroundRemovalBackendId)
          ? backgroundRemovalBackendId
          : (backends[0]?.id ?? 'imgly')
      } catch {
        removalBackendId = backgroundRemovalBackendId || 'imgly'
      }
    }

    const parseWatermarkPct = (s: string, fallback: number) => {
      const n = parseFloat(s)
      if (!Number.isFinite(n)) return fallback
      return Math.min(100, Math.max(0, n))
    }
    const wmDefaults = {
      left: parseFloat(FIXED_WATERMARK_DEFAULTS.leftPercent),
      top: parseFloat(FIXED_WATERMARK_DEFAULTS.topPercent),
      width: parseFloat(FIXED_WATERMARK_DEFAULTS.widthPercent),
      height: parseFloat(FIXED_WATERMARK_DEFAULTS.heightPercent),
    }

    const processOpts = {
      format: options.format,
      quality: options.quality,
      width: options.width ? parseInt(options.width, 10) : undefined,
      height: options.height ? parseInt(options.height, 10) : undefined,
      removeBackground: options.removeBackground,
      backgroundRemovalBackendId: removalBackendId,
      clearFixedWatermark: options.clearFixedWatermark,
      fixedWatermarkRegion: options.clearFixedWatermark
        ? {
            leftPercent: parseWatermarkPct(options.watermarkLeftPct, wmDefaults.left),
            topPercent: parseWatermarkPct(options.watermarkTopPct, wmDefaults.top),
            widthPercent: Math.max(
              0.5,
              parseWatermarkPct(options.watermarkWidthPct, wmDefaults.width),
            ),
            heightPercent: Math.max(
              0.5,
              parseWatermarkPct(options.watermarkHeightPct, wmDefaults.height),
            ),
          }
        : undefined,
    }

    for (const img of batch) {
      try {
        const result = await window.picafluxAPI.processImage(
          img.path,
          options.outputDir,
          processOpts,
        )

        setImages((prev) =>
          prev.map((p) =>
            p.path === img.path ? { ...p, status: result.success ? 'done' : 'error' } : p,
          ),
        )
      } catch {
        setImages((prev) =>
          prev.map((p) => (p.path === img.path ? { ...p, status: 'error' as const } : p)),
        )
      }
    }

    setIsProcessing(false)
  }

  const previewImage = previewPath ? (images.find((i) => i.path === previewPath) ?? null) : null
  const selectedCount = checkedPaths.size
  const isMac = window.picafluxAPI.platform === 'darwin'

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-[#121212]">
      {isMac ? (
        <div
          className="h-7 shrink-0 border-b border-[#2d2d2d] bg-[#121212]"
          style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
        />
      ) : null}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />

        {activeTab === 'settings' ? (
          <AppSettingsPage
            backgroundRemovalBackendId={backgroundRemovalBackendId}
            onBackgroundRemovalBackendIdChange={(id) => {
              setBackgroundRemovalBackendId(id)
              try {
                window.localStorage.setItem(BACKGROUND_REMOVAL_BACKEND_STORAGE_KEY, id)
              } catch {
                /* ignore */
              }
            }}
          />
        ) : activeTab === 'image' ? (
          <>
            <ImageStrip
              images={images}
              listMode={stripListMode}
              onListModeChange={setStripListMode}
              checkedPaths={checkedPaths}
              onTogglePath={handleTogglePath}
              onSelectAll={handleSelectAllForProcess}
              onClearSelection={handleClearProcessSelection}
              previewPath={previewPath}
              onPreviewPath={setPreviewPath}
              onRemoveImage={handleRemoveImage}
            />
            <ImagePreviewPane
              images={images}
              previewImage={previewImage}
              selectedCount={selectedCount}
              onAddImages={handleAddImages}
              onDropPaths={handleDropPaths}
            />
            <SettingsPanel
              options={options}
              onChange={setOptions}
              onSelectOutputDir={handleSelectOutputDir}
              onStartProcessing={handleStartProcessing}
              isProcessing={isProcessing}
              selectedForProcessCount={selectedCount}
              totalImageCount={images.length}
            />
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center text-gray-500">
            <p className="text-lg">Module &quot;{activeTab}&quot; is under construction.</p>
          </div>
        )}
      </div>
    </div>
  )
}
