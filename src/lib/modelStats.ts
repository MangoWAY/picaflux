import type { AnimationClip, Object3D } from 'three'
import { Mesh, SkinnedMesh, Texture } from 'three'

export interface ModelStats {
  meshes: number
  skinnedMeshes: number
  triangles: number
  materialCount: number
  textureCount: number
  animations: number
}

function triangleCountForGeometry(mesh: Mesh | SkinnedMesh): number {
  const g = mesh.geometry
  const idx = g.index
  const pos = g.getAttribute('position')
  if (idx) {
    return Math.max(0, Math.floor(idx.count / 3))
  }
  if (pos) {
    return Math.max(0, Math.floor(pos.count / 3))
  }
  return 0
}

/** 基于已加载的 Three 场景统计面数与资源数量（与 glTF 加载结果一致） */
export function computeModelStats(
  root: Object3D,
  animations?: readonly AnimationClip[],
): ModelStats {
  let meshes = 0
  let skinnedMeshes = 0
  let triangles = 0
  const materials = new Set<unknown>()
  const textures = new Set<Texture>()

  root.traverse((obj) => {
    if (obj instanceof SkinnedMesh) {
      skinnedMeshes += 1
      meshes += 1
      triangles += triangleCountForGeometry(obj)
      if (Array.isArray(obj.material)) {
        for (const m of obj.material) materials.add(m)
      } else if (obj.material) {
        materials.add(obj.material)
      }
    } else if (obj instanceof Mesh) {
      meshes += 1
      triangles += triangleCountForGeometry(obj)
      if (Array.isArray(obj.material)) {
        for (const m of obj.material) materials.add(m)
      } else if (obj.material) {
        materials.add(obj.material)
      }
    }
  })

  for (const m of materials) {
    if (m && typeof m === 'object' && 'map' in m) {
      const mat = m as {
        map?: Texture | null
        normalMap?: Texture | null
        roughnessMap?: Texture | null
      }
      const maps = [mat.map, mat.normalMap, mat.roughnessMap]
      for (const t of maps) {
        if (t && t instanceof Texture) textures.add(t)
      }
    }
  }

  const animCount = animations?.length ?? 0

  return {
    meshes,
    skinnedMeshes,
    triangles,
    materialCount: materials.size,
    textureCount: textures.size,
    animations: animCount,
  }
}
