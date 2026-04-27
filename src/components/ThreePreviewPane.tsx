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
import { UploadCloud, Box, Grid3x3, RotateCcw } from 'lucide-react'
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

function LoadedModelPrimitive({ url, onStats }: { url: string; onStats: (s: ModelStats) => void }) {
  const gltf = useGLTF(url, true, true, (loader) => {
    const dracoLoader = new DRACOLoader()
    dracoLoader.setDecoderPath(getDracoDecoderPath())
    loader.setDRACOLoader(dracoLoader)
  })

  useLayoutEffect(() => {
    onStats(computeModelStats(gltf.scene, gltf.animations))
  }, [gltf, url, onStats])

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

function ViewportScene({
  url,
  onStats,
  captureRef,
  showGrid,
  modelPosition,
  onModelPositionChange,
  viewportModelSelected,
  onViewportModelSelectedChange,
}: {
  url: string
  onStats: (s: ModelStats) => void
  captureRef: React.MutableRefObject<(() => string | null) | null>
  showGrid: boolean
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
              <LoadedModelPrimitive url={url} onStats={onStats} />
            </group>
          </Bounds>
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
                  captureRef={captureFnRef}
                  showGrid={showGroundGrid}
                  modelPosition={previewModelPosition}
                  onModelPositionChange={onPreviewModelPositionChange}
                  viewportModelSelected={viewportModelSelected}
                  onViewportModelSelectedChange={setViewportModelSelected}
                />
              </Canvas>
            </div>
          )}

          {previewModel ? (
            <div className="shrink-0 border-t border-[#2d2d2d] px-4 py-3 text-xs text-gray-400">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <div>
                  <span className="text-gray-600">大小</span>
                  <p className="text-gray-300">{formatSize(previewModel.size)}</p>
                </div>
                <div>
                  <span className="text-gray-600">主进程解析</span>
                  <p className="text-gray-300">
                    M {previewModel.meshCount ?? '—'} / Mat {previewModel.materialCount ?? '—'}
                  </p>
                </div>
                <div>
                  <span className="text-gray-600">贴图 / 动画</span>
                  <p className="text-gray-300">
                    T {previewModel.textureCount ?? '—'} / A {previewModel.animationCount ?? '—'}
                  </p>
                </div>
                <div>
                  <span className="text-gray-600">文件</span>
                  <p className="truncate text-gray-300" title={previewModel.path}>
                    {previewModel.name}
                  </p>
                </div>
              </div>
              {viewportStats ? (
                <div className="mt-2 border-t border-[#2d2d2d] pt-2 text-[11px] text-gray-500">
                  <span className="text-gray-600">渲染统计</span>
                  <p className="mt-0.5 text-gray-300">
                    三角面 {viewportStats.triangles.toLocaleString()} · Mesh {viewportStats.meshes}
                    {viewportStats.skinnedMeshes > 0
                      ? `（蒙皮 ${viewportStats.skinnedMeshes}）`
                      : ''}
                    · 材质 {viewportStats.materialCount} · 贴图 {viewportStats.textureCount} · 动画{' '}
                    {viewportStats.animations}
                  </p>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    )
  },
)
