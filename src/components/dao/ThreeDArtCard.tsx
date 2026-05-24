'use client'

import { useCallback, useRef, useState } from 'react'

import { cn } from '@/lib/utils'

type Props = {
  children: React.ReactNode
  className?: string
  /** Max rotation in degrees from the center. */
  maxTilt?: number
  /** Parallax depth in pixels — how far the inner content lifts on hover. */
  depth?: number
}

export function ThreeDArtCard({
  children,
  className,
  maxTilt = 12,
  depth = 30,
}: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const rafRef = useRef<number | null>(null)
  const [hovered, setHovered] = useState(false)

  const handleMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const node = ref.current
      if (!node) return
      const rect = node.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      const px = x / rect.width
      const py = y / rect.height
      const rotY = (px - 0.5) * 2 * maxTilt
      const rotX = -(py - 0.5) * 2 * maxTilt

      if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
      rafRef.current = requestAnimationFrame(() => {
        node.style.setProperty('--rx', `${rotX.toFixed(2)}deg`)
        node.style.setProperty('--ry', `${rotY.toFixed(2)}deg`)
        node.style.setProperty('--mx', `${(px * 100).toFixed(2)}%`)
        node.style.setProperty('--my', `${(py * 100).toFixed(2)}%`)
      })
    },
    [maxTilt]
  )

  const handleLeave = useCallback(() => {
    const node = ref.current
    if (!node) return
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
    node.style.setProperty('--rx', '0deg')
    node.style.setProperty('--ry', '0deg')
    node.style.setProperty('--mx', '50%')
    node.style.setProperty('--my', '50%')
    setHovered(false)
  }, [])

  return (
    <div className={cn('group [perspective:1200px]', className)}>
      <div
        ref={ref}
        onMouseMove={handleMove}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={handleLeave}
        className={cn(
          'relative aspect-square overflow-hidden rounded-xl border border-border bg-surface-2',
          'transition-transform duration-200 ease-out will-change-transform',
          '[transform-style:preserve-3d]',
          '[transform:rotateX(var(--rx,0deg))_rotateY(var(--ry,0deg))]'
        )}
      >
        {/* Art layer with parallax lift */}
        <div
          className="absolute inset-0 transition-transform duration-200 ease-out will-change-transform"
          style={{
            transform: hovered
              ? `translateZ(${depth}px) scale(1.04)`
              : 'translateZ(0px) scale(1)',
          }}
        >
          {children}
        </div>

        {/* Cursor-tracked glow */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          style={{
            background:
              'radial-gradient(420px circle at var(--mx,50%) var(--my,50%), rgba(255,255,255,0.25), transparent 55%)',
            mixBlendMode: 'overlay',
          }}
        />

        {/* Iridescent sheen */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-60"
          style={{
            background:
              'conic-gradient(from 210deg at var(--mx,50%) var(--my,50%), rgba(168,85,247,0.18), rgba(56,189,248,0.18), rgba(244,114,182,0.18), rgba(168,85,247,0.18))',
            mixBlendMode: 'screen',
          }}
        />

        {/* Subtle inner highlight ring */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-inset ring-white/10"
        />

        {/* Specular streak that follows the cursor along the X axis */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 -left-1/4 w-1/2 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          style={{
            transform: 'translateX(calc(var(--mx,50%) * 2 - 50%)) skewX(-18deg)',
            background:
              'linear-gradient(90deg, transparent, rgba(255,255,255,0.18), transparent)',
            mixBlendMode: 'plus-lighter',
          }}
        />
      </div>

      {/* Soft drop glow behind the card */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 rounded-xl opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-70"
        style={{
          background:
            'radial-gradient(60% 50% at 50% 60%, rgba(99,102,241,0.45), rgba(236,72,153,0.25) 40%, transparent 70%)',
        }}
      />
    </div>
  )
}
