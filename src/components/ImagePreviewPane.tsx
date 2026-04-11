import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import clsx from 'clsx'
import { UploadCloud, FileImage, Hand } from 'lucide-react'
import type { ImageFile } from './ImageStrip'
import type { WatermarkRegionPercents } from '@/lib/imageProcessPayload'

/** 阻止 range input 上的 wheel 事件改变滑块值 */
function usePreventWheelOnRef(ref: React.RefObject<HTMLInputElement | null>) {
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const stop = (e: WheelEvent) => e.preventDefault()
    el.addEventListener('wheel', stop, { passive: false })
    return () => el.removeEventListener('wheel', stop)
  }, [ref])
}

const IMAGE_EXT = /\.(jpe?g|png|webp|avif)$/i

/** 与导出时 fixedWatermarkRegion 百分比语义一致（相对原图宽高） */
export type FixedWatermarkRegionPercent = WatermarkRegionPercents

function pixelRectFromWatermarkPercent(
  region: WatermarkRegionPercents,
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
  sliceEnabled?: boolean
  sliceXLines?: number[]
  sliceYLines?: number[]
  onUpdateSliceLines?: (xLines: number[], yLines: number[]) => void
  cropEnabled?: boolean
  cropNorm?: { x: number; y: number; w: number; h: number }
  onCropNormChange?: (rect: { x: number; y: number; w: number; h: number }) => void
  /** 在预览区用 ← / → 切换列表中的上一张 / 下一张（与左侧顺序一致） */
  onNavigatePreview?: (delta: -1 | 1) => void
}

const MIN_CROP_FRAC = 0.02

type CropDragHandle = 'move' | 'n' | 's' | 'e' | 'w' | 'nw' | 'ne' | 'sw' | 'se'

interface CropDragState {
  handle: CropDragHandle
  startMx: number
  startMy: number
  start: { x: number; y: number; w: number; h: number }
}

function clampCropNorm(
  x: number,
  y: number,
  w: number,
  h: number,
  min = MIN_CROP_FRAC,
): { x: number; y: number; w: number; h: number } {
  let cx = x
  let cy = y
  let cw = Math.max(min, w)
  let ch = Math.max(min, h)
  if (cw > 1) cw = 1
  if (ch > 1) ch = 1
  cx = Math.max(0, Math.min(1 - cw, cx))
  cy = Math.max(0, Math.min(1 - ch, cy))
  cw = Math.max(min, Math.min(cw, 1 - cx))
  ch = Math.max(min, Math.min(ch, 1 - cy))
  return { x: cx, y: cy, w: cw, h: ch }
}

