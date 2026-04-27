import { describe, it, expect } from 'vitest'
import { AnimationClip, BoxGeometry, Mesh, MeshStandardMaterial, Scene, Texture } from 'three'
import { computeModelStats } from '../src/lib/modelStats'

describe('computeModelStats', () => {
  it('counts single box mesh triangles', () => {
    const scene = new Scene()
    const mesh = new Mesh(new BoxGeometry(1, 1, 1), new MeshStandardMaterial())
    scene.add(mesh)
    const s = computeModelStats(scene, [])
    expect(s.meshes).toBe(1)
    expect(s.triangles).toBe(12)
    expect(s.vertices).toBe(24)
    expect(s.materialCount).toBe(1)
  })

  it('counts animation clips', () => {
    const scene = new Scene()
    const s = computeModelStats(scene, [new AnimationClip('a', 1, [])])
    expect(s.animations).toBe(1)
  })

  it('counts diffuse map texture', () => {
    const scene = new Scene()
    const tex = new Texture()
    const mat = new MeshStandardMaterial({ map: tex })
    const mesh = new Mesh(new BoxGeometry(1, 1, 1), mat)
    scene.add(mesh)
    const s = computeModelStats(scene, [])
    expect(s.textureCount).toBeGreaterThanOrEqual(1)
  })
})
