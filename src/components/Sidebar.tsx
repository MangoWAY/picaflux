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
    <div className="w-64 h-full bg-[#1e1e1e] border-r border-[#2d2d2d] flex flex-col text-gray-300">
      <div className="p-6 flex items-center gap-2 text-white font-bold text-xl tracking-tight">
        <Sparkles className="w-6 h-6 text-blue-500" />
        PicaFlux
      </div>
      
      <nav className="flex-1 px-4 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = activeTab === item.id && activeTab !== 'settings'
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={clsx(
                'w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm font-medium',
                isActive 
                  ? 'bg-blue-500/10 text-blue-500' 
                  : 'hover:bg-[#2d2d2d] hover:text-white'
              )}
            >
              <Icon className="w-5 h-5" />
              {item.label}
            </button>
          )
        })}
      </nav>

      <div className="p-4">
        <button
          type="button"
          onClick={() => setActiveTab('settings')}
          className={clsx(
            'w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm font-medium',
            activeTab === 'settings'
              ? 'bg-blue-500/10 text-blue-500'
              : 'hover:bg-[#2d2d2d] hover:text-white text-gray-300'
          )}
        >
          <Settings className="w-5 h-5" />
          Settings
        </button>
      </div>
    </div>
  )
}
