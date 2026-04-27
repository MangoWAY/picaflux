import React, { useMemo } from 'react'
import clsx from 'clsx'
import { FolderOpen, ImageIcon, Layers2, RefreshCw, Images } from 'lucide-react'
import { PanelToggle } from './PanelToggle'

interface ThreeSettingsPanelProps {
  outputDir: string
  onSelectOutputDir: () => void
  onExportThumbnail: () => void
  onExportThumbnailsSelected: () => void
  onConvertSelected: () => void
  isProcessing: boolean
  canExportThumbnail: boolean
  selectedForProcessCount: number
  totalModelCount: number
  statusMessage: string | null
  textureCompressEnabled: boolean
  onTextureCompressEnabledChange: (enabled: boolean) => void
  textureMaxSize: number
  textureQuality: number
  onTextureMaxSizeChange: (n: number) => void
  onTextureQualityChange: (q: number) => void
}

export function ThreeSettingsPanel({
  outputDir,
  onSelectOutputDir,
  onExportThumbnail,
  onExportThumbnailsSelected,
  onConvertSelected,
  isProcessing,
  canExportThumbnail,
  selectedForProcessCount,
  totalModelCount,
  statusMessage,
  textureCompressEnabled,
  onTextureCompressEnabledChange,
  textureMaxSize,
  textureQuality,
  onTextureMaxSizeChange,
  onTextureQualityChange,
}: ThreeSettingsPanelProps) {
  const canConvert = selectedForProcessCount > 0 && Boolean(outputDir.trim())
  const canBatchThumb = selectedForProcessCount > 0 && Boolean(outputDir.trim())

  const textureSummary = useMemo(() => {
    if (!textureCompressEnabled) return null
    if (textureMaxSize === 0) return '不改写贴图'
    return `最长边 ≤${textureMaxSize}px，原格式`
  }, [textureCompressEnabled, textureMaxSize])

  return (
    <div className="flex h-full w-[320px] shrink-0 flex-col border-l border-[#2d2d2d] bg-[#1a1a1a]">
      <div className="border-b border-[#2d2d2d] px-4 py-3">
        <h2 className="text-sm font-semibold text-white">3D 导出 / 转换</h2>
        <p className="text-xs text-gray-500">缩略图针对当前预览；转换为勾选批量</p>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        <div
          className={clsx(
            'overflow-hidden rounded-lg border border-[#2d2d2d] bg-[#141414]',
            textureCompressEnabled && 'border-blue-500/35 ring-1 ring-blue-500/20',
          )}
        >
          <div className="flex items-center justify-between gap-2 px-2.5 py-2">
            <div className="flex min-w-0 flex-1 items-start gap-2">
              <Layers2 className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" aria-hidden />
              <div className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-gray-200">贴图压缩</span>
                {textureSummary ? (
                  <span
                    className="mt-0.5 block truncate text-[11px] text-gray-500"
                    title={textureSummary}
                  >
                    {textureSummary}
                  </span>
                ) : null}
              </div>
            </div>
            <PanelToggle
              checked={textureCompressEnabled}
              onChange={(v) => {
                if (isProcessing) return
                onTextureCompressEnabledChange(v)
              }}
              ariaLabel={textureCompressEnabled ? '关闭贴图压缩' : '启用贴图压缩'}
            />
          </div>
          {textureCompressEnabled ? (
            <div className="space-y-2 border-t border-[#2d2d2d] bg-[#121212]/80 px-2.5 pb-2.5 pt-2">
              <div className="space-y-2">
                <label className="block text-[11px] text-gray-500">最长边上限</label>
                <select
                  value={String(textureMaxSize)}
                  onChange={(e) => onTextureMaxSizeChange(parseInt(e.target.value, 10) || 0)}
                  disabled={isProcessing}
                  className="w-full rounded-lg border border-[#2d2d2d] bg-[#0f0f0f] px-3 py-2 text-sm text-white"
                >
                  <option value="0">不处理</option>
                  <option value="256">256px</option>
                  <option value="512">512px</option>
                  <option value="1024">1024px</option>
                  <option value="2048">2048px</option>
                  <option value="4096">4096px</option>
                </select>
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px] text-gray-500">
                  <span>质量</span>
                  <span>{textureQuality}</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={100}
                  value={textureQuality}
                  onChange={(e) => onTextureQualityChange(parseInt(e.target.value, 10) || 100)}
                  disabled={isProcessing}
                  className="w-full accent-blue-500"
                />
              </div>
              <p className="text-[10px] leading-relaxed text-gray-500">
                最长边缩放，PNG/JPEG/WebP 保持格式；质量仅影响 JPEG 与 WebP。
              </p>
            </div>
          ) : null}
        </div>

        <div>
          <label className="mb-2 block text-xs font-medium text-gray-400">输出目录</label>
          <div className="flex gap-2">
            <div
              className="min-w-0 flex-1 truncate rounded-lg border border-[#2d2d2d] bg-[#121212] px-3 py-2 text-xs text-gray-400"
              title={outputDir || '未选择'}
            >
              {outputDir || '未选择'}
            </div>
            <button
              type="button"
              onClick={onSelectOutputDir}
              disabled={isProcessing}
              className="shrink-0 rounded-lg border border-[#2d2d2d] bg-[#252525] p-2 text-gray-300 hover:bg-[#2d2d2d]"
              title="选择文件夹"
            >
              <FolderOpen className="h-5 w-5" />
            </button>
          </div>
        </div>

        {statusMessage ? (
          <p className="rounded-lg border border-[#2d2d2d] bg-[#121212] px-3 py-2 text-xs text-gray-300">
            {statusMessage}
          </p>
        ) : null}
      </div>

      <div className="space-y-2 border-t border-[#2d2d2d] p-4">
        <button
          type="button"
          onClick={onExportThumbnail}
          disabled={!canExportThumbnail || isProcessing}
          className={clsx(
            'flex w-full items-center justify-center gap-2 rounded-lg py-3 text-sm font-semibold text-white transition-colors',
            canExportThumbnail && !isProcessing
              ? 'bg-indigo-600 hover:bg-indigo-500'
              : 'cursor-not-allowed bg-gray-700 text-gray-500',
          )}
        >
          <ImageIcon className="h-4 w-4" />
          导出当前预览缩略图（PNG）
        </button>
        <button
          type="button"
          onClick={onExportThumbnailsSelected}
          disabled={!canBatchThumb || isProcessing}
          className={clsx(
            'flex w-full items-center justify-center gap-2 rounded-lg py-3 text-sm font-semibold text-white transition-colors',
            canBatchThumb && !isProcessing
              ? 'bg-indigo-600/80 hover:bg-indigo-600'
              : 'cursor-not-allowed bg-gray-700 text-gray-500',
          )}
        >
          <Images className="h-4 w-4" />
          批量导出已选缩略图（{selectedForProcessCount}/{totalModelCount}）
        </button>
        <button
          type="button"
          onClick={onConvertSelected}
          disabled={!canConvert || isProcessing}
          className={clsx(
            'flex w-full items-center justify-center gap-2 rounded-lg py-3 text-sm font-semibold text-white transition-colors',
            canConvert && !isProcessing
              ? 'bg-blue-600 hover:bg-blue-500'
              : 'cursor-not-allowed bg-gray-700 text-gray-500',
          )}
        >
          <RefreshCw className="h-4 w-4" />
          转换已选（{selectedForProcessCount}/{totalModelCount}）
        </button>
      </div>
    </div>
  )
}
