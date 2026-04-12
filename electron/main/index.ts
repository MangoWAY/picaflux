import {
  app,
  BrowserWindow,
  shell,
  ipcMain,
  dialog,
  screen,
  nativeTheme,
  type BrowserWindowConstructorOptions,
} from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import os from 'node:os'
import { update } from './update'
import {
  processImage,
  getImageAlphaPreviewDataUrl,
  getImageFileInfo,
  sanitizeGetImageAlphaPreviewOptions,
  sanitizeProcessImageOptions,
  sanitizeSliceImageGridOptions,
  sliceImageGrid,
} from './image-processor'
import {
  processVideo,
  processVideoConcat,
  getVideoFileInfo,
  getVideoThumbnailDataUrl,
  cancelVideoTask,
} from './video-processor'
import { getModel3dFileInfo, save3dThumbnailPng, processGlbConvert } from './gltf-3d-processor'
import {
  registerBackgroundRemovalBackends,
  listBackgroundRemovalBackendMetas,
} from './background-removal/registry'
import {
  listImageProcessPresets,
  saveImageProcessPreset,
  deleteImageProcessPreset,
} from './image-process-presets'
import {
  listVideoProcessPresets,
  saveVideoProcessPreset,
  deleteVideoProcessPreset,
} from './video-process-presets'
const __dirname = path.dirname(fileURLToPath(import.meta.url))

// The built directory structure
//
// ├─┬ dist-electron
// │ ├─┬ main
// │ │ └── index.js    > Electron-Main
// │ └─┬ preload
// │   └── index.mjs   > Preload-Scripts
// ├─┬ dist
// │ └── index.html    > Electron-Renderer
//
process.env.APP_ROOT = path.join(__dirname, '../..')

export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')
export const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, 'public')
  : RENDERER_DIST

// Disable GPU Acceleration for Windows 7
if (os.release().startsWith('6.1')) app.disableHardwareAcceleration()

// Set application name for Windows 10+ notifications
if (process.platform === 'win32') app.setAppUserModelId(app.getName())

if (!app.requestSingleInstanceLock()) {
  app.quit()
  process.exit(0)
}

let win: BrowserWindow | null = null
const preload = path.join(__dirname, '../preload/index.mjs')
const indexHtml = path.join(RENDERER_DIST, 'index.html')

async function createWindow() {
  const { width: workW, height: workH } = screen.getPrimaryDisplay().workAreaSize
  // Image workbench is three columns; target ~90% of work area with sane clamps
  const width = Math.max(1100, Math.min(1600, Math.floor(workW * 0.92)))
  const height = Math.max(720, Math.min(1000, Math.floor(workH * 0.9)))

  const winOptions: BrowserWindowConstructorOptions = {
    title: 'PicaFlux',
    width,
    height,
    minWidth: 1024,
    minHeight: 680,
    backgroundColor: '#121212',
    icon: path.join(process.env.VITE_PUBLIC, 'favicon.ico'),
    webPreferences: {
      preload,
      webSecurity: !VITE_DEV_SERVER_URL, // Allow file:// in dev mode
      // Warning: Enable nodeIntegration and disable contextIsolation is not secure in production
      // nodeIntegration: true,

      // Consider using contextBridge.exposeInMainWorld
      // Read more on https://www.electronjs.org/docs/latest/tutorial/context-isolation
      // contextIsolation: false,
    },
  }

  if (process.platform === 'darwin') {
    winOptions.titleBarStyle = 'hiddenInset'
    winOptions.trafficLightPosition = { x: 14, y: 12 }
  }

  win = new BrowserWindow(winOptions)

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(indexHtml)
  }

  // Test actively push message to the Electron-Renderer
  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', new Date().toLocaleString())
  })

  // Make all links open with the browser, not with the application
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https:')) shell.openExternal(url)
    return { action: 'deny' }
  })

  // Auto update
  update(win)
}

registerBackgroundRemovalBackends()

