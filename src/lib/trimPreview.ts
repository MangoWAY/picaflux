/**
 * 在渲染进程内模拟主进程 trim：在「与预览一致」的位图上计算透明边裁切后的保留矩形（归一化 0–1）。
 * 与 electron/main/image-processor.ts 中 applyTrimTransparent 的扫描逻辑一致。
 */

import type { NormRect } from '@/lib/cropNorm'

const DEFAULT_MAX_SIDE = 1400

/** 整幅图是否存在非不透明像素（与主进程「有 alpha 才 trim」语义接近） */
export function imageDataHasNonOpaqueAlpha(imageData: ImageData): boolean {
  const d = imageData.data
  for (let i = 3; i < d.length; i += 4) {
    if (d[i] !== 255) return true
  }
  return false
}

/** 将当前图按与预览相同的旋转/镜像绘制到 canvas，返回 ImageData（可下采样以控制耗时） */
export function renderVisualImageData(
  img: HTMLImageElement,
  visualW: number,
  visualH: number,
  rotateQuarterTurns: number,
  flipHorizontal: boolean,
  flipVertical: boolean,
  maxSide: number = DEFAULT_MAX_SIDE,
): ImageData | null {
  const nw = img.naturalWidth
  const nh = img.naturalHeight
  if (!nw || !nh || visualW <= 0 || visualH <= 0) return null

  const s = Math.min(1, maxSide / Math.max(visualW, visualH))
  const cw = Math.max(1, Math.round(visualW * s))
  const ch = Math.max(1, Math.round(visualH * s))

  const canvas = document.createElement('canvas')
  canvas.width = cw
  canvas.height = ch
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return null

  const rotateDeg = rotateQuarterTurns * 90
  ctx.save()
  ctx.scale(s, s)
  ctx.translate(visualW / 2, visualH / 2)
  ctx.rotate((rotateDeg * Math.PI) / 180)
  ctx.scale(flipHorizontal ? -1 : 1, flipVertical ? -1 : 1)
  ctx.drawImage(img, -nw / 2, -nh / 2)
  ctx.restore()

  return ctx.getImageData(0, 0, cw, ch)
}

function alphaBboxInRegion(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  channels: number,
  rx0: number,
  ry0: number,
  rw: number,
  rh: number,
): { minX: number; minY: number; maxX: number; maxY: number } | null {
  let minX = rw
  let minY = rh
  let maxX = -1
  let maxY = -1
  const x1 = Math.min(rx0 + rw, w)
  const y1 = Math.min(ry0 + rh, h)
  const x0 = Math.max(0, rx0)
  const y0 = Math.max(0, ry0)

  for (let y = y0; y < y1; y++) {
    const row = y * w * channels
    for (let x = x0; x < x1; x++) {
      const a = data[row + x * channels + 3]
      if (a !== 0) {
        const lx = x - rx0
        const ly = y - ry0
        if (lx < minX) minX = lx
        if (ly < minY) minY = ly
        if (lx > maxX) maxX = lx
        if (ly > maxY) maxY = ly
      }
    }
  }
  if (maxX < 0 || maxY < 0) return null
  return { minX, minY, maxX, maxY }
}

/**
 * 计算裁切透明边后的保留区域（相对整幅「视觉」尺寸的归一化矩形）。
 * @param cropNorm 当前裁剪（与导出一致：先裁剪再 trim）；未启用裁剪时传 {0,0,1,1}
 */
export function computeTrimNormRect(
  imageData: ImageData,
  cropNorm: NormRect,
  trimPaddingPx: number,
): NormRect | null {
  const w = imageData.width
  const h = imageData.height
  const channels = 4
  if (w <= 0 || h <= 0) return null

  const cx = Math.max(0, Math.min(1, cropNorm.x))
  const cy = Math.max(0, Math.min(1, cropNorm.y))
  const cwN = Math.max(0, Math.min(1, cropNorm.w))
  const chN = Math.max(0, Math.min(1, cropNorm.h))

  let rx0 = Math.round(cx * w)
  let ry0 = Math.round(cy * h)
  let rw = Math.max(1, Math.round(cwN * w))
  let rh = Math.max(1, Math.round(chN * h))
  rx0 = Math.max(0, Math.min(w - 1, rx0))
  ry0 = Math.max(0, Math.min(h - 1, ry0))
  rw = Math.max(1, Math.min(w - rx0, rw))
  rh = Math.max(1, Math.min(h - ry0, rh))

  const bbox = alphaBboxInRegion(imageData.data, w, h, channels, rx0, ry0, rw, rh)
  if (!bbox) return null

  const pad = Math.max(0, Math.round(trimPaddingPx))
  const left = Math.max(rx0, rx0 + bbox.minX - pad)
  const top = Math.max(ry0, ry0 + bbox.minY - pad)
  const right = Math.min(rx0 + rw - 1, rx0 + bbox.maxX + pad)
  const bottom = Math.min(ry0 + rh - 1, ry0 + bbox.maxY + pad)
  const tw = Math.max(1, right - left + 1)
  const th = Math.max(1, bottom - top + 1)

  return {
    x: left / w,
    y: top / h,
    w: tw / w,
    h: th / h,
  }
}
