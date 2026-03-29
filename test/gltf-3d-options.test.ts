import { describe, it, expect } from 'vitest'
import { sanitizeProcess3dOptions } from '../electron/main/gltf-3d-options'

describe('sanitizeProcess3dOptions', () => {
  it('defaults to optimize', () => {
    expect(sanitizeProcess3dOptions(null).preset).toBe('optimize')
    expect(sanitizeProcess3dOptions({}).preset).toBe('optimize')
  })

  it('accepts reserialize', () => {
    expect(sanitizeProcess3dOptions({ preset: 'reserialize' }).preset).toBe('reserialize')
  })

  it('rejects unknown preset', () => {
    expect(sanitizeProcess3dOptions({ preset: 'nope' }).preset).toBe('optimize')
  })
})
