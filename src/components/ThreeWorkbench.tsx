import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { ThreeStrip, type Model3dFile, type ThreeStripListMode } from './ThreeStrip'
import { ThreePreviewPane, type ThreePreviewPaneHandle } from './ThreePreviewPane'
import { ThreeSettingsPanel } from './ThreeSettingsPanel'
import type { ModelStats } from '@/lib/modelStats'

const MODEL_EXT = /\.(glb|gltf)$/i

async function buildModelEntries(paths: string[]): Promise<Model3dFile[]> {
  const filtered = paths.filter((p) => MODEL_EXT.test(p))
  const entries = await Promise.all(
    filtered.map(async (filePath) => {
      const name = filePath.split(/[/\\]/).pop() || 'unknown'
      const info = await window.picafluxAPI.getModel3dFileInfo(filePath)
      return {
        path: filePath,
        name,
        size: info?.size ?? 0,
        meshCount: info?.meshCount,
        materialCount: info?.materialCount,
        textureCount: info?.textureCount,
        animationCount: info?.animationCount,
        status: 'pending' as const,
      }
    }),
  )
  return entries
}

export function ThreeWorkbench() {
  const [models, setModels] = useState<Model3dFile[]>([])
  const [stripListMode, setStripListMode] = useState<ThreeStripListMode>('thumbnail')
  const [checkedPaths, setCheckedPaths] = useState<Set<string>>(() => new Set())
  const [previewPath, setPreviewPath] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [outputDir, setOutputDir] = useState('')
  const [previewModelPositionByPath, setPreviewModelPositionByPath] = useState<
    Record<string, [number, number, number]>
  >({})
  const [textureCompressEnabled, setTextureCompressEnabled] = useState(false)
  const [textureMaxSize, setTextureMaxSize] = useState(2048)
  const [textureQuality, setTextureQuality] = useState(100)
  const [viewportStats, setViewportStats] = useState<ModelStats | null>(null)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)

  const previewRef = useRef<ThreePreviewPaneHandle>(null)

  const modelPathsKey = useMemo(() => models.map((m) => m.path).join('\n'), [models])
  const modelsRef = useRef(models)
  modelsRef.current = models

  useEffect(() => {
    const list = modelsRef.current
    setPreviewPath((prev) => {
      if (list.length === 0) return null
      if (prev && list.some((m) => m.path === prev)) return prev
      return list[0].path
    })
  }, [modelPathsKey])

  useEffect(() => {
    const valid = new Set(modelsRef.current.map((m) => m.path))
    setCheckedPaths((prev) => {
      const next = new Set<string>()
      for (const p of prev) {
        if (valid.has(p)) next.add(p)
      }
      return next
    })
  }, [modelPathsKey])

  const mergeNewModels = useCallback((newEntries: Model3dFile[]) => {
    setModels((prev) => {
      const existingPaths = new Set(prev.map((m) => m.path))
      const uniqueNew = newEntries.filter((m) => !existingPaths.has(m.path))
      return uniqueNew.length ? [...prev, ...uniqueNew] : prev
    })
    setCheckedPaths((prev) => {
      const n = new Set(prev)
      for (const e of newEntries) {
        n.add(e.path)
      }
      return n
    })
  }, [])

  const handleAddModels = async () => {
    try {
      const filePaths = await window.picafluxAPI.open3dFiles()
      if (filePaths?.length) {
        const entries = await buildModelEntries(filePaths)
        mergeNewModels(entries)
      }
    } catch (e) {
      console.error(e)
    }
  }

  const handleDropPaths = useCallback(
    async (paths: string[]) => {
      if (!paths.length) return
      const entries = await buildModelEntries(paths)
      mergeNewModels(entries)
    },
    [mergeNewModels],
  )

  const handleRemoveModel = (path: string) => {
    setModels((prev) => prev.filter((m) => m.path !== path))
    setCheckedPaths((prev) => {
      const n = new Set(prev)
      n.delete(path)
      return n
    })
    setPreviewPath((prev) => (prev === path ? null : prev))
  }

  const handleTogglePath = useCallback((path: string, checked: boolean) => {
    setCheckedPaths((prev) => {
      const n = new Set(prev)
      if (checked) n.add(path)
      else n.delete(path)
      return n
    })
  }, [])

  const handleSelectAllForProcess = useCallback(() => {
    setCheckedPaths(new Set(models.map((m) => m.path)))
  }, [models])

  const handleClearProcessSelection = useCallback(() => {
    setCheckedPaths(new Set())
  }, [])

  const handleSelectOutputDir = async () => {
    try {
      const dir = await window.picafluxAPI.openDirectory()
      if (dir) setOutputDir(dir)
    } catch (e) {
      console.error(e)
    }
  }

  const previewModel = previewPath ? (models.find((m) => m.path === previewPath) ?? null) : null
  const selectedCount = checkedPaths.size

  const previewModelPosition: [number, number, number] = previewPath
    ? (previewModelPositionByPath[previewPath] ?? [0, 0, 0])
    : [0, 0, 0]

  const handlePreviewModelPositionChange = useCallback(
    (pos: [number, number, number]) => {
      if (!previewPath) return
      setPreviewModelPositionByPath((prev) => ({ ...prev, [previewPath]: pos }))
    },
    [previewPath],
  )

  const handleExportThumbnail = async () => {
    if (!previewPath || !outputDir.trim()) {
      setStatusMessage('请选择输出目录，并确保有当前预览模型。')
      return
    }
    setIsProcessing(true)
    setStatusMessage(null)
    try {
      await new Promise((r) => requestAnimationFrame(() => r(null)))
      const dataUrl = previewRef.current?.captureThumbnailDataUrl()
      if (!dataUrl) {
        setStatusMessage('无法截取画布（模型可能尚未渲染完成）。')
        setIsProcessing(false)
        return
      }
      const result = await window.picafluxAPI.save3dThumbnail(previewPath, outputDir, dataUrl)
      setStatusMessage(
        result.success && result.outputPath
          ? `已保存缩略图：${result.outputPath}`
          : `缩略图失败：${result.error ?? '未知错误'}`,
      )
    } catch (e: unknown) {
      setStatusMessage(e instanceof Error ? e.message : '缩略图导出异常')
    }
    setIsProcessing(false)
  }

  const waitForCapture = async (): Promise<string | null> => {
    // 模型加载 + 首帧渲染可能需要若干帧；这里做有限次重试避免卡死
    for (let i = 0; i < 180; i++) {
      await new Promise((r) => requestAnimationFrame(() => r(null)))
      const dataUrl = previewRef.current?.captureThumbnailDataUrl()
      if (dataUrl) return dataUrl
    }
    return null
  }

  const handleExportThumbnailsSelected = async () => {
    const batch = models.filter((m) => checkedPaths.has(m.path))
    if (!batch.length || !outputDir.trim()) return

    setIsProcessing(true)
    setStatusMessage(null)
    let ok = 0
    let lastErr: string | null = null

    for (const m of batch) {
      try {
        setPreviewPath(m.path)
        const dataUrl = await waitForCapture()
        if (!dataUrl) {
          lastErr = `${m.name}: 无法截取画布（模型可能尚未渲染完成）`
          continue
        }
        const result = await window.picafluxAPI.save3dThumbnail(m.path, outputDir, dataUrl)
        if (result.success) ok += 1
        else lastErr = `${m.name}: ${result.error ?? '未知错误'}`
      } catch (e: unknown) {
        lastErr = `${m.name}: ${e instanceof Error ? e.message : '异常'}`
      }
    }

    setIsProcessing(false)
    setStatusMessage(
      lastErr
        ? `批量缩略图：${ok}/${batch.length} 成功 — ${lastErr}`
        : `批量缩略图已完成：${ok}/${batch.length}。`,
    )
  }

  const handleConvertSelected = async () => {
    const batch = models.filter((m) => checkedPaths.has(m.path))
    if (!batch.length || !outputDir.trim()) return

    setIsProcessing(true)
    setStatusMessage(null)
    setModels((prev) =>
      prev.map((m) => (checkedPaths.has(m.path) ? { ...m, status: 'processing' as const } : m)),
    )

    const opts = textureCompressEnabled
      ? {
          preset: 'optimize' as const,
          textureMaxSize,
          textureFormat: 'keep' as const,
          textureQuality,
        }
      : {
          preset: 'optimize' as const,
          textureMaxSize: 0,
          textureFormat: 'keep' as const,
          textureQuality: 100,
        }
    let lastError: string | null = null
    for (const m of batch) {
      try {
        const result = await window.picafluxAPI.convert3dModel(m.path, outputDir, opts)
        setModels((prev) =>
          prev.map((p) =>
            p.path === m.path ? { ...p, status: result.success ? 'done' : 'error' } : p,
          ),
        )
        if (!result.success) {
          lastError = `${m.name}: ${result.error ?? '未知错误'}`
        }
      } catch (e: unknown) {
        lastError = `${m.name}: ${e instanceof Error ? e.message : '异常'}`
        setModels((prev) =>
          prev.map((p) => (p.path === m.path ? { ...p, status: 'error' as const } : p)),
        )
      }
    }

    setIsProcessing(false)
    setStatusMessage(
      lastError ? `部分失败 — ${lastError}` : `已完成 ${batch.length} 个文件的转换。`,
    )
  }

  return (
    <>
      <ThreeStrip
        models={models}
        listMode={stripListMode}
        onListModeChange={setStripListMode}
        checkedPaths={checkedPaths}
        onTogglePath={handleTogglePath}
        onSelectAll={handleSelectAllForProcess}
        onClearSelection={handleClearProcessSelection}
        previewPath={previewPath}
        onPreviewPath={setPreviewPath}
        onRemoveModel={handleRemoveModel}
      />
      <ThreePreviewPane
        ref={previewRef}
        models={models}
        previewModel={previewModel}
        previewUrl={previewPath}
        previewModelPosition={previewModelPosition}
        onPreviewModelPositionChange={handlePreviewModelPositionChange}
        viewportStats={viewportStats}
        selectedCount={selectedCount}
        onAddModels={handleAddModels}
        onDropPaths={handleDropPaths}
        onStatsUpdate={setViewportStats}
      />
      <ThreeSettingsPanel
        outputDir={outputDir}
        onSelectOutputDir={handleSelectOutputDir}
        onExportThumbnail={handleExportThumbnail}
        onExportThumbnailsSelected={handleExportThumbnailsSelected}
        onConvertSelected={handleConvertSelected}
        isProcessing={isProcessing}
        canExportThumbnail={Boolean(previewPath && outputDir.trim())}
        selectedForProcessCount={selectedCount}
        totalModelCount={models.length}
        statusMessage={statusMessage}
        textureCompressEnabled={textureCompressEnabled}
        onTextureCompressEnabledChange={setTextureCompressEnabled}
        textureMaxSize={textureMaxSize}
        textureQuality={textureQuality}
        onTextureMaxSizeChange={setTextureMaxSize}
        onTextureQualityChange={setTextureQuality}
      />
    </>
  )
}
