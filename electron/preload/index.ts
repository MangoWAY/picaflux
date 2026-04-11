import { ipcRenderer, contextBridge, webUtils, type IpcRendererEvent } from 'electron'

// --------- Expose some API to the Renderer process ---------
contextBridge.exposeInMainWorld('ipcRenderer', {
  on(...args: Parameters<typeof ipcRenderer.on>) {
    const [channel, listener] = args
    return ipcRenderer.on(channel, (event, ...args) => listener(event, ...args))
  },
  off(...args: Parameters<typeof ipcRenderer.off>) {
    const [channel, ...omit] = args
    return ipcRenderer.off(channel, ...omit)
  },
  send(...args: Parameters<typeof ipcRenderer.send>) {
    const [channel, ...omit] = args
    return ipcRenderer.send(channel, ...omit)
  },
  invoke(...args: Parameters<typeof ipcRenderer.invoke>) {
    const [channel, ...omit] = args
    return ipcRenderer.invoke(channel, ...omit)
  },
})

contextBridge.exposeInMainWorld('picafluxAPI', {
  openFiles: () => ipcRenderer.invoke('dialog:openFiles'),
  openDirectory: () => ipcRenderer.invoke('dialog:openDirectory'),
  processImage: (inputPath: string, outputDir: string, options: unknown) =>
    ipcRenderer.invoke('image:process', inputPath, outputDir, options),
  sliceImageGrid: (inputPath: string, outputDir: string, options: unknown) =>
    ipcRenderer.invoke('image:sliceGrid', inputPath, outputDir, options) as Promise<{
      success: boolean
      outputPaths?: string[]
      error?: string
    }>,
  openVideoFiles: () => ipcRenderer.invoke('dialog:openVideoFiles') as Promise<string[]>,
  processVideo: (taskId: string, inputPath: string, outputDir: string, options: unknown) =>
    ipcRenderer.invoke('video:process', taskId, inputPath, outputDir, options) as Promise<{
      success: boolean
      outputPath?: string
      outputPaths?: string[]
      error?: string
    }>,
  processVideoConcat: (taskId: string, inputPaths: string[], outputDir: string, options: unknown) =>
    ipcRenderer.invoke('video:processConcat', taskId, inputPaths, outputDir, options) as Promise<{
      success: boolean
      outputPath?: string
      outputPaths?: string[]
      error?: string
    }>,
  getVideoFileInfo: (filePath: string) =>
    ipcRenderer.invoke('video:getFileInfo', filePath) as Promise<{
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
    } | null>,
  getVideoThumbnail: (filePath: string) =>
    ipcRenderer.invoke('video:getThumbnail', filePath) as Promise<{
      success: boolean
      dataUrl?: string
      error?: string
    }>,
  cancelVideoTask: (taskId: string) =>
    ipcRenderer.invoke('video:cancel', taskId) as Promise<boolean>,
  subscribeVideoTaskProgress: (
    callback: (payload: { taskId: string; percent: number }) => void,
  ): (() => void) => {
    const handler = (_event: IpcRendererEvent, payload: { taskId: string; percent: number }) => {
      callback(payload)
    }
    ipcRenderer.on('video:taskProgress', handler)
    return () => {
      ipcRenderer.removeListener('video:taskProgress', handler)
    }
  },
  open3dFiles: () => ipcRenderer.invoke('dialog:open3dFiles') as Promise<string[]>,
  getModel3dFileInfo: (filePath: string) =>
    ipcRenderer.invoke('3d:getFileInfo', filePath) as Promise<{
      size: number
      extension: string
      meshCount: number
      materialCount: number
      textureCount: number
      animationCount: number
    } | null>,
  save3dThumbnail: (inputPath: string, outputDir: string, pngBase64: string) =>
    ipcRenderer.invoke('3d:saveThumbnail', inputPath, outputDir, pngBase64) as Promise<{
      success: boolean
      outputPath?: string
      error?: string
    }>,
  convert3dModel: (inputPath: string, outputDir: string, options: unknown) =>
    ipcRenderer.invoke('3d:convert', inputPath, outputDir, options) as Promise<{
      success: boolean
      outputPath?: string
      error?: string
    }>,
  getPathForFile: (file: File) => webUtils.getPathForFile(file),
  getImageFileInfo: (filePath: string) =>
    ipcRenderer.invoke('image:getFileInfo', filePath) as Promise<{
      size: number
      width?: number
      height?: number
      format?: string
    } | null>,
  getImageAlphaPreview: (filePath: string, options?: { maxSize?: number }) =>
    ipcRenderer.invoke('image:getAlphaPreview', filePath, options ?? {}) as Promise<{
      success: boolean
      dataUrl?: string
      error?: string
    }>,
  listBackgroundRemovalBackends: () =>
    ipcRenderer.invoke('image:listBackgroundRemovalBackends') as Promise<
      { id: string; displayName: string }[]
    >,
  listImageProcessPresets: () => ipcRenderer.invoke('image:presets:list'),
  saveImageProcessPreset: (payload: { name: string; options: unknown }) =>
    ipcRenderer.invoke('image:presets:save', payload) as Promise<{
      success: boolean
      error?: string
    }>,
  deleteImageProcessPreset: (id: string) =>
    ipcRenderer.invoke('image:presets:delete', id) as Promise<{
      success: boolean
      error?: string
    }>,
  platform: process.platform,
})

