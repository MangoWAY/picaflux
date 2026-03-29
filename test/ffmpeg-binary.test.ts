import { describe, it, expect } from 'vitest'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

describe('bundled ffmpeg / ffprobe', () => {
  it('ffmpeg installer binary runs -version', () => {
    const { path: ffmpegPath } = require('@ffmpeg-installer/ffmpeg') as { path: string }
    const out = execFileSync(ffmpegPath, ['-version'], {
      encoding: 'utf8',
      maxBuffer: 2 * 1024 * 1024,
    })
    expect(out).toMatch(/ffmpeg version/i)
  })

  it('ffprobe installer binary runs -version', () => {
    const { path: ffprobePath } = require('@ffprobe-installer/ffprobe') as { path: string }
    const out = execFileSync(ffprobePath, ['-version'], {
      encoding: 'utf8',
      maxBuffer: 2 * 1024 * 1024,
    })
    expect(out).toMatch(/ffprobe version/i)
  })
})
