/**
 * 与 electron/main/image-processor.ts 中 DEFAULT_FIXED_WATERMARK_REGION_PERCENT 保持一致
 */
export const FIXED_WATERMARK_DEFAULTS = {
  leftPercent: '80',
  topPercent: '90',
  widthPercent: '20',
  heightPercent: '10',
} as const
