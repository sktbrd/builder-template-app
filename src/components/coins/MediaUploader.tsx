'use client'

import { ImageIcon, Upload, Video, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { VideoThumbnailSelector } from '@/components/coins/VideoThumbnailSelector'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export const SUPPORTED_IMAGE_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
] as const

export const SUPPORTED_VIDEO_TYPES = [
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/x-m4v',
] as const

const MAX_FILE_BYTES = 100 * 1024 * 1024 // 100 MB; Pinata public allows up to ~50 GB but
// uploads through the signed-URL endpoint get slow well before that. 100 MB is
// generous for a coin image / short video. Tune later if users hit the limit.

export type MediaSelection =
  | null
  | {
      kind: 'image'
      file: File
      mimeType: string
    }
  | {
      kind: 'video'
      file: File
      mimeType: string
      thumbnail: File
    }

type Props = {
  value: MediaSelection
  onChange: (next: MediaSelection) => void
  disabled?: boolean
}

export function MediaUploader({ value, onChange, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [pendingVideo, setPendingVideo] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)

  const previewUrl = useMemo(() => {
    if (!value) return null
    return URL.createObjectURL(value.file)
  }, [value])

  useEffect(() => {
    if (!previewUrl) return
    return () => URL.revokeObjectURL(previewUrl)
  }, [previewUrl])

  const thumbnailUrl = useMemo(() => {
    if (!value || value.kind !== 'video') return null
    return URL.createObjectURL(value.thumbnail)
  }, [value])

  useEffect(() => {
    if (!thumbnailUrl) return
    return () => URL.revokeObjectURL(thumbnailUrl)
  }, [thumbnailUrl])

  const handleFile = useCallback(
    (file: File) => {
      const isImage = file.type.startsWith('image/')
      const isVideo = file.type.startsWith('video/')
      if (!isImage && !isVideo) {
        setError('Please upload an image or video.')
        return
      }
      if (isImage && !SUPPORTED_IMAGE_TYPES.includes(file.type as never)) {
        setError('Image must be JPEG, PNG, GIF, WebP or SVG.')
        return
      }
      if (isVideo && !SUPPORTED_VIDEO_TYPES.includes(file.type as never)) {
        setError('Video must be MP4, WebM or MOV.')
        return
      }
      if (file.size > MAX_FILE_BYTES) {
        setError(
          `File is too large. Max ${Math.round(MAX_FILE_BYTES / (1024 * 1024))} MB.`
        )
        return
      }
      setError(null)
      if (isImage) {
        onChange({ kind: 'image', file, mimeType: file.type })
      } else {
        // Defer the actual selection until the user picks a thumbnail.
        setPendingVideo(file)
      }
    },
    [onChange]
  )

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) handleFile(f)
    if (inputRef.current) inputRef.current.value = ''
  }

  const handleThumbnailSelected = (thumbnail: File) => {
    if (!pendingVideo) return
    onChange({
      kind: 'video',
      file: pendingVideo,
      mimeType: pendingVideo.type,
      thumbnail,
    })
    setPendingVideo(null)
  }

  const handleThumbnailCancel = () => {
    setPendingVideo(null)
  }

  const handleClear = () => {
    onChange(null)
    setError(null)
  }

  if (!value) {
    return (
      <>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={disabled}
          className={cn(
            'mx-auto flex w-full max-w-md flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-surface-2 px-6 py-10 text-center transition-colors hover:border-accent/60 hover:bg-surface-3',
            disabled &&
              'cursor-not-allowed opacity-60 hover:border-border hover:bg-surface-2',
            error && 'border-destructive'
          )}
        >
          <Upload className="mb-3 h-9 w-9 text-muted-fg" />
          <div className="text-sm font-medium">Upload image or video</div>
          <div className="mt-1 text-[11.5px] text-muted-fg">
            JPEG · PNG · GIF · WebP · SVG · MP4 · WebM · MOV
          </div>
        </button>
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept={[...SUPPORTED_IMAGE_TYPES, ...SUPPORTED_VIDEO_TYPES].join(',')}
          onChange={handleInputChange}
        />
        {error && <p className="mt-2 text-[12px] text-destructive">{error}</p>}
        {pendingVideo && (
          <ModalShell onDismiss={handleThumbnailCancel}>
            <VideoThumbnailSelector
              videoFile={pendingVideo}
              onThumbnailSelected={handleThumbnailSelected}
              onCancel={handleThumbnailCancel}
            />
          </ModalShell>
        )}
      </>
    )
  }

  return (
    <>
      <div
        className={cn(
          'grid grid-cols-1 gap-3',
          value.kind === 'video' && 'sm:grid-cols-2'
        )}
      >
        <div>
          <div className="mb-1.5 text-[12px] font-medium text-muted-fg">Media</div>
          <div className="relative overflow-hidden rounded-xl border border-border bg-surface-2">
            {value.kind === 'image' && previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewUrl}
                alt="Coin media preview"
                className="aspect-video w-full object-contain"
              />
            ) : null}
            {value.kind === 'video' && previewUrl ? (
              <video
                src={previewUrl}
                controls
                playsInline
                className="aspect-video w-full bg-black object-contain"
              />
            ) : null}
            <div className="absolute left-2 top-2 inline-flex max-w-[calc(100%-7rem)] items-center gap-1 rounded bg-black/60 px-2 py-0.5 text-[11px] font-medium text-white">
              {value.kind === 'image' ? (
                <ImageIcon className="h-3 w-3 shrink-0" />
              ) : (
                <Video className="h-3 w-3 shrink-0" />
              )}
              <span className="truncate">{value.file.name}</span>
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="absolute right-2 top-2"
              onClick={handleClear}
              disabled={disabled}
            >
              <X className="h-4 w-4" />
              Remove
            </Button>
          </div>
        </div>

        {value.kind === 'video' && (
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-[12px] font-medium text-muted-fg">Thumbnail</span>
              <button
                type="button"
                onClick={() => setPendingVideo(value.file)}
                className="text-[11.5px] font-medium text-accent hover:underline"
                disabled={disabled}
              >
                Change
              </button>
            </div>
            <div className="overflow-hidden rounded-xl border border-border bg-surface-2">
              {thumbnailUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={thumbnailUrl}
                  alt="Selected thumbnail"
                  className="aspect-video w-full object-cover"
                />
              ) : (
                <div className="aspect-video w-full" />
              )}
            </div>
          </div>
        )}
      </div>

      {pendingVideo && (
        <ModalShell onDismiss={handleThumbnailCancel}>
          <VideoThumbnailSelector
            videoFile={pendingVideo}
            onThumbnailSelected={handleThumbnailSelected}
            onCancel={handleThumbnailCancel}
          />
        </ModalShell>
      )}
    </>
  )
}

function ModalShell({
  children,
  onDismiss,
}: {
  children: React.ReactNode
  onDismiss?: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onDismiss}
    >
      <div className="w-full max-w-2xl" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  )
}
