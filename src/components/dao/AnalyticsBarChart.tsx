'use client'

import {
  Bar,
  BarChart as RechartsBarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  type TooltipProps,
  XAxis,
  YAxis,
} from 'recharts'

type Datum = { label: string; value: number }

type Props = {
  data: Datum[]
  /** Display unit shown in tooltip + Y-axis ticks (e.g. "ETH"). */
  valueSuffix?: string
  /** Format y-axis ticks; defaults to a compact integer. */
  formatTick?: (n: number) => string
  /** Override bar fill (CSS color or var). Defaults to --accent. */
  color?: string
  /** Chart height in px. Defaults to 180. */
  height?: number
  /** Decimal places to show in tooltip values. Defaults to 2. */
  precision?: number
}

/**
 * Treasury-grade bar chart with axes + tooltip + gridlines.
 *
 * Server components pass typed data; this client wrapper renders Recharts
 * with the DAO's theme tokens threaded through (--accent, --border,
 * --muted-fg). Per the design brief (Upstream Batch 2), this lives in the
 * template until a `@buildeross/treasury-analytics` package extracts it.
 */
export function AnalyticsBarChart({
  data,
  valueSuffix = '',
  formatTick,
  color = 'var(--accent)',
  height = 180,
  precision = 2,
}: Props) {
  const allZero = data.every((d) => d.value === 0)

  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <RechartsBarChart
          data={data}
          margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--border)"
            vertical={false}
          />
          <XAxis
            dataKey="label"
            stroke="var(--muted-fg)"
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: 'var(--border)' }}
          />
          <YAxis
            stroke="var(--muted-fg)"
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: 'var(--border)' }}
            tickFormatter={formatTick ?? ((n) => formatCompact(n))}
            width={36}
          />
          <Tooltip
            cursor={{ fill: 'var(--surface-2)' }}
            content={(props: TooltipProps<number, string>) => (
              <ChartTooltip
                {...props}
                valueSuffix={valueSuffix}
                precision={precision}
              />
            )}
          />
          <Bar
            dataKey="value"
            fill={color}
            radius={[3, 3, 0, 0]}
            // Hide bars when there's nothing to show; Recharts otherwise
            // renders a flat line at zero which reads as "missing data".
            hide={allZero}
          />
        </RechartsBarChart>
      </ResponsiveContainer>
      {allZero && (
        <div className="-mt-[180px] flex h-full items-center justify-center text-[12.5px] text-muted-fg">
          No activity yet.
        </div>
      )}
    </div>
  )
}

type ChartTooltipProps = TooltipProps<number, string> & {
  valueSuffix: string
  precision: number
}

function ChartTooltip({
  active,
  payload,
  label,
  valueSuffix,
  precision,
}: ChartTooltipProps) {
  if (!active || !payload?.length) return null
  const raw = payload[0].value
  const v = typeof raw === 'number' ? raw : Number(raw ?? 0)
  return (
    <div className="rounded-md border border-border bg-surface px-3 py-2 text-xs shadow-lg">
      <div className="text-muted-fg">{label}</div>
      <div className="font-semibold text-fg">
        {v.toLocaleString('en-US', {
          minimumFractionDigits: 0,
          maximumFractionDigits: precision,
        })}
        {valueSuffix && (
          <span className="ml-1 font-normal text-muted-fg">{valueSuffix}</span>
        )}
      </div>
    </div>
  )
}

function formatCompact(n: number): string {
  if (n === 0) return '0'
  if (Math.abs(n) >= 1000)
    return `${(n / 1000).toLocaleString('en-US', { maximumFractionDigits: 1 })}k`
  if (Math.abs(n) >= 1) return n.toLocaleString('en-US', { maximumFractionDigits: 1 })
  return n.toLocaleString('en-US', { maximumFractionDigits: 2 })
}
