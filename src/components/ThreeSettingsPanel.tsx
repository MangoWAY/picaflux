import React from 'react'
import clsx from 'clsx'
import { FolderOpen, ImageIcon, RefreshCw } from 'lucide-react'

export type Convert3dPresetUi = 'optimize' | 'reserialize'

interface ThreeSettingsPanelProps {
  outputDir: string
  onSelectOutputDir: () => void
  convertPreset: Convert3dPresetUi
  onConvertPresetChange: (p: Convert3dPresetUi) => void
  onExportThumbnail: () => void
  onConvertSelected: () => void
  isProcessing: boolean
  canExportThumbnail: boolean
  selectedForProcessCount: number
  totalModelCount: number
  statusMessage: string | null
}

export function ThreeSettingsPanel({
  outputDir,
  onSelectOutputDir,
  convertPreset,
  onConvertPresetChange,
  onExportThumbnail,
  onConvertSelected,
  isProcessing,
  canExportThumbnail,
  selectedForProcessCount,
  totalModelCount,
  statusMessage,
}: ThreeSettingsPanelProps) {
  const canConvert = selectedForProcessCount > 0 && Boolean(outputDir.trim())

  return (
    <div className="flex h-full w-[320px] shrink-0 flex-col border-l border-[#2d2d2d] bg-[#1a1a1a]">
      <div className="border-b border-[#2d2d2d] px-4 py-3">
        <h2 className="text-sm font-semibold text-white">3D 导出 / 转换</h2>
        <p className="text-xs text-gray-500">缩略图针对当前预览；转换为勾选批量</p>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        <div>
          <label className="mb-2 block text-xs font-medium text-gray-400">GLB 转换预设</label>
          <select
            value={convertPreset}
            onChange={(e) => onConvertPresetChange(e.target.value as Convert3dPresetUi)}
            disabled={isProcessing}
            className="w-full rounded-lg border border-[#2d2d2d] bg-[#121212] px-3 py-2 text-sm text-white"
          >
            <option value="optimize">优化（prune + dedup，输出 *_optimized.glb）</option>
            <option value="reserialize">仅重打包（*_out.glb）</option>
          </select>
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
