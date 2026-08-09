'use client'

import { useRef, useState } from 'react'

import { cn } from '@/lib/utils'

type Props = {
  data: number[]
  labels?: string[]
  height?: number
  className?: string
}

export function BarChart({ data, labels, height = 130, className }: Props) {
  const [hovered, setHovered] = useState<number | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const max = Math.max(...data, 0.0001)
  const hasData = data.some((v) => v > 0)
  const n = data.length

  // SVG coords in 0–100 space. Labels rendered as HTML below to avoid
  // preserveAspectRatio="none" distortion.
  const BOT = 2 // gap above baseline
  const GAP = 8 // gap between bars as % of slot width

  function barRect(i: number, v: number) {
    const slotW = 100 / n
    const barW = slotW - GAP
    const x = i * slotW + GAP / 2
    const barH = (v / max) * (100 - BOT)
    const y = 100 - BOT - barH
    return { x, y, w: barW, h: barH }
  }

  function onMouseMove(e: React.MouseEvent) {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    const xPct = (e.clientX - rect.left) / rect.width
    setHovered(Math.max(0, Math.min(n - 1, Math.floor(xPct * n))))
  }

  const hovVal = hovered !== null ? data[hovered] : null
  const hovX = hovered !== null ? ((hovered + 0.5) / n) * 100 : null

  function fmtVal(v: number) {
    if (v < 0.001) return '<0.001'
    if (v >= 1000) return `${Math.round(v / 1000)}K`
    if (v >= 100) return Math.round(v).toString()
    return v.toFixed(3).replace(/\.?0+$/, '')
  }

  return (
    <div
      ref={containerRef}
      className={cn('relative select-none', className)}
      onMouseMove={onMouseMove}
      onMouseLeave={() => setHovered(null)}
      style={{ cursor: 'crosshair' }}
    >
      {/* Tooltip — HTML so it's always crisp */}
      {hovX !== null && hovVal != null && hovVal > 0 && (
        <div
          className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-md bg-fg px-2 py-1 text-[11px] font-semibold text-bg shadow-sm"
          style={{ left: `${hovX}%` }}
        >
          {fmtVal(hovVal)} ETH
        </div>
      )}

      {!hasData && (
        <div
          className="pointer-events-none absolute inset-0 flex items-center justify-center"
          style={{ height }}
        >
          <span className="text-xs text-muted-fg">No auction data yet</span>
        </div>
      )}

      {/* Chart SVG — visuals only, no text */}
      <svg
        viewBox="0 0 100 100"
        width="100%"
        height={height}
        preserveAspectRatio="none"
        style={{ display: 'block' }}
        aria-hidden
      >
        <defs>
          <linearGradient id="bc-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.9" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.4" />
          </linearGradient>
        </defs>

        {/* Baseline */}
        <line
          x1="0"
          y1="100"
          x2="100"
          y2="100"
          stroke="var(--border)"
          strokeWidth="0.5"
        />

        {/* Bars */}
        {hasData &&
          data.map((v, i) => {
            const { x, y, w, h } = barRect(i, v)
            const isHov = hovered === i
            if (h <= 0) return null
            return (
              <rect
                key={i}
                x={x}
                y={y}
                width={w}
                height={h}
                rx="1.5"
                fill={isHov ? 'var(--accent)' : 'url(#bc-grad)'}
                opacity={isHov ? 1 : 0.75}
              />
            )
          })}
      </svg>

      {/* Month labels — plain HTML, never distorted */}
      {labels && (
        <div className="relative mt-1.5" style={{ height: 14 }}>
          {labels.map((l, i) => (
            <span
              key={i}
              className="absolute -translate-x-1/2 text-[10px] leading-none"
              style={{
                left: `${((i + 0.5) / n) * 100}%`,
                color: hovered === i ? 'var(--fg)' : 'var(--muted-fg)',
              }}
            >
              {l}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
