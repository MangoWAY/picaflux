import { MIN_CROP_NORM } from '@/lib/imageProcessOptions'

export type NormRect = { x: number; y: number; w: number; h: number }

export function clampCropNorm(
  x: number,
  y: number,
  w: number,
  h: number,
  min = MIN_CROP_NORM,
): NormRect {
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

/** 从归一化裁剪矩形推导四边像素内边距（相对视觉宽高 W×H） */
export function normToInsetPx(norm: NormRect, W: number, H: number) {
  const Wf = Math.max(1, W)
  const Hf = Math.max(1, H)
  const left = Math.round(norm.x * Wf)
  const top = Math.round(norm.y * Hf)
  const right = Math.max(0, Math.round(Wf - (norm.x + norm.w) * Wf))
  const bottom = Math.max(0, Math.round(Hf - (norm.y + norm.h) * Hf))
  return { left, top, right, bottom }
}

/**
 * 四边像素内边距 → 归一化裁剪（与预览拖动语义一致）。
 * 顺序：左、上、右、下（距各自边的距离）。
 */
export function insetsPxToNorm(
  left: number,
  top: number,
  right: number,
  bottom: number,
  W: number,
  H: number,
): NormRect {
  const Wf = Math.max(1, W)
  const Hf = Math.max(1, H)
  const minWpx = Math.max(1, Math.ceil(MIN_CROP_NORM * Wf))
  const minHpx = Math.max(1, Math.ceil(MIN_CROP_NORM * Hf))

  let l = Math.max(0, Math.round(left))
  let t = Math.max(0, Math.round(top))
  let r = Math.max(0, Math.round(right))
  let b = Math.max(0, Math.round(bottom))

  if (l + r > Wf - minWpx) {
    const excess = l + r - (Wf - minWpx)
    const takeL = Math.min(l, excess)
    l -= takeL
    r -= excess - takeL
  }
  if (t + b > Hf - minHpx) {
    const excess = t + b - (Hf - minHpx)
    const takeT = Math.min(t, excess)
    t -= takeT
    b -= excess - takeT
  }

  let wPx = Wf - l - r
  let hPx = Hf - t - b
  wPx = Math.max(minWpx, wPx)
  hPx = Math.max(minHpx, hPx)
  r = Wf - l - wPx
  b = Hf - t - hPx

  return clampCropNorm(l / Wf, t / Hf, wPx / Wf, hPx / Hf)
}