function computeCropFromDrag(
  d: CropDragState,
  nx: number,
  ny: number,
): { x: number; y: number; w: number; h: number } {
  const r = d.start
  const min = MIN_CROP_FRAC

  switch (d.handle) {
    case 'move':
      return clampCropNorm(r.x + (nx - d.startMx), r.y + (ny - d.startMy), r.w, r.h, min)
    case 'e':
      return clampCropNorm(r.x, r.y, nx - r.x, r.h, min)
    case 'w': {
      const right = Math.min(r.x + r.w, 1)
      const nxClamped = Math.min(nx, right - min)
      return clampCropNorm(nxClamped, r.y, right - nxClamped, r.h, min)
    }
    case 's':
      return clampCropNorm(r.x, r.y, r.w, ny - r.y, min)
    case 'n': {
      const bottom = Math.min(r.y + r.h, 1)
      const nyClamped = Math.min(ny, bottom - min)
      return clampCropNorm(r.x, nyClamped, r.w, bottom - nyClamped, min)
    }
    case 'se':
      return clampCropNorm(r.x, r.y, nx - r.x, ny - r.y, min)
    case 'sw': {
      const right = Math.min(r.x + r.w, 1)
      return clampCropNorm(nx, r.y, right - nx, ny - r.y, min)
    }
    case 'ne': {
      const bottom = Math.min(r.y + r.h, 1)
      return clampCropNorm(r.x, ny, nx - r.x, bottom - ny, min)
    }
    case 'nw': {
      const right = Math.min(r.x + r.w, 1)
      const bottom = Math.min(r.y + r.h, 1)
      const nxClamped = Math.min(nx, right - min)
      const nyClamped = Math.min(ny, bottom - min)
      return clampCropNorm(nxClamped, nyClamped, right - nxClamped, bottom - nyClamped, min)
    }
    default:
      return clampCropNorm(r.x, r.y, r.w, r.h, min)
  }
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
  sliceEnabled,
  sliceXLines,
  sliceYLines,
  onUpdateSliceLines,
  cropEnabled = false,
  cropNorm = { x: 0, y: 0, w: 1, h: 1 },
  onCropNormChange,
  onNavigatePreview,
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
  const [imgLayout, setImgLayout] = useState<{
    scale: number
    ew: number
    eh: number
  } | null>(null)

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
    const padding = 16 // 视觉边距
    const ew = Math.max(0, rect.width - padding * 2)
    const eh = Math.max(0, rect.height - padding * 2)
    if (!ew || !eh) {
      setImgLayout(null)
      return
    }
    const scale = Math.min(ew / nw, eh / nh)
    setImgLayout({ scale, ew, eh })
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

  const isRotated90 = Math.abs(rotateQuarterTurns % 2) === 1
  const visualW = isRotated90 ? nh : nw
  const visualH = isRotated90 ? nw : nh

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

  const viewScale = useMemo(() => {
    const base = imgLayout?.scale ?? 0
    return base > 0 ? base * zoom : 0
  }, [imgLayout?.scale, zoom])

  const viewPercentRounded = viewScale > 0 ? Math.round(viewScale * 100) : 0

  /** 滑块与手动输入：25%–400%（相对原图 1:1）；「适配」仍可缩至更小比例 */
  const applyViewPercent = useCallback(
    (pct: number) => {
      const base = imgLayout?.scale
      if (!base || base <= 0 || !Number.isFinite(pct)) return
      const clampedPct = Math.min(400, Math.max(25, Math.round(pct)))
      const vs = clampedPct / 100
      setZoom(vs / base)
    },
    [imgLayout?.scale],
  )

  const setFit = useCallback(() => {
    setZoom(1)
    setPan({ x: 0, y: 0 })
  }, [])

  const setOneToOne = useCallback(() => {
    applyViewPercent(100)
    setPan({ x: 0, y: 0 })
  }, [applyViewPercent])

  const canPan = useMemo(() => {
    if (!imgLayout || viewScale <= 0 || nw <= 0 || nh <= 0) return false
    const bw = nw * viewScale
    const bh = nh * viewScale
    const viewportW = imgLayout.ew + 32 // padding * 2
    const viewportH = imgLayout.eh + 32 // padding * 2
    return bw > viewportW + 0.5 || bh > viewportH + 0.5
  }, [imgLayout, viewScale, nw, nh])

  const [isDragging, setIsDragging] = useState(false)
  const [draggingSliceLine, setDraggingSliceLine] = useState<{
    axis: 'x' | 'y'
    index: number
  } | null>(null)
  const [cropDrag, setCropDrag] = useState<CropDragState | null>(null)

  const effectiveCrop = useMemo(
    () => (cropEnabled ? cropNorm : { x: 0, y: 0, w: 1, h: 1 }),
    [cropEnabled, cropNorm],
  )

  const clientToNorm = useCallback(
    (clientX: number, clientY: number) => {
      const vp = viewportRef.current
      if (!vp || visualW <= 0 || visualH <= 0 || viewScale <= 0) return { nx: 0, ny: 0 }
      const rect = vp.getBoundingClientRect()
      const centerX = rect.left + rect.width / 2 + pan.x
      const centerY = rect.top + rect.height / 2 + pan.y
      const imgX = (clientX - centerX) / viewScale + visualW / 2
      const imgY = (clientY - centerY) / viewScale + visualH / 2
      return { nx: imgX / visualW, ny: imgY / visualH }
    },
    [pan.x, pan.y, viewScale, visualW, visualH],
  )

  const beginCropDrag = useCallback(
    (e: React.MouseEvent, handle: CropDragHandle) => {
      if (e.button !== 0 || !onCropNormChange) return
      e.stopPropagation()
      e.preventDefault()
      const { nx, ny } = clientToNorm(e.clientX, e.clientY)
      setCropDrag({
        handle,
        startMx: nx,
        startMy: ny,
        start: { ...cropNorm },
      })
    },
    [clientToNorm, cropNorm, onCropNormChange],
  )

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0 || !canPan) return
      e.preventDefault()
      dragRef.current = {
        active: true,
        startClientX: e.clientX,
        startClientY: e.clientY,
        startPanX: pan.x,
        startPanY: pan.y,
      }
      setIsDragging(true)
    },
    [canPan, pan.x, pan.y],
  )

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (cropDrag && onCropNormChange) {
        e.preventDefault()
        const { nx, ny } = clientToNorm(e.clientX, e.clientY)
        onCropNormChange(computeCropFromDrag(cropDrag, nx, ny))
        return
      }

      if (draggingSliceLine && onUpdateSliceLines && sliceXLines && sliceYLines) {
        e.preventDefault()
        const vp = viewportRef.current
        if (!vp) return
        const rect = vp.getBoundingClientRect()

        // Calculate mouse position relative to the center of the viewport
        const centerX = rect.left + rect.width / 2 + pan.x
        const centerY = rect.top + rect.height / 2 + pan.y

        // Convert to image coordinates
        const imgX = (e.clientX - centerX) / viewScale + visualW / 2
        const imgY = (e.clientY - centerY) / viewScale + visualH / 2

        if (visualW <= 0 || visualH <= 0) return

        const cw = effectiveCrop.w > 1e-6 ? effectiveCrop.w : 1
        const ch = effectiveCrop.h > 1e-6 ? effectiveCrop.h : 1

        if (draggingSliceLine.axis === 'x') {
          const newXLines = [...sliceXLines]
          let pct = (imgX / visualW - effectiveCrop.x) / cw
          pct = Math.max(0.01, Math.min(0.99, pct))
          newXLines[draggingSliceLine.index] = pct
          onUpdateSliceLines(newXLines, sliceYLines)
        } else {
          const newYLines = [...sliceYLines]
          let pct = (imgY / visualH - effectiveCrop.y) / ch
          pct = Math.max(0.01, Math.min(0.99, pct))
          newYLines[draggingSliceLine.index] = pct
          onUpdateSliceLines(sliceXLines, newYLines)
        }
        return
      }

      if (!dragRef.current.active) return
      e.preventDefault()
      const dx = e.clientX - dragRef.current.startClientX
      const dy = e.clientY - dragRef.current.startClientY
      setPan({ x: dragRef.current.startPanX + dx, y: dragRef.current.startPanY + dy })
    },
    [
      draggingSliceLine,
      onUpdateSliceLines,
      sliceXLines,
      sliceYLines,
      pan.x,
      pan.y,
      viewScale,
      visualW,
      visualH,
      effectiveCrop,
      cropDrag,
      onCropNormChange,
      clientToNorm,
    ],
  )

  const handleMouseUpOrLeave = useCallback(() => {
    if (draggingSliceLine) {
      setDraggingSliceLine(null)
    }
    if (cropDrag) {
      setCropDrag(null)
    }
    if (dragRef.current.active) {
      dragRef.current.active = false
      setIsDragging(false)
    }
  }, [draggingSliceLine, cropDrag])

  const [zoomPercentDraft, setZoomPercentDraft] = useState('')
  const [zoomPercentEditing, setZoomPercentEditing] = useState(false)

  useEffect(() => {
    if (!zoomPercentEditing) {
      setZoomPercentDraft(viewPercentRounded > 0 ? String(viewPercentRounded) : '')
    }
  }, [viewPercentRounded, zoomPercentEditing])

  useEffect(() => {
    if (!isDragging && !draggingSliceLine && !cropDrag) return
    const endDrag = () => {
      dragRef.current.active = false
      setIsDragging(false)
      setDraggingSliceLine(null)
      setCropDrag(null)
    }
    window.addEventListener('mouseup', endDrag)
    window.addEventListener('blur', endDrag)
    return () => {
      window.removeEventListener('mouseup', endDrag)
      window.removeEventListener('blur', endDrag)
    }
  }, [isDragging, draggingSliceLine, cropDrag])

  const sliderPercentValue =
    viewPercentRounded > 0 ? Math.min(400, Math.max(25, viewPercentRounded)) : 25

  const zoomSliderRef = useRef<HTMLInputElement>(null)
  usePreventWheelOnRef(zoomSliderRef)

  const commitZoomPercentInput = useCallback(() => {
    const raw = zoomPercentDraft.trim().replace(',', '.')
    const n = Math.round(parseFloat(raw))
    if (!Number.isFinite(n) || n < 25 || n > 400) {
      setZoomPercentDraft(viewPercentRounded > 0 ? String(viewPercentRounded) : '100')
      return
    }
    applyViewPercent(n)
    setZoomPercentEditing(false)
  }, [zoomPercentDraft, viewPercentRounded, applyViewPercent])

  const imgRenderStyle: React.CSSProperties = useMemo(() => {
    const pixelated = viewScale >= 1.5
    return {
      imageRendering: pixelated ? 'pixelated' : 'auto',
    }
  }, [viewScale])

  /** 按 scale 反向补偿的边框——视觉上始终 ~1.5px，不随缩放变化 */
  const compensatedBorderStyle: React.CSSProperties = useMemo(() => {
    const s = (imgLayout?.scale ?? 0) * zoom
    if (s <= 0) return {}
    const bw = 1.5 / s
    const outerBw = 2 / s
    return {
      boxShadow: [`0 0 0 ${bw}px rgba(255,255,255,0.3)`, `0 0 0 ${outerBw}px rgba(0,0,0,0.5)`].join(
        ', ',
      ),
    }
  }, [imgLayout?.scale, zoom])

  useEffect(() => {
    if (!onNavigatePreview || images.length === 0) return
    const onKeyDown = (e: KeyboardEvent) => {
      const elTarget = e.target as HTMLElement | null
      if (elTarget?.closest('input, textarea, select, [contenteditable="true"]')) return
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        onNavigatePreview(-1)
        return
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault()
        onNavigatePreview(1)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onNavigatePreview, images.length])

  return (
    <div
      className="flex h-full min-h-0 min-w-0 flex-1 flex-col bg-[#121212]"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-[#2d2d2d] px-6">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold text-white">图片预览</h1>
          {images.length > 0 && (
            <>
              <p className="truncate text-xs text-gray-500">
                已选 {selectedCount} / {images.length} 张将使用右侧参数处理
              </p>
              <p className="mt-0.5 text-[10px] text-gray-600">← → 切换预览图片</p>
            </>
          )}
        </div>
        <button
          type="button"
          onClick={onAddImages}
          className="shrink-0 rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
        >
          添加图片
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
            <p className="text-sm">或点击右上角「添加图片」</p>
          </div>
        ) : previewImage ? (
          <div className="flex h-full min-h-0 flex-col gap-3">
            <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-[#2d2d2d]">
              <div
                ref={viewportRef}
                className={clsx(
                  'relative h-full min-h-0 w-full min-w-0 overflow-hidden',
                  canPan && (isDragging ? 'cursor-grabbing' : 'cursor-grab'),
                )}
                style={previewBgMode === 'checker' ? checkerStyle : { backgroundColor: solidBg }}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUpOrLeave}
                onMouseLeave={handleMouseUpOrLeave}
              >
                {previewSrc ? (
                  <div
                    className="absolute left-1/2 top-1/2"
                    style={{
                      transform: `translate(-50%, -50%) translate(${pan.x}px, ${pan.y}px) scale(${(imgLayout?.scale ?? 1) * zoom})`,
                      transition: isDragging ? 'none' : 'transform 0.06s linear',
                      willChange: 'transform',
                      width: visualW > 0 ? visualW : undefined,
                      height: visualH > 0 ? visualH : undefined,
                    }}
                  >
                    <div
                      className="absolute left-1/2 top-1/2"
                      style={{
                        width: nw > 0 ? nw : undefined,
                        height: nh > 0 ? nh : undefined,
                        marginLeft: nw > 0 ? -nw / 2 : undefined,
                        marginTop: nh > 0 ? -nh / 2 : undefined,
                        ...previewTransformStyle,
                        ...compensatedBorderStyle,
                      }}
                    >
                      <img
                        ref={imgRef}
                        src={showAlpha ? alphaDataUrl || '' : previewSrc}
                        alt={previewImage.name}
                        onLoad={updateImgLayout}
                        className="block w-full h-full select-none"
                        draggable={false}
                        style={imgRenderStyle}
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

                    {sliceEnabled && (
                      <div className="absolute inset-0 z-20 pointer-events-none">
                        {sliceXLines?.map((xPct, i) => (
                          <div
                            key={`x-${i}`}
                            className="absolute top-0 bottom-0 w-4 -ml-2 cursor-col-resize pointer-events-auto group flex justify-center"
                            style={{
                              left: `${(effectiveCrop.x + xPct * effectiveCrop.w) * 100}%`,
                            }}
                            onMouseDown={(e) => {
                              e.stopPropagation()
                              setDraggingSliceLine({ axis: 'x', index: i })
                            }}
                          >
                            <div className="h-full w-[1px] bg-blue-500 shadow-[0_0_2px_rgba(0,0,0,0.8)] group-hover:w-[2px] group-hover:bg-blue-400 transition-all" />
                          </div>
                        ))}
                        {sliceYLines?.map((yPct, i) => (
                          <div
                            key={`y-${i}`}
                            className="absolute left-0 right-0 h-4 -mt-2 cursor-row-resize pointer-events-auto group flex flex-col justify-center"
                            style={{
                              top: `${(effectiveCrop.y + yPct * effectiveCrop.h) * 100}%`,
                            }}
                            onMouseDown={(e) => {
                              e.stopPropagation()
                              setDraggingSliceLine({ axis: 'y', index: i })
                            }}
                          >
                            <div className="w-full h-[1px] bg-blue-500 shadow-[0_0_2px_rgba(0,0,0,0.8)] group-hover:h-[2px] group-hover:bg-blue-400 transition-all" />
                          </div>
                        ))}
                      </div>
                    )}
                    {cropEnabled && onCropNormChange ? (
                      <div className="absolute inset-0 z-[25] pointer-events-none select-none">
                        <div
                          className="absolute left-0 right-0 top-0 bg-black/50 pointer-events-none"
                          style={{ height: `${cropNorm.y * 100}%` }}
                        />
                        <div
                          className="absolute left-0 right-0 bottom-0 bg-black/50 pointer-events-none"
                          style={{ top: `${(cropNorm.y + cropNorm.h) * 100}%` }}
                        />
                        <div
                          className="absolute left-0 bg-black/50 pointer-events-none"
                          style={{
                            top: `${cropNorm.y * 100}%`,
                            width: `${cropNorm.x * 100}%`,
                            height: `${cropNorm.h * 100}%`,
                          }}
                        />
                        <div
                          className="absolute right-0 bg-black/50 pointer-events-none"
                          style={{
                            top: `${cropNorm.y * 100}%`,
                            left: `${(cropNorm.x + cropNorm.w) * 100}%`,
                            height: `${cropNorm.h * 100}%`,
                          }}
                        />
                        <div
                          role="presentation"
                          className="pointer-events-auto absolute cursor-move box-border border-2 border-amber-300 shadow-[0_0_0_1px_rgba(0,0,0,0.55)]"
                          style={{
                            left: `${cropNorm.x * 100}%`,
                            top: `${cropNorm.y * 100}%`,
                            width: `${cropNorm.w * 100}%`,
                            height: `${cropNorm.h * 100}%`,
                          }}
                          onMouseDown={(e) => beginCropDrag(e, 'move')}
                        />
                        {(
                          [
                            [
                              'nw',
                              'cursor-nwse-resize',
                              { left: `${cropNorm.x * 100}%`, top: `${cropNorm.y * 100}%` },
                            ],
                            [
                              'n',
                              'cursor-ns-resize',
                              {
                                left: `${(cropNorm.x + cropNorm.w / 2) * 100}%`,
                                top: `${cropNorm.y * 100}%`,
                              },
                            ],
                            [
                              'ne',
                              'cursor-nesw-resize',
                              {
                                left: `${(cropNorm.x + cropNorm.w) * 100}%`,
                                top: `${cropNorm.y * 100}%`,
                              },
                            ],
                            [
                              'e',
                              'cursor-ew-resize',
                              {
                                left: `${(cropNorm.x + cropNorm.w) * 100}%`,
                                top: `${(cropNorm.y + cropNorm.h / 2) * 100}%`,
                              },
                            ],
                            [
                              'se',
                              'cursor-nwse-resize',
                              {
                                left: `${(cropNorm.x + cropNorm.w) * 100}%`,
                                top: `${(cropNorm.y + cropNorm.h) * 100}%`,
                              },
                            ],
                            [
                              's',
                              'cursor-ns-resize',
                              {
                                left: `${(cropNorm.x + cropNorm.w / 2) * 100}%`,
                                top: `${(cropNorm.y + cropNorm.h) * 100}%`,
                              },
                            ],
                            [
                              'sw',
                              'cursor-nesw-resize',
                              {
                                left: `${cropNorm.x * 100}%`,
                                top: `${(cropNorm.y + cropNorm.h) * 100}%`,
                              },
                            ],
                            [
                              'w',
                              'cursor-ew-resize',
                              {
                                left: `${cropNorm.x * 100}%`,
                                top: `${(cropNorm.y + cropNorm.h / 2) * 100}%`,
                              },
                            ],
                          ] as const
                        ).map(([h, cur, st]) => (
                          <div
                            key={h}
                            role="presentation"
                            className={clsx(
                              'pointer-events-auto absolute z-10 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-[2px] border-2 border-amber-200 bg-[#121212]',
                              cur,
                            )}
                            style={st}
                            onMouseDown={(e) => beginCropDrag(e, h)}
                          />
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <FileImage className="h-24 w-24 text-gray-600" />
                  </div>
                )}
              </div>
            </div>
            <div className="shrink-0 flex flex-col gap-3 rounded-xl border border-[#2d2d2d] bg-[#181818] p-3">
              {previewSrc ? (
                <div className="flex items-center justify-between gap-4 text-xs text-gray-400">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={setFit}
                      className="rounded px-2 py-1 text-gray-300 hover:bg-[#2d2d2d] transition-colors"
                      title="适配窗口"
                    >
                      适配
                    </button>
                    <button
                      type="button"
                      onClick={setOneToOne}
                      className="rounded px-2 py-1 text-gray-300 hover:bg-[#2d2d2d] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      title="100%（1:1 像素）"
                      disabled={!imgLayout?.scale}
                    >
                      100%
                    </button>
                  </div>

                  <div className="flex items-center gap-3 flex-1 max-w-[240px]">
                    <input
                      ref={zoomSliderRef}
                      type="range"
                      min={25}
                      max={400}
                      step={1}
                      value={sliderPercentValue}
                      disabled={!imgLayout?.scale}
                      onChange={(e) => applyViewPercent(parseInt(e.target.value, 10))}
                      className="min-w-0 flex-1 accent-blue-500"
                    />
                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        inputMode="numeric"
                        value={zoomPercentDraft}
                        disabled={!imgLayout?.scale}
                        onFocus={() => setZoomPercentEditing(true)}
                        onChange={(e) => setZoomPercentDraft(e.target.value)}
                        onBlur={() => commitZoomPercentInput()}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            commitZoomPercentInput()
                          }
                        }}
                        className="w-10 shrink-0 rounded border border-[#3d3d3d] bg-[#121212] px-1 py-0.5 text-center text-[11px] text-gray-100 tabular-nums focus:border-blue-500 focus:outline-none"
                        title="25–400，回车确认"
                        aria-label="缩放百分比"
                      />
                      <span className="shrink-0 text-gray-500">%</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-end w-[80px]">
                    {canPan ? (
                      <div className="flex items-center gap-1 text-[10px] text-gray-500">
                        <Hand className="h-3 w-3" />
                        <span>可拖动</span>
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {previewSrc && <div className="h-px w-full bg-[#2d2d2d]" />}

              <div className="flex items-center justify-between text-xs text-gray-400">
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2">
                    <span className="text-gray-500">背景</span>
                    <select
                      value={previewBgMode}
                      onChange={(e) => setPreviewBgMode(e.target.value as 'checker' | 'solid')}
                      className="rounded border border-[#3d3d3d] bg-[#121212] px-2 py-1 text-xs text-gray-200 focus:border-blue-500 focus:outline-none"
                    >
                      <option value="checker">棋盘格</option>
                      <option value="solid">纯色</option>
                    </select>
                  </label>
                  {previewBgMode === 'checker' ? (
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-2">
                        <span className="text-gray-500">浅</span>
                        <input
                          type="color"
                          value={checkerLight}
                          onChange={(e) => setCheckerLight(e.target.value)}
                          className="h-6 w-8 cursor-pointer rounded border border-[#3d3d3d] bg-[#121212] p-0"
                          aria-label="棋盘格浅色"
                        />
                      </label>
                      <label className="flex items-center gap-2">
                        <span className="text-gray-500">深</span>
                        <input
                          type="color"
                          value={checkerDark}
                          onChange={(e) => setCheckerDark(e.target.value)}
                          className="h-6 w-8 cursor-pointer rounded border border-[#3d3d3d] bg-[#121212] p-0"
                          aria-label="棋盘格深色"
                        />
                      </label>
                    </div>
                  ) : (
                    <label className="flex items-center gap-2">
                      <span className="text-gray-500">颜色</span>
                      <input
                        type="color"
                        value={solidBg}
                        onChange={(e) => setSolidBg(e.target.value)}
                        className="h-6 w-8 cursor-pointer rounded border border-[#3d3d3d] bg-[#121212] p-0"
                        aria-label="背景纯色"
                      />
                    </label>
                  )}
                </div>

                <label className="flex items-center gap-2 cursor-pointer">
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
