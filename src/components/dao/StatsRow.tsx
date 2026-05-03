import { Diamond, Gavel, TrendingUp, Users } from 'lucide-react'

import { formatEth } from '@/lib/utils'

type Props = {
  totalSupply: number
  ownerCount: number
  treasuryEth: string
  totalAuctionSalesEth: string
}

export function StatsRow({
  totalSupply,
  ownerCount,
  treasuryEth,
  totalAuctionSalesEth,
}: Props) {
  const stats = [
    {
      icon: <Gavel className="h-3.5 w-3.5" />,
      value: totalSupply.toLocaleString('en-US'),
      label: 'Minted',
    },
    {
      icon: <Users className="h-3.5 w-3.5" />,
      value: ownerCount.toLocaleString('en-US'),
      label: 'Holders',
    },
    {
      icon: <Diamond className="h-3.5 w-3.5" />,
      value: `${formatEth(treasuryEth)} ETH`,
      label: 'Treasury',
    },
    {
      icon: <TrendingUp className="h-3.5 w-3.5" />,
      value: `${formatEth(totalAuctionSalesEth)} ETH`,
      label: 'Total sales',
    },
  ]

  return (
    <div className="flex flex-wrap items-center justify-center gap-x-0 gap-y-2 rounded-xl border border-border bg-surface px-5 py-3.5">
      {stats.map((s, i) => (
        <div key={s.label} className="flex items-center">
          {i > 0 && <span className="mx-4 h-4 w-px shrink-0 bg-border" />}
          <div className="flex items-center gap-2">
            <span className="text-muted-fg">{s.icon}</span>
            <span className="text-[14px] font-bold text-fg">{s.value}</span>
            <span className="text-[13px] text-muted-fg">{s.label}</span>
          </div>
        </div>
      ))}
    </div>
  )
}
