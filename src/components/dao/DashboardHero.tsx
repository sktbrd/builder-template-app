'use client'

import { useMemo, useState } from 'react'

import type { DashboardData, RecentTokenSummary } from '@/lib/dao-data'

import { AuctionHero } from './AuctionHero'
import { AuctionHistoryStrip } from './AuctionHistoryStrip'

type LiveAuction = NonNullable<DashboardData['currentAuction']>

type HeroAuction = LiveAuction & { kind: 'live' | 'past' }

type Props = {
  currentAuction: DashboardData['currentAuction']
  recentTokens: RecentTokenSummary[]
  totalSupply: number
  palette: [string, string, string]
  tokenLabel: string
}

/**
 * Holds the in-place "which token is shown in the hero" state. Defaults to the
 * live auction; clicking a tile in the carousel swaps the hero (artwork, born
 * date, tint, info column) without navigating away. Selecting the LIVE tile
 * returns the hero to the live auction's bid form / settle button.
 */
export function DashboardHero({
  currentAuction,
  recentTokens,
  totalSupply,
  palette,
  tokenLabel,
}: Props) {
  const liveTokenId = currentAuction?.tokenId ?? null
  const [selectedTokenId, setSelectedTokenId] = useState<number | null>(liveTokenId)

  const heroAuction = useMemo<HeroAuction | null>(() => {
    if (selectedTokenId == null || selectedTokenId === liveTokenId) {
      return currentAuction ? { ...currentAuction, kind: 'live' } : null
    }
    const t = recentTokens.find((x) => x.tokenId === selectedTokenId)
    if (!t) return currentAuction ? { ...currentAuction, kind: 'live' } : null
    return {
      tokenId: t.tokenId,
      name: t.name ?? `${tokenLabel} #${t.tokenId}`,
      image: t.image,
      // mintedAt → "BORN" label; endedAt → ended countdown reads "Ended".
      startTimeUnix: t.mintedAt,
      endTimeUnix: t.endedAtUnix ?? t.mintedAt,
      topBidEth: t.topBidEth,
      bidderShort: t.ownerLabel,
      // Past tiles collapse to just the winning bid — no per-bid history is
      // fetched for them. The hero hides the "Recent bids" block when empty.
      recentBids: [],
      kind: 'past',
    }
  }, [currentAuction, liveTokenId, recentTokens, selectedTokenId, tokenLabel])

  return (
    <>
      <AuctionHero auction={heroAuction} palette={palette} tokenLabel={tokenLabel} />
      <AuctionHistoryStrip
        tokens={recentTokens}
        totalSupply={totalSupply}
        selectedTokenId={selectedTokenId ?? undefined}
        onSelect={setSelectedTokenId}
        liveEndTimeUnix={currentAuction?.endTimeUnix}
      />
    </>
  )
}
