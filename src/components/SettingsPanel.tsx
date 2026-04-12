import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import clsx from 'clsx'
import {
  FolderOpen,
  SlidersHorizontal,
  Play,
  RotateCcw,
  RotateCw,
  FlipHorizontal,
  FlipVertical,
  ChevronDown,
  ChevronRight,
  BookmarkPlus,
  Trash2,
  Crop,
  ScanLine,
  Maximize2,
  Rotate3d,
  Sparkles,
  SquareDashed,
  LayoutGrid,
} from 'lucide-react'
import type { ImageProcessPresetRecord } from '@/lib/imagePreset'
import { insetsPxToNorm, normToInsetPx } from '@/lib/cropNorm'
import {
  isOutputFormatOption,
  type OutputFormatOption,
  type ProcessOptions,
} from '@/lib/imageProcessOptions'

/** 与下拉选项一致，用于 title 提示（窄宽度时「与原图相同」可能被裁切） */
const IMAGE_FORMAT_OPTION_LABEL: Record<OutputFormatOption, string> = {
  original: '与原图相同',
  png: 'PNG',
  jpeg: 'JPEG',
  webp: 'WebP',
  avif: 'AVIF',
}

export type {
  OutputFormatOption,
  ProcessOptions,
  ResizePercentPreset,
} from '@/lib/imageProcessOptions'

/** iOS 风格开关：必须为 ::after 设置 content，否则滑块不显示 */
function PanelToggle({
  checked,
  onChange,
  ariaLabel,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  ariaLabel: string
}) {
  return (
    <label className="inline-flex shrink-0 cursor-pointer items-center">
      <input
        type="checkbox"
        role="switch"
        aria-checked={checked}
        aria-label={ariaLabel}
        className="peer sr-only"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="relative h-6 w-11 shrink-0 rounded-full bg-[#3d3d3d] transition-colors after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow-sm after:transition-transform after:content-[''] peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-blue-500/80 peer-checked:bg-blue-600 peer-checked:after:translate-x-5" />
    </label>
  )
}

/** 几何区数值输入：统一质感（内阴影、圆角、聚焦环） */
const GEOMETRY_NUM_FIELD =
  'min-w-0 w-full rounded-lg border border-[#383838] bg-[#101010] px-2 py-2 text-center text-sm tabular-nums text-gray-100 shadow-[inset_0_1px_2px_rgba(0,0,0,0.45)] transition placeholder:text-gray-600 focus:border-blue-500/55 focus:outline-none focus:ring-2 focus:ring-blue-500/15'

/** 单行短数字（如边距 px） */
const GEOMETRY_NUM_FIELD_COMPACT =
  'rounded-lg border border-[#383838] bg-[#101010] py-1.5 pl-2.5 pr-7 text-right text-sm tabular-nums text-gray-100 shadow-[inset_0_1px_2px_rgba(0,0,0,0.45)] transition focus:border-blue-500/55 focus:outline-none focus:ring-2 focus:ring-blue-500/15'

interface SettingsPanelProps {
  options: ProcessOptions
  onChange: (options: ProcessOptions) => void
  onSelectOutputDir: () => void
  onStartProcessing: () => void
  isProcessing: boolean
  /** 勾选参与处理的数量 */
  selectedForProcessCount: number
  totalImageCount: number
  imagePresets: ImageProcessPresetRecord[]
  onApplyImagePreset: (id: string) => void
  onSaveImagePreset: (name: string) => Promise<{ success: boolean; error?: string }>
  onDeleteImagePreset: (id: string) => Promise<{ success: boolean; error?: string }>
  /** 批量处理时当前序号；仅当 total 大于 1 时展示 */
  batchProgress: { current: number; total: number } | null
  /** 预览中当前图的「视觉」像素尺寸，用于裁剪四边数值与拖动同步 */
  cropVisualPx: { w: number; h: number } | null
  /** 当前「格式」是否与所有勾选文件的扩展名一致（覆盖原图仅此时可用） */
  overwriteCompatibleWithFormat: boolean
}

