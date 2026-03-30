import React, { useState } from 'react'
import { Sidebar } from './Sidebar'
import { ImageWorkbench } from './ImageWorkbench'
import { VideoWorkbench } from './VideoWorkbench'
import { ThreeWorkbench } from './ThreeWorkbench'
import { AppSettingsPage, BACKGROUND_REMOVAL_BACKEND_STORAGE_KEY } from './AppSettingsPage'

function readStoredBackgroundRemovalBackendId(): string {
  try {
    return window.localStorage.getItem(BACKGROUND_REMOVAL_BACKEND_STORAGE_KEY) || 'imgly'
  } catch {
    return 'imgly'
  }
}

export function MainWorkbench() {
  const [activeTab, setActiveTab] = useState('image')
  const [backgroundRemovalBackendId, setBackgroundRemovalBackendId] = useState(
    readStoredBackgroundRemovalBackendId,
  )
  const isMac = window.picafluxAPI.platform === 'darwin'

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-[#121212]">
      {isMac ? (
        <div
          className="h-7 shrink-0 border-b border-[#2d2d2d] bg-[#121212]"
          style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
        />
      ) : null}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />

        {activeTab === 'settings' ? (
          <AppSettingsPage
            backgroundRemovalBackendId={backgroundRemovalBackendId}
            onBackgroundRemovalBackendIdChange={(id) => {
              setBackgroundRemovalBackendId(id)
              try {
                window.localStorage.setItem(BACKGROUND_REMOVAL_BACKEND_STORAGE_KEY, id)
              } catch {
                /* ignore */
              }
            }}
          />
        ) : activeTab === 'image' ? (
          <ImageWorkbench backgroundRemovalBackendId={backgroundRemovalBackendId} />
        ) : activeTab === 'video' ? (
          <VideoWorkbench />
        ) : activeTab === '3d' ? (
          <ThreeWorkbench />
        ) : (
          <div className="flex flex-1 items-center justify-center text-gray-500">
            <p className="text-lg">Module &quot;{activeTab}&quot; is under construction.</p>
          </div>
        )}
      </div>
    </div>
  )
}
