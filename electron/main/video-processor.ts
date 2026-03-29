import ffmpeg from 'fluent-ffmpeg'
import type { FfmpegCommand } from 'fluent-ffmpeg'
import path from 'node:path'
import fs from 'node:fs/promises'
import type { WebContents } from 'electron'
import { configureFfmpegStatic } from './ffmpeg-path'
import { sanitizeProcessVideoOptions, type SanitizedVideoOptions } from './video-options'

configureFfmpegStatic(ffmpeg)

const activeCommands = new Map<string, FfmpegCommand>()

export interface VideoFileInfoPayload {
  durationSec: number
  width?: number
  height?: number
  formatName?: string
  videoCodec?: string
  audioCodec?: string
  size: number
}

export interface ProcessVideoResult {
  success: boolean
  outputPath?: string
  outputPaths?: string[]
  error?: string
}

function sendProgress(sender: WebContents, taskId: string, percent: number): void {
  try {
    if (!sender.isDestroyed()) {
      sender.send('video:taskProgress', {
        taskId,
        percent: Math.min(99, Math.max(0, Math.round(percent))),
      })
    }
  } catch {
    /* ignore */
  }
}

export function cancelVideoTask(taskId: string): boolean {
  const cmd = activeCommands.get(taskId)
  if (!cmd) return false
  try {
    cmd.kill('SIGKILL')
  } catch {
    /* ignore */
  }
  activeCommands.delete(taskId)
  return true
}

export async function getVideoFileInfo(inputPath: string): Promise<VideoFileInfoPayload | null> {
  if (typeof inputPath !== 'string' || !inputPath.trim()) return null
  configureFfmpegStatic(ffmpeg)
  const st = await fs.stat(inputPath).catch(() => null)
  if (!st || !st.isFile()) return null

  return new Promise((resolve) => {
    ffmpeg.ffprobe(inputPath, (err, meta) => {
      if (err || !meta) {
        resolve({
          durationSec: 0,
          size: st.size,
        })
        return
      }
      const video = meta.streams.find((s) => s.codec_type === 'video')
      const audio = meta.streams.find((s) => s.codec_type === 'audio')
      const duration = parseFloat(String(meta.format.duration ?? '0')) || 0
      resolve({
        durationSec: duration,
        width: video?.width,
        height: video?.height,
        formatName: meta.format.format_long_name || meta.format.format_name,
        videoCodec: video?.codec_name,
        audioCodec: audio?.codec_name,
        size: st.size,
      })
    })
  })
}

function parsedBase(inputPath: string): { name: string; ext: string } {
  const p = path.parse(inputPath)
  return { name: p.name, ext: p.ext }
}

function applyScaleFilter(cmd: FfmpegCommand, maxW: number): void {
  if (maxW <= 0) return
  cmd.videoFilters(`scale='min(${maxW},iw)':-2`)
}

function buildTranscode(
  inputPath: string,
  outputPath: string,
  o: SanitizedVideoOptions,
  taskId: string,
  sender: WebContents,
): FfmpegCommand {
  const cmd = ffmpeg(inputPath).output(outputPath).outputOptions(['-map_metadata', '-1'])

  if (o.transcodePreset === 'copy_streams') {
    cmd.outputOptions(['-c', 'copy'])
  } else if (o.transcodePreset === 'high_quality_mp4') {
    cmd
      .videoCodec('libx264')
      .audioCodec('aac')
      .addOptions(['-crf', '18', '-preset', 'slow', '-movflags', '+faststart', '-b:a', '192k'])
    applyScaleFilter(cmd, o.maxWidth)
  } else {
    cmd
      .videoCodec('libx264')
      .audioCodec('aac')
      .addOptions(['-crf', '23', '-preset', 'fast', '-movflags', '+faststart', '-b:a', '128k'])
    applyScaleFilter(cmd, o.maxWidth)
  }

  cmd.on('progress', (p) => {
    if (typeof p.percent === 'number') sendProgress(sender, taskId, p.percent)
  })

  return cmd
}

