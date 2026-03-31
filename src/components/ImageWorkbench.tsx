import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { ImageStrip, ImageFile, type ImageStripListMode } from './ImageStrip'
import { ImagePreviewPane } from './ImagePreviewPane'
import { SettingsPanel, ProcessOptions, type ResizePercentPreset } from './SettingsPanel'
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

function effectiveResizeScalePercent(options: ProcessOptions): number {
  if (options.resizeMode !== 'percent') return 100
  if (options.resizePercentPreset === 'none') return 100
  if (options.resizePercentPreset === 'custom') {
    const n = parseFloat(String(options.resizeCustomPercentStr).replace(',', '.'))
    if (!Number.isFinite(n)) return 100
    return Math.min(400, Math.max(1, Math.round(n)))
  }
  const map: Record<Exclude<ResizePercentPreset, 'custom' | 'none'>, number> = {
    p75: 75,
    p50: 50,
    p25: 25,
  }
  return map[options.resizePercentPreset]
}

export function ImageWorkbench({
  backgroundRemovalBackendId,
}: {
  backgroundRemovalBackendId: string
}) {
  const [images, setImages] = useState<ImageFile[]>([])
  const [stripListMode, setStripListMode] = useState<ImageStripListMode>('thumbnail')
  const [checkedPaths, setCheckedPaths] = useState<Set<string>>(() => new Set())
  const [previewPath, setPreviewPath] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [options, setOptions] = useState<ProcessOptions>({
    format: 'png',
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
    quality: 80,
    outputDir: '',
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

    const rq = ((options.rotateQuarterTurns % 4) + 4) % 4

    const parseDim = (s: string) => {
      const n = parseInt(s, 10)
      return Number.isFinite(n) && n > 0 ? n : undefined
    }
    const pixelW = options.resizeMode === 'pixels' ? parseDim(options.width) : undefined
    const pixelH = options.resizeMode === 'pixels' ? parseDim(options.height) : undefined
    const scalePct = options.resizeMode === 'percent' ? effectiveResizeScalePercent(options) : 100

    const processOpts = {
      format: options.format,
      ...(rq !== 0 ? { rotateQuarterTurns: rq } : {}),
      ...(options.flipHorizontal ? { flipHorizontal: true } : {}),
      ...(options.flipVertical ? { flipVertical: true } : {}),
      quality: options.quality,
      ...(pixelW !== undefined || pixelH !== undefined
        ? {
            width: pixelW,
            height: pixelH,
            keepAspectRatio: options.keepAspectRatio,
          }
        : {}),
      ...(options.resizeMode === 'percent' && scalePct !== 100 ? { scalePercent: scalePct } : {}),
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
      ...(options.cropEnabled
        ? {
            crop: {
              x: options.cropNorm.x,
              y: options.cropNorm.y,
              width: options.cropNorm.w,
              height: options.cropNorm.h,
            },
          }
        : {}),
      ...(options.trimTransparent
        ? {
            trimTransparent: true,
            trimPaddingPx: (() => {
              const n = parseInt(String(options.trimPaddingPx), 10)
              return Number.isFinite(n) ? Math.min(512, Math.max(0, n)) : 2
            })(),
          }
        : {}),
    }

    const parseGridDim = (s: string, fallback: number) => {
      const n = parseInt(s, 10)
      if (!Number.isFinite(n)) return fallback
      return Math.min(64, Math.max(1, n))
    }
    const sliceRows = parseGridDim(options.sliceRows, 4)
    const sliceCols = parseGridDim(options.sliceCols, 4)

    for (const img of batch) {
      try {
        const result = options.sliceEnabled
          ? await window.picafluxAPI.sliceImageGrid(img.path, options.outputDir, {
              ...processOpts,
              rows: sliceRows,
              cols: sliceCols,
              xLines: options.sliceXLines,
              yLines: options.sliceYLines,
            })
          : await window.picafluxAPI.processImage(img.path, options.outputDir, processOpts)

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

  const fixedWatermarkRegionForPreview = useMemo(() => {
    if (!options.clearFixedWatermark) return null
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
    return {
      leftPercent: parseWatermarkPct(options.watermarkLeftPct, wmDefaults.left),
      topPercent: parseWatermarkPct(options.watermarkTopPct, wmDefaults.top),
      widthPercent: Math.max(0.5, parseWatermarkPct(options.watermarkWidthPct, wmDefaults.width)),
      heightPercent: Math.max(
        0.5,
        parseWatermarkPct(options.watermarkHeightPct, wmDefaults.height),
      ),
    }
  }, [
    options.clearFixedWatermark,
    options.watermarkLeftPct,
    options.watermarkTopPct,
    options.watermarkWidthPct,
    options.watermarkHeightPct,
  ])
  const selectedCount = checkedPaths.size

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-1 overflow-hidden">
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
        rotateQuarterTurns={options.rotateQuarterTurns}
        flipHorizontal={options.flipHorizontal}
        flipVertical={options.flipVertical}
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
    </div>
  )
}
