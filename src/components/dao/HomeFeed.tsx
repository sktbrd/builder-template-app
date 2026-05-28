'use client'

import { useFeed } from '@buildeross/hooks'
import { FeedEventType } from '@buildeross/sdk/subgraph'
import type { FeedItem } from '@buildeross/types'
import { Loader2 } from 'lucide-react'
import Link from 'next/link'
import { formatEther, isAddressEqual, zeroAddress } from 'viem'

import { ActorIdentity } from '@/components/feed/ActorIdentity'
import { daoConfig } from '@/lib/dao.config'
import { cn } from '@/lib/utils'

const EVENT_TYPES: FeedEventType[] = [
  FeedEventType.ProposalCreated,
  FeedEventType.ProposalVoted,
  FeedEventType.ProposalUpdated,
  FeedEventType.ProposalExecuted,
  FeedEventType.AuctionCreated,
  FeedEventType.AuctionBidPlaced,
  FeedEventType.AuctionSettled,
]

export function HomeFeed() {
  const { items, isLoading, error } = useFeed({
    chainIds: [daoConfig.chainId],
    daos: [daoConfig.addresses.token],
    eventTypes: EVENT_TYPES,
    limit: 14,
  })

  return (
    <section className="rounded-[10px] border border-border bg-surface/60 px-5 py-5 sm:px-6">
      <header className="mb-3 flex items-center justify-between gap-3">
        <h2 className="font-display text-xl font-bold tracking-tight">Feed</h2>
        <Link
          href="/feed"
          className="text-[12px] font-semibold text-muted-fg transition-colors hover:text-fg"
        >
          View all →
        </Link>
      </header>

      {isLoading ? (
        <FeedSkeleton />
      ) : error ? (
        <EmptyHint>Couldn&apos;t load the feed.</EmptyHint>
      ) : items.length === 0 ? (
        <EmptyHint>No activity yet.</EmptyHint>
      ) : (
        <ul className="flex flex-col">
          {items.slice(0, 14).map((item, i) => (
            <li
              key={item.id}
              className={cn(
                'py-2.5',
                i < items.length - 1 && i < 13 && 'border-b border-border/60'
              )}
            >
              <FeedRow item={item} />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function FeedRow({ item }: { item: FeedItem }) {
  const time = relativeTimeAgo(item.timestamp * 1000)
  switch (item.type) {
    case 'AUCTION_BID_PLACED':
      return (
        <Row actor={item.bidder} time={time}>
          bid <Strong>{formatBidEth(item.amount)} ETH</Strong> on{' '}
          <AuctionLink id={item.tokenId} name={item.tokenName} />
        </Row>
      )
    case 'AUCTION_CREATED':
      return (
        <Row actor={item.actor} time={time}>
          auction started for <AuctionLink id={item.tokenId} name={item.tokenName} />
        </Row>
      )
    case 'AUCTION_SETTLED': {
      const noBids =
        isAddressEqual(item.winner, zeroAddress) ||
        BigInt(item.amount || '0') === BigInt(0)
      return noBids ? (
        <Row time={time}>
          <AuctionLink id={item.tokenId} name={item.tokenName} /> settled with no bids
        </Row>
      ) : (
        <Row actor={item.winner} time={time}>
          won <AuctionLink id={item.tokenId} name={item.tokenName} /> for{' '}
          <Strong>{formatBidEth(item.amount)} ETH</Strong>
        </Row>
      )
    }
    case 'PROPOSAL_CREATED':
      return (
        <Row actor={item.proposer} time={time}>
          created <ProposalLink number={item.proposalNumber} title={item.proposalTitle} />
        </Row>
      )
    case 'PROPOSAL_VOTED': {
      const tone = SUPPORT_TONE[item.support]
      return (
        <Row actor={item.voter} time={time}>
          voted <span className={cn('font-semibold', tone)}>{item.support}</span>{' '}
          {item.weight ? (
            <span className="text-muted-fg">({formatVoteWeight(item.weight)})</span>
          ) : null}{' '}
          on <ProposalLink number={item.proposalNumber} title={item.proposalTitle} />
        </Row>
      )
    }
    case 'PROPOSAL_UPDATED':
      return (
        <Row actor={item.proposer} time={time}>
          updated <ProposalLink number={item.proposalNumber} title={item.proposalTitle} />
        </Row>
      )
    case 'PROPOSAL_EXECUTED':
      return (
        <Row actor={item.proposer} time={time}>
          executed{' '}
          <ProposalLink number={item.proposalNumber} title={item.proposalTitle} />
        </Row>
      )
    default:
      return null
  }
}

const SUPPORT_TONE: Record<'FOR' | 'AGAINST' | 'ABSTAIN', string> = {
  FOR: 'text-vote-for',
  AGAINST: 'text-vote-against',
  ABSTAIN: 'text-vote-abstain',
}

function Row({
  actor,
  time,
  children,
}: {
  /** Address — omit when there's no meaningful actor (e.g. zero-bid settle). */
  actor?: string
  time: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[13px] leading-6 text-muted-fg">
          {actor && <ActorIdentity address={actor} size={20} className="text-[13px]" />}
          <span className="leading-6">{children}</span>
        </div>
      </div>
      <span className="shrink-0 text-[11px] leading-6 tabular-nums text-muted-fg/70">
        {time}
      </span>
    </div>
  )
}

function Strong({ children }: { children: React.ReactNode }) {
  return <strong className="font-semibold text-fg">{children}</strong>
}

function AuctionLink({ id, name }: { id: number | string; name: string | null }) {
  return (
    <Link
      href={`/auction/${id}`}
      className="font-semibold text-fg hover:text-accent-strong"
    >
      {name || `#${id}`}
    </Link>
  )
}

function ProposalLink({ number, title }: { number: number | string; title: string }) {
  return (
    <Link
      href={`/proposals/${number}`}
      className="font-semibold text-fg hover:text-accent-strong"
    >
      #{number} {title}
    </Link>
  )
}

function EmptyHint({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-dashed border-border bg-surface-2 px-4 py-8 text-center text-sm text-muted-fg">
      {children}
    </div>
  )
}

function FeedSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-2.5">
          <div className="h-5 w-5 shrink-0 rounded-full bg-surface-2" />
          <div className="h-3 flex-1 rounded bg-surface-2" />
        </div>
      ))}
      <div className="flex items-center justify-center pt-2 text-muted-fg">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      </div>
    </div>
  )
}

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
  if (diffSec < 60) return `${diffSec}s`
  const m = Math.floor(diffSec / 60)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d}d`
  const mo = Math.floor(d / 30)
  return `${mo}mo`
}
