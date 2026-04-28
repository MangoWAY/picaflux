import React, {
  Suspense,
  useEffect,
  useLayoutEffect,
  forwardRef,
  useImperativeHandle,
  useRef,
  useState,
  useCallback,
} from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import {
  Bounds,
  Grid,
  Html,
  OrbitControls,
  TransformControls,
  useGLTF,
  useProgress,
} from '@react-three/drei'
import { DRACOLoader, OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { UploadCloud, Box, Grid3x3, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react'
import { PanelToggle } from './PanelToggle'
import type { ModelStats } from '@/lib/modelStats'
import { computeModelStats } from '@/lib/modelStats'
import { pathToFileUrl } from '@/lib/fileUrl'
import { getDracoDecoderPath } from '@/lib/dracoPath'
import type { Model3dFile } from './ThreeStrip'

const MODEL_EXT = /\.(glb|gltf)$/i

function formatSize(bytes: number): string {
  if (bytes <= 0) return '—'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
}

function LoadStatus() {
  const { active, progress } = useProgress()
  if (!active) return null
  return (
    <Html center>
      <div className="rounded bg-black/80 px-3 py-2 text-xs text-white shadow-lg">
        加载 {progress.toFixed(0)}%
      </div>
    </Html>
  )
}

function OfflineEnvironmentMap() {
  const { gl, scene } = useThree()
  useLayoutEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl)
    const room = new RoomEnvironment()
    const rt = pmrem.fromScene(room)
    scene.environment = rt.texture
    return () => {
      if (scene.environment === rt.texture) scene.environment = null
      rt.dispose()
      room.dispose()
      pmrem.dispose()
    }
  }, [gl, scene])
  return null
}

function PreviewRendererSetup() {
  const { gl } = useThree()
  useLayoutEffect(() => {
    const prevTM = gl.toneMapping
    const prevExp = gl.toneMappingExposure
    const prevOC = gl.outputColorSpace
    gl.toneMapping = THREE.ACESFilmicToneMapping
    gl.toneMappingExposure = 0.92
    gl.outputColorSpace = THREE.SRGBColorSpace
    return () => {
      gl.toneMapping = prevTM
      gl.toneMappingExposure = prevExp
      gl.outputColorSpace = prevOC
    }
  }, [gl])
  return null
}

function CaptureBridge({
  captureRef,
}: {
  captureRef: React.MutableRefObject<(() => string | null) | null>
}) {
  const { gl, scene, camera } = useThree()
  useLayoutEffect(() => {
    captureRef.current = () => {
      gl.render(scene, camera)
      return gl.domElement.toDataURL('image/png')
    }
    return () => {
      captureRef.current = null
    }
  }, [gl, scene, camera, captureRef])
  return null
}

type Vec3 = [number, number, number]
type RenderStyle = 'standard' | 'wireframe' | 'clay' | 'normal'

interface TexturePreviewInfo {
  key: string
  label: string
  width: number
  height: number
  previewUrl: string | null
}

function getTextureDimensions(texture: THREE.Texture): { width: number; height: number } | null {
  const image = texture.image as
    | { width?: number; height?: number }
    | { data?: { width?: number; height?: number } }
    | null
    | undefined
  const width = Number(
    (image && 'width' in image ? image.width : undefined) ??
      (image && 'data' in image ? image.data?.width : undefined) ??
      0,
  )
  const height = Number(
    (image && 'height' in image ? image.height : undefined) ??
      (image && 'data' in image ? image.data?.height : undefined) ??
      0,
  )
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null
  return { width: Math.round(width), height: Math.round(height) }
}

