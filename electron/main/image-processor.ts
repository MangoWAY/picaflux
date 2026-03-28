import sharp from 'sharp'
import path from 'node:path'
import fs from 'node:fs/promises'

export interface ProcessImageOptions {
  format?: 'original' | 'png' | 'jpeg' | 'webp' | 'avif'
  width?: number
  height?: number
  quality?: number // 1-100
}

export interface ProcessImageResult {
  success: boolean
  outputPath?: string
  error?: string
}

export interface ImageFileInfo {
  size: number
  width?: number
  height?: number
  /** sharp metadata format, e.g. jpeg, png, webp */
  format?: string
}

export async function getImageFileInfo(inputPath: string): Promise<ImageFileInfo | null> {
  try {
    const stat = await fs.stat(inputPath)
    const meta = await sharp(inputPath).metadata()
    return {
      size: stat.size,
      width: meta.width,
      height: meta.height,
      format: meta.format,
    }
  } catch {
    return null
  }
}

export async function processImage(
  inputPath: string,
  outputDir: string,
  options: ProcessImageOptions
): Promise<ProcessImageResult> {
  try {
    // Ensure output directory exists
    await fs.mkdir(outputDir, { recursive: true })

    const parsedPath = path.parse(inputPath)
    const requested = options.format || 'original'

    const extToFormat: Record<string, 'png' | 'jpeg' | 'webp' | 'avif'> = {
      png: 'png',
      jpeg: 'jpeg',
      jpg: 'jpeg',
      webp: 'webp',
      avif: 'avif',
    }

    let format: 'png' | 'jpeg' | 'webp' | 'avif'
    if (requested === 'original') {
      const ext = parsedPath.ext.toLowerCase().replace('.', '')
      format = extToFormat[ext] ?? 'png'
    } else {
      format = requested
    }

    const outputExt = format === 'jpeg' ? 'jpg' : format
    const outputFileName = `${parsedPath.name}_processed.${outputExt}`
    const outputPath = path.join(outputDir, outputFileName)

    let pipeline = sharp(inputPath)

    // Resize
    if (options.width || options.height) {
      pipeline = pipeline.resize({
        width: options.width,
        height: options.height,
        fit: 'inside', // Keep aspect ratio by default
        withoutEnlargement: true, // Don't upscale
      })
    }

    // Format & Quality
    const quality = options.quality || 80
    switch (format) {
      case 'png':
        pipeline = pipeline.png({ quality })
        break
      case 'jpeg':
        pipeline = pipeline.jpeg({ quality })
        break
      case 'webp':
        pipeline = pipeline.webp({ quality })
        break
      case 'avif':
        pipeline = pipeline.avif({ quality })
        break
    }

    await pipeline.toFile(outputPath)

    return {
      success: true,
      outputPath
    }
  } catch (error: unknown) {
    console.error('Error processing image:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return {
      success: false,
      error: message,
    }
  }
}
