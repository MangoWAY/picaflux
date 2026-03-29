import { describe, it, expect } from 'vitest'
import { pathToFileUrl } from '../src/lib/fileUrl'

describe('pathToFileUrl', () => {
  it('passes through existing file URL', () => {
    expect(pathToFileUrl('file:///a/b.glb')).toBe('file:///a/b.glb')
  })

  it('unix absolute path', () => {
    expect(pathToFileUrl('/Users/x/model.glb')).toBe('file:///Users/x/model.glb')
  })

  it('windows drive path', () => {
    expect(pathToFileUrl('C:\\Users\\x\\m.glb')).toBe('file:///C:/Users/x/m.glb')
  })
})
