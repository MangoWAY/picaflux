/// <reference types="vite/client" />

interface Window {
  // expose in the `electron/preload/index.ts`
  ipcRenderer: import('electron').IpcRenderer
  picafluxAPI: {
    openFiles: () => Promise<string[]>
    openDirectory: () => Promise<string | null>
    processImage: (
      inputPath: string,
      outputDir: string,
      options: unknown,
    ) => Promise<{
      success: boolean
      outputPath?: string
      error?: string
    }>
    sliceImageGrid: (
      inputPath: string,
      outputDir: string,
      options: unknown,
    ) => Promise<{
      success: boolean
      outputPaths?: string[]
      error?: string
    }>
    getPathForFile: (file: File) => string
    getImageFileInfo: (filePath: string) => Promise<{
      size: number
      width?: number
      height?: number
      format?: string
    } | null>
    getImageAlphaPreview: (
      filePath: string,
      options?: { maxSize?: number },
    ) => Promise<{
      success: boolean
      dataUrl?: string
      error?: string
    }>
    listBackgroundRemovalBackends: () => Promise<{ id: string; displayName: string }[]>
    listImageProcessPresets: () => Promise<import('./lib/imagePreset').ImageProcessPresetRecord[]>
    saveImageProcessPreset: (payload: {
      name: string
      options: import('./lib/imagePreset').ImageProcessPresetStored
    }) => Promise<{ success: boolean; error?: string }>
    deleteImageProcessPreset: (id: string) => Promise<{ success: boolean; error?: string }>
    platform: NodeJS.Platform
    openVideoFiles: () => Promise<string[]>
    processVideo: (
      taskId: string,
      inputPath: string,
      outputDir: string,
      options: unknown,
    ) => Promise<{
      success: boolean
      outputPath?: string
      outputPaths?: string[]
      error?: string
    }>
    processVideoConcat: (
      taskId: string,
      inputPaths: string[],
      outputDir: string,
      options: unknown,
    ) => Promise<{
      success: boolean
      outputPath?: string
      outputPaths?: string[]
      error?: string
    }>
    getVideoFileInfo: (filePath: string) => Promise<{
      durationSec: number
      width?: number
      height?: number
      formatName?: string
      videoCodec?: string
      audioCodec?: string
      bitRateBps?: number
      videoBitRateBps?: number
      audioBitRateBps?: number
      size: number
    } | null>
    getVideoThumbnail: (filePath: string) => Promise<{
      success: boolean
      dataUrl?: string
      error?: string
    }>
    cancelVideoTask: (taskId: string) => Promise<boolean>
    listVideoProcessPresets: () => Promise<import('./lib/videoPreset').VideoProcessPresetRecord[]>
    saveVideoProcessPreset: (payload: {
      name: string
      options: unknown
    }) => Promise<{ success: boolean; error?: string }>
    deleteVideoProcessPreset: (id: string) => Promise<{ success: boolean; error?: string }>
    subscribeVideoTaskProgress: (
      callback: (payload: { taskId: string; percent: number }) => void,
    ) => () => void
    open3dFiles: () => Promise<string[]>
    getModel3dFileInfo: (filePath: string) => Promise<{
      size: number
      extension: string
      meshCount: number
      materialCount: number
      textureCount: number
      animationCount: number
    } | null>
    save3dThumbnail: (
      inputPath: string,
      outputDir: string,
      pngBase64: string,
    ) => Promise<{
      success: boolean
      outputPath?: string
      error?: string
    }>
    convert3dModel: (
      inputPath: string,
      outputDir: string,
      options: unknown,
    ) => Promise<{
      success: boolean
      outputPath?: string
      error?: string
    }>
  }
}
