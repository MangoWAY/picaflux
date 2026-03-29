import React from 'react'
import { FolderOpen, SlidersHorizontal, Play } from 'lucide-react'

export type OutputFormatOption = 'original' | 'png' | 'jpeg' | 'webp' | 'avif'

export interface ProcessOptions {
  format: OutputFormatOption
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
}

const OUTPUT_FORMAT_VALUES: OutputFormatOption[] = ['original', 'png', 'jpeg', 'webp', 'avif']

function isOutputFormatOption(v: string): v is OutputFormatOption {
  return (OUTPUT_FORMAT_VALUES as readonly string[]).includes(v)
}

interface SettingsPanelProps {
  options: ProcessOptions
  onChange: (options: ProcessOptions) => void
  onSelectOutputDir: () => void
  onStartProcessing: () => void
  isProcessing: boolean
  /** 勾选参与处理的数量 */
  selectedForProcessCount: number
  totalImageCount: number
}

export function SettingsPanel({
  options,
  onChange,
  onSelectOutputDir,
  onStartProcessing,
  isProcessing,
  selectedForProcessCount,
  totalImageCount,
}: SettingsPanelProps) {
  const updateOption = <K extends keyof ProcessOptions>(key: K, value: ProcessOptions[K]) => {
    onChange({ ...options, [key]: value })
  }

  return (
    <div className="w-80 bg-[#1e1e1e] border-l border-[#2d2d2d] flex flex-col h-full text-gray-300">
      <div className="h-14 shrink-0 flex flex-col justify-center border-b border-[#2d2d2d] px-5">
        <div className="flex items-center">
          <SlidersHorizontal className="mr-2 h-5 w-5 text-gray-400" />
          <h2 className="font-semibold text-white">Processing</h2>
        </div>
        {totalImageCount > 0 && (
          <p className="mt-0.5 pl-7 text-[11px] text-gray-500">
            将处理已勾选的 {selectedForProcessCount} 张
          </p>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-6">
        {/* Format */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-400">Format</label>
          <select
            value={options.format}
            onChange={(e) => {
              const v = e.target.value
              if (isOutputFormatOption(v)) updateOption('format', v)
            }}
            className="w-full bg-[#121212] border border-[#3d3d3d] rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
          >
            <option value="original">Original</option>
            <option value="png">PNG</option>
            <option value="jpeg">JPEG</option>
            <option value="webp">WebP</option>
            <option value="avif">AVIF</option>
          </select>
        </div>

        {/* Resize */}
        <div className="space-y-3">
          <label className="text-sm font-medium text-gray-400">Resize (px)</label>
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <input
                type="number"
                placeholder="Width"
                value={options.width}
                onChange={(e) => updateOption('width', e.target.value)}
                className="w-full bg-[#121212] border border-[#3d3d3d] rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 placeholder-gray-600"
              />
            </div>
            <span className="text-gray-500">×</span>
            <div className="flex-1">
              <input
                type="number"
                placeholder="Height"
                value={options.height}
                onChange={(e) => updateOption('height', e.target.value)}
                className="w-full bg-[#121212] border border-[#3d3d3d] rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 placeholder-gray-600"
              />
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={options.keepAspectRatio}
              onChange={(e) => updateOption('keepAspectRatio', e.target.checked)}
              className="rounded bg-[#121212] border-[#3d3d3d] text-blue-500 focus:ring-blue-500 focus:ring-offset-0"
            />
            <span className="text-sm text-gray-400">Keep Aspect Ratio</span>
          </label>
        </div>

        {/* Quality */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <label className="text-sm font-medium text-gray-400">Quality</label>
            <span className="text-sm text-gray-300">{options.quality}%</span>
          </div>
          <input
            type="range"
            min="1"
            max="100"
            value={options.quality}
            onChange={(e) => updateOption('quality', parseInt(e.target.value))}
            className="w-full accent-blue-500"
          />
        </div>

        <div className="space-y-3 rounded-lg border border-[#2d2d2d] bg-[#181818] p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium text-gray-300">去除背景</span>
            <label className="relative inline-flex cursor-pointer items-center shrink-0">
              <input
                type="checkbox"
                className="peer sr-only"
                checked={options.removeBackground}
                onChange={(e) => updateOption('removeBackground', e.target.checked)}
              />
              <div className="h-6 w-11 rounded-full bg-[#3d3d3d] after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all peer-checked:bg-blue-600 peer-checked:after:translate-x-5" />
            </label>
          </div>
        </div>

        <div className="space-y-3 rounded-lg border border-[#2d2d2d] bg-[#181818] p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium text-gray-300">固定水印区域透明</span>
            <label className="relative inline-flex cursor-pointer items-center shrink-0">
              <input
                type="checkbox"
                className="peer sr-only"
                checked={options.clearFixedWatermark}
                onChange={(e) => updateOption('clearFixedWatermark', e.target.checked)}
              />
              <div className="h-6 w-11 rounded-full bg-[#3d3d3d] after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all peer-checked:bg-blue-600 peer-checked:after:translate-x-5" />
            </label>
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
                  className="mt-1 w-full bg-[#121212] border border-[#3d3d3d] rounded px-2 py-1.5 text-sm text-white"
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
                  className="mt-1 w-full bg-[#121212] border border-[#3d3d3d] rounded px-2 py-1.5 text-sm text-white"
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
                  className="mt-1 w-full bg-[#121212] border border-[#3d3d3d] rounded px-2 py-1.5 text-sm text-white"
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
                  className="mt-1 w-full bg-[#121212] border border-[#3d3d3d] rounded px-2 py-1.5 text-sm text-white"
                />
              </label>
            </div>
          )}
        </div>

        {/* Output */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-400">Output Folder</label>
          <div className="flex gap-2">
            <div
              className="flex-1 bg-[#121212] border border-[#3d3d3d] rounded-md px-3 py-2 text-sm text-gray-400 truncate"
              title={options.outputDir || 'Not selected'}
            >
              {options.outputDir || 'Select a folder...'}
            </div>
            <button
              onClick={onSelectOutputDir}
              className="p-2 bg-[#2d2d2d] hover:bg-[#3d3d3d] rounded-md transition-colors text-gray-300"
              title="Select Folder"
            >
              <FolderOpen className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      <div className="p-5 border-t border-[#2d2d2d] shrink-0">
        <button
          onClick={onStartProcessing}
          disabled={selectedForProcessCount === 0 || !options.outputDir || isProcessing}
          className="flex w-full items-center justify-center gap-2 rounded-md bg-blue-600 py-2.5 font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-700 disabled:text-gray-500"
        >
          {isProcessing ? (
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          ) : (
            <Play className="h-5 w-5" />
          )}
          {isProcessing
            ? 'Processing...'
            : selectedForProcessCount > 0
              ? `Start Processing (${selectedForProcessCount})`
              : 'Start Processing'}
        </button>
      </div>
    </div>
  )
}
