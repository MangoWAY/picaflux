import path from 'node:path'
import fs from 'node:fs/promises'
import sharp from 'sharp'
import { NodeIO } from '@gltf-transform/core'
import { dedup, prune } from '@gltf-transform/functions'
import { sanitizeProcess3dOptions, type SanitizedProcess3dOptions } from './gltf-3d-options'

export interface Model3dFileInfo {
  size: number
  extension: string
  meshCount: number
  materialCount: number
  textureCount: number
  animationCount: number
}

export interface Process3dResult {
  success: boolean
  outputPath?: string
  error?: string
}

function safeFileBase(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120) || 'model'
}

export async function getModel3dFileInfo(inputPath: string): Promise<Model3dFileInfo | null> {
  if (typeof inputPath !== 'string' || !inputPath.trim()) return null
  const st = await fs.stat(inputPath).catch(() => null)
  if (!st?.isFile()) return null
  const ext = path.extname(inputPath).toLowerCase()
  if (ext !== '.glb' && ext !== '.gltf') {
    return {
      size: st.size,
      extension: ext || 'unknown',
      meshCount: 0,
      materialCount: 0,
      textureCount: 0,
      animationCount: 0,
    }
  }

  try {
    const io = new NodeIO()
    const doc = await io.read(inputPath)
    const root = doc.getRoot()
    return {
      size: st.size,
      extension: ext,
      meshCount: root.listMeshes().length,
      materialCount: root.listMaterials().length,
      textureCount: root.listTextures().length,
      animationCount: root.listAnimations().length,
    }
  } catch {
    return {
      size: st.size,
      extension: ext,
      meshCount: 0,
      materialCount: 0,
      textureCount: 0,
      animationCount: 0,
    }
  }
}

export async function save3dThumbnailPng(
  inputPath: string,
  outputDir: string,
  pngBase64: string,
): Promise<Process3dResult> {
  if (
    typeof inputPath !== 'string' ||
    typeof outputDir !== 'string' ||
    typeof pngBase64 !== 'string'
  ) {
    return { success: false, error: 'Invalid arguments' }
  }
  const data = pngBase64.replace(/^data:image\/png;base64,/, '')
  let buf: Buffer
  try {
    buf = Buffer.from(data, 'base64')
  } catch {
    return { success: false, error: 'Invalid base64' }
  }
  if (buf.length < 32) {
    return { success: false, error: 'PNG too small' }
  }
  try {
    await fs.mkdir(outputDir, { recursive: true })
    const base = safeFileBase(path.parse(inputPath).name)
    const outPath = path.join(outputDir, `${base}_thumb.png`)
    await fs.writeFile(outPath, buf)
    return { success: true, outputPath: outPath }
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Write failed'
    return { success: false, error: message }
  }
}

export async function processGlbConvert(
  inputPath: string,
  outputDir: string,
  rawOptions: unknown,
): Promise<Process3dResult> {
  if (typeof inputPath !== 'string' || typeof outputDir !== 'string') {
    return { success: false, error: 'Invalid path arguments' }
  }
  const ext = path.extname(inputPath).toLowerCase()
  if (ext !== '.glb' && ext !== '.gltf') {
    return { success: false, error: 'Only .glb / .gltf supported' }
  }

  const opts: SanitizedProcess3dOptions = sanitizeProcess3dOptions(rawOptions)

  try {
    await fs.mkdir(outputDir, { recursive: true })
    const io = new NodeIO()
    const doc = await io.read(inputPath)
    if (opts.preset === 'optimize') {
      await doc.transform(prune(), dedup())
    }

    if (opts.textureMaxSize > 0 || opts.textureFormat !== 'keep') {
      const root = doc.getRoot()
      const textures = root.listTextures()
      for (const tex of textures) {
        const img = tex.getImage()
        if (!img) continue
        const buf = Buffer.from(img as Uint8Array)
        const meta = await sharp(buf)
          .metadata()
          .catch(() => null)
        const hasAlpha = Boolean(meta?.hasAlpha)

        let pipeline = sharp(buf, { failOn: 'none' })
        if (opts.textureMaxSize > 0) {
          pipeline = pipeline.resize({
            width: opts.textureMaxSize,
            height: opts.textureMaxSize,
            fit: 'inside',
            withoutEnlargement: true,
          })
        }

        const requested = opts.textureFormat
        const fmt =
          requested === 'keep'
            ? (() => {
                const mt = tex.getMimeType()
                if (mt === 'image/jpeg' || mt === 'image/jpg') return 'jpeg' as const
                if (mt === 'image/webp') return 'webp' as const
                if (mt === 'image/png') return 'png' as const
                return null
              })()
            : requested === 'jpeg' && hasAlpha
              ? ('webp' as const)
              : requested

        if (!fmt) continue

        const q = opts.textureQuality
        const out =
          fmt === 'webp'
            ? await pipeline.webp({ quality: q }).toBuffer()
            : fmt === 'jpeg'
              ? await pipeline.jpeg({ quality: q, mozjpeg: true }).toBuffer()
              : await pipeline.png({ compressionLevel: 9 }).toBuffer()

        tex.setImage(out)
        tex.setMimeType(fmt === 'webp' ? 'image/webp' : fmt === 'jpeg' ? 'image/jpeg' : 'image/png')
      }
    }

    const base = safeFileBase(path.parse(inputPath).name)
    const suffix = opts.preset === 'optimize' ? '_optimized' : '_out'
    const outPath = path.join(outputDir, `${base}${suffix}.glb`)
    await io.write(outPath, doc)
    return { success: true, outputPath: outPath }
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'GLB processing failed'
    return { success: false, error: message }
  }
}
