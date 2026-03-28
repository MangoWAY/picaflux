import React, { useState, useCallback } from 'react'
import { Sidebar } from './Sidebar'
import { ImageGrid, ImageFile } from './ImageGrid'
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
    })
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
  const [isProcessing, setIsProcessing] = useState(false)
  const [backgroundRemovalBackendId, setBackgroundRemovalBackendId] = useState(
    readStoredBackgroundRemovalBackendId
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

  const mergeNewImages = useCallback((newEntries: ImageFile[]) => {
    setImages((prev) => {
      const existingPaths = new Set(prev.map((i) => i.path))
      const uniqueNew = newEntries.filter((i) => !existingPaths.has(i.path))
      return [...prev, ...uniqueNew]
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
    [mergeNewImages]
  )

  const handleRemoveImage = (path: string) => {
    setImages((prev) => prev.filter((img) => img.path !== path))
  }

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
    if (images.length === 0 || !options.outputDir) return

    const batch = images
    setIsProcessing(true)
    setImages((prev) => prev.map((img) => ({ ...img, status: 'processing' as const })))

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
              parseWatermarkPct(options.watermarkWidthPct, wmDefaults.width)
            ),
            heightPercent: Math.max(
              0.5,
              parseWatermarkPct(options.watermarkHeightPct, wmDefaults.height)
            ),
          }
        : undefined,
    }

    for (const img of batch) {
      try {
        const result = await window.picafluxAPI.processImage(
          img.path,
          options.outputDir,
          processOpts
        )

        setImages((prev) =>
          prev.map((p) =>
            p.path === img.path ? { ...p, status: result.success ? 'done' : 'error' } : p
          )
        )
      } catch {
        setImages((prev) =>
          prev.map((p) => (p.path === img.path ? { ...p, status: 'error' as const } : p))
        )
      }
    }

    setIsProcessing(false)
  }

  return (
    <div className="flex h-screen w-screen bg-[#121212] overflow-hidden">
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
          <ImageGrid
            images={images}
            onAddImages={handleAddImages}
            onRemoveImage={handleRemoveImage}
            onDropPaths={handleDropPaths}
          />
          <SettingsPanel
            options={options}
            onChange={setOptions}
            onSelectOutputDir={handleSelectOutputDir}
            onStartProcessing={handleStartProcessing}
            isProcessing={isProcessing}
            hasImages={images.length > 0}
          />
        </>
      ) : (
        <div className="flex-1 flex items-center justify-center text-gray-500">
          <p className="text-lg">Module &quot;{activeTab}&quot; is under construction.</p>
        </div>
      )}
    </div>
  )
}
