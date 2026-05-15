'use client'

import { useFeed } from '@buildeross/hooks'
import { FeedEventType } from '@buildeross/sdk/subgraph'
import type { FeedItem } from '@buildeross/types'
import { Loader2 } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import { formatEther, isAddressEqual, zeroAddress } from 'viem'

import { ActorIdentity } from '@/components/feed/ActorIdentity'
import {
  EventTypeChip,
  QuoteBlock,
  VoteSupportBadge,
  type EventCategory,
} from '@/components/feed/primitives'
import { daoConfig } from '@/lib/dao.config'
import { cn, resolveIpfs } from '@/lib/utils'

const ALL_EVENT_TYPES = Object.values(FeedEventType)

type CategoryKey = 'all' | 'proposals' | 'auctions' | 'coins'

const CATEGORY_TO_EVENT_TYPES: Record<CategoryKey, FeedEventType[] | undefined> = {
  all: undefined,
  proposals: [
    FeedEventType.ProposalCreated,
    FeedEventType.ProposalVoted,
    FeedEventType.ProposalUpdated,
    FeedEventType.ProposalExecuted,
  ],
  auctions: [
    FeedEventType.AuctionCreated,
    FeedEventType.AuctionBidPlaced,
    FeedEventType.AuctionSettled,
  ],
  coins: [
    FeedEventType.ClankerTokenCreated,
    FeedEventType.ZoraCoinCreated,
    FeedEventType.ZoraDropCreated,
  ],
}

const FILTERS: { key: CategoryKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'proposals', label: 'Proposals' },
  { key: 'auctions', label: 'Auctions' },
  { key: 'coins', label: 'Coins' },
]

