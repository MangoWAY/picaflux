import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { VideoStrip, type VideoFile, type VideoStripListMode } from './VideoStrip'
import { VideoPreviewPane } from './VideoPreviewPane'
import { VideoSettingsPanel } from './VideoSettingsPanel'
import { buildVideoProcessPayload, type VideoProcessFormState } from '@/lib/videoFormPayload'

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
  videoRotation: '0',
  videoFlip: 'none',
  playbackSpeedStr: '1.5',
}

export function VideoWorkbench() {
  const [videos, setVideos] = useState<VideoFile[]>([])
  const [stripListMode, setStripListMode] = useState<VideoStripListMode>('thumbnail')
  const [checkedPaths, setCheckedPaths] = useState<Set<string>>(() => new Set())
  const [previewPath, setPreviewPath] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [form, setForm] = useState<VideoProcessFormState>(defaultForm)
  const [progressPercent, setProgressPercent] = useState<number | null>(null)
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number } | null>(
    null,
  )

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

    setIsProcessing(true)
    setVideos((prev) =>
      prev.map((v) => (checkedPaths.has(v.path) ? { ...v, status: 'processing' as const } : v)),
    )

    const payloadBase = buildVideoProcessPayload(form)

    if (form.mode === 'concat') {
      if (batch.length < 2) {
        setVideos((prev) => prev.map((v) => ({ ...v, status: 'pending' as const })))
        setIsProcessing(false)
        return
      }
      const orderedPaths = videos.filter((v) => checkedPaths.has(v.path)).map((v) => v.path)
      const taskId = newTaskId()
      activeTaskIdRef.current = taskId
      setProgressPercent(0)
      setBatchProgress({ current: 1, total: 1 })
      try {
        const result = await window.picafluxAPI.processVideoConcat(
          taskId,
          orderedPaths,
          form.outputDir,
          payloadBase,
        )
        setVideos((prev) =>
          prev.map((p) =>
            checkedPaths.has(p.path) ? { ...p, status: result.success ? 'done' : 'error' } : p,
          ),
        )
      } catch {
        setVideos((prev) =>
          prev.map((p) => (checkedPaths.has(p.path) ? { ...p, status: 'error' as const } : p)),
        )
      }
      setProgressPercent(null)
      activeTaskIdRef.current = null
      setBatchProgress(null)
      setIsProcessing(false)
      return
    }

    setBatchProgress({ current: 0, total: batch.length })
    try {
      for (let i = 0; i < batch.length; i++) {
        const v = batch[i]
        setBatchProgress({ current: i + 1, total: batch.length })
        const taskId = newTaskId()
        activeTaskIdRef.current = taskId
        setProgressPercent(0)
        try {
          const result = await window.picafluxAPI.processVideo(
            taskId,
            v.path,
            form.outputDir,
            payloadBase,
          )
          setVideos((prev) =>
            prev.map((p) =>
              p.path === v.path ? { ...p, status: result.success ? 'done' : 'error' } : p,
            ),
          )
        } catch {
          setVideos((prev) =>
            prev.map((p) => (p.path === v.path ? { ...p, status: 'error' as const } : p)),
          )
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

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-1 overflow-hidden">
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
        concatMode={form.mode === 'concat'}
        onReorder={reorderVideos}
        reorderLocked={isProcessing}
      />
      <VideoPreviewPane
        videos={videos}
        previewVideo={previewVideo}
        selectedCount={selectedCount}
        onAddVideos={handleAddVideos}
        onDropPaths={handleDropPaths}
        form={form}
        onFormChange={setForm}
        isProcessing={isProcessing}
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
      />
    </div>
  )
}