function textureToPreviewUrl(texture: THREE.Texture): string | null {
  const image = texture.image as
    | (CanvasImageSource & { width?: number; height?: number })
    | { data?: Uint8Array; width?: number; height?: number }
    | null
    | undefined
  if (!image) return null
  try {
    const canvas = document.createElement('canvas')
    const dim = getTextureDimensions(texture)
    if (!dim) return null
    canvas.width = Math.max(1, Math.min(256, dim.width))
    canvas.height = Math.max(1, Math.min(256, dim.height))
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    if ('data' in image && image.data instanceof Uint8Array) return null
    ctx.drawImage(image as CanvasImageSource, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/png')
  } catch {
    return null
  }
}

function collectTextureInfos(root: THREE.Object3D): TexturePreviewInfo[] {
  const textures = new Map<string, TexturePreviewInfo>()
  root.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh || obj instanceof THREE.SkinnedMesh)) return
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material]
    for (const mat of mats) {
      if (!mat || typeof mat !== 'object') continue
      const entries = Object.entries(mat as Record<string, unknown>)
      for (const [slot, value] of entries) {
        if (!(value instanceof THREE.Texture)) continue
        const dim = getTextureDimensions(value)
        if (!dim) continue
        if (textures.has(value.uuid)) continue
        textures.set(value.uuid, {
          key: value.uuid,
          label: slot,
          width: dim.width,
          height: dim.height,
          previewUrl: textureToPreviewUrl(value),
        })
      }
    }
  })
  return Array.from(textures.values())
}

function LoadedModelPrimitive({
  url,
  onStats,
  onTextures,
}: {
  url: string
  onStats: (s: ModelStats) => void
  onTextures: (items: TexturePreviewInfo[]) => void
}) {
  const gltf = useGLTF(url, true, true, (loader) => {
    const dracoLoader = new DRACOLoader()
    dracoLoader.setDecoderPath(getDracoDecoderPath())
    loader.setDRACOLoader(dracoLoader)
  })

  useLayoutEffect(() => {
    onStats(computeModelStats(gltf.scene, gltf.animations))
    onTextures(collectTextureInfos(gltf.scene))
  }, [gltf, url, onStats, onTextures])

  useEffect(() => {
    return () => {
      useGLTF.clear(url)
    }
  }, [url])

  return <primitive object={gltf.scene} />
}

class GltfErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { message: string | null }
> {
  state = { message: null as string | null }

  static getDerivedStateFromError(err: Error) {
    return { message: err.message || '加载失败' }
  }

  override render() {
    if (this.state.message) {
      return (
        <Html center>
          <div className="max-w-xs rounded bg-red-900/90 px-3 py-2 text-center text-xs text-red-100">
            {this.state.message}
          </div>
        </Html>
      )
    }
    return this.props.children
  }
}

function materialFromMode(mode: RenderStyle, template: THREE.Material): THREE.Material | null {
  if (mode === 'standard') return null
  const common = { side: template.side }
  if (mode === 'wireframe') {
    return new THREE.MeshStandardMaterial({
      color: '#d0d0d0',
      wireframe: true,
      metalness: 0,
      roughness: 0.95,
      ...common,
    })
  }
  if (mode === 'clay') {
    return new THREE.MeshStandardMaterial({
      color: '#d9d9d9',
      metalness: 0,
      roughness: 1,
      ...common,
    })
  }
  return new THREE.MeshNormalMaterial(common)
}

function ModelMaterialMode({ target, mode }: { target: THREE.Object3D | null; mode: RenderStyle }) {
  useEffect(() => {
    if (!target) return
    const originals = new Map<THREE.Mesh | THREE.SkinnedMesh, THREE.Material | THREE.Material[]>()
    const created: THREE.Material[] = []
    target.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh || obj instanceof THREE.SkinnedMesh)) return
      const source = obj.material
      originals.set(obj, source)
      if (mode === 'standard') return
      if (Array.isArray(source)) {
        obj.material = source.map((m) => {
          const next = materialFromMode(mode, m) ?? m
          if (next !== m) created.push(next)
          return next
        })
      } else if (source) {
        const next = materialFromMode(mode, source) ?? source
        if (next !== source) created.push(next)
        obj.material = next
      }
    })
    return () => {
      for (const [mesh, material] of originals) {
        mesh.material = material
      }
      for (const m of created) m.dispose()
    }
  }, [target, mode])
  return null
}

