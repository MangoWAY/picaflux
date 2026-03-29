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
    getPathForFile: (file: File) => string
    getImageFileInfo: (filePath: string) => Promise<{
      size: number
      width?: number
      height?: number
      format?: string
    } | null>
    listBackgroundRemovalBackends: () => Promise<{ id: string; displayName: string }[]>
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
    getVideoFileInfo: (filePath: string) => Promise<{
      durationSec: number
      width?: number
      height?: number
      formatName?: string
      videoCodec?: string
      audioCodec?: string
      size: number
    } | null>
    cancelVideoTask: (taskId: string) => Promise<boolean>
    subscribeVideoTaskProgress: (
      callback: (payload: { taskId: string; percent: number }) => void,
    ) => () => void
  }
}
