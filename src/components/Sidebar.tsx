import React from 'react'
import { Image, Video, Box, Settings, Library, Sparkles } from 'lucide-react'
import { clsx } from 'clsx'

interface SidebarProps {
  activeTab: string
  setActiveTab: (tab: string) => void
}

export function Sidebar({ activeTab, setActiveTab }: SidebarProps) {
  const navItems = [
    { id: 'library', icon: Library, label: 'Library' },
    { id: 'image', icon: Image, label: 'Image' },
    { id: 'video', icon: Video, label: 'Video' },
    { id: '3d', icon: Box, label: '3D' },
  ]

  return (
    <div className="flex h-full min-h-0 w-52 shrink-0 flex-col border-r border-[#2d2d2d] bg-[#1e1e1e] text-gray-300">
      <div className="flex items-center gap-2 px-3 py-3.5 text-lg font-bold tracking-tight text-white">
        <Sparkles className="h-5 w-5 shrink-0 text-blue-500" />
        <span className="min-w-0 truncate">PicaFlux</span>
      </div>

      <nav className="flex-1 space-y-0.5 px-2">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = activeTab === item.id && activeTab !== 'settings'
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={clsx(
                'flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm font-medium transition-colors',
                isActive
                  ? 'bg-blue-500/10 text-blue-500'
                  : 'text-gray-300 hover:bg-[#2d2d2d] hover:text-white',
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="min-w-0 truncate">{item.label}</span>
            </button>
          )
        })}
      </nav>

      <div className="px-2 pb-3 pt-1">
        <button
          type="button"
          onClick={() => setActiveTab('settings')}
          className={clsx(
            'flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm font-medium transition-colors',
            activeTab === 'settings'
              ? 'bg-blue-500/10 text-blue-500'
              : 'text-gray-300 hover:bg-[#2d2d2d] hover:text-white',
          )}
        >
          <Settings className="h-4 w-4 shrink-0" />
          <span className="min-w-0 truncate">Settings</span>
        </button>
      </div>
    </div>
  )
}
