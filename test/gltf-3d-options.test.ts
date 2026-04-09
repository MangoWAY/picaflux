import { describe, it, expect } from 'vitest'
import { sanitizeProcess3dOptions } from '../electron/main/gltf-3d-options'

describe('sanitizeProcess3dOptions', () => {
  it('defaults to optimize', () => {
    expect(sanitizeProcess3dOptions(null).preset).toBe('optimize')
    expect(sanitizeProcess3dOptions({}).preset).toBe('optimize')
    expect(sanitizeProcess3dOptions(null).textureFormat).toBe('keep')
  })

  it('accepts reserialize', () => {
    expect(sanitizeProcess3dOptions({ preset: 'reserialize' }).preset).toBe('reserialize')
  })

  it('rejects unknown preset', () => {
    expect(sanitizeProcess3dOptions({ preset: 'nope' }).preset).toBe('optimize')
  })

  it('sanitizes texture options', () => {
    const o = sanitizeProcess3dOptions({
      preset: 'optimize',
      textureMaxSize: 2048.2,
      textureFormat: 'webp',
      textureQuality: 120,
    })
    expect(o.textureMaxSize).toBe(2048)
    expect(o.textureFormat).toBe('webp')
    expect(o.textureQuality).toBe(100)
  })
})
