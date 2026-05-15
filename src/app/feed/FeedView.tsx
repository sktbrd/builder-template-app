'use client'

import { useFeed } from '@buildeross/hooks'
import { FeedEventType } from '@buildeross/sdk/subgraph'
import type { FeedItem } from '@buildeross/types'
import { Loader2 } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import { formatEther } from 'viem'

import { daoConfig } from '@/lib/dao.config'
import { cn } from '@/lib/utils'

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

const CATEGORIES: { key: CategoryKey; label: string }[] = [
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
    <div>
      <div className="mb-6 flex flex-wrap gap-1.5">
        {CATEGORIES.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => setCategory(c.key)}
            className={cn(
              'rounded-md px-3 py-1.5 text-xs font-semibold transition-colors',
              category === c.key
                ? 'bg-surface-2 text-fg'
                : 'text-muted-fg hover:bg-surface-2 hover:text-fg'
            )}
          >
            {c.label}
          </button>
        ))}
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
        <div className="space-y-8">
          {grouped.map((group) => (
            <section key={group.dayKey} className="space-y-2">
              <div className="flex items-center gap-3">
                <h2
                  className="text-sm font-semibold text-fg"
                  suppressHydrationWarning
                >
                  {group.label}
                </h2>
                <span className="h-px flex-1 bg-border" />
              </div>
              <ul className="flex flex-col divide-y divide-border rounded-xl border border-border bg-surface">
                {group.items.map((item) => (
                  <li key={item.id} className="px-4 py-3">
                    <FeedRow item={item} />
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

function FeedRow({ item }: { item: FeedItem }) {
  const time = relativeTimeAgo(item.timestamp * 1000)

  switch (item.type) {
    case 'AUCTION_BID_PLACED':
      return (
        <Row
          tone="accent"
          tag="Bid"
          who={short(item.bidder)}
          what={
            <>
              bid <strong className="text-fg">{formatBidEth(item.amount)} ETH</strong> on{' '}
              <Link
                href={`/auction/${item.tokenId}`}
                className="hover:text-accent-strong"
              >
                {item.tokenName || `#${item.tokenId}`}
              </Link>
              {item.bidComment ? (
                <span className="mt-1 block text-xs text-muted-fg">
                  &ldquo;{item.bidComment}&rdquo;
                </span>
              ) : null}
            </>
          }
          time={time}
        />
      )
    case 'AUCTION_CREATED':
      return (
        <Row
          tone="accent"
          tag="Auction"
          who={item.tokenName || `#${item.tokenId}`}
          what={
            <>
              auction started ·{' '}
              <Link
                href={`/auction/${item.tokenId}`}
                className="hover:text-accent-strong"
              >
                view
              </Link>
            </>
          }
          time={time}
        />
      )
    case 'AUCTION_SETTLED':
      return (
        <Row
          tone="success"
          tag="Settled"
          who={short(item.winner)}
          what={
            <>
              won{' '}
              <Link
                href={`/auction/${item.tokenId}`}
                className="hover:text-accent-strong"
              >
                {item.tokenName || `#${item.tokenId}`}
              </Link>{' '}
              for <strong className="text-fg">{formatBidEth(item.amount)} ETH</strong>
            </>
          }
          time={time}
        />
      )
    case 'PROPOSAL_CREATED':
      return (
        <Row
          tone="warning"
          tag="Proposal"
          who={short(item.proposer)}
          what={
            <>
              created{' '}
              <Link
                href={`/proposals/${item.proposalNumber}`}
                className="hover:text-accent-strong"
              >
                #{item.proposalNumber} {item.proposalTitle}
              </Link>
            </>
          }
          time={time}
        />
      )
    case 'PROPOSAL_VOTED': {
      const supportLabel =
        item.support === 'FOR'
          ? 'voted for'
          : item.support === 'AGAINST'
            ? 'voted against'
            : 'abstained on'
      const tone =
        item.support === 'FOR'
          ? 'vote-for'
          : item.support === 'AGAINST'
            ? 'vote-against'
            : 'vote-abstain'
      return (
        <Row
          tone={tone}
          tag="Vote"
          who={short(item.voter)}
          what={
            <>
              {supportLabel}{' '}
              <Link
                href={`/proposals/${item.proposalNumber}`}
                className="hover:text-accent-strong"
              >
                #{item.proposalNumber} {item.proposalTitle}
              </Link>
              {item.reason ? (
                <span className="mt-1 block text-xs text-muted-fg">
                  &ldquo;{item.reason}&rdquo;
                </span>
              ) : null}
            </>
          }
          time={time}
        />
      )
    }
    case 'PROPOSAL_UPDATED':
      return (
        <Row
          tone="warning"
          tag="Update"
          who={short(item.proposer)}
          what={
            <>
              posted an update on{' '}
              <Link
                href={`/proposals/${item.proposalNumber}`}
                className="hover:text-accent-strong"
              >
                #{item.proposalNumber} {item.proposalTitle}
              </Link>
            </>
          }
          time={time}
        />
      )
    case 'PROPOSAL_EXECUTED':
      return (
        <Row
          tone="success"
          tag="Executed"
          who={short(item.proposer)}
          what={
            <>
              proposal{' '}
              <Link
                href={`/proposals/${item.proposalNumber}`}
                className="hover:text-accent-strong"
              >
                #{item.proposalNumber} {item.proposalTitle}
              </Link>{' '}
              executed
            </>
          }
          time={time}
        />
      )
    case 'CLANKER_TOKEN_CREATED':
      return (
        <Row
          tone="accent"
          tag="Coin"
          who={short(item.actor)}
          what={
            <>
              launched <strong className="text-fg">${item.tokenSymbol}</strong>{' '}
              {item.tokenName ? `(${item.tokenName})` : null}
            </>
          }
          time={time}
        />
      )
    case 'ZORA_COIN_CREATED':
      return (
        <Row
          tone="accent"
          tag="Coin"
          who={short(item.actor)}
          what={
            <>
              launched <strong className="text-fg">${item.coinSymbol}</strong>{' '}
              {item.coinName ? `(${item.coinName})` : null}
            </>
          }
          time={time}
        />
      )
    case 'ZORA_DROP_CREATED':
      return (
        <Row
          tone="accent"
          tag="Drop"
          who={short(item.dropCreator)}
          what={
            <>
              created drop <strong className="text-fg">{item.dropName}</strong>
            </>
          }
          time={time}
        />
      )
    default:
      return null
  }
}

function Row({
  tone,
  tag,
  who,
  what,
  time,
}: {
  tone: 'accent' | 'success' | 'warning' | 'vote-for' | 'vote-against' | 'vote-abstain'
  tag: string
  who: string
  what: React.ReactNode
  time: string
}) {
  const dotClass = {
    accent: 'bg-accent',
    success: 'bg-success',
    warning: 'bg-warning',
    'vote-for': 'bg-vote-for',
    'vote-against': 'bg-vote-against',
    'vote-abstain': 'bg-vote-abstain',
  }[tone]

  return (
    <div className="flex items-start gap-3">
      <span className={cn('mt-[7px] h-2 w-2 shrink-0 rounded-full', dotClass)} />
      <div className="min-w-0 flex-1">
        <p className="text-sm leading-snug">
          <span className="font-semibold text-fg">{who}</span>{' '}
          <span className="text-muted-fg">{what}</span>
        </p>
        <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-fg">
          <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
            {tag}
          </span>
          <span suppressHydrationWarning>{time}</span>
        </p>
      </div>
    </div>
  )
}

function FeedSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="flex items-start gap-3 rounded-xl border border-border bg-surface px-4 py-4"
        >
          <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-surface-2" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-3/4 rounded bg-surface-2" />
            <div className="h-2.5 w-1/3 rounded bg-surface-2" />
          </div>
        </div>
      ))}
    </div>
  )
}

function short(addr: string): string {
  if (!addr || addr.length < 10) return addr
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

function formatBidEth(amountWei: string): string {
  try {
    const eth = formatEther(BigInt(amountWei))
    return trimDec(eth, 4)
  } catch {
    return amountWei
  }
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