function buildTrim(
  inputPath: string,
  outputPath: string,
  o: SanitizedVideoOptions,
  taskId: string,
  sender: WebContents,
) {
  const cmd = ffmpeg(inputPath)
    .setStartTime(o.startSec)
    .setDuration(o.durationSec)
    .videoCodec('libx264')
    .audioCodec('aac')
    .addOptions(['-crf', '23', '-preset', 'fast', '-movflags', '+faststart', '-b:a', '128k'])
    .output(outputPath)
    .outputOptions(['-map_metadata', '-1'])

  applyScaleFilter(cmd, o.maxWidth)
  cmd.on('progress', (p) => {
    if (typeof p.percent === 'number') sendProgress(sender, taskId, p.percent)
  })
  return cmd
}

function buildStripAudio(
  inputPath: string,
  outputPath: string,
  taskId: string,
  sender: WebContents,
) {
  const cmd = ffmpeg(inputPath)
    .videoCodec('copy')
    .noAudio()
    .output(outputPath)
    .outputOptions(['-map_metadata', '-1'])
  cmd.on('progress', (p) => {
    if (typeof p.percent === 'number') sendProgress(sender, taskId, p.percent)
  })
  return cmd
}

function audioCodecForFormat(f: SanitizedVideoOptions['audioFormat']): string {
  if (f === 'mp3') return 'libmp3lame'
  if (f === 'wav') return 'pcm_s16le'
  return 'aac'
}

function audioExt(f: SanitizedVideoOptions['audioFormat']): string {
  if (f === 'mp3') return 'mp3'
  if (f === 'wav') return 'wav'
  return 'm4a'
}

function buildAudioExtract(
  inputPath: string,
  outputPath: string,
  o: SanitizedVideoOptions,
  taskId: string,
  sender: WebContents,
) {
  const cmd = ffmpeg(inputPath)
    .noVideo()
    .audioCodec(audioCodecForFormat(o.audioFormat))
    .output(outputPath)
    .outputOptions(['-map_metadata', '-1'])
  if (o.audioFormat === 'aac') {
    cmd.addOptions(['-b:a', '192k'])
  }
  cmd.on('progress', (p) => {
    if (typeof p.percent === 'number') sendProgress(sender, taskId, p.percent)
  })
  return cmd
}

function buildGif(
  inputPath: string,
  outputPath: string,
  o: SanitizedVideoOptions,
  taskId: string,
  sender: WebContents,
) {
  const fps = o.gifFps
  const w = o.gifMaxWidth
  const vf = `fps=${fps},scale=${w}:-1:flags=lanczos,split[s0][s1];[s0]palettegen=stats_mode=single[p];[s1][p]paletteuse=dither=bayer`
  const cmd = ffmpeg(inputPath)
    .setStartTime(o.startSec)
    .setDuration(o.durationSec)
    .outputOptions(['-an', '-vf', vf])
    .output(outputPath)

  cmd.on('progress', (p) => {
    if (typeof p.percent === 'number') sendProgress(sender, taskId, p.percent)
  })
  return cmd
}

function runCommand(cmd: FfmpegCommand, taskId: string, sender: WebContents): Promise<void> {
  activeCommands.set(taskId, cmd)
  return new Promise((resolve, reject) => {
    cmd
      .on('end', () => {
        activeCommands.delete(taskId)
        sendProgress(sender, taskId, 100)
        resolve()
      })
      .on('error', (err: Error, _stdout, stderr) => {
        activeCommands.delete(taskId)
        const msg = err?.message || stderr || 'ffmpeg error'
        reject(new Error(msg))
      })
      .run()
  })
}

async function extractFramesSequence(
  inputPath: string,
  outputDir: string,
  baseName: string,
  o: SanitizedVideoOptions,
  info: VideoFileInfoPayload | null,
  taskId: string,
  sender: WebContents,
): Promise<string[]> {
  const step = o.frameIntervalSec
  const knownDur = info && info.durationSec > 0 ? info.durationSec : 0
  const endByDuration = knownDur > 0 ? knownDur : o.timeSec + step * o.maxFrameCount
  const ext = o.frameFormat === 'jpeg' ? 'jpg' : 'png'
  const times: number[] = []
  let t = o.timeSec
  while (t < endByDuration + 0.01 && times.length < o.maxFrameCount) {
    times.push(Math.max(0, t))
    t += step
  }
  if (times.length === 0) {
    times.push(Math.max(0, o.timeSec))
  }

  const outputs: string[] = []
  let i = 0
  for (const ts of times) {
    const out = path.join(outputDir, `${baseName}_frame_${String(++i).padStart(4, '0')}.${ext}`)
    const cmd = ffmpeg(inputPath).seekInput(ts).outputOptions(['-frames:v', '1']).output(out)
    if (o.frameFormat === 'jpeg') {
      cmd.outputOptions(['-q:v', '2'])
    }
    await runCommand(cmd, `${taskId}:${i}`, sender)
    outputs.push(out)
    sendProgress(sender, taskId, Math.round((i / times.length) * 100))
  }
  sendProgress(sender, taskId, 100)
  return outputs
}

