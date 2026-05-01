import { cn } from '@/lib/utils'

type Props = {
  forV: number
  against: number
  abstain: number
  quorum: number
  height?: number
  showLabels?: boolean
  className?: string
}

export function VoteBar({
  forV,
  against,
  abstain,
  quorum,
  height = 8,
  showLabels = false,
  className,
}: Props) {
  const total = Math.max(1, forV + against + abstain)
  const fp = (forV / total) * 100
  const ap = (against / total) * 100
  const bp = (abstain / total) * 100
  const quorumPct = Math.min(100, (quorum / total) * 100)
  const empty = forV + against + abstain === 0

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <div
        className="relative flex w-full overflow-hidden rounded-full bg-surface-2"
        style={{ height }}
      >
        {empty ? (
          <div className="w-full bg-surface-2" />
        ) : (
          <>
            <div
              className="bg-vote-for transition-[width] duration-300"
              style={{ width: `${fp}%` }}
            />
            <div
              className="bg-vote-against transition-[width] duration-300"
              style={{ width: `${ap}%` }}
            />
            <div
              className="bg-vote-abstain transition-[width] duration-300"
              style={{ width: `${bp}%` }}
            />
            {quorum > 0 && (
              <div
                className="absolute -bottom-0.5 -top-0.5 w-0.5 bg-fg"
                style={{ left: `${quorumPct}%` }}
                title={`Quorum: ${quorum}`}
              />
            )}
          </>
        )}
      </div>
      {showLabels && (
        <div className="flex flex-wrap gap-4 text-xs text-muted-fg">
          <span className="inline-flex items-center gap-1.5">
            <i className="inline-block h-2 w-2 rounded-sm bg-vote-for" />
            {forV} For
          </span>
          <span className="inline-flex items-center gap-1.5">
            <i className="inline-block h-2 w-2 rounded-sm bg-vote-against" />
            {against} Against
          </span>
          <span className="inline-flex items-center gap-1.5">
            <i className="inline-block h-2 w-2 rounded-sm bg-vote-abstain" />
            {abstain} Abstain
          </span>
        </div>
      )}
    </div>
  )
}
