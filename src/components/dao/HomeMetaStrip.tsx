import { formatEth } from '@/lib/utils'

type Props = {
  totalSupply: number
  ownerCount: number
  treasuryEth: string
  totalAuctionSalesEth: string
  /** Optional — hides when 0 to avoid noise on quiet DAOs. */
  activeProposalCount?: number
}

export function HomeMetaStrip({
  totalSupply,
  ownerCount,
  treasuryEth,
  totalAuctionSalesEth,
  activeProposalCount = 0,
}: Props) {
  const stats: Array<{ label: string; value: string; tone?: 'accent' }> = [
    { label: 'Minted', value: totalSupply.toLocaleString('en-US') },
    { label: 'Holders', value: ownerCount.toLocaleString('en-US') },
    { label: 'Treasury', value: `${formatEth(treasuryEth)} ETH` },
    { label: 'Total sales', value: `${formatEth(totalAuctionSalesEth)} ETH` },
  ]
  if (activeProposalCount > 0) {
    stats.push({
      label: 'Active props',
      value: activeProposalCount.toLocaleString('en-US'),
      tone: 'accent',
    })
  }

  // Full-bleed band with the content constrained to the same max-w-[1180px]
  // grid as the hero above it — stats distribute across the hero's width
  // instead of clustering left with a dead right half.
  return (
    <div className="relative left-1/2 w-screen -translate-x-1/2 border-y border-border">
      <div className="mx-auto flex w-full max-w-[1180px] flex-wrap items-baseline justify-between gap-x-6 gap-y-1.5 px-6 py-3 md:px-8">
        {stats.map((s) => (
          <div key={s.label} className="flex items-baseline gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-fg">
              {s.label}
            </span>
            <span
              className={
                s.tone === 'accent'
                  ? 'text-[15px] font-bold tabular-nums text-accent-strong'
                  : 'text-[15px] font-bold tabular-nums text-fg'
              }
            >
              {s.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
