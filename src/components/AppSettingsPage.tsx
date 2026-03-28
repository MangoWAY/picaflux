import React, { useEffect, useState } from 'react'
import { SlidersHorizontal } from 'lucide-react'

export const BACKGROUND_REMOVAL_BACKEND_STORAGE_KEY = 'picaflux.backgroundRemovalBackendId'

interface AppSettingsPageProps {
  backgroundRemovalBackendId: string
  onBackgroundRemovalBackendIdChange: (id: string) => void
}

export function AppSettingsPage({
  backgroundRemovalBackendId,
  onBackgroundRemovalBackendIdChange,
}: AppSettingsPageProps) {
  const [backends, setBackends] = useState<{ id: string; displayName: string }[]>([])

  useEffect(() => {
    let cancelled = false
    window.picafluxAPI
      .listBackgroundRemovalBackends()
      .then((list) => {
        if (!cancelled) setBackends(list)
      })
      .catch(() => {
        if (!cancelled) setBackends([])
      })
    return () => {
      cancelled = true
    }
  }, [])

  const selectValue =
    backends.some((b) => b.id === backgroundRemovalBackendId) && backends.length > 0
      ? backgroundRemovalBackendId
      : backends[0]?.id ?? backgroundRemovalBackendId

  return (
    <div className="flex-1 flex flex-col bg-[#121212] min-h-0 text-gray-300">
      <div className="h-14 border-b border-[#2d2d2d] flex items-center px-6 shrink-0">
        <SlidersHorizontal className="w-5 h-5 mr-2 text-gray-400" />
        <h1 className="text-lg font-semibold text-white">Settings</h1>
      </div>

      <div className="flex-1 overflow-y-auto p-6 max-w-xl">
        <section className="space-y-3 rounded-lg border border-[#2d2d2d] bg-[#1a1a1a] p-5">
          <h2 className="text-sm font-medium text-white">抠图引擎</h2>
          <p className="text-xs text-gray-500 leading-relaxed">
            选择本地去背景推理实现。图片工作台仅开关「去除背景」，此处统一决定使用的引擎。
          </p>
          {backends.length > 0 ? (
            <select
              value={selectValue}
              onChange={(e) => onBackgroundRemovalBackendIdChange(e.target.value)}
              className="w-full bg-[#121212] border border-[#3d3d3d] rounded-md px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
            >
              {backends.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.displayName}
                </option>
              ))}
            </select>
          ) : (
            <p className="text-sm text-amber-500/90">暂无可用的抠图后端，请检查主进程注册。</p>
          )}
        </section>
      </div>
    </div>
  )
}