export function FeedView() {
  const [category, setCategory] = useState<CategoryKey>('all')

  const eventTypes = CATEGORY_TO_EVENT_TYPES[category] ?? ALL_EVENT_TYPES

  const { items, hasMore, isLoading, isLoadingMore, error, fetchNextPage } = useFeed({
    chainIds: [daoConfig.chainId],
    daos: [daoConfig.addresses.token],
    eventTypes,
    limit: 20,
  })

  const sentinelRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const node = sentinelRef.current
    if (!node) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasMore && !isLoadingMore) {
          void fetchNextPage()
        }
      },
      { rootMargin: '300px' }
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [hasMore, isLoadingMore, fetchNextPage])

  const grouped = useMemo(() => groupByDay(items), [items])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-[clamp(36px,5vw,56px)] font-extrabold leading-[1.04] tracking-[-0.025em]">
            Feed
          </h1>
          <p className="mt-1 text-muted-fg">
            Real-time activity from {daoConfig.name}.
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setCategory(f.key)}
              className={cn(
                'rounded-md px-3 py-1.5 text-xs font-semibold transition-colors',
                category === f.key
                  ? 'bg-surface-2 text-fg'
                  : 'text-muted-fg hover:bg-surface-2 hover:text-fg'
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <FeedSkeleton />
      ) : error ? (
        <div className="rounded-md border border-dashed border-border bg-surface-2 px-4 py-8 text-center text-sm text-muted-fg">
          Couldn&apos;t load the feed. Try again in a moment.
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-md border border-dashed border-border bg-surface-2 px-4 py-12 text-center text-sm text-muted-fg">
          No activity in this category yet.
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {grouped.map((group) => (
            <section key={group.dayKey} className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <h2
                  className="text-xs font-semibold uppercase tracking-wider text-muted-fg"
                  suppressHydrationWarning
                >
                  {group.label}
                </h2>
                <span className="h-px flex-1 bg-border" />
              </div>
              <ul className="flex flex-col gap-3">
                {group.items.map((item) => (
                  <li key={item.id}>
                    <FeedCard item={item} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
          <div ref={sentinelRef} className="h-8" />
          {isLoadingMore && (
            <div className="flex items-center justify-center py-4 text-muted-fg">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Card wrapper ──────────────────────────────────────────────

function Card({
  actor,
  time,
  category,
  children,
}: {
  /** Omit for events with no meaningful actor (e.g. auctions settled with no bid). */
  actor?: React.ReactNode
  time: string
  category: EventCategory
  children: React.ReactNode
}) {
  return (
    <article className="rounded-xl border border-border bg-surface px-4 py-3 transition-colors hover:border-border-strong">
      <header className="mb-2 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2 truncate">
          {actor}
          <span className="text-xs text-muted-fg" suppressHydrationWarning>
            {actor ? '· ' : ''}
            {time}
          </span>
        </div>
        <EventTypeChip category={category} />
      </header>
      <div>{children}</div>
    </article>
  )
}

// ── Per-item renderer ─────────────────────────────────────────

function FeedCard({ item }: { item: FeedItem }) {
  const time = relativeTimeAgo(item.timestamp * 1000)

  switch (item.type) {
    case 'AUCTION_BID_PLACED':
      return (
        <Card
          actor={<ActorIdentity address={item.bidder} />}
          time={time}
          category="auction-bid"
        >
          <BodyWithThumb image={item.tokenImage} name={item.tokenName}>
            <p className="text-sm leading-snug text-muted-fg">
              bid{' '}
              <strong className="text-fg">{formatBidEth(item.amount)} ETH</strong> on{' '}
              <Link
                href={`/auction/${item.tokenId}`}
                className="font-semibold text-fg hover:text-accent-strong"
              >
                {item.tokenName || `#${item.tokenId}`}
              </Link>
            </p>
            {item.bidComment ? <QuoteBlock>{item.bidComment}</QuoteBlock> : null}
          </BodyWithThumb>
        </Card>
      )

    case 'AUCTION_CREATED':
      return (
        <Card
          actor={<ActorIdentity address={item.actor} />}
          time={time}
          category="auction"
        >
          <BodyWithThumb image={item.tokenImage} name={item.tokenName}>
            <p className="text-sm leading-snug text-muted-fg">
              auction started for{' '}
              <Link
                href={`/auction/${item.tokenId}`}
                className="font-semibold text-fg hover:text-accent-strong"
              >
                {item.tokenName || `#${item.tokenId}`}
              </Link>
            </p>
          </BodyWithThumb>
        </Card>
      )

    case 'AUCTION_SETTLED': {
      const noBids =
        isAddressEqual(item.winner, zeroAddress) ||
        BigInt(item.amount || '0') === BigInt(0)
      return (
        <Card
          actor={noBids ? undefined : <ActorIdentity address={item.winner} />}
          time={time}
          category="auction-settled"
        >
          <BodyWithThumb image={item.tokenImage} name={item.tokenName}>
            {noBids ? (
              <p className="text-sm leading-snug text-muted-fg">
                <Link
                  href={`/auction/${item.tokenId}`}
                  className="font-semibold text-fg hover:text-accent-strong"
                >
                  {item.tokenName || `#${item.tokenId}`}
                </Link>{' '}
                settled with no bids
              </p>
            ) : (
              <p className="text-sm leading-snug text-muted-fg">
                won{' '}
                <Link
                  href={`/auction/${item.tokenId}`}
                  className="font-semibold text-fg hover:text-accent-strong"
                >
                  {item.tokenName || `#${item.tokenId}`}
                </Link>{' '}
                for <strong className="text-fg">{formatBidEth(item.amount)} ETH</strong>
              </p>
            )}
          </BodyWithThumb>
        </Card>
      )
    }

    case 'PROPOSAL_CREATED':
      return (
        <Card
          actor={<ActorIdentity address={item.proposer} />}
          time={time}
          category="proposal"
        >
          <p className="text-sm leading-snug text-muted-fg">
            created{' '}
            <Link
              href={`/proposals/${item.proposalNumber}`}
              className="font-semibold text-fg hover:text-accent-strong"
            >
              #{item.proposalNumber} {item.proposalTitle}
            </Link>
          </p>
        </Card>
      )

    case 'PROPOSAL_VOTED':
      return (
        <Card
          actor={<ActorIdentity address={item.voter} />}
          time={time}
          category="vote"
        >
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <VoteSupportBadge support={item.support} />
              <span className="text-sm text-muted-fg">on</span>
              <Link
                href={`/proposals/${item.proposalNumber}`}
                className="text-sm font-semibold text-fg hover:text-accent-strong"
              >
                #{item.proposalNumber} {item.proposalTitle}
              </Link>
              {item.weight ? (
                <span className="text-xs text-muted-fg">
                  · {formatVoteWeight(item.weight)}{' '}
                  {Number(item.weight) === 1 ? 'vote' : 'votes'}
                </span>
              ) : null}
            </div>
            {item.reason ? <QuoteBlock>{item.reason}</QuoteBlock> : null}
          </div>
        </Card>
      )

    case 'PROPOSAL_UPDATED':
      return (
        <Card
          actor={<ActorIdentity address={item.proposer} />}
          time={time}
          category="proposal"
        >
          <p className="text-sm leading-snug text-muted-fg">
            posted an update on{' '}
            <Link
              href={`/proposals/${item.proposalNumber}`}
              className="font-semibold text-fg hover:text-accent-strong"
            >
              #{item.proposalNumber} {item.proposalTitle}
            </Link>
          </p>
          {item.message ? <QuoteBlock>{item.message}</QuoteBlock> : null}
        </Card>
      )

    case 'PROPOSAL_EXECUTED':
      return (
        <Card
          actor={<ActorIdentity address={item.proposer} />}
          time={time}
          category="executed"
        >
          <p className="text-sm leading-snug text-muted-fg">
            proposal{' '}
            <Link
              href={`/proposals/${item.proposalNumber}`}
              className="font-semibold text-fg hover:text-accent-strong"
            >
              #{item.proposalNumber} {item.proposalTitle}
            </Link>{' '}
            executed
          </p>
        </Card>
      )

    case 'CLANKER_TOKEN_CREATED':
      return (
        <Card
          actor={<ActorIdentity address={item.actor} />}
          time={time}
          category="coin"
        >
          <BodyWithThumb image={item.tokenImage} name={item.tokenName}>
            <p className="text-sm leading-snug text-muted-fg">
              launched <strong className="text-fg">${item.tokenSymbol}</strong>{' '}
              {item.tokenName ? `· ${item.tokenName}` : null}
            </p>
          </BodyWithThumb>
        </Card>
      )

    case 'ZORA_COIN_CREATED':
      return (
        <Card
          actor={<ActorIdentity address={item.actor} />}
          time={time}
          category="coin"
        >
          <p className="text-sm leading-snug text-muted-fg">
            launched <strong className="text-fg">${item.coinSymbol}</strong>{' '}
            {item.coinName ? `· ${item.coinName}` : null}
          </p>
        </Card>
      )

    case 'ZORA_DROP_CREATED':
      return (
        <Card
          actor={<ActorIdentity address={item.dropCreator} />}
          time={time}
          category="coin"
        >
          <BodyWithThumb image={item.dropImageURI} name={item.dropName}>
            <p className="text-sm leading-snug text-muted-fg">
              created drop <strong className="text-fg">{item.dropName}</strong>
            </p>
          </BodyWithThumb>
        </Card>
      )

    default:
      return null
  }
}

// ── Body with optional left thumbnail ─────────────────────────

function BodyWithThumb({
  image,
  name,
  children,
}: {
  image?: string | null
  name?: string | null
  children: React.ReactNode
}) {
  const src = image ? safeImageSrc(image) : null

  return (
    <div className="flex items-start gap-3">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- subgraph URLs;
        // template doesn't configure remotePatterns and many feed images are
        // direct render endpoints (nouns.build/api/renderer) that don't need
        // optimization. Plain <img> avoids whitelisting every CDN.
        <img
          src={src}
          alt={name ?? ''}
          className="h-16 w-16 shrink-0 rounded-lg border border-border bg-surface-2 object-cover"
          loading="lazy"
        />
      ) : null}
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}

function safeImageSrc(src: string): string | null {
  if (!src) return null
  if (src.startsWith('ipfs://')) return resolveIpfs(src)
  if (src.startsWith('http://') || src.startsWith('https://')) return src
  return null
}

// ── Skeleton ──────────────────────────────────────────────────

function FeedSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="rounded-xl border border-border bg-surface px-4 py-3"
        >
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="h-6 w-6 rounded-full bg-surface-2" />
              <span className="h-3 w-32 rounded bg-surface-2" />
            </div>
            <span className="h-4 w-16 rounded-full bg-surface-2" />
          </div>
          <div className="flex items-start gap-3">
            <span className="h-16 w-16 shrink-0 rounded-lg bg-surface-2" />
            <div className="flex-1 space-y-2 py-1">
              <div className="h-3 w-3/4 rounded bg-surface-2" />
              <div className="h-3 w-1/2 rounded bg-surface-2" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Utilities ─────────────────────────────────────────────────

function formatBidEth(amountWei: string): string {
  try {
    return trimDec(formatEther(BigInt(amountWei)), 4)
  } catch {
    return amountWei
  }
}

function formatVoteWeight(weight: string): string {
  const n = Number(weight)
  if (isNaN(n)) return weight
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}K`
  return Math.round(n).toString()
}

function trimDec(value: string, max: number): string {
  if (!value.includes('.')) return value
  const [intPart, decPart] = value.split('.')
  const sliced = decPart.slice(0, max).replace(/0+$/, '')
  return sliced ? `${intPart}.${sliced}` : intPart
}

function relativeTimeAgo(ms: number): string {
  const diffSec = Math.floor((Date.now() - ms) / 1000)
  if (diffSec < 60) return `${diffSec}s ago`
  const m = Math.floor(diffSec / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d}d ago`
  const mo = Math.floor(d / 30)
  return `${mo}mo ago`
}

function groupByDay(items: FeedItem[]): Array<{
  dayKey: number
  label: string
  items: FeedItem[]
}> {
  const map = new Map<number, FeedItem[]>()
  for (const it of items) {
    const d = new Date(it.timestamp * 1000)
    const key = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(it)
  }
  const entries = Array.from(map.entries()).sort((a, b) => b[0] - a[0])
  const now = new Date()
  const todayKey = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  return entries.map(([key, dayItems]) => ({
    dayKey: key,
    label: dayLabel(key, todayKey),
    items: dayItems,
  }))
}

function dayLabel(dayKey: number, todayKey: number): string {
  const diffDays = Math.round((todayKey - dayKey) / (1000 * 60 * 60 * 24))
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays} days ago`
  const d = new Date(dayKey)
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: d.getUTCFullYear() !== new Date().getUTCFullYear() ? 'numeric' : undefined,
    timeZone: 'UTC',
  })
}
