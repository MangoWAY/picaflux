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
  hasAudio?: boolean
  /** overall bitrate in bits per second */
  bitRateBps?: number
  /** video stream bitrate in bits per second */
  videoBitRateBps?: number
  /** audio stream bitrate in bits per second */
  audioBitRateBps?: number
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
          hasAudio: false,
        })
        return
      }
      const video = meta.streams.find((s) => s.codec_type === 'video')
      const audio = meta.streams.find((s) => s.codec_type === 'audio')
      const duration = parseFloat(String(meta.format.duration ?? '0')) || 0
      const bitRateBps = (() => {
        const raw = meta.format.bit_rate ?? video?.bit_rate ?? audio?.bit_rate ?? null
        const n = typeof raw === 'number' ? raw : parseInt(String(raw ?? ''), 10)
        if (Number.isFinite(n) && n > 0) return n
        if (duration > 0 && st.size > 0) return Math.round((st.size * 8) / duration)
        return undefined
      })()
      const videoBitRateBps = (() => {
        const raw = video?.bit_rate ?? null
        const n = typeof raw === 'number' ? raw : parseInt(String(raw ?? ''), 10)
        return Number.isFinite(n) && n > 0 ? n : undefined
      })()
      const audioBitRateBps = (() => {
        const raw = audio?.bit_rate ?? null
        const n = typeof raw === 'number' ? raw : parseInt(String(raw ?? ''), 10)
        return Number.isFinite(n) && n > 0 ? n : undefined
      })()
      resolve({
        durationSec: duration,
        width: video?.width,
        height: video?.height,
        formatName: meta.format.format_long_name || meta.format.format_name,
        videoCodec: video?.codec_name,
        audioCodec: audio?.codec_name,
        hasAudio: Boolean(audio),
        bitRateBps,
        videoBitRateBps,
        audioBitRateBps,
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

function needsVideoTransform(o: SanitizedVideoOptions): boolean {
  return o.videoRotationDeg !== 0 || o.videoFlip !== 'none'
}

function videoTransformFilterParts(o: SanitizedVideoOptions): string[] {
  const parts: string[] = []
  switch (o.videoRotationDeg) {
    case 0:
      break
    case 90:
      parts.push('transpose=1')
      break
    case 180:
      parts.push('transpose=1')
      parts.push('transpose=1')
      break
    case 270:
      parts.push('transpose=2')
      break
    default:
      break
  }
  if (o.videoFlip === 'horizontal') parts.push('hflip')
  else if (o.videoFlip === 'vertical') parts.push('vflip')
  else if (o.videoFlip === 'both') {
    parts.push('hflip')
    parts.push('vflip')
  }
  return parts
}

/** 旋转/翻转 + 可选最长边缩放（与图片工作台语义一致） */
function joinTransformAndMaxWidthVF(o: SanitizedVideoOptions): string | null {
  const t = videoTransformFilterParts(o)
  const tf = t.length ? t.join(',') : null
  const scale = o.maxWidth > 0 ? `scale='min(${o.maxWidth},iw)':-2` : null
  if (tf && scale) return `${tf},${scale}`
  if (tf) return tf
  if (scale) return scale
  return null
}

function dimensionsAfterRotation(
  w: number,
  h: number,
  rot: SanitizedVideoOptions['videoRotationDeg'],
): [number, number] {
  if (rot === 90 || rot === 270) return [h, w]
  return [w, h]
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
    const vf = joinTransformAndMaxWidthVF(o)
    if (vf) cmd.videoFilters(vf)
  } else {
    cmd
      .videoCodec('libx264')
      .audioCodec('aac')
      .addOptions(['-crf', '23', '-preset', 'fast', '-movflags', '+faststart', '-b:a', '128k'])
    const vf = joinTransformAndMaxWidthVF(o)
    if (vf) cmd.videoFilters(vf)
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

  const vf = joinTransformAndMaxWidthVF(o)
  if (vf) cmd.videoFilters(vf)
  else applyScaleFilter(cmd, o.maxWidth)
  cmd.on('progress', (p) => {
    if (typeof p.percent === 'number') sendProgress(sender, taskId, p.percent)
  })
  return cmd
}

function buildStripAudio(
  inputPath: string,
  outputPath: string,
  o: SanitizedVideoOptions,
  taskId: string,
  sender: WebContents,
) {
  if (needsVideoTransform(o) || o.maxWidth > 0) {
    const cmd = ffmpeg(inputPath)
      .videoCodec('libx264')
      .noAudio()
      .addOptions(['-crf', '23', '-preset', 'fast', '-movflags', '+faststart'])
      .output(outputPath)
      .outputOptions(['-map_metadata', '-1'])
    const vf = joinTransformAndMaxWidthVF(o)
    if (vf) cmd.videoFilters(vf)
    cmd.on('progress', (p) => {
      if (typeof p.percent === 'number') sendProgress(sender, taskId, p.percent)
    })
    return cmd
  }
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

function createGifEncodeCommand(
  inputPath: string,
  outputPath: string,
  o: SanitizedVideoOptions,
): FfmpegCommand {
  const fps = o.gifFps
  const w = o.gifMaxWidth
  const tp = videoTransformFilterParts(o).join(',')
  const graph = `fps=${fps},scale=${w}:-1:flags=lanczos,split[s0][s1];[s0]palettegen=stats_mode=single[p];[s1][p]paletteuse=dither=bayer`
  const vf = tp ? `${tp},${graph}` : graph
  return ffmpeg(inputPath)
    .setStartTime(o.startSec)
    .setDuration(o.durationSec)
    .outputOptions(['-an', '-vf', vf])
    .output(outputPath)
}

function buildGif(
  inputPath: string,
  outputPath: string,
  o: SanitizedVideoOptions,
  taskId: string,
  sender: WebContents,
) {
  const cmd = createGifEncodeCommand(inputPath, outputPath, o)
  cmd.on('progress', (p) => {
    if (typeof p.percent === 'number') sendProgress(sender, taskId, p.percent)
  })
  return cmd
}

/** 动图 WebP：依赖 ffmpeg 编译时启用 libwebp（若报 Unknown encoder，请换用带 libwebp 的 ffmpeg 并设置 FFMPEG_PATH） */
function buildWebpAnim(
  inputPath: string,
  outputPath: string,
  o: SanitizedVideoOptions,
  taskId: string,
  sender: WebContents,
): FfmpegCommand {
  const fps = o.gifFps
  const w = o.gifMaxWidth
  const q = Math.round(o.webpQuality)
  const tp = videoTransformFilterParts(o).join(',')
  const core = `fps=${fps},scale=${w}:-1:flags=lanczos`
  const vf = tp ? `${tp},${core}` : core
  const cmd = ffmpeg(inputPath)
    .setStartTime(o.startSec)
    .setDuration(o.durationSec)
    .outputOptions([
      '-an',
      '-vf',
      vf,
      '-c:v',
      'libwebp',
      '-lossless',
      '0',
      '-compression_level',
      '4',
      '-q:v',
      String(q),
      '-loop',
      '0',
      '-preset',
      'default',
      '-map_metadata',
      '-1',
    ])
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
        let msg = err?.message || stderr || 'ffmpeg error'
        if (/Unknown encoder ['"]?libwebp/i.test(msg) || /Codec not found.*libwebp/i.test(msg)) {
          msg +=
            '（当前 ffmpeg 未启用 libwebp；请安装带 libwebp 的 ffmpeg 或通过 FFMPEG_PATH 指定）'
        }
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
  const tfOnly = videoTransformFilterParts(o).join(',')
  for (const ts of times) {
    const out = path.join(outputDir, `${baseName}_frame_${String(++i).padStart(4, '0')}.${ext}`)
    const cmd = ffmpeg(inputPath).seekInput(ts).outputOptions(['-frames:v', '1']).output(out)
    if (tfOnly) cmd.videoFilters(tfOnly)
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

async function buildConcatCommand(
  inputPaths: string[],
  outputPath: string,
  o: SanitizedVideoOptions,
  taskId: string,
  sender: WebContents,
): Promise<FfmpegCommand> {
  const infos = await Promise.all(inputPaths.map((p) => getVideoFileInfo(p)))
  if (infos.some((x) => !x)) {
    throw new Error('无法读取某个视频的元数据')
  }
  const probes = infos as VideoFileInfoPayload[]
  if (probes.some((p) => !p.hasAudio)) {
    throw new Error('合并需每个片段均包含音轨；无声片段请先单独处理或重新封装')
  }

  const fallbackW = 1280
  const fallbackH = 720
  const eff = probes.map((p) => {
    const w = p.width && p.width > 0 ? p.width : fallbackW
    const h = p.height && p.height > 0 ? p.height : fallbackH
    return dimensionsAfterRotation(w, h, o.videoRotationDeg)
  })
  const maxEffW = Math.max(...eff.map(([ew]) => ew))
  const targetW = o.maxWidth > 0 ? Math.min(o.maxWidth, maxEffW) : maxEffW
  const tw = Math.max(16, Math.round(targetW))

  const scaledHeights = eff.map(([ew, eh]) => Math.max(1, Math.round((eh * tw) / ew)))
  const maxH = Math.max(...scaledHeights)

  const tf = videoTransformFilterParts(o)
  const tfPrefix = tf.length ? `${tf.join(',')},` : ''

  const filterLines: string[] = []
  for (let i = 0; i < inputPaths.length; i++) {
    filterLines.push(
      `[${i}:v]${tfPrefix}scale=${tw}:-2,pad=${tw}:${maxH}:(ow-iw)/2:(oh-ih)/2:black,setsar=1,setpts=PTS-STARTPTS[v${i}]`,
    )
    filterLines.push(
      `[${i}:a]aformat=sample_rates=48000:channel_layouts=stereo,asetpts=PTS-STARTPTS[a${i}]`,
    )
  }
  const concatIn = inputPaths.map((_, i) => `[v${i}][a${i}]`).join('')
  filterLines.push(`${concatIn}concat=n=${inputPaths.length}:v=1:a=1[outv][outa]`)
  const fc = filterLines.join(';')

  const encOpts =
    o.transcodePreset === 'high_quality_mp4'
      ? ['-crf', '18', '-preset', 'slow', '-b:a', '192k']
      : ['-crf', '23', '-preset', 'fast', '-b:a', '128k']

  const cmd = ffmpeg()
  for (const p of inputPaths) {
    cmd.input(p)
  }
  cmd
    .complexFilter(fc)
    .outputOptions([
      '-map',
      '[outv]',
      '-map',
      '[outa]',
      '-c:v',
      'libx264',
      '-c:a',
      'aac',
      ...encOpts,
      '-movflags',
      '+faststart',
      '-map_metadata',
      '-1',
    ])
    .output(outputPath)

  cmd.on('progress', (p) => {
    if (typeof p.percent === 'number') sendProgress(sender, taskId, p.percent)
  })
  return cmd
}

export async function processVideoConcat(
  taskId: string,
  inputPaths: unknown,
  outputDir: string,
  rawOptions: unknown,
  sender: WebContents,
): Promise<ProcessVideoResult> {
  if (typeof taskId !== 'string' || !taskId.trim()) {
    return { success: false, error: 'Invalid task id' }
  }
  if (typeof outputDir !== 'string' || !outputDir.trim()) {
    return { success: false, error: 'Invalid output directory' }
  }
  if (!Array.isArray(inputPaths) || inputPaths.length < 2) {
    return { success: false, error: '合并至少需要 2 个视频' }
  }
  const paths: string[] = []
  for (const p of inputPaths) {
    if (typeof p !== 'string' || !p.trim()) {
      return { success: false, error: '合并路径无效' }
    }
    paths.push(p)
  }

  const o = sanitizeProcessVideoOptions(rawOptions)
  if (o.mode !== 'concat') {
    return { success: false, error: '合并任务参数 mode 无效' }
  }
  configureFfmpegStatic(ffmpeg)

  try {
    await fs.mkdir(outputDir, { recursive: true })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Cannot create output directory'
    return { success: false, error: msg }
  }

  const firstBase = parsedBase(paths[0]).name
  const outputPath = path.join(outputDir, `${firstBase}_merged_${paths.length}_${Date.now()}.mp4`)

  try {
    const cmd = await buildConcatCommand(paths, outputPath, o, taskId, sender)
    await runCommand(cmd, taskId, sender)
    return { success: true, outputPath }
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Video concat failed'
    return { success: false, error: message }
  }
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

  if (o.mode === 'concat') {
    return { success: false, error: '内部错误：合并应使用专用接口' }
  }
  if (o.mode === 'transcode' && o.transcodePreset === 'copy_streams' && needsVideoTransform(o)) {
    return {
      success: false,
      error: '流拷贝无法与旋转/翻转同时进行，请改用转码预设或关闭画面变换',
    }
  }

  try {
    await fs.mkdir(outputDir, { recursive: true })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Cannot create output directory'
    return { success: false, error: msg }
  }

  const { name: base } = parsedBase(inputPath)
  let info: VideoFileInfoPayload | null = null

  try {
    if (
      o.mode === 'trim' ||
      o.mode === 'gif' ||
      o.mode === 'webp_anim' ||
      o.mode === 'extract_frame'
    ) {
      info = await getVideoFileInfo(inputPath)
      if (info && (o.mode === 'trim' || o.mode === 'gif' || o.mode === 'webp_anim')) {
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
        cmd = buildStripAudio(inputPath, outputPath, o, taskId, sender)
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
      case 'webp_anim': {
        outputPath = path.join(outputDir, `${base}_clip.webp`)
        cmd = buildWebpAnim(inputPath, outputPath, o, taskId, sender)
        break
      }
      case 'extract_frame': {
        const ext = o.frameFormat === 'jpeg' ? 'jpg' : 'png'
        outputPath = path.join(outputDir, `${base}_frame.${ext}`)
        cmd = ffmpeg(inputPath)
          .seekInput(o.timeSec)
          .outputOptions(['-frames:v', '1'])
          .output(outputPath)
        {
          const tfOnly = videoTransformFilterParts(o).join(',')
          if (tfOnly) cmd.videoFilters(tfOnly)
        }
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