app.whenReady().then(() => {
  nativeTheme.themeSource = 'dark'
  createWindow()
})

app.on('window-all-closed', () => {
  win = null
  if (process.platform !== 'darwin') app.quit()
})

app.on('second-instance', () => {
  if (win) {
    // Focus on the main window if the user tried to open another
    if (win.isMinimized()) win.restore()
    win.focus()
  }
})

app.on('activate', () => {
  const allWindows = BrowserWindow.getAllWindows()
  if (allWindows.length) {
    allWindows[0].focus()
  } else {
    createWindow()
  }
})

// New window example arg: new windows url
ipcMain.handle('open-win', (_, arg) => {
  const childWindow = new BrowserWindow({
    webPreferences: {
      preload,
      nodeIntegration: true,
      contextIsolation: false,
    },
  })

  if (VITE_DEV_SERVER_URL) {
    childWindow.loadURL(`${VITE_DEV_SERVER_URL}#${arg}`)
  } else {
    childWindow.loadFile(indexHtml, { hash: arg })
  }
})

// IPC Handlers for Image Processing
ipcMain.handle('dialog:openFiles', async () => {
  if (!win) return []
  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    properties: ['openFile', 'multiSelections'],
    filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp', 'avif'] }],
  })
  if (canceled) {
    return []
  } else {
    return filePaths
  }
})

ipcMain.handle('dialog:openDirectory', async () => {
  if (!win) return null
  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    properties: ['openDirectory'],
  })
  if (canceled) {
    return null
  } else {
    return filePaths[0]
  }
})

ipcMain.handle(
  'image:process',
  async (_, inputPath: string, outputDir: string, options: unknown) => {
    if (typeof inputPath !== 'string' || typeof outputDir !== 'string') {
      return { success: false, error: 'Invalid path arguments' }
    }
    const cleaned = sanitizeProcessImageOptions(options)
    if (!cleaned.overwriteOriginal && !outputDir.trim()) {
      return { success: false, error: 'Invalid output directory' }
    }
    return await processImage(inputPath, outputDir, cleaned)
  },
)

ipcMain.handle(
  'image:sliceGrid',
  async (_, inputPath: string, outputDir: string, options: unknown) => {
    if (typeof inputPath !== 'string' || typeof outputDir !== 'string') {
      return { success: false, error: 'Invalid path arguments' }
    }
    const cleaned = sanitizeSliceImageGridOptions(options)
    if (!cleaned) {
      return { success: false, error: 'Invalid slice options' }
    }
    return await sliceImageGrid(inputPath, outputDir, cleaned)
  },
)

ipcMain.handle('image:getFileInfo', async (_, inputPath: string) => {
  if (typeof inputPath !== 'string' || !inputPath) {
    return null
  }
  return await getImageFileInfo(inputPath)
})

ipcMain.handle('image:getAlphaPreview', async (_, inputPath: string, options: unknown) => {
  if (typeof inputPath !== 'string' || !inputPath) {
    return { success: false, error: 'Invalid path arguments' }
  }
  return await getImageAlphaPreviewDataUrl(inputPath, sanitizeGetImageAlphaPreviewOptions(options))
})

ipcMain.handle('image:listBackgroundRemovalBackends', () => {
  return listBackgroundRemovalBackendMetas()
})

ipcMain.handle('image:presets:list', async () => {
  return await listImageProcessPresets(app.getPath('userData'))
})

ipcMain.handle('image:presets:save', async (_, payload: unknown) => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { success: false, error: '参数无效' }
  }
  const o = payload as Record<string, unknown>
  const name = typeof o.name === 'string' ? o.name : ''
  return await saveImageProcessPreset(app.getPath('userData'), name, o.options)
})

ipcMain.handle('image:presets:delete', async (_, id: unknown) => {
  if (typeof id !== 'string') {
    return { success: false, error: '参数无效' }
  }
  return await deleteImageProcessPreset(app.getPath('userData'), id)
})

