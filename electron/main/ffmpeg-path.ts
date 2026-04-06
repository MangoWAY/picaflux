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

function resolveBundledFfmpeg(): string | null {
  try {
    const p = require('ffmpeg-static') as string | null
    return typeof p === 'string' && p.length > 0 ? p : null
  } catch {
    return null
  }
}

function resolveBundledFfprobe(): string | null {
  try {
    const m = require('ffprobe-static') as { path?: string }
    return typeof m?.path === 'string' && m.path.length > 0 ? m.path : null
  } catch {
    return null
  }
}

/**
 * 混合策略：`FFMPEG_PATH` / `FFPROBE_PATH` → `resources/ffmpeg-bin` → `ffmpeg-static` / `ffprobe-static`（含 libwebp 等较全编码器）。
 */
export function getFfmpegPathsForRuntime(): { ffmpeg: string; ffprobe: string } {
  const envFfmpeg = process.env.FFMPEG_PATH?.trim()
  const envFfprobe = process.env.FFPROBE_PATH?.trim()
  const resFfmpeg = resourcesBin('ffmpeg')
  const resFfprobe = resourcesBin('ffprobe')

  const ffmpegPath = envFfmpeg ?? resFfmpeg ?? resolveBundledFfmpeg()
  const ffprobePath = envFfprobe ?? resFfprobe ?? resolveBundledFfprobe()

  if (!ffmpegPath) {
    throw new Error(
      '未找到 ffmpeg。请设置 FFMPEG_PATH，或将 ffmpeg 放入打包资源的 ffmpeg-bin/，并确保已安装依赖 ffmpeg-static（npm install 会下载二进制）。',
    )
  }
  if (!ffprobePath) {
    throw new Error(
      '未找到 ffprobe。请设置 FFPROBE_PATH，或将 ffprobe 放入打包资源的 ffmpeg-bin/，并确保已安装依赖 ffprobe-static。',
    )
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
