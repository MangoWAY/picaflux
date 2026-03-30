import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { UploadCloud, FileImage } from 'lucide-react'
import type { ImageFile } from './ImageStrip'

const IMAGE_EXT = /\.(jpe?g|png|webp|avif)$/i

/** 与导出时 fixedWatermarkRegion 百分比语义一致（相对原图宽高） */
export type FixedWatermarkRegionPercent = {
  leftPercent: number
  topPercent: number
  widthPercent: number
  heightPercent: number
}

function pixelRectFromWatermarkPercent(
  region: FixedWatermarkRegionPercent,
  w: number,
  h: number,
): { x: number; y: number; width: number; height: number } {
  let left = Math.round((region.leftPercent / 100) * w)
  let top = Math.round((region.topPercent / 100) * h)
  let rw = Math.round((region.widthPercent / 100) * w)
  let rh = Math.round((region.heightPercent / 100) * h)
  left = Math.max(0, Math.min(w - 1, left))
  top = Math.max(0, Math.min(h - 1, top))
  rw = Math.max(1, Math.min(w - left, rw))
  rh = Math.max(1, Math.min(h - top, rh))
  return { x: left, y: top, width: rw, height: rh }
}

interface ImagePreviewPaneProps {
  images: ImageFile[]
  previewImage: ImageFile | null
  selectedCount: number
  onAddImages: () => void
  onDropPaths: (paths: string[]) => void
  /** 累计 90° 步数（与右侧一致）；预览用 steps×90°，避免 270°→0° 时 CSS 沿长弧插值 */
  rotateQuarterTurns: number
  flipHorizontal: boolean
  flipVertical: boolean
  /** 开启「固定水印区域透明」时预览标出矩形（百分比与导出一致） */
  fixedWatermarkRegionPercent: FixedWatermarkRegionPercent | null
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
  rotateQuarterTurns,
  flipHorizontal,
  flipVertical,
  fixedWatermarkRegionPercent,
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

  const rotateDeg = rotateQuarterTurns * 90
  const prevRotateDegRef = useRef(rotateDeg)
  const rotateDelta = Math.abs(rotateDeg - prevRotateDegRef.current)
  const transformTransition = rotateDelta > 180 ? 'none' : 'transform 0.2s ease'

  useLayoutEffect(() => {
    prevRotateDegRef.current = rotateDeg
  }, [rotateDeg])

  const previewTransformStyle: React.CSSProperties = {
    transform: `rotate(${rotateDeg}deg) scaleX(${flipHorizontal ? -1 : 1}) scaleY(${flipVertical ? -1 : 1})`,
    transition: transformTransition,
  }

  const previewSrc = previewImage?.previewUrl

  const [previewBgMode, setPreviewBgMode] = useState<'checker' | 'solid'>('checker')
  const [checkerLight, setCheckerLight] = useState('#cfcfcf')
  const [checkerDark, setCheckerDark] = useState('#9b9b9b')
  const [solidBg, setSolidBg] = useState('#1a1a1a')

  const [showAlpha, setShowAlpha] = useState(false)
  const [alphaDataUrl, setAlphaDataUrl] = useState<string | null>(null)
  const [alphaError, setAlphaError] = useState<string | null>(null)

  const viewportRef = useRef<HTMLDivElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const [imgLayout, setImgLayout] = useState<{ scale: number; ox: number; oy: number } | null>(null)

  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const dragRef = useRef<{
    active: boolean
    startClientX: number
    startClientY: number
    startPanX: number
    startPanY: number
  }>({ active: false, startClientX: 0, startClientY: 0, startPanX: 0, startPanY: 0 })

  useEffect(() => {
    // 切换预览图时回到适配视图
    setZoom(1)
    setPan({ x: 0, y: 0 })
  }, [previewImage?.path])

  const updateImgLayout = useCallback(() => {
    const vp = viewportRef.current
    const el = imgRef.current
    if (!vp || !el || !previewSrc) {
      setImgLayout(null)
      return
    }
    const nw = el.naturalWidth
    const nh = el.naturalHeight
    if (!nw || !nh) {
      setImgLayout(null)
      return
    }
    const rect = vp.getBoundingClientRect()
    const padding = 16 // 与 p-4 一致
    const ew = Math.max(0, rect.width - padding * 2)
    const eh = Math.max(0, rect.height - padding * 2)
    if (!ew || !eh) {
      setImgLayout(null)
      return
    }
    const scale = Math.min(ew / nw, eh / nh)
    const dw = nw * scale
    const dh = nh * scale
    setImgLayout({ scale, ox: (ew - dw) / 2, oy: (eh - dh) / 2 })
  }, [previewSrc])

  useLayoutEffect(() => {
    updateImgLayout()
  }, [updateImgLayout, rotateDeg, flipHorizontal, flipVertical, fixedWatermarkRegionPercent])

  useEffect(() => {
    const vp = viewportRef.current
    if (!vp) return
    const ro = new ResizeObserver(() => updateImgLayout())
    ro.observe(vp)
    return () => ro.disconnect()
  }, [updateImgLayout])

