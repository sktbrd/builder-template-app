'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'

import { daoConfig } from '@/lib/dao.config'
import type { AuctionPricePoint } from '@/lib/dao-data'

const PERIODS = [
  { key: '30', label: '30D', days: 30 },
  { key: '60', label: '60D', days: 60 },
  { key: '90', label: '90D', days: 90 },
  { key: 'all', label: 'All', days: 0 },
] as const

type PeriodKey = (typeof PERIODS)[number]['key']

const WIDTH = 640
const HEIGHT = 240
const PAD_X = 24
const PAD_Y = 28

export function AuctionPriceChart({ data }: { data: AuctionPricePoint[] }) {
  const [period, setPeriod] = useState<PeriodKey>('all')
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)

  // Snapshot "now" once at mount so the React compiler doesn't flag the
  // impure Date.now() call inside the period-filter memo.
  const [nowSec] = useState(() => Math.floor(Date.now() / 1000))
  const filtered = useMemo(() => {
    if (period === 'all') return data
    const days = PERIODS.find((p) => p.key === period)!.days
    const cutoff = nowSec - days * 86400
    return data.filter((p) => p.endTime >= cutoff)
  }, [data, period, nowSec])

  const stats = useMemo(() => {
    if (filtered.length === 0) return null
    const amounts = filtered.map((p) => p.ethAmount)
    const sum = amounts.reduce((a, b) => a + b, 0)
    return {
      max: Math.max(...amounts),
      avg: sum / amounts.length,
      total: sum,
      count: filtered.length,
    }
  }, [filtered])

  return (
    <div className="rounded-xl border border-border bg-surface px-5 py-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-fg">
            Auction history
          </div>
          <h2 className="text-lg font-bold tracking-tight">Winning bids over time</h2>
        </div>
        <div className="flex items-center gap-1 rounded-full border border-border bg-surface-2 p-0.5">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => setPeriod(p.key)}
              className={
                period === p.key
                  ? 'rounded-full bg-fg px-2.5 py-1 text-[11px] font-semibold text-bg'
                  : 'rounded-full px-2.5 py-1 text-[11px] font-medium text-muted-fg hover:text-fg'
              }
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {stats && (
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Auctions" value={stats.count.toString()} />
          <Stat label="Highest" value={`${trim(stats.max, 4)} ETH`} />
          <Stat label="Average" value={`${trim(stats.avg, 4)} ETH`} />
          <Stat label="Total" value={`${trim(stats.total, 2)} ETH`} />
        </div>
      )}

      {filtered.length < 2 ? (
        <div className="flex h-[240px] items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-fg">
          {data.length === 0
            ? 'No settled auctions yet.'
            : 'Not enough data in the selected period.'}
        </div>
      ) : (
        <Chart
          points={filtered}
          hoverIndex={hoverIndex}
          onHover={setHoverIndex}
          onLeave={() => setHoverIndex(null)}
        />
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-muted-fg">{label}</div>
      <div className="mt-0.5 text-sm font-bold text-fg">{value}</div>
    </div>
  )
}

function Chart({
  points,
  hoverIndex,
  onHover,
  onLeave,
}: {
  points: AuctionPricePoint[]
  hoverIndex: number | null
  onHover: (i: number) => void
  onLeave: () => void
}) {
  const innerW = WIDTH - PAD_X * 2
  const innerH = HEIGHT - PAD_Y * 2
  const maxAmount = Math.max(...points.map((p) => p.ethAmount), 0.0001)

  const xy = (i: number, amt: number) => {
    const x =
      points.length === 1
        ? innerW / 2 + PAD_X
        : PAD_X + (i / (points.length - 1)) * innerW
    const y = PAD_Y + innerH - (amt / maxAmount) * innerH
    return { x, y }
  }

  const linePoints = points.map((p, i) => {
    const { x, y } = xy(i, p.ethAmount)
    return `${x.toFixed(2)},${y.toFixed(2)}`
  })

  const areaPath = (() => {
    if (points.length < 2) return ''
    const first = xy(0, points[0].ethAmount)
    const last = xy(points.length - 1, points[points.length - 1].ethAmount)
    return `M ${first.x.toFixed(2)},${(PAD_Y + innerH).toFixed(2)} L ${linePoints.join(
      ' L '
    )} L ${last.x.toFixed(2)},${(PAD_Y + innerH).toFixed(2)} Z`
  })()

  const active = hoverIndex != null ? points[hoverIndex] : null
  const activeXY = active ? xy(hoverIndex!, active.ethAmount) : null

  const handleMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const svg = e.currentTarget
    const rect = svg.getBoundingClientRect()
    const xRatio = (e.clientX - rect.left) / rect.width
    const xInChart = xRatio * WIDTH - PAD_X
    const idx = Math.max(
      0,
      Math.min(points.length - 1, Math.round((xInChart / innerW) * (points.length - 1)))
    )
    onHover(idx)
  }

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="h-[240px] w-full touch-none"
        onPointerMove={handleMove}
        onPointerLeave={onLeave}
      >
        <defs>
          <linearGradient id="auctionFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.25" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* horizontal grid lines (quartiles) */}
        {[0, 0.25, 0.5, 0.75, 1].map((t) => {
          const y = PAD_Y + innerH - t * innerH
          return (
            <line
              key={t}
              x1={PAD_X}
              x2={WIDTH - PAD_X}
              y1={y}
              y2={y}
              stroke="var(--border)"
              strokeDasharray={t === 0 || t === 1 ? '' : '3 4'}
              strokeWidth={0.5}
            />
          )
        })}

        {areaPath && <path d={areaPath} fill="url(#auctionFill)" />}

        <polyline
          points={linePoints.join(' ')}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={1.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* hover indicators */}
        {activeXY && (
          <>
            <line
              x1={activeXY.x}
              x2={activeXY.x}
              y1={PAD_Y}
              y2={PAD_Y + innerH}
              stroke="var(--fg)"
              strokeWidth={0.5}
              opacity={0.4}
            />
            <circle
              cx={activeXY.x}
              cy={activeXY.y}
              r={4}
              fill="var(--accent)"
              stroke="var(--bg)"
              strokeWidth={2}
            />
          </>
        )}
      </svg>

      {active && activeXY && (
        <HoverCard
          point={active}
          xPct={(activeXY.x / WIDTH) * 100}
          alignRight={activeXY.x > WIDTH * 0.65}
        />
      )}
    </div>
  )
}

function HoverCard({
  point,
  xPct,
  alignRight,
}: {
  point: AuctionPricePoint
  xPct: number
  alignRight: boolean
}) {
  const date = new Date(point.endTime * 1000).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
  return (
    <div
      className="pointer-events-auto absolute top-2 z-10 -translate-x-1/2 rounded-md border border-border bg-surface px-3 py-2 shadow-md"
      style={{
        left: `${xPct}%`,
        transform: alignRight ? 'translateX(-100%)' : 'translateX(-50%)',
      }}
    >
      <div className="text-[11px] uppercase tracking-wider text-muted-fg">{date}</div>
      <div className="text-sm font-bold text-fg">{trim(point.ethAmount, 4)} ETH</div>
      <Link
        href={`/auction/${point.tokenId}`}
        className="text-[11px] font-medium text-accent-strong hover:underline"
      >
        {daoConfig.name.split(' ')[0]} #{point.tokenId} →
      </Link>
    </div>
  )
}

function trim(n: number, max: number): string {
  if (!Number.isFinite(n)) return '0'
  const fixed = n.toFixed(max)
  return fixed.replace(/\.?0+$/, '') || '0'
}
