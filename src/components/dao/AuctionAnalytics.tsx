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

/**
 * DAO-wide auction analytics. A single period toggle drives the headline
 * stat row plus two charts that share the same filtered window: winning bids
 * per auction and the cumulative ETH raised over that window.
 */
export function AuctionAnalytics({ data }: { data: AuctionPricePoint[] }) {
  const [period, setPeriod] = useState<PeriodKey>('all')

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

  // Running total of winning bids across the filtered window (oldest → newest).
  const cumulative = useMemo(
    () =>
      filtered.reduce<number[]>((acc, p) => {
        acc.push((acc[acc.length - 1] ?? 0) + p.ethAmount)
        return acc
      }, []),
    [filtered]
  )

  return (
    <div className="rounded-xl border border-border bg-surface px-6 py-[22px]">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-fg">
            All auctions
          </div>
          <h2 className="text-xl font-bold tracking-tight">Auction analytics</h2>
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
        <div className="mb-5 grid grid-cols-2 gap-3 border-b border-border pb-5 sm:grid-cols-4">
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
        <div className="grid gap-6 lg:grid-cols-2">
          <ChartBlock title="Winning bids over time">
            <PriceLineChart points={filtered} />
          </ChartBlock>
          <ChartBlock title="Cumulative revenue">
            <CumulativeAreaChart points={filtered} cumulative={cumulative} />
          </ChartBlock>
        </div>
      )}
    </div>
  )
}

function ChartBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 text-[12.5px] font-semibold text-muted-fg">{title}</div>
      {children}
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

function PriceLineChart({ points }: { points: AuctionPricePoint[] }) {
  return (
    <LineAreaChart
      ys={points.map((p) => p.ethAmount)}
      gradientId="auctionFill"
      renderContent={(i) => {
        const p = points[i]
        return (
          <>
            <div className="text-[11px] uppercase tracking-wider text-muted-fg">
              {formatDate(p.endTime)}
            </div>
            <div className="text-sm font-bold text-fg">{trim(p.ethAmount, 4)} ETH</div>
            <Link
              href={`/auction/${p.tokenId}`}
              className="text-[11px] font-medium text-accent-strong hover:underline"
            >
              {daoConfig.name.split(' ')[0]} #{p.tokenId} →
            </Link>
          </>
        )
      }}
    />
  )
}

function CumulativeAreaChart({
  points,
  cumulative,
}: {
  points: AuctionPricePoint[]
  cumulative: number[]
}) {
  return (
    <LineAreaChart
      ys={cumulative}
      gradientId="cumulativeFill"
      renderContent={(i) => (
        <>
          <div className="text-[11px] uppercase tracking-wider text-muted-fg">
            {formatDate(points[i].endTime)}
          </div>
          <div className="text-sm font-bold text-fg">{trim(cumulative[i], 2)} ETH</div>
          <div className="text-[11px] font-medium text-muted-fg">total raised</div>
        </>
      )}
    />
  )
}

/**
 * Shared SVG line+area chart. Scales the `ys` series to the viewBox, draws
 * quartile gridlines, and surfaces a positioned hover card whose contents are
 * supplied by the caller via `renderContent`.
 */
function LineAreaChart({
  ys,
  gradientId,
  renderContent,
}: {
  ys: number[]
  gradientId: string
  renderContent: (index: number) => React.ReactNode
}) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)
  const innerW = WIDTH - PAD_X * 2
  const innerH = HEIGHT - PAD_Y * 2
  const maxAmount = Math.max(...ys, 0.0001)

  const xy = (i: number, amt: number) => {
    const x =
      ys.length === 1 ? innerW / 2 + PAD_X : PAD_X + (i / (ys.length - 1)) * innerW
    const y = PAD_Y + innerH - (amt / maxAmount) * innerH
    return { x, y }
  }

  const linePoints = ys.map((amt, i) => {
    const { x, y } = xy(i, amt)
    return `${x.toFixed(2)},${y.toFixed(2)}`
  })

  const areaPath = (() => {
    if (ys.length < 2) return ''
    const first = xy(0, ys[0])
    const last = xy(ys.length - 1, ys[ys.length - 1])
    return `M ${first.x.toFixed(2)},${(PAD_Y + innerH).toFixed(2)} L ${linePoints.join(
      ' L '
    )} L ${last.x.toFixed(2)},${(PAD_Y + innerH).toFixed(2)} Z`
  })()

  const activeXY = hoverIndex != null ? xy(hoverIndex, ys[hoverIndex]) : null

  const handleMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const xRatio = (e.clientX - rect.left) / rect.width
    const xInChart = xRatio * WIDTH - PAD_X
    const idx = Math.max(
      0,
      Math.min(ys.length - 1, Math.round((xInChart / innerW) * (ys.length - 1)))
    )
    setHoverIndex(idx)
  }

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="h-[240px] w-full touch-none"
        onPointerMove={handleMove}
        onPointerLeave={() => setHoverIndex(null)}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
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

        {areaPath && <path d={areaPath} fill={`url(#${gradientId})`} />}

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

      {hoverIndex != null && activeXY && (
        <div
          className="pointer-events-auto absolute top-2 z-10 rounded-md border border-border bg-surface px-3 py-2 shadow-md"
          style={{
            left: `${(activeXY.x / WIDTH) * 100}%`,
            transform:
              activeXY.x > WIDTH * 0.65 ? 'translateX(-100%)' : 'translateX(-50%)',
          }}
        >
          {renderContent(hoverIndex)}
        </div>
      )}
    </div>
  )
}

function formatDate(unixSec: number): string {
  return new Date(unixSec * 1000).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function trim(n: number, max: number): string {
  if (!Number.isFinite(n)) return '0'
  const fixed = n.toFixed(max)
  return fixed.replace(/\.?0+$/, '') || '0'
}
