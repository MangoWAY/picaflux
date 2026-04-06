import { describe, it, expect } from 'vitest'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

describe('bundled ffmpeg / ffprobe', () => {
  it('ffmpeg-static binary runs and includes libwebp encoder', () => {
    const ffmpegPath = require('ffmpeg-static') as string
    expect(typeof ffmpegPath).toBe('string')
    const ver = execFileSync(ffmpegPath, ['-version'], {
      encoding: 'utf8',
      maxBuffer: 2 * 1024 * 1024,
    })
    expect(ver).toMatch(/ffmpeg version/i)
    const enc = execFileSync(ffmpegPath, ['-encoders'], {
      encoding: 'utf8',
      maxBuffer: 2 * 1024 * 1024,
    })
    expect(enc).toMatch(/libwebp/i)
  })

  it('ffprobe-static binary runs -version', () => {
    const { path: ffprobePath } = require('ffprobe-static') as { path: string }
    const out = execFileSync(ffprobePath, ['-version'], {
      encoding: 'utf8',
      maxBuffer: 2 * 1024 * 1024,
    })
    expect(out).toMatch(/ffprobe version/i)
  })
})
