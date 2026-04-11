import React, { useEffect, useRef, useState } from 'react'
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
  BookmarkPlus,
  Trash2,
} from 'lucide-react'
import type { ImageProcessPresetRecord } from '@/lib/imagePreset'

export type OutputFormatOption = 'original' | 'png' | 'jpeg' | 'webp' | 'avif'

/** none：不按比例缩放；再点同一百分比可回到 none */
export type ResizePercentPreset = 'none' | 'p75' | 'p50' | 'p25' | 'custom'

export interface ProcessOptions {
  format: OutputFormatOption
  /** 累计 90° 步数（可正可负、不取模），导出时对 4 取模；预览用此值算角度以保证动画走最短弧 */
  rotateQuarterTurns: number
  flipHorizontal: boolean
  flipVertical: boolean
  /** 切图：按网格均分输出 */
  sliceEnabled: boolean
  sliceRows: string
  sliceCols: string
  /** 自定义切图线（0.0~1.0 的比例），如果为空则使用均分 */
  sliceXLines?: number[]
  sliceYLines?: number[]
  /** 百分比缩放与像素缩放二选一 */
  resizeMode: 'percent' | 'pixels'
  resizePercentPreset: ResizePercentPreset
  /** 选择「自定义」时的百分比字符串，1–400 */
  resizeCustomPercentStr: string
  /** 像素输入区是否展开 */
  resizePixelsExpanded: boolean
  width: string
  height: string
  keepAspectRatio: boolean
  quality: number
  outputDir: string
  removeBackground: boolean
  clearFixedWatermark: boolean
  watermarkLeftPct: string
  watermarkTopPct: string
  watermarkWidthPct: string
  watermarkHeightPct: string
  /** 与中间预览一致的裁剪框（相对当前「视觉」宽高的 0–1 归一化，含旋转/镜像后） */
  cropEnabled: boolean
  cropNorm: { x: number; y: number; w: number; h: number }
  /** 裁掉完全透明的边缘像素（用于减小导出尺寸） */
  trimTransparent: boolean
  /** 额外保留的透明边（像素） */
  trimPaddingPx: string
}

const OUTPUT_FORMAT_VALUES: OutputFormatOption[] = ['original', 'png', 'jpeg', 'webp', 'avif']

function isOutputFormatOption(v: string): v is OutputFormatOption {
  return (OUTPUT_FORMAT_VALUES as readonly string[]).includes(v)
}

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

type SettingsTab = 'output' | 'geometry' | 'smart' | 'slice'

