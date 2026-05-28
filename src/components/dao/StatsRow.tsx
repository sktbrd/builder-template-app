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
    <div className="grid grid-cols-2 gap-y-3 rounded-xl border border-border bg-surface px-5 py-3.5 sm:grid-cols-4 sm:divide-x sm:divide-border">
      {stats.map((s) => (
        <div key={s.label} className="flex items-center justify-center gap-2 sm:px-4">
          <span className="text-muted-fg">{s.icon}</span>
          <span className="text-[14px] font-bold text-fg">{s.value}</span>
          <span className="text-[13px] text-muted-fg">{s.label}</span>
        </div>
      ))}
    </div>
  )
}