  const nw = imgRef.current?.naturalWidth || previewImage?.width || 0
  const nh = imgRef.current?.naturalHeight || previewImage?.height || 0

  const fixedWatermarkPixelRect =
    fixedWatermarkRegionPercent && nw > 0 && nh > 0
      ? pixelRectFromWatermarkPercent(fixedWatermarkRegionPercent, nw, nh)
      : null

  useEffect(() => {
    let cancelled = false
    setAlphaError(null)
    setAlphaDataUrl(null)
    if (!showAlpha || !previewImage?.path) return
    ;(async () => {
      try {
        const r = await window.picafluxAPI.getImageAlphaPreview(previewImage.path, {
          maxSize: 1400,
        })
        if (cancelled) return
        if (!r.success || !r.dataUrl) {
          setAlphaError(r.error || 'Alpha 预览生成失败')
          return
        }
        setAlphaDataUrl(r.dataUrl)
      } catch (e: unknown) {
        if (cancelled) return
        setAlphaError(e instanceof Error ? e.message : 'Alpha 预览生成失败')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [showAlpha, previewImage?.path])

  const checkerStyle: React.CSSProperties = {
    backgroundColor: checkerLight,
    backgroundImage: [
      `linear-gradient(45deg, ${checkerDark} 25%, transparent 25%)`,
      `linear-gradient(-45deg, ${checkerDark} 25%, transparent 25%)`,
      `linear-gradient(45deg, transparent 75%, ${checkerDark} 75%)`,
      `linear-gradient(-45deg, transparent 75%, ${checkerDark} 75%)`,
    ].join(', '),
    backgroundSize: '24px 24px',
    backgroundPosition: '0 0, 0 12px, 12px -12px, -12px 0px',
  }

  const display = useMemo(() => {
    const baseScale = imgLayout?.scale ?? 0
    const displayScale = baseScale > 0 ? baseScale * zoom : 0
    const percent = displayScale > 0 ? Math.round(displayScale * 100) : 0
    return { baseScale, displayScale, percent }
  }, [imgLayout?.scale, zoom])

  const setFit = useCallback(() => {
    setZoom(1)
    setPan({ x: 0, y: 0 })
  }, [])

  const setOneToOne = useCallback(() => {
    const base = imgLayout?.scale
    if (!base || base <= 0) return
    setZoom(1 / base)
    setPan({ x: 0, y: 0 })
  }, [imgLayout?.scale])

  const zoomByStep = useCallback(
    (dir: 1 | -1) => {
      setZoom((z) => {
        const factor = dir > 0 ? 1.15 : 1 / 1.15
        const next = Math.min(64, Math.max(0.05, z * factor))
        return next
      })
    },
    [setZoom],
  )

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      if (!previewImage) return
      e.preventDefault()
      const dir: 1 | -1 = e.deltaY < 0 ? 1 : -1
      zoomByStep(dir)
    },
    [previewImage, zoomByStep],
  )

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return
      dragRef.current = {
        active: true,
        startClientX: e.clientX,
        startClientY: e.clientY,
        startPanX: pan.x,
        startPanY: pan.y,
      }
    },
    [pan.x, pan.y],
  )

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragRef.current.active) return
    const dx = e.clientX - dragRef.current.startClientX
    const dy = e.clientY - dragRef.current.startClientY
    setPan({ x: dragRef.current.startPanX + dx, y: dragRef.current.startPanY + dy })
  }, [])

  const handleMouseUpOrLeave = useCallback(() => {
    dragRef.current.active = false
  }, [])

  const imgRenderStyle: React.CSSProperties = useMemo(() => {
    const pixelated = display.displayScale >= 1.5
    return {
      imageRendering: pixelated ? 'pixelated' : 'auto',
    }
  }, [display.displayScale])
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
          <div className="flex h-full min-h-0 flex-col gap-3">
            <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-[#2d2d2d]">
              <div
                ref={viewportRef}
                className="relative flex h-full min-h-0 w-full min-w-0 items-center justify-center p-4"
                style={previewBgMode === 'checker' ? checkerStyle : { backgroundColor: solidBg }}
                onWheel={handleWheel}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUpOrLeave}
                onMouseLeave={handleMouseUpOrLeave}
              >
                {previewSrc ? (
                  <div
                    className="relative flex max-h-full max-w-full min-h-0 min-w-0"
                    style={{
                      transform: `translate(${pan.x}px, ${pan.y}px) translate(${imgLayout?.ox ?? 0}px, ${imgLayout?.oy ?? 0}px) scale(${(imgLayout?.scale ?? 1) * zoom})`,
                      transformOrigin: 'top left',
                      transition: dragRef.current.active ? 'none' : 'transform 0.06s linear',
                      willChange: 'transform',
                    }}
                  >
                    <div className="relative" style={previewTransformStyle}>
                      <img
                        ref={imgRef}
                        src={showAlpha ? alphaDataUrl || '' : previewSrc}
                        alt={previewImage.name}
                        onLoad={updateImgLayout}
                        className="block select-none"
                        draggable={false}
                        style={{
                          ...imgRenderStyle,
                          width: nw > 0 ? nw : undefined,
                          height: nh > 0 ? nh : undefined,
                          maxWidth: 'none',
                          maxHeight: 'none',
                        }}
                      />
                      {showAlpha && !alphaDataUrl ? (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="rounded-md bg-black/60 px-3 py-2 text-xs text-gray-200">
                            {alphaError ? `Alpha 预览失败：${alphaError}` : '生成 Alpha 预览中...'}
                          </div>
                        </div>
                      ) : null}
                      {fixedWatermarkPixelRect && imgLayout ? (
                        <div
                          className="pointer-events-none absolute z-10 box-border border-2 border-dashed border-sky-400/95 bg-sky-400/15 shadow-[0_0_0_1px_rgba(0,0,0,0.35)]"
                          style={{
                            left: fixedWatermarkPixelRect.x,
                            top: fixedWatermarkPixelRect.y,
                            width: fixedWatermarkPixelRect.width,
                            height: fixedWatermarkPixelRect.height,
                          }}
                          title="导出时「固定水印区域透明」将清除此矩形内 alpha"
                        >
                          <span className="absolute left-0 top-0 whitespace-nowrap rounded-br bg-black/70 px-1 py-0.5 text-[10px] font-medium text-sky-100">
                            固定透明区域
                          </span>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : (
                  <FileImage className="h-24 w-24 text-gray-600" />
                )}

                {previewSrc ? (
                  <div className="absolute right-3 top-3 z-20 flex items-center gap-1 rounded-md border border-[#2d2d2d] bg-black/50 px-2 py-1 text-[11px] text-gray-200 backdrop-blur">
                    <button
                      type="button"
                      onClick={setFit}
                      className="rounded px-2 py-1 text-gray-100 hover:bg-white/10"
                      title="适配视图"
                    >
                      Fit
                    </button>
                    <button
                      type="button"
                      onClick={setOneToOne}
                      className="rounded px-2 py-1 text-gray-100 hover:bg-white/10"
                      title="100%（1:1 像素）"
                      disabled={!imgLayout?.scale}
                    >
                      100%
                    </button>
                    <div className="mx-1 h-4 w-px bg-white/15" />
                    <button
                      type="button"
                      onClick={() => zoomByStep(-1)}
                      className="rounded px-2 py-1 text-gray-100 hover:bg-white/10"
                      title="缩小"
                    >
                      −
                    </button>
                    <span className="w-12 text-center tabular-nums">{display.percent}%</span>
                    <button
                      type="button"
                      onClick={() => zoomByStep(1)}
                      className="rounded px-2 py-1 text-gray-100 hover:bg-white/10"
                      title="放大"
                    >
                      +
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
            <div className="shrink-0 rounded-xl border border-[#2d2d2d] bg-[#181818] px-3 py-2">
              <div className="flex flex-wrap items-center gap-3 text-xs text-gray-400">
                <label className="flex items-center gap-2">
                  <span className="text-gray-500">背景</span>
                  <select
                    value={previewBgMode}
                    onChange={(e) => setPreviewBgMode(e.target.value as 'checker' | 'solid')}
                    className="rounded border border-[#3d3d3d] bg-[#121212] px-2 py-1 text-xs text-gray-200"
                  >
                    <option value="checker">棋盘格</option>
                    <option value="solid">纯色</option>
                  </select>
                </label>
                {previewBgMode === 'checker' ? (
                  <>
                    <label className="flex items-center gap-2">
                      <span className="text-gray-500">浅</span>
                      <input
                        type="color"
                        value={checkerLight}
                        onChange={(e) => setCheckerLight(e.target.value)}
                        className="h-6 w-8 cursor-pointer rounded border border-[#3d3d3d] bg-[#121212]"
                        aria-label="棋盘格浅色"
                      />
                    </label>
                    <label className="flex items-center gap-2">
                      <span className="text-gray-500">深</span>
                      <input
                        type="color"
                        value={checkerDark}
                        onChange={(e) => setCheckerDark(e.target.value)}
                        className="h-6 w-8 cursor-pointer rounded border border-[#3d3d3d] bg-[#121212]"
                        aria-label="棋盘格深色"
                      />
                    </label>
                  </>
                ) : (
                  <label className="flex items-center gap-2">
                    <span className="text-gray-500">颜色</span>
                    <input
                      type="color"
                      value={solidBg}
                      onChange={(e) => setSolidBg(e.target.value)}
                      className="h-6 w-8 cursor-pointer rounded border border-[#3d3d3d] bg-[#121212]"
                      aria-label="背景纯色"
                    />
                  </label>
                )}

                <label className="ml-auto flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={showAlpha}
                    onChange={(e) => setShowAlpha(e.target.checked)}
                    className="rounded border-[#3d3d3d] bg-[#121212] text-blue-500 focus:ring-blue-500 focus:ring-offset-0"
                  />
                  <span className="text-gray-300">显示 Alpha 通道</span>
                </label>
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
