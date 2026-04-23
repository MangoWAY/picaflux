import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { VideoStrip, type VideoFile, type VideoStripListMode } from './VideoStrip'
import { VideoPreviewPane } from './VideoPreviewPane'
import { QueueSidebarCollapseHandle } from './QueueSidebarCollapseHandle'
import { VideoSettingsPanel } from './VideoSettingsPanel'
import { ChevronRight } from 'lucide-react'
import {
  buildVideoProcessPayload,
  createEmptyModeEnabled,
  listEnabledModesInOrder,
  type VideoProcessFormState,
} from '@/lib/videoFormPayload'
import type { VideoProcessPresetRecord } from '@/lib/videoPreset'
import { mergeVideoPresetIntoForm, toVideoPresetPayload } from '@/lib/videoPreset'

const VIDEO_EXT = /\.(mp4|mov|mkv|webm|m4v|avi|mpeg|mpg)$/i

function newTaskId(): string {
  return crypto.randomUUID()
}

async function buildVideoEntries(paths: string[]): Promise<VideoFile[]> {
  const filtered = paths.filter((p) => VIDEO_EXT.test(p))
  const entries = await Promise.all(
    filtered.map(async (filePath) => {
      const name = filePath.split(/[/\\]/).pop() || 'unknown'
      const info = await window.picafluxAPI.getVideoFileInfo(filePath)
      return {
        path: filePath,
        name,
        size: info?.size ?? 0,
        durationSec: info?.durationSec,
        width: info?.width,
        height: info?.height,
        formatName: info?.formatName,
        videoCodec: info?.videoCodec,
        audioCodec: info?.audioCodec,
        bitRateBps: info?.bitRateBps,
        videoBitRateBps: info?.videoBitRateBps,
        audioBitRateBps: info?.audioBitRateBps,
        status: 'pending' as const,
        previewUrl: `file://${filePath}`,
      }
    }),
  )
  return entries
}

const defaultForm: VideoProcessFormState = {
  mode: 'transcode',
  modeEnabled: createEmptyModeEnabled(),
  outputDir: '',
  transcodePreset: 'web_mp4',
  maxWidthStr: '1280',
  startSecStr: '0',
  durationSecStr: '10',
  timeSecStr: '0',
  frameIntervalStr: '0',
  maxFrameCountStr: '30',
  frameFormat: 'png',
  audioFormat: 'aac',
  gifFpsStr: '10',
  gifMaxWidthStr: '480',
  webpQualityStr: '75',
  videoTransformEnabled: true,
  videoRotation: '0',
  videoFlip: 'none',
  playbackSpeedStr: '1.5',
}

