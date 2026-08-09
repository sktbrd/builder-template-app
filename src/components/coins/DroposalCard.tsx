'use client'

import { Image as ImageIcon } from 'lucide-react'
import Link from 'next/link'

import { type DroposalListItem } from '@/lib/droposals'
import { cn } from '@/lib/utils'

type Props = {
  item: DroposalListItem
  className?: string
}

const STATUS_LABELS: Record<DroposalListItem['status'], string> = {
  executed: 'Executed',
  queued: 'Queued',
  active: 'Active',
  pending: 'Pending',
  defeated: 'Defeated',
  canceled: 'Canceled',
  vetoed: 'Vetoed',
  expired: 'Expired',
}

function priceLabel(priceEth: string): string {
  return priceEth === '0' || priceEth === '0.0' ? 'Free' : `${priceEth} ETH`
}

export function DroposalCard({ item, className }: Props) {
  // The drop image is already resolved to an http(s) URL in the data layer
  // (decoded.imageURI -> resolveIpfs), so no IPFS metadata SWR fetch is needed.
  const image = item.image ?? null

  return (
    <Link
      href={`/droposals/${item.proposalNumber}`}
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
            alt={item.name || item.title}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted-fg">
            <ImageIcon className="h-9 w-9" />
          </div>
        )}
        <span className="absolute left-2 top-2 rounded-full bg-surface-3 px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wider text-muted-fg">
          {STATUS_LABELS[item.status]}
        </span>
      </div>
      <div className="flex flex-col gap-0.5 px-4 py-3">
        <div className="truncate text-sm font-bold" title={item.name || item.title}>
          {item.name || item.title}
        </div>
        <div className="flex items-center justify-between gap-2">
          <span
            className="truncate font-mono text-[12px] text-muted-fg"
            title={item.symbol ? `$${item.symbol}` : undefined}
          >
            {item.symbol ? `$${item.symbol}` : ''}
          </span>
          <span className="shrink-0 text-[12px] font-semibold text-fg">
            {priceLabel(item.priceEth)}
          </span>
        </div>
      </div>
    </Link>
  )
}
