'use client'

import { Check, Pause, Play, RotateCcw } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type Props = {
  videoFile: File
  onThumbnailSelected: (thumbnail: File) => void
  onCancel: () => void
}

/**
 * Modal that lets the user scrub through a video and pick a frame to use as
 * the coin's thumbnail. Plain `<video>` + `<input type="range">` + a Canvas
 * frame capture; no external player abstraction.
 */
export function VideoThumbnailSelector({
  videoFile,
  onThumbnailSelected,
  onCancel,
}: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const videoUrl = useMemo(() => URL.createObjectURL(videoFile), [videoFile])

  useEffect(() => {
    return () => URL.revokeObjectURL(videoUrl)
  }, [videoUrl])

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  // Wait for the next `seeked` event on the underlying video element.
  const waitForSeeked = useCallback((video: HTMLVideoElement) => {
    return new Promise<void>((resolve) => {
      const onSeeked = () => {
        video.removeEventListener('seeked', onSeeked)
        resolve()
      }
      video.addEventListener('seeked', onSeeked)
    })
  }, [])

  const captureFrame = useCallback(async (): Promise<File> => {
    const video = videoRef.current
    if (!video) throw new Error('Video element not mounted')

    const canvas = canvasRef.current ?? document.createElement('canvas')
    canvas.width = video.videoWidth || 1280
    canvas.height = video.videoHeight || 720
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas 2D context unavailable')
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

    const blob: Blob = await new Promise((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('Failed to encode thumbnail'))),
        'image/jpeg',
        0.92
      )
    })

    const stem = videoFile.name.replace(/\.[^.]+$/, '')
    return new File([blob], `${stem}-thumbnail.jpg`, { type: 'image/jpeg' })
  }, [videoFile.name])

  const renderPreview = useCallback(async () => {
    try {
      const file = await captureFrame()
      const url = URL.createObjectURL(file)
      setPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev)
        return url
      })
    } catch (err) {
      console.error('[thumbnail] preview render failed', err)
    }
  }, [captureFrame])

  const seekTo = useCallback(
    async (t: number) => {
      const video = videoRef.current
      if (!video) return
      const wait = waitForSeeked(video)
      video.currentTime = Math.max(0, Math.min(duration || t, t))
      await wait
      setCurrentTime(video.currentTime)
      await renderPreview()
    },
    [duration, renderPreview, waitForSeeked]
  )

  const onLoaded = useCallback(async () => {
    const video = videoRef.current
    if (!video) return
    setDuration(video.duration)
    setError(null)
    const initial = Math.min(1, video.duration * 0.1)
    await seekTo(initial)
  }, [seekTo])

  const togglePlay = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    if (video.paused) {
      void video.play()
      setIsPlaying(true)
    } else {
      video.pause()
      setIsPlaying(false)
      // Capture the frame we just paused on as the preview.
      void renderPreview()
    }
  }, [renderPreview])

  const handleConfirm = useCallback(async () => {
    setBusy(true)
    try {
      const file = await captureFrame()
      onThumbnailSelected(file)
    } catch (err) {
      console.error('[thumbnail] capture failed', err)
      setError(err instanceof Error ? err.message : 'Failed to capture thumbnail')
    } finally {
      setBusy(false)
    }
  }, [captureFrame, onThumbnailSelected])

  const resetToDefault = useCallback(() => {
    if (!duration) return
    void seekTo(Math.min(1, duration * 0.1))
  }, [duration, seekTo])

  return (
    <div className="w-full max-w-2xl rounded-xl border border-border bg-surface px-5 py-6 shadow-xl">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h3 className="text-base font-bold">Select a thumbnail</h3>
          <p className="text-[12.5px] text-muted-fg">
            Scrub through the video and pick the frame you want to represent this coin.
          </p>
        </div>
      </div>

      <div className="relative overflow-hidden rounded-md border border-border bg-black">
        <video
          ref={videoRef}
          src={videoUrl}
          className="aspect-video w-full object-contain"
          onLoadedMetadata={onLoaded}
          onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onError={() => setError('Browser could not play this video file.')}
          playsInline
          preload="metadata"
        />
        <button
          type="button"
          onClick={togglePlay}
          className="absolute inset-0 flex items-center justify-center bg-black/0 transition hover:bg-black/20 focus-visible:bg-black/30 focus-visible:outline-none"
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          <span className="rounded-full bg-black/50 p-3 text-white">
            {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
          </span>
        </button>
        <div className="absolute bottom-2 right-2 rounded bg-black/60 px-2 py-0.5 text-[11px] font-medium text-white">
          {formatTime(currentTime)} / {formatTime(duration)}
        </div>
      </div>

      {duration > 0 && (
        <div className="mt-4 flex flex-col gap-3">
          <input
            type="range"
            min={0}
            max={duration}
            step={0.1}
            value={currentTime}
            onChange={(e) => void seekTo(parseFloat(e.target.value))}
            className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-surface-2 accent-accent"
          />
          <div className="flex items-center justify-between">
            <Button type="button" variant="outline" size="sm" onClick={resetToDefault}>
              <RotateCcw className="h-4 w-4" />
              Reset
            </Button>
            <span className="text-[12px] text-muted-fg">
              Frame at {formatTime(currentTime)}
            </span>
          </div>
        </div>
      )}

      {previewUrl && (
        <div className="mt-4">
          <div className="mb-1 text-[12px] font-medium text-muted-fg">
            Thumbnail preview
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt="Thumbnail preview"
            className="aspect-video w-full rounded-md border border-border object-cover"
          />
        </div>
      )}

      {error && <div className={cn('mt-3 text-[12.5px] text-destructive')}>{error}</div>}

      <div className="mt-5 flex items-center justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={handleConfirm}
          disabled={busy || !!error || duration <= 0}
        >
          {busy ? (
            'Capturing…'
          ) : (
            <>
              <Check className="h-4 w-4" />
              Use this thumbnail
            </>
          )}
        </Button>
      </div>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  )
}

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}
