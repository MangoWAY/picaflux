import { describe, it, expect, vi, afterEach } from 'vitest'
import { getDracoDecoderPath } from '../src/lib/dracoPath'

describe('getDracoDecoderPath', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('uses page URL as base so Electron file:// resolves next to index.html', () => {
    vi.stubGlobal('window', {
      location: {
        href: 'file:///Applications/PicaFlux.app/Contents/Resources/app.asar/dist/index.html',
      },
    })
    const p = getDracoDecoderPath()
    expect(p).toBe('file:///Applications/PicaFlux.app/Contents/Resources/app.asar/dist/draco/gltf/')
  })

  it('works on Vite dev server root', () => {
    vi.stubGlobal('window', {
      location: { href: 'http://127.0.0.1:7777/' },
    })
    expect(getDracoDecoderPath()).toBe('http://127.0.0.1:7777/draco/gltf/')
  })
})