// --------- Preload scripts loading ---------
function domReady(condition: DocumentReadyState[] = ['complete', 'interactive']) {
  return new Promise((resolve) => {
    if (condition.includes(document.readyState)) {
      resolve(true)
    } else {
      document.addEventListener('readystatechange', () => {
        if (condition.includes(document.readyState)) {
          resolve(true)
        }
      })
    }
  })
}

const safeDOM = {
  append(parent: HTMLElement, child: HTMLElement) {
    if (!Array.from(parent.children).find((e) => e === child)) {
      return parent.appendChild(child)
    }
  },
  remove(parent: HTMLElement, child: HTMLElement) {
    if (Array.from(parent.children).find((e) => e === child)) {
      return parent.removeChild(child)
    }
  },
}

/**
 * https://tobiasahlin.com/spinkit
 * https://connoratherton.com/loaders
 * https://projects.lukehaas.me/css-loaders
 * https://matejkustec.github.io/SpinThatShit
 */
function useLoading() {
  const className = `loaders-css__square-spin`
  const styleContent = `
@keyframes square-spin {
  25% { transform: perspective(100px) rotateX(180deg) rotateY(0); }
  50% { transform: perspective(100px) rotateX(180deg) rotateY(180deg); }
  75% { transform: perspective(100px) rotateX(0) rotateY(180deg); }
  100% { transform: perspective(100px) rotateX(0) rotateY(0); }
}
.${className} > div {
  animation-fill-mode: both;
  width: 50px;
  height: 50px;
  background: #fff;
  animation: square-spin 3s 0s cubic-bezier(0.09, 0.57, 0.49, 0.9) infinite;
}
.app-loading-wrap {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #282c34;
  z-index: 9;
}
    `
  const oStyle = document.createElement('style')
  const oDiv = document.createElement('div')

  oStyle.id = 'app-loading-style'
  oStyle.innerHTML = styleContent
  oDiv.className = 'app-loading-wrap'
  oDiv.innerHTML = `<div class="${className}"><div></div></div>`

  return {
    appendLoading() {
      safeDOM.append(document.head, oStyle)
      safeDOM.append(document.body, oDiv)
    },
    removeLoading() {
      safeDOM.remove(document.head, oStyle)
      safeDOM.remove(document.body, oDiv)
    },
  }
}

// ----------------------------------------------------------------------

const { appendLoading, removeLoading } = useLoading()
domReady().then(appendLoading)

window.onmessage = (ev) => {
  if (ev.data.payload === 'removeLoading') {
    removeLoading()
  }
}

setTimeout(removeLoading, 4999)