const SETTINGS_TABS: { id: SettingsTab; label: string }[] = [
  { id: 'output', label: '输出与预设' },
  { id: 'geometry', label: '几何' },
  { id: 'smart', label: '智能与修复' },
  { id: 'slice', label: '切图' },
]

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
}: SettingsPanelProps) {
  const updateOption = <K extends keyof ProcessOptions>(key: K, value: ProcessOptions[K]) => {
    onChange({ ...options, [key]: value })
  }

  const [selectedPresetId, setSelectedPresetId] = useState('')
  const [newPresetName, setNewPresetName] = useState('')
  const [presetMessage, setPresetMessage] = useState<string | null>(null)
  const [settingsTab, setSettingsTab] = useState<SettingsTab>('output')

  useEffect(() => {
    if (selectedPresetId && !imagePresets.some((p) => p.id === selectedPresetId)) {
      setSelectedPresetId('')
    }
  }, [imagePresets, selectedPresetId])

  const qualitySliderRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (settingsTab !== 'output') return
    const el = qualitySliderRef.current
    if (!el) return
    const stop = (e: WheelEvent) => e.preventDefault()
    el.addEventListener('wheel', stop, { passive: false })
    return () => el.removeEventListener('wheel', stop)
  }, [settingsTab])

  const canStart = selectedForProcessCount > 0 && Boolean(options.outputDir.trim())

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
          <p className="mt-0.5 pl-7 text-[11px] text-gray-500">
            将处理已勾选的 {selectedForProcessCount} 张
          </p>
        )}
      </div>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[#1e1e1e]">
        <div
          className="min-h-0 flex-1 space-y-5 overflow-x-hidden overflow-y-auto px-4 py-4"
          style={{ overscrollBehavior: 'none' }}
        >
          <div
            role="tablist"
            aria-label="处理参数分组"
            className="flex flex-wrap gap-1 border-b border-[#2d2d2d] pb-3"
          >
            {SETTINGS_TABS.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={settingsTab === id}
                onClick={() => setSettingsTab(id)}
                className={clsx(
                  'rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors',
                  settingsTab === id
                    ? 'bg-blue-600/25 text-blue-200 ring-1 ring-blue-500/50'
                    : 'text-gray-400 hover:bg-[#2a2a2a] hover:text-gray-200',
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {settingsTab === 'output' ? (
            <>
              <div className="space-y-3 rounded-lg border border-[#2d2d2d] bg-[#181818] p-3">
                <span className="text-sm font-medium text-gray-300">参数预设</span>
                <p className="text-[10px] leading-relaxed text-gray-500">
                  保存当前右侧全部处理参数（不含输出目录与中间预览里的裁剪框）。载入后裁剪仍按当前图；最多
                  40 条，超出时自动删掉最旧的一条。
                </p>
                <select
                  value={selectedPresetId}
                  onChange={(e) => {
                    setSelectedPresetId(e.target.value)
                    setPresetMessage(null)
                  }}
                  disabled={isProcessing}
                  className="w-full rounded-md border border-[#3d3d3d] bg-[#121212] px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
                >
                  <option value="">选择预设…</option>
                  {imagePresets.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={isProcessing || !selectedPresetId}
                    onClick={() => {
                      setPresetMessage(null)
                      onApplyImagePreset(selectedPresetId)
                    }}
                    className="flex flex-1 min-w-[5rem] items-center justify-center gap-1.5 rounded-md border border-[#3d3d3d] bg-[#121212] px-3 py-2 text-xs text-gray-200 transition-colors hover:border-blue-500/40 hover:bg-[#1e1e1e] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    载入
                  </button>
                  <button
                    type="button"
                    disabled={isProcessing || !selectedPresetId}
                    onClick={async () => {
                      setPresetMessage(null)
                      const r = await onDeleteImagePreset(selectedPresetId)
                      if (!r.success) setPresetMessage(r.error ?? '删除失败')
                    }}
                    className="flex flex-1 min-w-[5rem] items-center justify-center gap-1.5 rounded-md border border-[#3d3d3d] bg-[#121212] px-3 py-2 text-xs text-gray-200 transition-colors hover:border-red-500/40 hover:bg-[#1e1e1e] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    删除
                  </button>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <input
                    type="text"
                    value={newPresetName}
                    onChange={(e) => {
                      setNewPresetName(e.target.value)
                      setPresetMessage(null)
                    }}
                    placeholder="新预设名称"
                    disabled={isProcessing}
                    maxLength={80}
                    className="min-w-0 flex-1 rounded-md border border-[#3d3d3d] bg-[#121212] px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-blue-500 focus:outline-none"
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
                    className="flex shrink-0 items-center justify-center gap-1.5 rounded-md bg-blue-600 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-gray-700 disabled:text-gray-500"
                  >
                    <BookmarkPlus className="h-3.5 w-3.5" />
                    保存当前
                  </button>
                </div>
                {presetMessage ? (
                  <p className="text-xs text-amber-500/95">{presetMessage}</p>
                ) : null}
              </div>

              {/* 输出格式 */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-400">输出格式</label>
                <select
                  value={options.format}
                  onChange={(e) => {
                    const v = e.target.value
                    if (isOutputFormatOption(v)) updateOption('format', v)
                  }}
                  className="w-full bg-[#121212] border border-[#3d3d3d] rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="original">与原图相同</option>
                  <option value="png">PNG</option>
                  <option value="jpeg">JPEG</option>
                  <option value="webp">WebP</option>
                  <option value="avif">AVIF</option>
                </select>
              </div>

              {/* 质量 */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-sm font-medium text-gray-400">质量</label>
                  <span className="text-sm text-gray-300">{options.quality}%</span>
                </div>
                <input
                  ref={qualitySliderRef}
                  type="range"
                  min="1"
                  max="100"
                  value={options.quality}
                  onChange={(e) => updateOption('quality', parseInt(e.target.value))}
                  className="w-full accent-blue-500"
                />
              </div>
            </>
          ) : null}

          {settingsTab === 'geometry' ? (
            <>
              {/* 旋转与镜像（与中间预览、导出管线一致） */}
              <div className="space-y-3 rounded-lg border border-[#2d2d2d] bg-[#181818] p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-gray-300">旋转与镜像</span>
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
                    className="text-xs text-blue-400 hover:text-blue-300"
                  >
                    重置
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    title="逆时针 90°"
                    onClick={() =>
                      updateOption('rotateQuarterTurns', options.rotateQuarterTurns - 1)
                    }
                    className="flex items-center justify-center gap-2 rounded-md border border-[#3d3d3d] bg-[#121212] px-2 py-2 text-xs text-gray-200 transition-colors hover:border-blue-500/50 hover:bg-[#1e1e1e]"
                  >
                    <RotateCcw className="h-4 w-4 shrink-0" />
                    左转 90°
                  </button>
                  <button
                    type="button"
                    title="顺时针 90°"
                    onClick={() =>
                      updateOption('rotateQuarterTurns', options.rotateQuarterTurns + 1)
                    }
                    className="flex items-center justify-center gap-2 rounded-md border border-[#3d3d3d] bg-[#121212] px-2 py-2 text-xs text-gray-200 transition-colors hover:border-blue-500/50 hover:bg-[#1e1e1e]"
                  >
                    <RotateCw className="h-4 w-4 shrink-0" />
                    右转 90°
                  </button>
                  <button
                    type="button"
                    title="水平镜像"
                    onClick={() => updateOption('flipHorizontal', !options.flipHorizontal)}
                    className={`flex items-center justify-center gap-2 rounded-md border px-2 py-2 text-xs transition-colors ${
                      options.flipHorizontal
                        ? 'border-blue-500/60 bg-blue-500/15 text-blue-200'
                        : 'border-[#3d3d3d] bg-[#121212] text-gray-200 hover:border-blue-500/50 hover:bg-[#1e1e1e]'
                    }`}
                  >
                    <FlipHorizontal className="h-4 w-4 shrink-0" />
                    水平镜像
                  </button>
                  <button
                    type="button"
                    title="垂直镜像"
                    onClick={() => updateOption('flipVertical', !options.flipVertical)}
                    className={`flex items-center justify-center gap-2 rounded-md border px-2 py-2 text-xs transition-colors ${
                      options.flipVertical
                        ? 'border-blue-500/60 bg-blue-500/15 text-blue-200'
                        : 'border-[#3d3d3d] bg-[#121212] text-gray-200 hover:border-blue-500/50 hover:bg-[#1e1e1e]'
                    }`}
                  >
                    <FlipVertical className="h-4 w-4 shrink-0" />
                    垂直镜像
                  </button>
                </div>
              </div>

              <div className="overflow-hidden rounded-xl border border-[#2d2d2d] bg-[#181818]">
                <div className="flex items-center justify-between gap-3 px-3 py-3">
                  <div className="min-w-0">
                    <span className="text-sm font-medium text-gray-200">可视化裁剪</span>
                    <p className="mt-0.5 text-[10px] text-gray-500">
                      在预览中拖动画框；导出与网格切图会在旋转/镜像之后先裁剪
                    </p>
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
                    ariaLabel="可视化裁剪"
                  />
                </div>
                {options.cropEnabled && (
                  <div className="border-t border-[#2d2d2d] px-3 py-2">
                    <button
                      type="button"
                      onClick={() => onChange({ ...options, cropNorm: { x: 0, y: 0, w: 1, h: 1 } })}
                      className="text-xs text-blue-400 hover:text-blue-300"
                    >
                      重置为全图
                    </button>
                  </div>
                )}
              </div>

              <div className="overflow-hidden rounded-xl border border-[#2d2d2d] bg-[#181818]">
                <div className="flex items-center justify-between gap-3 px-3 py-3">
                  <div className="min-w-0">
                    <span className="text-sm font-medium text-gray-200">裁切透明边</span>
                    <p className="mt-0.5 text-[10px] text-gray-500">
                      裁剪掉四周完全透明的像素，默认额外保留 2px 透明边
                    </p>
                  </div>
                  <PanelToggle
                    checked={options.trimTransparent}
                    onChange={(v) => updateOption('trimTransparent', v)}
                    ariaLabel="裁切透明边"
                  />
                </div>
                {options.trimTransparent && (
                  <div className="border-t border-[#2d2d2d] px-3 py-3">
                    <label className="flex items-center justify-between gap-3 text-xs text-gray-500">
                      <span className="shrink-0">边缘保留</span>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={0}
                          max={512}
                          step={1}
                          value={options.trimPaddingPx}
                          onChange={(e) => updateOption('trimPaddingPx', e.target.value)}
                          className="w-20 rounded border border-[#3d3d3d] bg-[#121212] px-2 py-1.5 text-sm text-white focus:border-blue-500 focus:outline-none"
                        />
                        <span className="shrink-0">px</span>
                      </div>
                    </label>
                  </div>
                )}
              </div>

              {/* 缩放：百分比 与 像素互斥 */}
              <div className="min-w-0 space-y-3">
                <label className="text-sm font-medium text-gray-400">缩放</label>
                <p className="text-[11px] leading-relaxed text-gray-500">
                  百分比与下方像素二选一；同一比例再点一次可取消缩放。
                </p>
                <div className="grid min-w-0 grid-cols-3 gap-2">
                  {(
                    [
                      { preset: 'p75' as const, label: '75%' },
                      { preset: 'p50' as const, label: '50%' },
                      { preset: 'p25' as const, label: '25%' },
                    ] as const
                  ).map(({ preset, label }) => {
                    const active =
                      options.resizeMode === 'percent' && options.resizePercentPreset === preset
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
                        options.resizeMode === 'percent' && options.resizePercentPreset === 'custom'
                      onChange({
                        ...options,
                        resizeMode: 'percent',
                        resizePercentPreset: active ? 'none' : 'custom',
                        resizePixelsExpanded: false,
                      })
                    }}
                    className={clsx(
                      'col-span-3 rounded-md border py-2 text-center text-xs font-medium transition-colors',
                      options.resizeMode === 'percent' && options.resizePercentPreset === 'custom'
                        ? 'border-blue-500/60 bg-blue-500/15 text-blue-200'
                        : 'border-[#3d3d3d] bg-[#121212] text-gray-300 hover:border-blue-500/40 hover:bg-[#1e1e1e]',
                    )}
                  >
                    自定义比例
                  </button>
                </div>
                {options.resizeMode === 'percent' && options.resizePercentPreset === 'custom' && (
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
                )}

                <div className="min-w-0 overflow-hidden rounded-lg border border-[#2d2d2d] bg-[#181818]">
                  <button
                    type="button"
                    onClick={() => {
                      const next = !options.resizePixelsExpanded
                      onChange({
                        ...options,
                        resizePixelsExpanded: next,
                        resizeMode: next ? 'pixels' : 'percent',
                      })
                    }}
                    className="flex w-full min-w-0 items-center justify-between gap-2 px-3 py-2.5 text-left text-sm text-gray-200 transition-colors hover:bg-[#222]"
                  >
                    <span className="min-w-0 truncate">指定宽高 (px)</span>
                    <ChevronDown
                      className={clsx(
                        'h-4 w-4 shrink-0 text-gray-500 transition-transform',
                        options.resizePixelsExpanded && 'rotate-180',
                      )}
                    />
                  </button>
                  {options.resizePixelsExpanded && (
                    <div className="min-w-0 space-y-3 border-t border-[#2d2d2d] px-3 pb-3 pt-3">
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
              </div>
            </>
          ) : null}

          {settingsTab === 'smart' ? (
            <>
              <div className="overflow-hidden rounded-xl border border-[#2d2d2d] bg-[#181818]">
                <div className="divide-y divide-[#2d2d2d]">
                  <div className="flex items-center justify-between gap-3 px-3 py-3">
                    <div className="min-w-0">
                      <span className="text-sm font-medium text-gray-200">去除背景</span>
                      <p className="mt-0.5 text-[10px] text-gray-500">AI 自动抠图</p>
                    </div>
                    <PanelToggle
                      checked={options.removeBackground}
                      onChange={(v) => updateOption('removeBackground', v)}
                      ariaLabel="去除背景"
                    />
                  </div>
                  <div className="space-y-3 px-3 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <span className="text-sm font-medium text-gray-200">固定透明区域</span>
                        <p className="mt-0.5 text-[10px] text-gray-500">清除指定区域的内容</p>
                      </div>
                      <PanelToggle
                        checked={options.clearFixedWatermark}
                        onChange={(v) => updateOption('clearFixedWatermark', v)}
                        ariaLabel="固定透明区域"
                      />
                    </div>
                    {options.clearFixedWatermark && (
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <label className="text-gray-500">
                          左 %
                          <input
                            type="number"
                            min={0}
                            max={100}
                            step={0.1}
                            value={options.watermarkLeftPct}
                            onChange={(e) => updateOption('watermarkLeftPct', e.target.value)}
                            className="mt-1 w-full rounded border border-[#3d3d3d] bg-[#121212] px-2 py-1.5 text-sm text-white"
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
                            className="mt-1 w-full rounded border border-[#3d3d3d] bg-[#121212] px-2 py-1.5 text-sm text-white"
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
                            className="mt-1 w-full rounded border border-[#3d3d3d] bg-[#121212] px-2 py-1.5 text-sm text-white"
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
                            className="mt-1 w-full rounded border border-[#3d3d3d] bg-[#121212] px-2 py-1.5 text-sm text-white"
                          />
                        </label>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </>
          ) : null}

          {settingsTab === 'slice' ? (
            <>
              <div className="overflow-hidden rounded-xl border border-[#2d2d2d] bg-[#181818]">
                <div className="divide-y divide-[#2d2d2d]">
                  <div className="flex items-center justify-between gap-3 px-3 py-3">
                    <div className="min-w-0">
                      <span className="text-sm font-medium text-gray-200">网格切图</span>
                      <p className="mt-0.5 text-[10px] text-gray-500">将图片按行和列均分切片</p>
                    </div>
                    <PanelToggle
                      checked={options.sliceEnabled}
                      onChange={(v) => {
                        const updates: Partial<ProcessOptions> = { sliceEnabled: v }
                        if (v) {
                          const rows = parseInt(options.sliceRows, 10)
                          const cols = parseInt(options.sliceCols, 10)
                          if (
                            options.sliceYLines === undefined &&
                            Number.isFinite(rows) &&
                            rows > 0
                          ) {
                            updates.sliceYLines =
                              rows > 1
                                ? Array.from({ length: rows - 1 }, (_, i) => (i + 1) / rows)
                                : []
                          }
                          if (
                            options.sliceXLines === undefined &&
                            Number.isFinite(cols) &&
                            cols > 0
                          ) {
                            updates.sliceXLines =
                              cols > 1
                                ? Array.from({ length: cols - 1 }, (_, i) => (i + 1) / cols)
                                : []
                          }
                        }
                        onChange({ ...options, ...updates })
                      }}
                      ariaLabel="网格切图"
                    />
                  </div>
                  {options.sliceEnabled && (
                    <div className="space-y-3 px-3 py-3">
                      <div className="grid grid-cols-2 gap-2 text-xs">
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
                            className="mt-1 w-full rounded border border-[#3d3d3d] bg-[#121212] px-2 py-1.5 text-sm text-white focus:border-blue-500 focus:outline-none"
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
                            className="mt-1 w-full rounded border border-[#3d3d3d] bg-[#121212] px-2 py-1.5 text-sm text-white focus:border-blue-500 focus:outline-none"
                          />
                        </label>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : null}
        </div>

        <div className="shrink-0 space-y-3 border-t border-[#2d2d2d] bg-[#1e1e1e] px-4 py-3">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-400">输出目录</label>
            <div className="flex gap-2">
              <div
                className="flex-1 truncate rounded-md border border-[#3d3d3d] bg-[#121212] px-3 py-2 text-sm text-gray-400"
                title={options.outputDir || '未选择'}
              >
                {options.outputDir || '请选择文件夹…'}
              </div>
              <button
                type="button"
                onClick={onSelectOutputDir}
                className="rounded-md bg-[#2d2d2d] p-2 text-gray-300 transition-colors hover:bg-[#3d3d3d]"
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
                : !options.outputDir.trim()
                  ? '请选择输出目录。'
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
