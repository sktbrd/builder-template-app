type Props = {
  data: number[]
  color?: string
  labels?: string[]
  height?: number
  className?: string
}

export function BarChart({
  data,
  color = 'var(--accent)',
  labels,
  height = 120,
  className,
}: Props) {
  const max = Math.max(...data, 1)
  const w = 100 / data.length
  return (
    <svg
      viewBox={`0 0 100 ${height}`}
      preserveAspectRatio="none"
      style={{ height }}
      className={className}
      role="img"
      aria-label="Bar chart"
    >
      {data.map((v, i) => {
        const h = (v / max) * (height - 20)
        return (
          <rect
            key={i}
            x={i * w + 1}
            y={height - 14 - h}
            width={w - 2}
            height={h}
            fill={color}
            rx="1"
          />
        )
      })}
      {labels?.map((l, i) => (
        <text
          key={i}
          x={i * w + w / 2}
          y={height - 2}
          textAnchor="middle"
          fontSize="5"
          fill="var(--muted-fg)"
        >
          {l}
        </text>
      ))}
    </svg>
  )
}