export function SettingsPanel({
  options,
  onChange,
  onSelectOutputDir,
  onStartProcessing,
  isProcessing,
  selectedForProcessCount,
  totalImageCount,
  imagePresets,
  onApplyImagePreset,
  onSaveImagePreset,
  onDeleteImagePreset,
  batchProgress,
  cropVisualPx,
  overwriteCompatibleWithFormat,
}: SettingsPanelProps) {
  const updateOption = <K extends keyof ProcessOptions>(key: K, value: ProcessOptions[K]) => {
    onChange({ ...options, [key]: value })
  }

  const [selectedPresetId, setSelectedPresetId] = useState('')
  const [newPresetName, setNewPresetName] = useState('')
  const [presetMessage, setPresetMessage] = useState<string | null>(null)
  /** 预设管理 UI：默认关闭，开启后才显示下拉与保存等 */
  const [presetSectionEnabled, setPresetSectionEnabled] = useState(false)
  const [geometryResizeOpen, setGeometryResizeOpen] = useState(false)

  const cropInsetsPx = useMemo(() => {
    if (!cropVisualPx || cropVisualPx.w <= 0 || cropVisualPx.h <= 0) {
      return { left: 0, top: 0, right: 0, bottom: 0 }
    }
    return normToInsetPx(options.cropNorm, cropVisualPx.w, cropVisualPx.h)
  }, [options.cropNorm, cropVisualPx])

  /** 开启旋转与镜像时，展示当前非单位变换摘要（无则不显示） */
  const rotateStatusHint = useMemo(() => {
    const q = ((options.rotateQuarterTurns % 4) + 4) % 4
    const parts: string[] = []
    if (q !== 0) parts.push(`${q * 90}°`)
    if (options.flipHorizontal) parts.push('水平翻转')
    if (options.flipVertical) parts.push('垂直翻转')
    return parts.length > 0 ? parts.join(' · ') : null
  }, [options.rotateQuarterTurns, options.flipHorizontal, options.flipVertical])

  const resizeSummary = useMemo(() => {
    if (options.resizeMode === 'pixels' && (options.width.trim() || options.height.trim())) {
      return `${options.width.trim() || '?'}×${options.height.trim() || '?'}`
    }
    if (options.resizeMode !== 'percent') return null
    switch (options.resizePercentPreset) {
      case 'p75':
        return '75%'
      case 'p50':
        return '50%'
      case 'p25':
        return '25%'
      case 'custom':
        return `${options.resizeCustomPercentStr.trim() || '?'}%`
      default:
        return null
    }
  }, [
    options.resizeMode,
    options.resizePercentPreset,
    options.resizeCustomPercentStr,
    options.width,
    options.height,
  ])

  useEffect(() => {
    if (selectedPresetId && !imagePresets.some((p) => p.id === selectedPresetId)) {
      setSelectedPresetId('')
    }
  }, [imagePresets, selectedPresetId])

  const qualitySliderRef = useRef<HTMLInputElement>(null)
  useLayoutEffect(() => {
    const el = qualitySliderRef.current
    if (!el) return
    const stop = (e: WheelEvent) => e.preventDefault()
    el.addEventListener('wheel', stop, { passive: false })
    return () => el.removeEventListener('wheel', stop)
  }, [])

  const canStart =
    selectedForProcessCount > 0 &&
    (options.overwriteOriginal ? overwriteCompatibleWithFormat : Boolean(options.outputDir.trim()))

  const overwriteCheckboxDisabled =
    options.sliceEnabled || isProcessing || !overwriteCompatibleWithFormat

  return (
    <div
      className="flex h-full min-h-0 w-[min(100%,22rem)] shrink-0 flex-col border-l border-[#2d2d2d] bg-[#1e1e1e] text-gray-300"
      style={{ overflow: 'hidden' }}
    >
      <div className="h-14 shrink-0 flex flex-col justify-center border-b border-[#2d2d2d] px-4">
        <div className="flex items-center">
          <SlidersHorizontal className="mr-2 h-5 w-5 text-gray-400" />
          <h2 className="font-semibold text-white">图片处理</h2>
        </div>
        {totalImageCount > 0 && (
          <p
            className="mt-0.5 pl-7 text-[11px] text-gray-500"
            title="将使用当前右侧参数处理的勾选图片数"
          >
            已选 {selectedForProcessCount} 张
          </p>
        )}
      </div>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[#1e1e1e]">
        <div
          className="min-h-0 flex-1 space-y-4 overflow-x-hidden overflow-y-auto px-4 py-3"
          style={{ overscrollBehavior: 'none' }}
        >
          <>
            <div
              className="overflow-hidden rounded-xl border border-[#2d2d2d] bg-[#181818]"
              title="保存当前全部处理参数（不含输出目录与预览裁剪框）。最多 40 条，超出时删除最旧一条。"
            >
              <div className="flex items-center justify-between gap-3 px-3 py-2">
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <BookmarkPlus className="h-4 w-4 shrink-0 text-gray-400" aria-hidden />
                  <span className="shrink-0 text-sm font-medium text-gray-200">预设</span>
                </div>
                <PanelToggle
                  checked={presetSectionEnabled}
                  onChange={(v) => {
                    setPresetSectionEnabled(v)
                    if (!v) setPresetMessage(null)
                  }}
                  ariaLabel="启用预设管理"
                />
              </div>
              {presetSectionEnabled ? (
                <div className="space-y-1.5 border-t border-[#2d2d2d] px-3 pb-3 pt-2">
                  <div className="flex min-w-0 gap-1">
                    <select
                      value={selectedPresetId}
                      onChange={(e) => {
                        setSelectedPresetId(e.target.value)
                        setPresetMessage(null)
                      }}
                      disabled={isProcessing}
                      className="min-w-0 flex-1 rounded-md border border-[#3d3d3d] bg-[#121212] px-2 py-1.5 text-xs text-white focus:border-blue-500 focus:outline-none"
                    >
                      <option value="">选择…</option>
                      {imagePresets.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={isProcessing || !selectedPresetId}
                      title="载入预设"
                      onClick={() => {
                        setPresetMessage(null)
                        onApplyImagePreset(selectedPresetId)
                      }}
                      className="shrink-0 rounded-md border border-[#3d3d3d] bg-[#121212] px-2 py-1.5 text-[11px] font-medium text-gray-200 transition-colors hover:border-blue-500/40 hover:bg-[#1e1e1e] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      载入
                    </button>
                    <button
                      type="button"
                      disabled={isProcessing || !selectedPresetId}
                      title="删除预设"
                      onClick={async () => {
                        setPresetMessage(null)
                        const r = await onDeleteImagePreset(selectedPresetId)
                        if (!r.success) setPresetMessage(r.error ?? '删除失败')
                      }}
                      className="shrink-0 rounded-md border border-[#3d3d3d] bg-[#121212] p-1.5 text-gray-400 transition-colors hover:border-red-500/40 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="flex min-w-0 gap-1">
                    <input
                      type="text"
                      value={newPresetName}
                      onChange={(e) => {
                        setNewPresetName(e.target.value)
                        setPresetMessage(null)
                      }}
                      placeholder="新名称"
                      disabled={isProcessing}
                      maxLength={80}
                      className="min-w-0 flex-1 rounded-md border border-[#3d3d3d] bg-[#121212] px-2 py-1.5 text-xs text-white placeholder-gray-600 focus:border-blue-500 focus:outline-none"
                    />
                    <button
                      type="button"
                      disabled={isProcessing || !newPresetName.trim()}
                      onClick={async () => {
                        setPresetMessage(null)
                        const r = await onSaveImagePreset(newPresetName.trim())
                        if (r.success) setNewPresetName('')
                        else setPresetMessage(r.error ?? '保存失败')
                      }}
                      className="shrink-0 rounded-md bg-blue-600 px-2.5 py-1.5 text-[11px] font-medium text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-gray-700 disabled:text-gray-500"
                    >
                      保存
                    </button>
                  </div>
                  {presetMessage ? (
                    <p className="text-[10px] leading-snug text-amber-500/95">{presetMessage}</p>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="overflow-hidden rounded-xl border border-[#2d2d2d] bg-[#181818]">
              <div className="flex items-center justify-between gap-3 px-3 py-2">
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <Rotate3d className="h-4 w-4 shrink-0 text-gray-400" aria-hidden />
                  <span className="shrink-0 text-sm font-medium text-gray-200">旋转与镜像</span>
                  {options.rotateMirrorEnabled && rotateStatusHint ? (
                    <span
                      className="min-w-0 truncate text-xs text-gray-500"
                      title={rotateStatusHint}
                    >
                      {rotateStatusHint}
                    </span>
                  ) : null}
                </div>
                <PanelToggle
                  checked={options.rotateMirrorEnabled}
                  onChange={(v) => updateOption('rotateMirrorEnabled', v)}
                  ariaLabel="启用旋转与镜像"
                />
              </div>
              {options.rotateMirrorEnabled ? (
                <div className="space-y-2 border-t border-[#2d2d2d] px-3 pb-3 pt-2">
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() =>
                        onChange({
                          ...options,
                          rotateQuarterTurns: 0,
                          flipHorizontal: false,
                          flipVertical: false,
                        })
                      }
                      className="text-xs font-medium text-blue-400/95 transition hover:text-blue-300"
                    >
                      重置
                    </button>
                  </div>
                  <div className="grid grid-cols-4 gap-1.5">
                    <button
                      type="button"
                      aria-label="逆时针旋转 90°"
                      title="逆时针 90°"
                      onClick={() =>
                        updateOption('rotateQuarterTurns', options.rotateQuarterTurns - 1)
                      }
                      className="flex items-center justify-center rounded-md border border-[#3d3d3d] bg-[#121212] py-2.5 text-gray-200 transition-colors hover:border-blue-500/50 hover:bg-[#1e1e1e]"
                    >
                      <RotateCcw className="h-5 w-5 shrink-0" />
                    </button>
                    <button
                      type="button"
                      aria-label="顺时针旋转 90°"
                      title="顺时针 90°"
                      onClick={() =>
                        updateOption('rotateQuarterTurns', options.rotateQuarterTurns + 1)
                      }
                      className="flex items-center justify-center rounded-md border border-[#3d3d3d] bg-[#121212] py-2.5 text-gray-200 transition-colors hover:border-blue-500/50 hover:bg-[#1e1e1e]"
                    >
                      <RotateCw className="h-5 w-5 shrink-0" />
                    </button>
                    <button
                      type="button"
                      aria-label="水平镜像"
                      title="水平镜像"
                      onClick={() => updateOption('flipHorizontal', !options.flipHorizontal)}
                      className={`flex items-center justify-center rounded-md border py-2.5 transition-colors ${
                        options.flipHorizontal
                          ? 'border-blue-500/60 bg-blue-500/15 text-blue-200'
                          : 'border-[#3d3d3d] bg-[#121212] text-gray-200 hover:border-blue-500/50 hover:bg-[#1e1e1e]'
                      }`}
                    >
                      <FlipHorizontal className="h-5 w-5 shrink-0" />
                    </button>
                    <button
                      type="button"
                      aria-label="垂直镜像"
                      title="垂直镜像"
                      onClick={() => updateOption('flipVertical', !options.flipVertical)}
                      className={`flex items-center justify-center rounded-md border py-2.5 transition-colors ${
                        options.flipVertical
                          ? 'border-blue-500/60 bg-blue-500/15 text-blue-200'
                          : 'border-[#3d3d3d] bg-[#121212] text-gray-200 hover:border-blue-500/50 hover:bg-[#1e1e1e]'
                      }`}
                    >
                      <FlipVertical className="h-5 w-5 shrink-0" />
                    </button>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="overflow-hidden rounded-xl border border-[#2d2d2d] bg-[#181818]">
              <div className="flex items-center justify-between gap-3 px-3 py-2">
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <Crop className="h-4 w-4 shrink-0 text-gray-400" aria-hidden />
                  <span
                    className="min-w-0 text-sm font-medium text-gray-200"
                    title="开启后在预览中拖动画框；导出与切图会在旋转/镜像之后先裁剪"
                  >
                    裁剪
                  </span>
                </div>
                <PanelToggle
                  checked={options.cropEnabled}
                  onChange={(v) =>
                    onChange({
                      ...options,
                      cropEnabled: v,
                      cropNorm: v
                        ? options.cropNorm.w > 0 && options.cropNorm.h > 0
                          ? options.cropNorm
                          : { x: 0, y: 0, w: 1, h: 1 }
                        : options.cropNorm,
                    })
                  }
                  ariaLabel="裁剪"
                />
              </div>
              {options.cropEnabled ? (
                <div className="border-t border-[#2d2d2d] px-3 pb-3 pt-3">
                  <div className="mb-3 flex items-center justify-between gap-2 border-b border-[#2a2a2a] pb-3">
                    <span className="text-[11px] font-medium tracking-wide text-gray-500">
                      四边距（px）
                    </span>
                    <button
                      type="button"
                      onClick={() => onChange({ ...options, cropNorm: { x: 0, y: 0, w: 1, h: 1 } })}
                      className="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-blue-400/95 transition hover:bg-blue-500/10 hover:text-blue-300"
                    >
                      重置
                    </button>
                  </div>
                  {cropVisualPx ? (
                    <div className="flex min-w-0 gap-3">
                      {(
                        [
                          { key: 'left' as const, label: '左', title: '距图像左侧' },
                          { key: 'top' as const, label: '上', title: '距图像上侧' },
                          { key: 'right' as const, label: '右', title: '距图像右侧' },
                          { key: 'bottom' as const, label: '下', title: '距图像下侧' },
                        ] as const
                      ).map(({ key, label, title }) => (
                        <div
                          key={key}
                          className="flex min-w-0 flex-1 basis-0 flex-col gap-2"
                          title={title}
                        >
                          <span className="block text-center text-[11px] font-medium text-gray-500">
                            {label}
                          </span>
                          <input
                            type="number"
                            min={0}
                            aria-label={`裁剪${label}边距像素`}
                            value={cropInsetsPx[key]}
                            onChange={(e) => {
                              const n = parseInt(e.target.value, 10)
                              const v = Number.isFinite(n) ? Math.max(0, n) : 0
                              if (!cropVisualPx) return
                              const W = cropVisualPx.w
                              const H = cropVisualPx.h
                              const next = { ...cropInsetsPx, [key]: v }
                              onChange({
                                ...options,
                                cropNorm: insetsPxToNorm(
                                  next.left,
                                  next.top,
                                  next.right,
                                  next.bottom,
                                  W,
                                  H,
                                ),
                              })
                            }}
                            className={GEOMETRY_NUM_FIELD}
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="rounded-lg border border-dashed border-[#3a3a3a] bg-[#141414] px-3 py-2.5 text-center text-[11px] leading-relaxed text-gray-500">
                      加载预览图后可输入像素，或与预览中拖拽同步
                    </p>
                  )}
                </div>
              ) : null}
            </div>

            <div className="overflow-hidden rounded-xl border border-[#2d2d2d] bg-[#181818]">
              <div className="flex items-center justify-between gap-3 px-3 py-2">
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <ScanLine className="h-4 w-4 shrink-0 text-gray-400" aria-hidden />
                  <span
                    className="min-w-0 text-sm font-medium text-gray-200"
                    title="去除四周全透明像素；预览中绿色虚线框为保留区域；默认额外保留 2px（可调）"
                  >
                    裁切透明边
                  </span>
                </div>
                <PanelToggle
                  checked={options.trimTransparent}
                  onChange={(v) => updateOption('trimTransparent', v)}
                  ariaLabel="裁切透明边"
                />
              </div>
              {options.trimTransparent ? (
                <div className="border-t border-[#2d2d2d] px-3 pb-2.5 pt-2.5">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    <span className="text-[11px] font-medium text-gray-500">额外保留</span>
                    <div className="relative inline-flex shrink-0">
                      <input
                        type="number"
                        min={0}
                        max={512}
                        step={1}
                        aria-label="裁切透明边额外保留像素"
                        value={options.trimPaddingPx}
                        onChange={(e) => updateOption('trimPaddingPx', e.target.value)}
                        className={clsx(GEOMETRY_NUM_FIELD_COMPACT, 'w-[4.25rem]')}
                      />
                      <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[11px] font-medium text-gray-500">
                        px
                      </span>
                    </div>
                    <span className="text-[10px] text-gray-600">透明区域外扩</span>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="min-w-0 overflow-hidden rounded-xl border border-[#2d2d2d] bg-[#181818]">
              <button
                type="button"
                onClick={() => setGeometryResizeOpen((o) => !o)}
                className="flex w-full min-w-0 items-center justify-between gap-2 px-3 py-2.5 text-left transition-colors hover:bg-[#222]"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <Maximize2 className="h-4 w-4 shrink-0 text-gray-400" aria-hidden />
                  <span className="text-sm font-medium text-gray-200">缩放</span>
                  {resizeSummary ? (
                    <span className="truncate text-xs text-blue-300/90">{resizeSummary}</span>
                  ) : (
                    <span className="text-xs text-gray-500">未启用</span>
                  )}
                </div>
                {geometryResizeOpen ? (
                  <ChevronDown className="h-4 w-4 shrink-0 text-gray-500" />
                ) : (
                  <ChevronRight className="h-4 w-4 shrink-0 text-gray-500" />
                )}
              </button>
              {geometryResizeOpen ? (
                <div className="space-y-3 border-t border-[#2d2d2d] px-3 pb-3 pt-2">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        onChange({
                          ...options,
                          resizeMode: 'percent',
                          resizePixelsExpanded: false,
                          width: '',
                          height: '',
                        })
                      }
                      className={clsx(
                        'rounded-md border py-2 text-center text-xs font-medium transition-colors',
                        options.resizeMode === 'percent'
                          ? 'border-blue-500/60 bg-blue-500/15 text-blue-200'
                          : 'border-[#3d3d3d] bg-[#121212] text-gray-400 hover:border-blue-500/40',
                      )}
                    >
                      按比例
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        onChange({
                          ...options,
                          resizeMode: 'pixels',
                          resizePixelsExpanded: true,
                          resizePercentPreset: 'none',
                        })
                      }
                      className={clsx(
                        'rounded-md border py-2 text-center text-xs font-medium transition-colors',
                        options.resizeMode === 'pixels'
                          ? 'border-blue-500/60 bg-blue-500/15 text-blue-200'
                          : 'border-[#3d3d3d] bg-[#121212] text-gray-400 hover:border-blue-500/40',
                      )}
                    >
                      指定宽高
                    </button>
                  </div>

                  {options.resizeMode === 'percent' ? (
                    <>
                      <div
                        className="grid min-w-0 grid-cols-4 gap-1.5"
                        title="与指定宽高二选一；再点同一比例可清除"
                      >
                        {(
                          [
                            { preset: 'p75' as const, label: '75%' },
                            { preset: 'p50' as const, label: '50%' },
                            { preset: 'p25' as const, label: '25%' },
                          ] as const
                        ).map(({ preset, label }) => {
                          const active =
                            options.resizeMode === 'percent' &&
                            options.resizePercentPreset === preset
                          return (
                            <button
                              key={preset}
                              type="button"
                              onClick={() => {
                                const turnOff = active
                                onChange({
                                  ...options,
                                  resizeMode: 'percent',
                                  resizePercentPreset: turnOff ? 'none' : preset,
                                  resizePixelsExpanded: false,
                                })
                              }}
                              className={clsx(
                                'min-w-0 rounded-md border py-2 text-center text-xs font-medium transition-colors',
                                active
                                  ? 'border-blue-500/60 bg-blue-500/15 text-blue-200'
                                  : 'border-[#3d3d3d] bg-[#121212] text-gray-300 hover:border-blue-500/40 hover:bg-[#1e1e1e]',
                              )}
                            >
                              {label}
                            </button>
                          )
                        })}
                        <button
                          type="button"
                          onClick={() => {
                            const active =
                              options.resizeMode === 'percent' &&
                              options.resizePercentPreset === 'custom'
                            onChange({
                              ...options,
                              resizeMode: 'percent',
                              resizePercentPreset: active ? 'none' : 'custom',
                              resizePixelsExpanded: false,
                            })
                          }}
                          className={clsx(
                            'min-w-0 rounded-md border py-2 text-center text-xs font-medium transition-colors',
                            options.resizeMode === 'percent' &&
                              options.resizePercentPreset === 'custom'
                              ? 'border-blue-500/60 bg-blue-500/15 text-blue-200'
                              : 'border-[#3d3d3d] bg-[#121212] text-gray-300 hover:border-blue-500/40 hover:bg-[#1e1e1e]',
                          )}
                        >
                          自定义
                        </button>
                      </div>
                      {options.resizePercentPreset === 'custom' ? (
                        <div className="flex min-w-0 items-center gap-2">
                          <input
                            type="number"
                            min={1}
                            max={400}
                            step={1}
                            value={options.resizeCustomPercentStr}
                            onChange={(e) => updateOption('resizeCustomPercentStr', e.target.value)}
                            className="min-w-0 max-w-full flex-1 rounded-md border border-[#3d3d3d] bg-[#121212] px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
                          />
                          <span className="shrink-0 text-sm text-gray-500">%</span>
                        </div>
                      ) : null}
                    </>
                  ) : (
                    <div className="min-w-0 space-y-2">
                      <div className="grid min-w-0 grid-cols-[1fr_auto_1fr] items-center gap-2">
                        <input
                          type="number"
                          placeholder="宽"
                          value={options.width}
                          onChange={(e) => updateOption('width', e.target.value)}
                          className="min-w-0 max-w-full rounded-md border border-[#3d3d3d] bg-[#121212] px-2 py-2 text-sm text-white placeholder-gray-600 focus:border-blue-500 focus:outline-none"
                        />
                        <span className="shrink-0 px-0.5 text-center text-gray-500">×</span>
                        <input
                          type="number"
                          placeholder="高"
                          value={options.height}
                          onChange={(e) => updateOption('height', e.target.value)}
                          className="min-w-0 max-w-full rounded-md border border-[#3d3d3d] bg-[#121212] px-2 py-2 text-sm text-white placeholder-gray-600 focus:border-blue-500 focus:outline-none"
                        />
                      </div>
                      <label className="flex cursor-pointer items-center gap-2">
                        <input
                          type="checkbox"
                          checked={options.keepAspectRatio}
                          onChange={(e) => updateOption('keepAspectRatio', e.target.checked)}
                          className="rounded border-[#3d3d3d] bg-[#121212] text-blue-500 focus:ring-blue-500 focus:ring-offset-0"
                        />
                        <span className="text-sm text-gray-400">保持宽高比</span>
                      </label>
                    </div>
                  )}
                </div>
              ) : null}
            </div>

            <div className="overflow-hidden rounded-xl border border-[#2d2d2d] bg-[#181818]">
              <div className="flex items-center justify-between gap-3 px-3 py-2">
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <Sparkles className="h-4 w-4 shrink-0 text-gray-400" aria-hidden />
                  <span className="text-sm font-medium text-gray-200" title="AI 自动抠图">
                    去除背景
                  </span>
                </div>
                <PanelToggle
                  checked={options.removeBackground}
                  onChange={(v) => updateOption('removeBackground', v)}
                  ariaLabel="去除背景"
                />
              </div>
            </div>

            <div className="overflow-hidden rounded-xl border border-[#2d2d2d] bg-[#181818]">
              <div className="flex items-center justify-between gap-3 px-3 py-2">
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <SquareDashed className="h-4 w-4 shrink-0 text-gray-400" aria-hidden />
                  <span
                    className="min-w-0 text-sm font-medium text-gray-200"
                    title="将选中矩形区域清除为透明"
                  >
                    固定透明区域
                  </span>
                </div>
                <PanelToggle
                  checked={options.clearFixedWatermark}
                  onChange={(v) => updateOption('clearFixedWatermark', v)}
                  ariaLabel="固定透明区域"
                />
              </div>
              {options.clearFixedWatermark ? (
                <div className="border-t border-[#2d2d2d] px-3 pb-3 pt-2">
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <label className="text-gray-500">
                      左 %
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={0.1}
                        value={options.watermarkLeftPct}
                        onChange={(e) => updateOption('watermarkLeftPct', e.target.value)}
                        className={clsx(GEOMETRY_NUM_FIELD, 'mt-1.5')}
                      />
                    </label>
                    <label className="text-gray-500">
                      上 %
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={0.1}
                        value={options.watermarkTopPct}
                        onChange={(e) => updateOption('watermarkTopPct', e.target.value)}
                        className={clsx(GEOMETRY_NUM_FIELD, 'mt-1.5')}
                      />
                    </label>
                    <label className="text-gray-500">
                      宽 %
                      <input
                        type="number"
                        min={0.5}
                        max={100}
                        step={0.1}
                        value={options.watermarkWidthPct}
                        onChange={(e) => updateOption('watermarkWidthPct', e.target.value)}
                        className={clsx(GEOMETRY_NUM_FIELD, 'mt-1.5')}
                      />
                    </label>
                    <label className="text-gray-500">
                      高 %
                      <input
                        type="number"
                        min={0.5}
                        max={100}
                        step={0.1}
                        value={options.watermarkHeightPct}
                        onChange={(e) => updateOption('watermarkHeightPct', e.target.value)}
                        className={clsx(GEOMETRY_NUM_FIELD, 'mt-1.5')}
                      />
                    </label>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="overflow-hidden rounded-xl border border-[#2d2d2d] bg-[#181818]">
              <div className="flex items-center justify-between gap-3 px-3 py-2">
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <LayoutGrid className="h-4 w-4 shrink-0 text-gray-400" aria-hidden />
                  <span
                    className="min-w-0 text-sm font-medium text-gray-200"
                    title="按行数与列数均分切片"
                  >
                    网格切图
                  </span>
                </div>
                <PanelToggle
                  checked={options.sliceEnabled}
                  onChange={(v) => {
                    const updates: Partial<ProcessOptions> = { sliceEnabled: v }
                    if (v) {
                      updates.overwriteOriginal = false
                      const rows = parseInt(options.sliceRows, 10)
                      const cols = parseInt(options.sliceCols, 10)
                      if (options.sliceYLines === undefined && Number.isFinite(rows) && rows > 0) {
                        updates.sliceYLines =
                          rows > 1 ? Array.from({ length: rows - 1 }, (_, i) => (i + 1) / rows) : []
                      }
                      if (options.sliceXLines === undefined && Number.isFinite(cols) && cols > 0) {
                        updates.sliceXLines =
                          cols > 1 ? Array.from({ length: cols - 1 }, (_, i) => (i + 1) / cols) : []
                      }
                    }
                    onChange({ ...options, ...updates })
                  }}
                  ariaLabel="网格切图"
                />
              </div>
              {options.sliceEnabled ? (
                <div className="border-t border-[#2d2d2d] px-3 pb-3 pt-2">
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <label className="text-gray-500">
                      行数
                      <input
                        type="number"
                        min={1}
                        max={64}
                        step={1}
                        value={options.sliceRows}
                        onChange={(e) => {
                          const val = e.target.value
                          const rows = parseInt(val, 10)
                          let yLines: number[] | undefined
                          if (Number.isFinite(rows) && rows > 1) {
                            yLines = Array.from({ length: rows - 1 }, (_, i) => (i + 1) / rows)
                          } else if (rows === 1) {
                            yLines = []
                          }
                          onChange({ ...options, sliceRows: val, sliceYLines: yLines })
                        }}
                        className={clsx(GEOMETRY_NUM_FIELD, 'mt-1.5')}
                      />
                    </label>
                    <label className="text-gray-500">
                      列数
                      <input
                        type="number"
                        min={1}
                        max={64}
                        step={1}
                        value={options.sliceCols}
                        onChange={(e) => {
                          const val = e.target.value
                          const cols = parseInt(val, 10)
                          let xLines: number[] | undefined
                          if (Number.isFinite(cols) && cols > 1) {
                            xLines = Array.from({ length: cols - 1 }, (_, i) => (i + 1) / cols)
                          } else if (cols === 1) {
                            xLines = []
                          }
                          onChange({ ...options, sliceCols: val, sliceXLines: xLines })
                        }}
                        className={clsx(GEOMETRY_NUM_FIELD, 'mt-1.5')}
                      />
                    </label>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="overflow-hidden rounded-xl border border-[#2d2d2d] bg-[#181818] px-3 py-2.5">
              <div className="flex min-w-0 flex-nowrap items-center gap-2">
                <label
                  htmlFor="image-output-format"
                  className="shrink-0 text-[11px] font-medium text-gray-500"
                >
                  格式
                </label>
                <select
                  id="image-output-format"
                  value={options.format}
                  onChange={(e) => {
                    const v = e.target.value
                    if (isOutputFormatOption(v)) updateOption('format', v)
                  }}
                  className="w-[6rem] shrink-0 rounded-lg border border-[#383838] bg-[#101010] py-1.5 pl-2 pr-7 text-sm text-white focus:border-blue-500/55 focus:outline-none focus:ring-2 focus:ring-blue-500/15"
                  title={IMAGE_FORMAT_OPTION_LABEL[options.format]}
                >
                  <option value="original">与原图相同</option>
                  <option value="png">PNG</option>
                  <option value="jpeg">JPEG</option>
                  <option value="webp">WebP</option>
                  <option value="avif">AVIF</option>
                </select>
                <label
                  htmlFor="image-output-quality"
                  className="ml-1 shrink-0 text-[11px] font-medium text-gray-500"
                >
                  质量
                </label>
                <input
                  ref={qualitySliderRef}
                  id="image-output-quality"
                  type="range"
                  min="1"
                  max="100"
                  value={options.quality}
                  onChange={(e) => updateOption('quality', parseInt(e.target.value))}
                  className="min-w-[5rem] flex-1 accent-blue-500"
                  aria-valuetext={`${options.quality}%`}
                />
                <span className="w-9 shrink-0 text-right text-xs tabular-nums text-gray-400">
                  {options.quality}%
                </span>
              </div>
            </div>
          </>
        </div>

        <div className="shrink-0 space-y-2 border-t border-[#2d2d2d] bg-[#1e1e1e] px-4 py-2.5">
          <div className="space-y-2">
            <label
              className={clsx(
                'flex cursor-pointer items-center gap-2 text-sm text-gray-300',
                overwriteCheckboxDisabled && 'cursor-not-allowed opacity-60',
              )}
              title={
                options.sliceEnabled
                  ? '网格切图时不可用覆盖原图'
                  : !overwriteCompatibleWithFormat
                    ? '仅当导出扩展名与所选源文件一致时可覆盖（请使用「与原图相同」或选择与源文件相同的格式）'
                    : '导出到源路径并替换原文件，与下方输出目录二选一'
              }
            >
              <input
                type="checkbox"
                className="h-4 w-4 shrink-0 rounded border-[#3d3d3d] bg-[#121212] text-blue-600 focus:ring-blue-500/30 disabled:cursor-not-allowed"
                checked={options.overwriteOriginal}
                disabled={overwriteCheckboxDisabled}
                onChange={(e) => {
                  const next = e.target.checked
                  if (next) {
                    const ok = window.confirm(
                      '启用「覆盖原图」后，处理结果将直接替换磁盘上的原始文件，此操作不可撤销。\n\n确定要继续吗？',
                    )
                    if (!ok) return
                  }
                  updateOption('overwriteOriginal', next)
                }}
              />
              <span className="min-w-0 flex-1 truncate">
                <span className="font-medium text-gray-200">覆盖原图</span>
                <span className="ml-1.5 text-xs text-gray-500">
                  与输出目录二选一
                  {options.sliceEnabled ? ' · 切图不可用' : ''}
                  {!options.sliceEnabled &&
                  !overwriteCompatibleWithFormat &&
                  selectedForProcessCount > 0
                    ? ' · 需与源扩展名一致'
                    : null}
                </span>
              </span>
            </label>
            <label className="text-sm font-medium text-gray-400">输出目录</label>
            <div className="flex gap-2">
              <div
                className={clsx(
                  'flex-1 truncate rounded-md border border-[#3d3d3d] bg-[#121212] px-3 py-2 text-sm text-gray-400',
                  options.overwriteOriginal && 'opacity-60',
                )}
                title={
                  options.overwriteOriginal
                    ? '已启用覆盖原图时不需要输出目录'
                    : options.outputDir || '未选择'
                }
              >
                {options.overwriteOriginal
                  ? '（已启用覆盖原图）'
                  : options.outputDir || '请选择文件夹…'}
              </div>
              <button
                type="button"
                onClick={onSelectOutputDir}
                disabled={options.overwriteOriginal || isProcessing}
                className="rounded-md bg-[#2d2d2d] p-2 text-gray-300 transition-colors hover:bg-[#3d3d3d] disabled:cursor-not-allowed disabled:opacity-50"
                title="选择文件夹"
              >
                <FolderOpen className="w-5 h-5" />
              </button>
            </div>
          </div>
          {isProcessing && batchProgress && batchProgress.total > 1 ? (
            <p className="text-[11px] text-gray-400">
              正在处理第 {batchProgress.current} / {batchProgress.total} 张
            </p>
          ) : null}
          {!canStart && !isProcessing ? (
            <p className="text-xs text-amber-500/90">
              {selectedForProcessCount === 0
                ? '请至少勾选一张图片。'
                : !options.overwriteOriginal && !options.outputDir.trim()
                  ? '请选择输出目录，或启用「覆盖原图」。'
                  : ''}
            </p>
          ) : null}
          <button
            type="button"
            onClick={onStartProcessing}
            disabled={!canStart || isProcessing}
            className="flex w-full items-center justify-center gap-2 rounded-md bg-blue-600 py-2.5 font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-700 disabled:text-gray-500"
          >
            {isProcessing ? (
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            ) : (
              <Play className="h-5 w-5" />
            )}
            {isProcessing
              ? '处理中…'
              : selectedForProcessCount > 0
                ? `开始处理（${selectedForProcessCount}）`
                : '开始处理'}
          </button>
        </div>
      </div>
    </div>
  )
}