export function VideoWorkbench() {
  const [videos, setVideos] = useState<VideoFile[]>([])
  const [stripListMode, setStripListMode] = useState<VideoStripListMode>('thumbnail')
  const [isStripCollapsed, setIsStripCollapsed] = useState(false)
  const [checkedPaths, setCheckedPaths] = useState<Set<string>>(() => new Set())
  const [previewPath, setPreviewPath] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [form, setForm] = useState<VideoProcessFormState>(defaultForm)
  const [progressPercent, setProgressPercent] = useState<number | null>(null)
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number } | null>(
    null,
  )
  const [videoPresets, setVideoPresets] = useState<VideoProcessPresetRecord[]>([])

  const activeTaskIdRef = useRef<string | null>(null)

  const videoPathsKey = useMemo(() => videos.map((v) => v.path).join('\n'), [videos])
  const videosRef = useRef(videos)
  videosRef.current = videos

  useEffect(() => {
    const list = videosRef.current
    setPreviewPath((prev) => {
      if (list.length === 0) return null
      if (prev && list.some((v) => v.path === prev)) return prev
      return list[0].path
    })
  }, [videoPathsKey])

  useEffect(() => {
    const valid = new Set(videosRef.current.map((v) => v.path))
    setCheckedPaths((prev) => {
      const next = new Set<string>()
      for (const p of prev) {
        if (valid.has(p)) next.add(p)
      }
      return next
    })
  }, [videoPathsKey])

  useEffect(() => {
    return window.picafluxAPI.subscribeVideoTaskProgress(({ taskId, percent }) => {
      if (taskId === activeTaskIdRef.current) {
        setProgressPercent(percent)
      }
    })
  }, [])

  const refreshVideoPresets = useCallback(async () => {
    try {
      const list = await window.picafluxAPI.listVideoProcessPresets()
      setVideoPresets(list)
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    void refreshVideoPresets()
  }, [refreshVideoPresets])

  const handleApplyVideoPreset = useCallback(
    (id: string) => {
      const rec = videoPresets.find((p) => p.id === id)
      if (!rec) return
      setForm((prev) => mergeVideoPresetIntoForm(rec.options, prev))
    },
    [videoPresets],
  )

  const handleSaveVideoPreset = useCallback(
    async (name: string) => {
      const r = await window.picafluxAPI.saveVideoProcessPreset({
        name,
        options: toVideoPresetPayload(form),
      })
      if (r.success) await refreshVideoPresets()
      return r
    },
    [form, refreshVideoPresets],
  )

  const handleDeleteVideoPreset = useCallback(
    async (id: string) => {
      const r = await window.picafluxAPI.deleteVideoProcessPreset(id)
      if (r.success) await refreshVideoPresets()
      return r
    },
    [refreshVideoPresets],
  )

  useEffect(() => {
    let cancelled = false
    const needThumb = videos.filter((v) => !v.thumbnailDataUrl && !v.thumbnailError)
    if (needThumb.length === 0) return
    void (async () => {
      for (const v of needThumb) {
        if (cancelled) return
        const r = await window.picafluxAPI.getVideoThumbnail(v.path)
        if (cancelled) return
        setVideos((prev) =>
          prev.map((x) =>
            x.path === v.path
              ? {
                  ...x,
                  thumbnailDataUrl: r.success && r.dataUrl ? r.dataUrl : undefined,
                  thumbnailError: !(r.success && r.dataUrl),
                }
              : x,
          ),
        )
      }
    })()
    return () => {
      cancelled = true
    }
  }, [videos])

  const reorderVideos = useCallback((from: number, to: number) => {
    if (from === to || from < 0 || to < 0) return
    setVideos((prev) => {
      if (from >= prev.length || to >= prev.length) return prev
      const next = [...prev]
      const [item] = next.splice(from, 1)
      next.splice(to, 0, item)
      return next
    })
  }, [])

  const mergeNewVideos = useCallback((newEntries: VideoFile[]) => {
    setVideos((prev) => {
      const existingPaths = new Set(prev.map((v) => v.path))
      const uniqueNew = newEntries.filter((v) => !existingPaths.has(v.path))
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

  const handleAddVideos = async () => {
    try {
      const filePaths = await window.picafluxAPI.openVideoFiles()
      if (filePaths?.length) {
        const entries = await buildVideoEntries(filePaths)
        mergeNewVideos(entries)
      }
    } catch (e) {
      console.error(e)
    }
  }

  const handleDropPaths = useCallback(
    async (paths: string[]) => {
      if (!paths.length) return
      const entries = await buildVideoEntries(paths)
      mergeNewVideos(entries)
    },
    [mergeNewVideos],
  )

  const handleRemoveVideo = (path: string) => {
    setVideos((prev) => prev.filter((v) => v.path !== path))
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
    setCheckedPaths(new Set(videos.map((v) => v.path)))
  }, [videos])

  const handleClearProcessSelection = useCallback(() => {
    setCheckedPaths(new Set())
  }, [])

  const handleSelectOutputDir = async () => {
    try {
      const dir = await window.picafluxAPI.openDirectory()
      if (dir) setForm((f) => ({ ...f, outputDir: dir }))
    } catch (e) {
      console.error(e)
    }
  }

  const handleCancelProcessing = async () => {
    const id = activeTaskIdRef.current
    if (!id) return
    try {
      await window.picafluxAPI.cancelVideoTask(id)
    } catch {
      /* ignore */
    }
  }

  const handleStartProcessing = async () => {
    const batch = videos.filter((v) => checkedPaths.has(v.path))
    if (!batch.length || !form.outputDir.trim()) return

    const enabledModes = listEnabledModesInOrder(form.modeEnabled)
    if (enabledModes.length === 0) return

    const modesPerFile = enabledModes.filter((m) => m !== 'concat')
    const hasConcat = enabledModes.includes('concat')
    if (hasConcat && batch.length < 2) return

    setIsProcessing(true)
    setVideos((prev) =>
      prev.map((v) =>
        checkedPaths.has(v.path)
          ? { ...v, status: 'processing' as const, lastError: undefined }
          : v,
      ),
    )

    const totalSteps = modesPerFile.length * batch.length + (hasConcat ? 1 : 0)
    let step = 0

    const markVideoResult = (path: string, success: boolean, err?: string) => {
      setVideos((prev) =>
        prev.map((p) =>
          p.path === path
            ? {
                ...p,
                status: success ? 'done' : 'error',
                lastError: success ? undefined : (err ?? '处理失败'),
              }
            : p,
        ),
      )
    }

    const markConcatBatchResult = (success: boolean, err?: string) => {
      setVideos((prev) =>
        prev.map((p) =>
          checkedPaths.has(p.path)
            ? {
                ...p,
                status: success ? 'done' : 'error',
                lastError: success ? undefined : (err ?? '合并失败'),
              }
            : p,
        ),
      )
    }

    try {
      for (const v of batch) {
        let fileOk = true
        let fileErr: string | undefined
        for (const mode of modesPerFile) {
          step += 1
          setBatchProgress({ current: step, total: totalSteps })
          const taskId = newTaskId()
          activeTaskIdRef.current = taskId
          setProgressPercent(0)
          const payload = buildVideoProcessPayload(form, mode)
          try {
            const result = await window.picafluxAPI.processVideo(
              taskId,
              v.path,
              form.outputDir,
              payload,
            )
            if (!result.success) {
              fileOk = false
              fileErr = result.error ?? '处理失败'
            }
          } catch {
            fileOk = false
            fileErr = '处理失败'
          }
          setProgressPercent(null)
          activeTaskIdRef.current = null
        }
        markVideoResult(v.path, fileOk, fileErr)
      }

      if (hasConcat) {
        step += 1
        setBatchProgress({ current: step, total: totalSteps })
        const taskId = newTaskId()
        activeTaskIdRef.current = taskId
        setProgressPercent(0)
        const concatPayload = buildVideoProcessPayload(form, 'concat')
        const orderedPaths = videos.filter((x) => checkedPaths.has(x.path)).map((x) => x.path)
        try {
          const result = await window.picafluxAPI.processVideoConcat(
            taskId,
            orderedPaths,
            form.outputDir,
            concatPayload,
          )
          markConcatBatchResult(result.success, result.error)
        } catch {
          markConcatBatchResult(false, '合并失败')
        }
        setProgressPercent(null)
        activeTaskIdRef.current = null
      }
    } finally {
      setBatchProgress(null)
      setIsProcessing(false)
    }
  }

  const previewVideo = previewPath ? (videos.find((x) => x.path === previewPath) ?? null) : null
  const selectedCount = checkedPaths.size

  const handleNavigatePreview = useCallback(
    (delta: -1 | 1) => {
      if (videos.length === 0) return
      const idx = previewPath ? videos.findIndex((v) => v.path === previewPath) : -1
      const cur = idx >= 0 ? idx : 0
      const len = videos.length
      const next = (cur + delta + len) % len
      setPreviewPath(videos[next].path)
    },
    [videos, previewPath],
  )

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-1 overflow-hidden">
      {isStripCollapsed ? (
        <div className="flex h-full w-9 shrink-0 items-center justify-center border-r border-[#2d2d2d] bg-[#181818]">
          <button
            type="button"
            onClick={() => setIsStripCollapsed(false)}
            className="rounded-md p-1.5 text-gray-400 transition-colors hover:bg-[#2d2d2d] hover:text-gray-200"
            aria-label="展开队列"
            title="展开队列"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <div className="flex h-full min-h-0 shrink-0">
          <VideoStrip
            videos={videos}
            listMode={stripListMode}
            onListModeChange={setStripListMode}
            checkedPaths={checkedPaths}
            onTogglePath={handleTogglePath}
            onSelectAll={handleSelectAllForProcess}
            onClearSelection={handleClearProcessSelection}
            previewPath={previewPath}
            onPreviewPath={setPreviewPath}
            onRemoveVideo={handleRemoveVideo}
            concatMode={form.modeEnabled.concat}
            onReorder={reorderVideos}
            reorderLocked={isProcessing}
          />
          <QueueSidebarCollapseHandle onCollapse={() => setIsStripCollapsed(true)} />
        </div>
      )}
      <VideoPreviewPane
        videos={videos}
        previewVideo={previewVideo}
        selectedCount={selectedCount}
        onAddVideos={handleAddVideos}
        onDropPaths={handleDropPaths}
        form={form}
        onFormChange={setForm}
        isProcessing={isProcessing}
        onNavigatePreview={handleNavigatePreview}
      />
      <VideoSettingsPanel
        state={form}
        onChange={setForm}
        onSelectOutputDir={handleSelectOutputDir}
        onStartProcessing={handleStartProcessing}
        onCancelProcessing={handleCancelProcessing}
        isProcessing={isProcessing}
        selectedForProcessCount={selectedCount}
        totalVideoCount={videos.length}
        progressPercent={progressPercent}
        batchProgress={batchProgress}
        videoPresets={videoPresets}
        onApplyVideoPreset={handleApplyVideoPreset}
        onSaveVideoPreset={handleSaveVideoPreset}
        onDeleteVideoPreset={handleDeleteVideoPreset}
      />
    </div>
  )
}
