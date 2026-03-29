import { createRequire } from 'node:module'
import { app } from 'electron'
import fs from 'node:fs'
import path from 'node:path'

const require = createRequire(import.meta.url)

function assertBinaryExists(p: string, label: string): void {
  if (!fs.existsSync(p)) {
    throw new Error(`${label} 不存在: ${p}`)
  }
  if (process.platform !== 'win32') {
    try {
      fs.accessSync(p, fs.constants.X_OK)
    } catch {
      throw new Error(`${label} 不可执行: ${p}`)
    }
  }
}

/** 打包后 `extraResources` 放入的目录（可选） */
function resourcesBin(name: 'ffmpeg' | 'ffprobe'): string | null {
  if (!process.versions.electron) return null
  try {
    if (!app.isPackaged) return null
    const ext = process.platform === 'win32' ? '.exe' : ''
    const p = path.join(process.resourcesPath, 'ffmpeg-bin', `${name}${ext}`)
    return fs.existsSync(p) ? p : null
  } catch {
    return null
  }
}

/**
 * 混合策略：`FFMPEG_PATH` / `FFPROBE_PATH` → `resources/ffmpeg-bin` → installer 包。
 * 环境变量可只设其一，缺失项由 installer 补齐。
 */
export function getFfmpegPathsForRuntime(): { ffmpeg: string; ffprobe: string } {
  const envFfmpeg = process.env.FFMPEG_PATH?.trim()
  const envFfprobe = process.env.FFPROBE_PATH?.trim()
  const resFfmpeg = resourcesBin('ffmpeg')
  const resFfprobe = resourcesBin('ffprobe')

  let ffmpegPath = envFfmpeg ?? resFfmpeg
  let ffprobePath = envFfprobe ?? resFfprobe

  if (!ffmpegPath) {
    try {
      ffmpegPath = (require('@ffmpeg-installer/ffmpeg') as { path: string }).path
    } catch {
      throw new Error(
        '未找到 ffmpeg。请设置 FFMPEG_PATH，或将 ffmpeg 放入打包资源的 ffmpeg-bin/，或安装 @ffmpeg-installer/ffmpeg。',
      )
    }
  }
  if (!ffprobePath) {
    try {
      ffprobePath = (require('@ffprobe-installer/ffprobe') as { path: string }).path
    } catch {
      throw new Error(
        '未找到 ffprobe。请设置 FFPROBE_PATH，或将 ffprobe 放入打包资源的 ffmpeg-bin/，或安装 @ffprobe-installer/ffprobe。',
      )
    }
  }

  assertBinaryExists(ffmpegPath, 'ffmpeg')
  assertBinaryExists(ffprobePath, 'ffprobe')

  return { ffmpeg: ffmpegPath, ffprobe: ffprobePath }
}

let configured = false

export function configureFfmpegStatic(ffmpegLib: {
  setFfmpegPath: (p: string) => void
  setFfprobePath: (p: string) => void
}): void {
  if (configured) return
  const { ffmpeg, ffprobe } = getFfmpegPathsForRuntime()
  ffmpegLib.setFfmpegPath(ffmpeg)
  ffmpegLib.setFfprobePath(ffprobe)
  configured = true
}
