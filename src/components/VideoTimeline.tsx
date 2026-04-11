import React, { useEffect, useMemo, useRef, useState } from 'react'
import clsx from 'clsx'
import type { VideoWorkbenchMode } from '@/lib/videoFormPayload'

function isFiniteNonNeg(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n >= 0
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

function formatSec(n: number): string {
  if (!Number.isFinite(n)) return '0'
  const s = n.toFixed(3).replace(/\.?0+$/, '')
  return s === '-0' ? '0' : s
}

function parseSecStr(s: string, fallback: number): number {
  const n = parseFloat(String(s).trim().replace(',', '.'))
  if (!Number.isFinite(n) || n < 0) return fallback
  return n
}

function formatClock(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '—'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  const ms = Math.floor((sec % 1) * 1000)
  if (ms > 0) return `${m}:${String(s).padStart(2, '0')}.${String(ms).padStart(3, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

type TimelineMode = Extract<VideoWorkbenchMode, 'trim' | 'gif' | 'webp_anim' | 'extract_frame'>

export interface VideoTimelineProps {
  mode: TimelineMode
  videoEl: HTMLVideoElement | null
  durationSec?: number
  startSecStr: string
  durationSecStr: string
  timeSecStr: string
  onChange: (next: { startSecStr?: string; durationSecStr?: string; timeSecStr?: string }) => void
  disabled?: boolean
}

type DragKind = 'none' | 'playhead' | 'start' | 'end' | 'time'

export function VideoTimeline({
  mode,
  videoEl,
  durationSec,
  startSecStr,
  durationSecStr,
  timeSecStr,
  onChange,
  disabled,
}: VideoTimelineProps) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [metaDuration, setMetaDuration] = useState<number | null>(null)
  const [currentTime, setCurrentTime] = useState<number>(0)
  const [hoverSec, setHoverSec] = useState<number | null>(null)
  const dragRef = useRef<{ kind: DragKind; pointerId: number } | null>(null)

  const dur = useMemo(() => {
    const d =
      (videoEl && isFiniteNonNeg(videoEl.duration) ? videoEl.duration : null) ??
      (isFiniteNonNeg(durationSec) ? durationSec : null) ??
      metaDuration
    return d && d > 0 ? d : 0
  }, [videoEl, durationSec, metaDuration])

  const startSec = useMemo(() => {
    if (dur <= 0) return parseSecStr(startSecStr, 0)
    return clamp(parseSecStr(startSecStr, 0), 0, dur)
  }, [dur, startSecStr])

  const clipDurationSec = useMemo(() => {
    const raw = parseSecStr(durationSecStr, 0)
    if (dur <= 0) return raw
    return clamp(raw, 0, dur)
  }, [dur, durationSecStr])

  const endSec = useMemo(() => {
    const raw = startSec + clipDurationSec
    if (dur <= 0) return raw
    return clamp(raw, 0, dur)
  }, [dur, startSec, clipDurationSec])

  const timeSec = useMemo(() => {
    if (dur <= 0) return parseSecStr(timeSecStr, 0)
    return clamp(parseSecStr(timeSecStr, 0), 0, dur)
  }, [dur, timeSecStr])

  useEffect(() => {
    if (!videoEl) return
    const onLoaded = () => {
      const d = videoEl.duration
      if (isFiniteNonNeg(d) && d > 0) setMetaDuration(d)
    }
    const onDuration = () => {
      const d = videoEl.duration
      if (isFiniteNonNeg(d) && d > 0) setMetaDuration(d)
    }
    videoEl.addEventListener('loadedmetadata', onLoaded)
    videoEl.addEventListener('durationchange', onDuration)
    onLoaded()
    return () => {
      videoEl.removeEventListener('loadedmetadata', onLoaded)
      videoEl.removeEventListener('durationchange', onDuration)
    }
  }, [videoEl])

  useEffect(() => {
    if (!videoEl) return
    let raf = 0
    const tick = () => {
      raf = requestAnimationFrame(tick)
      const t = videoEl.currentTime
      if (isFiniteNonNeg(t)) setCurrentTime(t)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [videoEl])

  const pxToSec = (clientX: number) => {
    const el = trackRef.current
    if (!el) return 0
    const r = el.getBoundingClientRect()
    const x = clamp(clientX - r.left, 0, r.width)
    const ratio = r.width > 0 ? x / r.width : 0
    const s = ratio * (dur > 0 ? dur : 1)
    return dur > 0 ? clamp(s, 0, dur) : Math.max(0, s)
  }

  const setVideoTime = (sec: number) => {
    if (!videoEl) return
    try {
      videoEl.currentTime = sec
    } catch {
      /* ignore */
    }
  }

  const updateTrim = (nextStart: number, nextEnd: number, seekTo?: number) => {
    const d = dur > 0 ? dur : Math.max(nextEnd, nextStart)
    const s = clamp(nextStart, 0, d)
    const e = clamp(nextEnd, 0, d)
    const minLen = 0.01
    const safeE = e < s + minLen ? s + minLen : e
    const clampedE = d > 0 ? clamp(safeE, 0, d) : safeE
    const nextDur = Math.max(0, clampedE - s)
    onChange({ startSecStr: formatSec(s), durationSecStr: formatSec(nextDur) })
    if (typeof seekTo === 'number') setVideoTime(clamp(seekTo, 0, d))
  }

  const updateTime = (t: number, seek = true) => {
    const d = dur > 0 ? dur : t
    const nt = clamp(t, 0, d)
    onChange({ timeSecStr: formatSec(nt) })
    if (seek) setVideoTime(nt)
  }

  const onPointerDown = (e: React.PointerEvent, kind: DragKind) => {
    if (disabled) return
    if (!trackRef.current) return
    if (e.button !== 0) return
    dragRef.current = { kind, pointerId: e.pointerId }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    e.preventDefault()
    e.stopPropagation()
  }

  const onPointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== e.pointerId) return
    if (disabled) return
    const sec = pxToSec(e.clientX)

    if (mode === 'extract_frame') {
      updateTime(sec)
      return
    }

    if (drag.kind === 'playhead') {
      setVideoTime(sec)
      return
    }

    if (drag.kind === 'start') {
      updateTrim(sec, endSec, sec)
      return
    }

    if (drag.kind === 'end') {
      updateTrim(startSec, sec, sec)
      return
    }
  }

  const onPointerUp = (e: React.PointerEvent) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== e.pointerId) return
    dragRef.current = null
    try {
      ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
  }

  const durSafe = dur > 0 ? dur : 1
  const startPct = (startSec / durSafe) * 100
  const endPct = (endSec / durSafe) * 100
  const playPct = (currentTime / durSafe) * 100
  const timePct = (timeSec / durSafe) * 100

  const isTrim = mode === 'trim' || mode === 'gif' || mode === 'webp_anim'

  return (
    <div className="w-full rounded-lg border border-[#2d2d2d] bg-[#101010] px-3 py-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-gray-400">
        <div className="flex items-center gap-3">
          <span className="text-gray-500">时长</span>
          <span className="text-gray-200">{dur > 0 ? formatClock(dur) : '—'}</span>
          <span className="text-gray-500">当前</span>
          <span className="text-gray-200">{formatClock(currentTime)}</span>
        </div>
        {isTrim ? (
          <div className="flex items-center gap-3">
            <span className="text-gray-500">起点</span>
            <span className="text-gray-200">{formatClock(startSec)}</span>
            <span className="text-gray-500">终点</span>
            <span className="text-gray-200">{formatClock(endSec)}</span>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <span className="text-gray-500">截取</span>
            <span className="text-gray-200">{formatClock(timeSec)}</span>
          </div>
        )}
      </div>

      <div className="relative">
        {hoverSec != null && dur > 0 ? (
          <div
            className="pointer-events-none absolute -top-7 z-20 -translate-x-1/2 whitespace-nowrap rounded bg-black/85 px-1.5 py-0.5 text-[10px] tabular-nums text-gray-100 shadow"
            style={{ left: `${(hoverSec / durSafe) * 100}%` }}
          >
            {formatClock(hoverSec)}
          </div>
        ) : null}
        <div
          ref={trackRef}
          className={clsx(
            'relative h-10 w-full select-none rounded-md bg-[#1a1a1a]',
            disabled ? 'opacity-60' : 'cursor-pointer',
          )}
          onMouseMove={(e) => {
            if (disabled) return
            setHoverSec(pxToSec(e.clientX))
          }}
          onMouseLeave={() => setHoverSec(null)}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onPointerDown={(e) => {
            if (disabled) return
            const sec = pxToSec(e.clientX)
            if (mode === 'extract_frame') updateTime(sec)
            else setVideoTime(sec)
          }}
        >
          {[0, 0.25, 0.5, 0.75, 1].map((r, i) => (
            <div
              key={i}
              className="pointer-events-none absolute bottom-0 top-0 w-px bg-white/12"
              style={{ left: `${r * 100}%` }}
            />
          ))}
          {isTrim ? (
            <div
              className="absolute inset-y-0 rounded-md bg-blue-500/20"
              style={{ left: `${startPct}%`, width: `${Math.max(0, endPct - startPct)}%` }}
            />
          ) : null}

          <div
            className={clsx(
              'absolute inset-y-1 w-[2px] rounded bg-white/70',
              disabled ? '' : 'cursor-ew-resize',
            )}
            style={{ left: `${mode === 'extract_frame' ? timePct : playPct}%` }}
            onPointerDown={(e) => onPointerDown(e, mode === 'extract_frame' ? 'time' : 'playhead')}
            title={mode === 'extract_frame' ? '拖动选择截帧时间' : '拖动跳转播放位置'}
          />

          {isTrim ? (
            <>
              <div
                className={clsx(
                  'absolute inset-y-0 w-3 -translate-x-1/2 rounded-md bg-blue-500/70 shadow',
                  disabled ? '' : 'cursor-ew-resize hover:bg-blue-400/80',
                )}
                style={{ left: `${startPct}%` }}
                onPointerDown={(e) => onPointerDown(e, 'start')}
                title="拖动起点"
              />
              <div
                className={clsx(
                  'absolute inset-y-0 w-3 -translate-x-1/2 rounded-md bg-blue-500/70 shadow',
                  disabled ? '' : 'cursor-ew-resize hover:bg-blue-400/80',
                )}
                style={{ left: `${endPct}%` }}
                onPointerDown={(e) => onPointerDown(e, 'end')}
                title="拖动终点"
              />
            </>
          ) : null}
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        {isTrim ? (
          <>
            <button
              type="button"
              disabled={disabled || !videoEl}
              onClick={() => {
                const t = isFiniteNonNeg(videoEl?.currentTime) ? (videoEl?.currentTime ?? 0) : 0
                updateTrim(t, endSec, t)
              }}
              className="rounded-md border border-[#2d2d2d] bg-[#151515] px-2 py-1 text-[11px] text-gray-200 hover:bg-[#1e1e1e] disabled:opacity-50"
            >
              设为起点
            </button>
            <button
              type="button"
              disabled={disabled || !videoEl}
              onClick={() => {
                const t = isFiniteNonNeg(videoEl?.currentTime) ? (videoEl?.currentTime ?? 0) : 0
                updateTrim(startSec, t, t)
              }}
              className="rounded-md border border-[#2d2d2d] bg-[#151515] px-2 py-1 text-[11px] text-gray-200 hover:bg-[#1e1e1e] disabled:opacity-50"
            >
              设为终点
            </button>
            <button
              type="button"
              disabled={disabled || dur <= 0}
              onClick={() => updateTrim(0, Math.min(dur, 10), 0)}
              className="ml-auto rounded-md border border-[#2d2d2d] bg-[#151515] px-2 py-1 text-[11px] text-gray-400 hover:bg-[#1e1e1e] disabled:opacity-50"
            >
              重置为 0–10s
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              disabled={disabled || !videoEl}
              onClick={() => {
                const t = isFiniteNonNeg(videoEl?.currentTime) ? (videoEl?.currentTime ?? 0) : 0
                updateTime(t)
              }}
              className="rounded-md border border-[#2d2d2d] bg-[#151515] px-2 py-1 text-[11px] text-gray-200 hover:bg-[#1e1e1e] disabled:opacity-50"
            >
              设为当前帧
            </button>
            <button
              type="button"
              disabled={disabled || dur <= 0}
              onClick={() => updateTime(0)}
              className="ml-auto rounded-md border border-[#2d2d2d] bg-[#151515] px-2 py-1 text-[11px] text-gray-400 hover:bg-[#1e1e1e] disabled:opacity-50"
            >
              归零
            </button>
          </>
        )}
      </div>
    </div>
  )
}
