'use client'

import { type ClankerTokenCardFragment } from '@buildeross/sdk/subgraph'
import { Image as ImageIcon } from 'lucide-react'
import Link from 'next/link'

import { cn, resolveIpfs } from '@/lib/utils'

type Props = {
  coin: ClankerTokenCardFragment
  className?: string
}

export function CoinCard({ coin, className }: Props) {
  const image = coin.tokenImage ? resolveIpfs(coin.tokenImage) : null

  return (
    <Link
      href={`/coins/${coin.tokenAddress}`}
      className={cn(
        'group flex flex-col overflow-hidden rounded-xl border border-border bg-surface transition-colors hover:border-accent/60',
        className
      )}
    >
      <div className="relative aspect-square w-full bg-surface-2">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image}
            alt={coin.tokenName ?? 'Coin image'}
            className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted-fg">
            <ImageIcon className="h-9 w-9" />
          </div>
        )}
      </div>
      <div className="flex flex-col gap-0.5 px-4 py-3">
        <div className="truncate text-sm font-bold">
          {coin.tokenName ?? 'Untitled coin'}
        </div>
        <div className="text-[12px] font-mono text-muted-fg">
          {coin.tokenSymbol ? `$${coin.tokenSymbol}` : ''}
        </div>
      </div>
    </Link>
  )
}
