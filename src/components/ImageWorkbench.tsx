import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { ImageStrip, ImageFile, type ImageStripListMode } from './ImageStrip'
import { ImagePreviewPane } from './ImagePreviewPane'
import { QueueSidebarCollapseHandle } from './QueueSidebarCollapseHandle'
import { SettingsPanel } from './SettingsPanel'
import { ChevronRight } from 'lucide-react'
import type { ProcessOptions } from '@/lib/imageProcessOptions'
import {
  mergePresetIntoOptions,
  toPresetPayload,
  type ImageProcessPresetRecord,
} from '@/lib/imagePreset'
import {
  buildProcessImageInvokeOptions,
  getWatermarkRegionPercents,
  isOverwriteCompatibleWithSourcePath,
  parseSliceGridDimension,
} from '@/lib/imageProcessPayload'
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

export function ImageWorkbench({
  backgroundRemovalBackendId,
}: {
  backgroundRemovalBackendId: string
}) {
  const [images, setImages] = useState<ImageFile[]>([])
  const [stripListMode, setStripListMode] = useState<ImageStripListMode>('thumbnail')
  const [isStripCollapsed, setIsStripCollapsed] = useState(false)
  const [checkedPaths, setCheckedPaths] = useState<Set<string>>(() => new Set())
  const [previewPath, setPreviewPath] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number } | null>(
    null,
  )
  const [imagePresets, setImagePresets] = useState<ImageProcessPresetRecord[]>([])
  const [cropVisualPx, setCropVisualPx] = useState<{ w: number; h: number } | null>(null)
  const [options, setOptions] = useState<ProcessOptions>({
    format: 'png',
    rotateMirrorEnabled: false,
    rotateQuarterTurns: 0,
    flipHorizontal: false,
    flipVertical: false,
    sliceEnabled: false,
    sliceRows: '4',
    sliceCols: '4',
    sliceXLines: undefined,
    sliceYLines: undefined,
    resizeMode: 'percent',
    resizePercentPreset: 'none',
    resizeCustomPercentStr: '100',
    resizePixelsExpanded: false,
    width: '',
    height: '',
    keepAspectRatio: true,
    quality: 100,
    outputDir: '',
    overwriteOriginal: false,
    removeBackground: false,
    clearFixedWatermark: false,
    watermarkLeftPct: FIXED_WATERMARK_DEFAULTS.leftPercent,
    watermarkTopPct: FIXED_WATERMARK_DEFAULTS.topPercent,
    watermarkWidthPct: FIXED_WATERMARK_DEFAULTS.widthPercent,
    watermarkHeightPct: FIXED_WATERMARK_DEFAULTS.heightPercent,
    cropEnabled: false,
    cropNorm: { x: 0, y: 0, w: 1, h: 1 },
    trimTransparent: false,
    trimPaddingPx: '2',
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

  const overwriteCompatibleWithFormat = useMemo(() => {
    if (checkedPaths.size === 0) return false
    for (const p of checkedPaths) {
      if (!isOverwriteCompatibleWithSourcePath(p, options.format)) return false
    }
    return true
  }, [checkedPaths, options.format])

  useEffect(() => {
    if (!overwriteCompatibleWithFormat && options.overwriteOriginal) {
      setOptions((prev) => ({ ...prev, overwriteOriginal: false }))
    }
  }, [overwriteCompatibleWithFormat, options.overwriteOriginal])

  const refreshImagePresets = useCallback(async () => {
    try {
      const list = await window.picafluxAPI.listImageProcessPresets()
      setImagePresets(list)
    } catch {
      setImagePresets([])
    }
  }, [])

  useEffect(() => {
    void refreshImagePresets()
  }, [refreshImagePresets])

  const handleApplyImagePreset = useCallback(
    (id: string) => {
      const p = imagePresets.find((x) => x.id === id)
      if (!p) return
      setOptions((prev) => mergePresetIntoOptions(p.options, prev))
    },
    [imagePresets],
  )

  const handleSaveImagePreset = useCallback(
    async (name: string) => {
      const payload = toPresetPayload(options)
      const r = await window.picafluxAPI.saveImageProcessPreset({ name, options: payload })
      if (r.success) await refreshImagePresets()
      return r
    },
    [options, refreshImagePresets],
  )

  const handleDeleteImagePreset = useCallback(
    async (id: string) => {
      const r = await window.picafluxAPI.deleteImageProcessPreset(id)
      if (r.success) await refreshImagePresets()
      return r
    },
    [refreshImagePresets],
  )

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
    if (batch.length === 0) return
    if (options.overwriteOriginal && !overwriteCompatibleWithFormat) return
    if (!options.overwriteOriginal && !options.outputDir) return

    setIsProcessing(true)
    setImages((prev) =>
      prev.map((img) =>
        checkedPaths.has(img.path)
          ? { ...img, status: 'processing' as const, lastError: undefined }
          : img,
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

    const processOpts = buildProcessImageInvokeOptions(options, removalBackendId)
    const sliceRows = parseSliceGridDimension(options.sliceRows, 4)
    const sliceCols = parseSliceGridDimension(options.sliceCols, 4)

    setBatchProgress({ current: 0, total: batch.length })
    try {
      for (let i = 0; i < batch.length; i++) {
        const img = batch[i]
        setBatchProgress({ current: i + 1, total: batch.length })
        try {
          const result = options.sliceEnabled
            ? await window.picafluxAPI.sliceImageGrid(img.path, options.outputDir, {
                ...processOpts,
                rows: sliceRows,
                cols: sliceCols,
                xLines: options.sliceXLines,
                yLines: options.sliceYLines,
              })
            : await window.picafluxAPI.processImage(
                img.path,
                options.overwriteOriginal ? '' : options.outputDir,
                processOpts,
              )

          const outPath =
            !options.sliceEnabled && result.success && 'outputPath' in result && result.outputPath
              ? result.outputPath
              : undefined

          setImages((prev) =>
            prev.map((p) => {
              if (p.path !== img.path) return p
              const pathChanged = Boolean(
                options.overwriteOriginal && outPath && outPath !== img.path,
              )
              const nextPath = pathChanged ? outPath! : p.path
              return {
                ...p,
                path: nextPath,
                name: pathChanged ? (nextPath.split(/[/\\]/).pop() ?? p.name) : p.name,
                previewUrl: pathChanged ? `file://${nextPath}` : p.previewUrl,
                status: result.success ? 'done' : 'error',
                lastError: result.success ? undefined : (result.error ?? '处理失败'),
              }
            }),
          )

          if (options.overwriteOriginal && result.success && outPath && outPath !== img.path) {
            setCheckedPaths((prev) => {
              const n = new Set(prev)
              n.delete(img.path)
              n.add(outPath)
              return n
            })
            setPreviewPath((prev) => (prev === img.path ? outPath : prev))
          }
        } catch {
          setImages((prev) =>
            prev.map((p) =>
              p.path === img.path ? { ...p, status: 'error' as const, lastError: '处理失败' } : p,
            ),
          )
        }
      }
    } finally {
      setBatchProgress(null)
      setIsProcessing(false)
    }
  }

  const previewImage = previewPath ? (images.find((i) => i.path === previewPath) ?? null) : null

  const handleNavigatePreview = useCallback(
    (delta: -1 | 1) => {
      if (images.length === 0) return
      const idx = previewPath ? images.findIndex((i) => i.path === previewPath) : -1
      const cur = idx >= 0 ? idx : 0
      const len = images.length
      const next = (cur + delta + len) % len
      setPreviewPath(images[next].path)
    },
    [images, previewPath],
  )

  const fixedWatermarkRegionForPreview = getWatermarkRegionPercents(options)
  const selectedCount = checkedPaths.size

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-1 overflow-hidden">
      {isStripCollapsed ? (
        <div className="flex h-full w-9 shrink-0 items-center justify-center border-r border-[#2d2d2d] bg-[#181818]">
          <button
            type="button"
            onClick={() => setIsStripCollapsed(false)}
            className="rounded-md p-1.5 text-gray-400 transition-colors hover:bg-[#2d2d2d] hover:text-gray-200"
            aria-label="展开队列"
            title="展开队列"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <div className="flex h-full min-h-0 shrink-0">
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
          <QueueSidebarCollapseHandle onCollapse={() => setIsStripCollapsed(true)} />
        </div>
      )}
      <ImagePreviewPane
        images={images}
        previewImage={previewImage}
        selectedCount={selectedCount}
        onAddImages={handleAddImages}
        onDropPaths={handleDropPaths}
        rotateQuarterTurns={options.rotateMirrorEnabled === false ? 0 : options.rotateQuarterTurns}
        flipHorizontal={options.rotateMirrorEnabled !== false && options.flipHorizontal}
        flipVertical={options.rotateMirrorEnabled !== false && options.flipVertical}
        fixedWatermarkRegionPercent={fixedWatermarkRegionForPreview}
        sliceEnabled={options.sliceEnabled}
        sliceXLines={options.sliceXLines}
        sliceYLines={options.sliceYLines}
        onUpdateSliceLines={(xLines, yLines) =>
          setOptions((prev) => ({ ...prev, sliceXLines: xLines, sliceYLines: yLines }))
        }
        cropEnabled={options.cropEnabled}
        cropNorm={options.cropNorm}
        onCropNormChange={(rect) => setOptions((prev) => ({ ...prev, cropNorm: rect }))}
        onCropVisualSizeChange={setCropVisualPx}
        trimTransparent={options.trimTransparent}
        trimPaddingPx={options.trimPaddingPx}
        onNavigatePreview={handleNavigatePreview}
      />
      <SettingsPanel
        options={options}
        onChange={setOptions}
        cropVisualPx={cropVisualPx}
        onSelectOutputDir={handleSelectOutputDir}
        onStartProcessing={handleStartProcessing}
        isProcessing={isProcessing}
        overwriteCompatibleWithFormat={overwriteCompatibleWithFormat}
        selectedForProcessCount={selectedCount}
        totalImageCount={images.length}
        imagePresets={imagePresets}
        onApplyImagePreset={handleApplyImagePreset}
        onSaveImagePreset={handleSaveImagePreset}
        onDeleteImagePreset={handleDeleteImagePreset}
        batchProgress={batchProgress}
      />
    </div>
  )
}