ipcMain.handle('video:presets:list', async () => {
  return await listVideoProcessPresets(app.getPath('userData'))
})

ipcMain.handle('video:presets:save', async (_, payload: unknown) => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { success: false, error: '参数无效' }
  }
  const o = payload as Record<string, unknown>
  const name = typeof o.name === 'string' ? o.name : ''
  return await saveVideoProcessPreset(app.getPath('userData'), name, o.options)
})

ipcMain.handle('video:presets:delete', async (_, id: unknown) => {
  if (typeof id !== 'string') {
    return { success: false, error: '参数无效' }
  }
  return await deleteVideoProcessPreset(app.getPath('userData'), id)
})

const VIDEO_DIALOG_EXT = ['mp4', 'mov', 'mkv', 'webm', 'm4v', 'avi', 'mpeg', 'mpg'] as const

ipcMain.handle('dialog:openVideoFiles', async () => {
  if (!win) return []
  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    properties: ['openFile', 'multiSelections'],
    filters: [{ name: 'Video', extensions: [...VIDEO_DIALOG_EXT] }],
  })
  return canceled ? [] : filePaths
})

ipcMain.handle(
  'video:process',
  async (event, taskId: string, inputPath: string, outputDir: string, options: unknown) => {
    if (
      typeof taskId !== 'string' ||
      typeof inputPath !== 'string' ||
      typeof outputDir !== 'string'
    ) {
      return { success: false, error: 'Invalid arguments' }
    }
    return await processVideo(taskId, inputPath, outputDir, options, event.sender)
  },
)

ipcMain.handle(
  'video:processConcat',
  async (event, taskId: string, inputPaths: unknown, outputDir: string, options: unknown) => {
    if (typeof taskId !== 'string' || typeof outputDir !== 'string') {
      return { success: false, error: 'Invalid arguments' }
    }
    return await processVideoConcat(taskId, inputPaths, outputDir, options, event.sender)
  },
)

ipcMain.handle('video:getFileInfo', async (_, inputPath: string) => {
  if (typeof inputPath !== 'string' || !inputPath) {
    return null
  }
  return await getVideoFileInfo(inputPath)
})

ipcMain.handle('video:getThumbnail', async (_, inputPath: string) => {
  if (typeof inputPath !== 'string' || !inputPath) {
    return { success: false, error: 'Invalid arguments' }
  }
  return await getVideoThumbnailDataUrl(inputPath)
})

ipcMain.handle('video:cancel', (_, taskId: string) => {
  if (typeof taskId !== 'string') return false
  return cancelVideoTask(taskId)
})

const MODEL_3D_EXT = ['glb', 'gltf'] as const

ipcMain.handle('dialog:open3dFiles', async () => {
  if (!win) return []
  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    properties: ['openFile', 'multiSelections'],
    filters: [{ name: 'glTF', extensions: [...MODEL_3D_EXT] }],
  })
  return canceled ? [] : filePaths
})

ipcMain.handle('3d:getFileInfo', async (_, inputPath: string) => {
  if (typeof inputPath !== 'string' || !inputPath) return null
  return await getModel3dFileInfo(inputPath)
})

ipcMain.handle(
  '3d:saveThumbnail',
  async (_, inputPath: string, outputDir: string, pngBase64: string) => {
    if (
      typeof inputPath !== 'string' ||
      typeof outputDir !== 'string' ||
      typeof pngBase64 !== 'string'
    ) {
      return { success: false, error: 'Invalid arguments' }
    }
    return await save3dThumbnailPng(inputPath, outputDir, pngBase64)
  },
)

ipcMain.handle('3d:convert', async (_, inputPath: string, outputDir: string, options: unknown) => {
  if (typeof inputPath !== 'string' || typeof outputDir !== 'string') {
    return { success: false, error: 'Invalid path arguments' }
  }
  return await processGlbConvert(inputPath, outputDir, options)
})