function ViewportScene({
  url,
  onStats,
  onTextures,
  captureRef,
  showGrid,
  renderStyle,
  modelPosition,
  onModelPositionChange,
  viewportModelSelected,
  onViewportModelSelectedChange,
}: {
  url: string
  onStats: (s: ModelStats) => void
  onTextures: (items: TexturePreviewInfo[]) => void
  captureRef: React.MutableRefObject<(() => string | null) | null>
  showGrid: boolean
  renderStyle: RenderStyle
  modelPosition: Vec3
  onModelPositionChange: (p: Vec3) => void
  viewportModelSelected: boolean
  onViewportModelSelectedChange: (v: boolean) => void
}) {
  const orbitRef = useRef<OrbitControlsImpl | null>(null)
  const [transformHost, setTransformHost] = useState<THREE.Group | null>(null)

  return (
    <>
      <color attach="background" args={['#1a1a1a']} />
      <PreviewRendererSetup />
      <OfflineEnvironmentMap />
      <ambientLight intensity={0.32} />
      <directionalLight position={[8, 12, 10]} intensity={0.65} />
      <directionalLight position={[-6, 4, -4]} intensity={0.22} />
      {showGrid ? (
        <Grid
          args={[48, 48]}
          position={[0, 0, 0]}
          infiniteGrid
          cellSize={0.45}
          sectionSize={3.15}
          fadeDistance={36}
          fadeStrength={1}
          sectionColor="#4d4d4d"
          cellColor="#353535"
        />
      ) : null}
      <Suspense fallback={<LoadStatus />}>
        <GltfErrorBoundary key={url}>
          <Bounds fit clip margin={1.2} observe={false}>
            <group
              ref={(node) => {
                setTransformHost((prev) => (prev === node ? prev : node))
              }}
              position={modelPosition}
              onClick={(e) => {
                e.stopPropagation()
                onViewportModelSelectedChange(true)
              }}
            >
              <LoadedModelPrimitive url={url} onStats={onStats} onTextures={onTextures} />
            </group>
          </Bounds>
          <ModelMaterialMode target={transformHost} mode={renderStyle} />
        </GltfErrorBoundary>
      </Suspense>
      <OrbitControls ref={orbitRef} makeDefault enableDamping dampingFactor={0.08} />
      {viewportModelSelected && transformHost ? (
        <TransformControls
          object={transformHost}
          mode="translate"
          onMouseDown={() => {
            if (orbitRef.current) orbitRef.current.enabled = false
          }}
          onMouseUp={() => {
            if (orbitRef.current) orbitRef.current.enabled = true
          }}
          onObjectChange={() => {
            const o = transformHost
            onModelPositionChange([o.position.x, o.position.y, o.position.z])
          }}
        />
      ) : null}
      <CaptureBridge captureRef={captureRef} />
    </>
  )
}

export type ThreePreviewPaneHandle = {
  captureThumbnailDataUrl: () => string | null
}

interface ThreePreviewPaneProps {
  models: Model3dFile[]
  previewModel: Model3dFile | null
  previewUrl: string | null
  /** 当前预览模型在场景中的平移（仅预览，不写回文件） */
  previewModelPosition: Vec3
  onPreviewModelPositionChange: (p: Vec3) => void
  viewportStats: ModelStats | null
  selectedCount: number
  onAddModels: () => void
  onDropPaths: (paths: string[]) => void
  onStatsUpdate: (stats: ModelStats | null) => void
}

