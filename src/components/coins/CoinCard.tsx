'use client'

import { fetchIpfsMetadata } from '@buildeross/ipfs-service'
import { type ZoraCoinCardFragment } from '@buildeross/sdk/subgraph'
import { Image as ImageIcon } from 'lucide-react'
import Link from 'next/link'
import useSWR from 'swr'

import { cn, resolveIpfs } from '@/lib/utils'

type Props = {
  coin: ZoraCoinCardFragment
  className?: string
}

export function CoinCard({ coin, className }: Props) {
  // Zora coins don't store the image on the card fragment — it lives inside
  // the IPFS metadata JSON pointed to by `uri`. We fetch lazily and SWR-cache
  // per coin so a list re-render doesn't refetch.
  const { data: metadata } = useSWR(
    coin.uri ? (['zora-coin-metadata', coin.uri] as const) : null,
    async ([, uri]) => fetchIpfsMetadata(uri)
  )

  const rawImage = metadata?.image ?? metadata?.imageUrl ?? null
  const image = rawImage ? resolveIpfs(rawImage) : null

  return (
    <Link
      href={`/coins/${coin.coinAddress}`}
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
            alt={coin.name ?? 'Coin image'}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted-fg">
            <ImageIcon className="h-9 w-9" />
          </div>
        )}
      </div>
      <div className="flex flex-col gap-0.5 px-4 py-3">
        <div className="truncate text-sm font-bold" title={coin.name ?? undefined}>
          {coin.name ?? 'Untitled coin'}
        </div>
        <div
          className="truncate font-mono text-[12px] text-muted-fg"
          title={coin.symbol ? `$${coin.symbol}` : undefined}
        >
          {coin.symbol ? `$${coin.symbol}` : ''}
        </div>
      </div>
    </Link>
  )
}