export async function processVideo(
  taskId: string,
  inputPath: string,
  outputDir: string,
  rawOptions: unknown,
  sender: WebContents,
): Promise<ProcessVideoResult> {
  if (typeof taskId !== 'string' || !taskId.trim()) {
    return { success: false, error: 'Invalid task id' }
  }
  if (typeof inputPath !== 'string' || typeof outputDir !== 'string') {
    return { success: false, error: 'Invalid path arguments' }
  }

  const o = sanitizeProcessVideoOptions(rawOptions)
  configureFfmpegStatic(ffmpeg)

  try {
    await fs.mkdir(outputDir, { recursive: true })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Cannot create output directory'
    return { success: false, error: msg }
  }

  const { name: base } = parsedBase(inputPath)
  let info: VideoFileInfoPayload | null = null

  try {
    if (o.mode === 'trim' || o.mode === 'gif' || o.mode === 'extract_frame') {
      info = await getVideoFileInfo(inputPath)
      if (info && o.mode === 'trim') {
        const end = o.startSec + o.durationSec
        if (end > info.durationSec + 0.05 && info.durationSec > 0) {
          return {
            success: false,
            error: `裁剪范围超出时长（约 ${info.durationSec.toFixed(2)}s）`,
          }
        }
      }
      if (info && o.mode === 'extract_frame' && o.frameIntervalSec <= 0) {
        if (o.timeSec > info.durationSec + 0.05 && info.durationSec > 0) {
          return { success: false, error: '截取时间超出视频时长' }
        }
      }
    }

    if (o.mode === 'extract_frame' && o.frameIntervalSec > 0) {
      const outputs = await extractFramesSequence(
        inputPath,
        outputDir,
        base,
        o,
        info,
        taskId,
        sender,
      )
      return { success: true, outputPaths: outputs, outputPath: outputs[0] }
    }

    let outputPath = ''
    let cmd: FfmpegCommand

    switch (o.mode) {
      case 'transcode': {
        outputPath = path.join(outputDir, `${base}_transcoded.mp4`)
        cmd = buildTranscode(inputPath, outputPath, o, taskId, sender)
        break
      }
      case 'trim': {
        outputPath = path.join(outputDir, `${base}_trim.mp4`)
        cmd = buildTrim(inputPath, outputPath, o, taskId, sender)
        break
      }
      case 'strip_audio': {
        outputPath = path.join(outputDir, `${base}_noaudio.mp4`)
        cmd = buildStripAudio(inputPath, outputPath, taskId, sender)
        break
      }
      case 'audio_extract': {
        outputPath = path.join(outputDir, `${base}_audio.${audioExt(o.audioFormat)}`)
        cmd = buildAudioExtract(inputPath, outputPath, o, taskId, sender)
        break
      }
      case 'gif': {
        outputPath = path.join(outputDir, `${base}_clip.gif`)
        cmd = buildGif(inputPath, outputPath, o, taskId, sender)
        break
      }
      case 'extract_frame': {
        const ext = o.frameFormat === 'jpeg' ? 'jpg' : 'png'
        outputPath = path.join(outputDir, `${base}_frame.${ext}`)
        cmd = ffmpeg(inputPath)
          .seekInput(o.timeSec)
          .outputOptions(['-frames:v', '1'])
          .output(outputPath)
        if (o.frameFormat === 'jpeg') {
          cmd.outputOptions(['-q:v', '2'])
        }
        cmd.on('progress', (p) => {
          if (typeof p.percent === 'number') sendProgress(sender, taskId, p.percent)
        })
        break
      }
      default: {
        outputPath = path.join(outputDir, `${base}_transcoded.mp4`)
        cmd = buildTranscode(inputPath, outputPath, o, taskId, sender)
      }
    }

    await runCommand(cmd, taskId, sender)
    return { success: true, outputPath }
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Video processing failed'
    return { success: false, error: message }
  }
}
