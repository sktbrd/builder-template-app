import { cn } from '@/lib/utils'

type Props = {
  palette?: [string, string, string]
  className?: string
}

export function AuctionArt({
  palette = ['#ff4d4d', '#000000', '#ffffff'],
  className,
}: Props) {
  const [c1, c2, c3] = palette
  return (
    <div
      className={cn('flex h-full w-full items-center justify-center', className)}
      style={{ background: c1 }}
    >
      <svg viewBox="0 0 200 200" className="h-full w-full" aria-hidden>
        {/* sun burst */}
        <g transform="translate(40,40)">
          {Array.from({ length: 8 }).map((_, i) => (
            <rect
              key={i}
              x="14"
              y="-2"
              width="3"
              height="14"
              fill={c3}
              transform={`rotate(${i * 45} 15 15)`}
            />
          ))}
          <circle cx="15" cy="15" r="6" fill={c2} />
        </g>
        {/* hex */}
        <polygon points="120,20 145,35 145,60 120,75 95,60 95,35" fill={c2} />
        {/* dotted circle */}
        <g transform="translate(155,40)">
          {Array.from({ length: 12 }).map((_, i) => {
            const angle = (i / 12) * Math.PI * 2
            // Round trig output: Math.cos/sin aren't spec-required to be
            // correctly rounded, so server (Node) and client can differ in the
            // last bits and trip a hydration mismatch on these attributes.
            const cx = Math.round((Math.cos(angle) * 14 + 14) * 1000) / 1000
            const cy = Math.round((Math.sin(angle) * 14 + 14) * 1000) / 1000
            return <circle key={i} cx={cx} cy={cy} r="2" fill={c3} />
          })}
        </g>
        {/* arch trio */}
        <g transform="translate(70,90)">
          <path
            d="M0,40 L0,15 Q0,0 12,0 Q24,0 24,15 L24,40 M16,40 L16,15 Q16,8 12,8 Q8,8 8,15 L8,40"
            fill={c2}
          />
          <rect x="30" y="0" width="10" height="40" fill={c2} />
          <path d="M50,40 L50,15 Q50,0 62,0 Q74,0 74,15 L74,40" fill={c2} />
        </g>
        {/* asterisk */}
        <g
          transform="translate(95,150)"
          stroke={c2}
          strokeWidth="6"
          strokeLinecap="round"
        >
          <line x1="-12" y1="0" x2="12" y2="0" />
          <line x1="0" y1="-12" x2="0" y2="12" />
          <line x1="-9" y1="-9" x2="9" y2="9" />
          <line x1="-9" y1="9" x2="9" y2="-9" />
        </g>
        {/* squiggles */}
        <path
          d="M 10 130 Q 30 110 50 130 T 90 130"
          stroke={c3}
          strokeWidth="4"
          fill="none"
        />
        <path d="M 140 170 Q 160 150 180 170" stroke={c3} strokeWidth="4" fill="none" />
      </svg>
    </div>
  )
}