export const ThreePreviewPane = forwardRef<ThreePreviewPaneHandle, ThreePreviewPaneProps>(
  function ThreePreviewPane(
    {
      models,
      previewModel,
      previewUrl,
      previewModelPosition,
      onPreviewModelPositionChange,
      viewportStats,
      selectedCount,
      onAddModels,
      onDropPaths,
      onStatsUpdate,
    },
    ref,
  ) {
    const [dragOver, setDragOver] = useState(false)
    const [showGroundGrid, setShowGroundGrid] = useState(true)
    const [viewportModelSelected, setViewportModelSelected] = useState(false)
    const [renderStyle, setRenderStyle] = useState<RenderStyle>('standard')
    const [infoCollapsed, setInfoCollapsed] = useState(true)
    const [textureInfos, setTextureInfos] = useState<TexturePreviewInfo[]>([])
    const captureFnRef = useRef<(() => string | null) | null>(null)

    useImperativeHandle(ref, () => ({
      captureThumbnailDataUrl: () => captureFnRef.current?.() ?? null,
    }))

    const handleStats = useCallback(
      (s: ModelStats) => {
        onStatsUpdate(s)
      },
      [onStatsUpdate],
    )

    useEffect(() => {
      if (!previewUrl) onStatsUpdate(null)
    }, [previewUrl, onStatsUpdate])

    const fileUrl = previewUrl ? pathToFileUrl(previewUrl) : null

    useEffect(() => {
      setViewportModelSelected(false)
      setTextureInfos([])
    }, [fileUrl])

    const collectPathsFromDataTransfer = useCallback((dt: DataTransfer): string[] => {
      const paths: string[] = []
      const files = Array.from(dt.files)
      for (const file of files) {
        try {
          const p = window.picafluxAPI.getPathForFile(file)
          if (p && MODEL_EXT.test(p)) paths.push(p)
        } catch {
          /* ignore */
        }
      }
      return paths
    }, [])

    const onDragOver = (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setDragOver(true)
    }

    const onDragLeave = (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setDragOver(false)
    }

    const onDrop = (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setDragOver(false)
      const paths = collectPathsFromDataTransfer(e.dataTransfer)
      if (paths.length) onDropPaths(paths)
    }

    return (
      <div
        className="relative flex min-h-0 min-w-0 flex-1 flex-col border-r border-[#2d2d2d] bg-[#141414]"
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        <div className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-[#2d2d2d] px-3 sm:px-4">
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-sm font-semibold text-white">3D 预览</h2>
            <p className="truncate text-xs text-gray-500">
              {models.length === 0
                ? '拖入 .glb / .gltf 或点击添加'
                : fileUrl
                  ? `${selectedCount} 项已选 · 共 ${models.length} · 点击模型可平移`
                  : `${selectedCount} 项已选 · 共 ${models.length} 个文件`}
            </p>
          </div>
          {fileUrl ? (
            <>
              <div
                className="flex shrink-0 items-center rounded-lg border border-[#2d2d2d] bg-[#181818] p-0.5"
                title="渲染模式"
              >
                {(
                  [
                    ['standard', '标准'],
                    ['wireframe', '网格'],
                    ['clay', '白模'],
                    ['normal', '法线'],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setRenderStyle(id)}
                    className={
                      renderStyle === id
                        ? 'rounded px-2 py-1 text-[11px] text-white bg-[#2d2d2d]'
                        : 'rounded px-2 py-1 text-[11px] text-gray-500 hover:text-gray-300'
                    }
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div
                className="flex shrink-0 items-center gap-1.5 rounded-lg border border-[#2d2d2d] bg-[#181818] px-2 py-1.5"
                title="地面参考网格"
              >
                <Grid3x3 className="h-3.5 w-3.5 shrink-0 text-gray-500" aria-hidden />
                <span className="hidden text-[11px] text-gray-500 sm:inline">地面</span>
                <PanelToggle
                  checked={showGroundGrid}
                  onChange={setShowGroundGrid}
                  ariaLabel={showGroundGrid ? '隐藏地面网格' : '显示地面网格'}
                />
              </div>
              <button
                type="button"
                onClick={() => {
                  onPreviewModelPositionChange([0, 0, 0])
                  setViewportModelSelected(false)
                }}
                className="flex shrink-0 items-center gap-1.5 rounded-lg border border-[#2d2d2d] bg-[#181818] px-2 py-1.5 text-[11px] text-gray-300 transition-colors hover:border-blue-500/40 hover:text-white"
                title="复位模型位置"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">复位</span>
              </button>
            </>
          ) : null}
          <button
            type="button"
            onClick={onAddModels}
            className="flex shrink-0 items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500"
          >
            <UploadCloud className="h-4 w-4" />
            添加模型
          </button>
        </div>

        <div
          className={`flex min-h-0 flex-1 flex-col ${dragOver ? 'bg-blue-500/5 ring-2 ring-inset ring-blue-500/30' : ''}`}
        >
          {!fileUrl ? (
            <div className="flex flex-1 flex-col items-center justify-center p-6 text-center text-gray-500">
              <Box className="mb-4 h-16 w-16 opacity-40" />
              <p className="text-sm">选择左侧列表中的模型以预览（Draco 解码器已内置）</p>
            </div>
          ) : (
            <div className="relative min-h-0 flex-1">
              <Canvas
                className="h-full w-full"
                camera={{ position: [2.2, 1.6, 2.2], fov: 45, near: 0.01, far: 500 }}
                gl={{ preserveDrawingBuffer: true, alpha: false, antialias: true }}
                onPointerMissed={() => setViewportModelSelected(false)}
              >
                <ViewportScene
                  key={fileUrl}
                  url={fileUrl}
                  onStats={handleStats}
                  onTextures={setTextureInfos}
                  captureRef={captureFnRef}
                  showGrid={showGroundGrid}
                  renderStyle={renderStyle}
                  modelPosition={previewModelPosition}
                  onModelPositionChange={onPreviewModelPositionChange}
                  viewportModelSelected={viewportModelSelected}
                  onViewportModelSelectedChange={setViewportModelSelected}
                />
              </Canvas>
            </div>
          )}

          {previewModel ? (
            <div className="shrink-0 border-t border-[#2d2d2d] bg-[#151515]">
              <button
                type="button"
                onClick={() => setInfoCollapsed((v) => !v)}
                className="flex w-full items-center justify-between px-4 py-2 text-left text-xs text-gray-400 transition-colors hover:bg-[#1b1b1b]"
              >
                <span>模型信息</span>
                {infoCollapsed ? (
                  <ChevronUp className="h-4 w-4 text-gray-500" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-gray-500" />
                )}
              </button>
              {infoCollapsed ? null : (
                <div className="max-h-[38vh] space-y-1.5 overflow-y-auto px-3 pb-2 text-[11px] text-gray-400">
                  <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                    <div className="rounded-md border border-[#2d2d2d] bg-[#121212] px-2 py-1">
                      <span className="text-[10px] text-gray-600">文件大小</span>
                      <p className="mt-0.5 leading-tight text-gray-200">
                        {formatSize(previewModel.size)}
                      </p>
                    </div>
                    <div className="rounded-md border border-[#2d2d2d] bg-[#121212] px-2 py-1">
                      <span className="text-[10px] text-gray-600">网格 / 材质</span>
                      <p className="mt-0.5 leading-tight text-gray-200">
                        {viewportStats?.meshes ?? previewModel.meshCount ?? 0} /{' '}
                        {viewportStats?.materialCount ?? previewModel.materialCount ?? 0}
                      </p>
                    </div>
                    <div className="rounded-md border border-[#2d2d2d] bg-[#121212] px-2 py-1">
                      <span className="text-[10px] text-gray-600">贴图 / 动画</span>
                      <p className="mt-0.5 leading-tight text-gray-200">
                        {viewportStats?.textureCount ?? previewModel.textureCount ?? 0} /{' '}
                        {viewportStats?.animations ?? previewModel.animationCount ?? 0}
                      </p>
                    </div>
                    <div className="rounded-md border border-[#2d2d2d] bg-[#121212] px-2 py-1">
                      <span className="text-[10px] text-gray-600">顶点 / 三角面</span>
                      <p className="mt-0.5 leading-tight text-gray-200">
                        {viewportStats?.vertices?.toLocaleString() ?? '—'} /{' '}
                        {viewportStats?.triangles?.toLocaleString() ?? '—'}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-md border border-[#2d2d2d] bg-[#121212] px-2 py-1.5">
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-[10px] text-gray-600">纹理预览</span>
                      <span className="text-[10px] text-gray-500">{textureInfos.length} 张</span>
                    </div>
                    {textureInfos.length === 0 ? (
                      <p className="text-[11px] text-gray-500">未检测到可预览纹理</p>
                    ) : (
                      <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4 lg:grid-cols-6">
                        {textureInfos.map((tex) => (
                          <div
                            key={tex.key}
                            className="overflow-hidden rounded border border-[#2d2d2d] bg-[#0f0f0f]"
                            title={`${tex.label} · ${tex.width}x${tex.height}`}
                          >
                            <div className="flex h-14 items-center justify-center bg-[#0b0b0b] sm:h-16">
                              {tex.previewUrl ? (
                                <img
                                  src={tex.previewUrl}
                                  alt=""
                                  className="h-full w-full object-contain"
                                />
                              ) : (
                                <Box className="h-5 w-5 text-gray-600" />
                              )}
                            </div>
                            <div className="px-1 py-0.5">
                              <p className="truncate text-[9px] text-gray-400">{tex.label}</p>
                              <p className="text-[9px] text-gray-500">
                                {tex.width} x {tex.height}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    )
  },
)
