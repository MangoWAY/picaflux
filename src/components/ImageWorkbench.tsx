import React, { useState, useCallback } from 'react'
import { Sidebar } from './Sidebar'
import { ImageGrid, ImageFile } from './ImageGrid'
import { SettingsPanel, ProcessOptions } from './SettingsPanel'

const IMAGE_EXT = /\.(jpe?g|png|webp|avif)$/i

async function buildImageEntries(paths: string[]): Promise<ImageFile[]> {
  const filtered = paths.filter((p) => IMAGE_EXT.test(p))
  const entries = await Promise.all(
    filtered.map(async (filePath) => {
      const name = filePath.split(/[/\\]/).pop() || 'unknown'
      const info = await window.picafluxAPI.getImageFileInfo(filePath)
      return {
        path: filePath,
        name,
        size: info?.size ?? 0,
        width: info?.width,
        height: info?.height,
        format: info?.format,
        status: 'pending' as const,
        previewUrl: `file://${filePath}`,
      }
    })
  )
  return entries
}

export function ImageWorkbench() {
  const [activeTab, setActiveTab] = useState('image')
  const [images, setImages] = useState<ImageFile[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [options, setOptions] = useState<ProcessOptions>({
    format: 'original',
    width: '',
    height: '',
    keepAspectRatio: true,
    quality: 80,
    outputDir: '',
  })

  const mergeNewImages = useCallback((newEntries: ImageFile[]) => {
    setImages((prev) => {
      const existingPaths = new Set(prev.map((i) => i.path))
      const uniqueNew = newEntries.filter((i) => !existingPaths.has(i.path))
      return [...prev, ...uniqueNew]
    })
  }, [])

  const handleAddImages = async () => {
    try {
      const filePaths = await window.picafluxAPI.openFiles()
      if (filePaths && filePaths.length > 0) {
        const entries = await buildImageEntries(filePaths)
        mergeNewImages(entries)
      }
    } catch (error) {
      console.error('Failed to open files:', error)
    }
  }

  const handleDropPaths = useCallback(
    async (paths: string[]) => {
      if (paths.length === 0) return
      const entries = await buildImageEntries(paths)
      mergeNewImages(entries)
    },
    [mergeNewImages]
  )

  const handleRemoveImage = (path: string) => {
    setImages((prev) => prev.filter((img) => img.path !== path))
  }

  const handleSelectOutputDir = async () => {
    try {
      const dir = await window.picafluxAPI.openDirectory()
      if (dir) {
        setOptions((prev) => ({ ...prev, outputDir: dir }))
      }
    } catch (error) {
      console.error('Failed to select directory:', error)
    }
  }

  const handleStartProcessing = async () => {
    if (images.length === 0 || !options.outputDir) return

    const batch = images
    setIsProcessing(true)
    setImages((prev) => prev.map((img) => ({ ...img, status: 'processing' as const })))

    const processOpts = {
      format: options.format,
      quality: options.quality,
      width: options.width ? parseInt(options.width, 10) : undefined,
      height: options.height ? parseInt(options.height, 10) : undefined,
    }

    for (const img of batch) {
      try {
        const result = await window.picafluxAPI.processImage(
          img.path,
          options.outputDir,
          processOpts
        )

        setImages((prev) =>
          prev.map((p) =>
            p.path === img.path ? { ...p, status: result.success ? 'done' : 'error' } : p
          )
        )
      } catch {
        setImages((prev) =>
          prev.map((p) => (p.path === img.path ? { ...p, status: 'error' as const } : p))
        )
      }
    }

    setIsProcessing(false)
  }

  return (
    <div className="flex h-screen w-screen bg-[#121212] overflow-hidden">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />

      {activeTab === 'image' ? (
        <>
          <ImageGrid
            images={images}
            onAddImages={handleAddImages}
            onRemoveImage={handleRemoveImage}
            onDropPaths={handleDropPaths}
          />
          <SettingsPanel
            options={options}
            onChange={setOptions}
            onSelectOutputDir={handleSelectOutputDir}
            onStartProcessing={handleStartProcessing}
            isProcessing={isProcessing}
            hasImages={images.length > 0}
          />
        </>
      ) : (
        <div className="flex-1 flex items-center justify-center text-gray-500">
          <p className="text-lg">Module &quot;{activeTab}&quot; is under construction.</p>
        </div>
      )}
    </div>
  )
}
