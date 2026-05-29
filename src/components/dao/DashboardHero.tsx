'use client'

import { useMemo, useState } from 'react'

import { useWeb3Ready } from '@/app/web3-providers'
import type { DashboardData, RecentTokenSummary } from '@/lib/dao-data'
import { shortAddress } from '@/lib/utils'

import { AuctionHero } from './AuctionHero'
import { AuctionHistoryStrip } from './AuctionHistoryStrip'
import { type AuctionTruth, useAuctionTruth, useTokenImage } from './useAuctionTruth'

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
 *
 * The OPTIMISTIC ONCHAIN BRIDGE lives here: when wagmi is mounted we read the
 * Auction House `auction()` getter directly (useAuctionTruth, ~5s poll) and,
 * whenever chain is ahead of the subgraph-seeded `currentAuction` prop
 * (post-settle / fresh-mint, or a newer top bid), drive the live hero from chain
 * truth instead of stale subgraph data — then defer back to the server prop once
 * they agree. Before the wagmi provider mounts we render the plain server view.
 */
export function DashboardHero(props: Props) {
  const ready = useWeb3Ready()
  // wagmi hooks throw before WagmiProvider mounts — same gate BidForm uses.
  if (!ready) {
    return <DashboardHeroView {...props} truth={null} overlayImage={null} />
  }
  return <DashboardHeroConnected {...props} />
}

function DashboardHeroConnected(props: Props) {
  const { truth } = useAuctionTruth()
  const serverTokenId = props.currentAuction?.tokenId ?? null
  // Only reach for the onchain tokenURI in the optimistic window — when chain
  // has a token the subgraph hasn't surfaced yet.
  const overlayTokenId =
    truth && (serverTokenId == null || truth.tokenId > serverTokenId)
      ? truth.tokenId
      : undefined
  const overlayImage = useTokenImage(overlayTokenId)
  return <DashboardHeroView {...props} truth={truth} overlayImage={overlayImage} />
}

/**
 * Builds the live hero object, preferring chain truth over the subgraph prop.
 * Returns null only when neither source has an auction.
 */
function buildLiveHero(
  server: LiveAuction | null,
  truth: AuctionTruth | null,
  overlayImage: string | null,
  tokenLabel: string
): HeroAuction | null {
  if (!truth) return server ? { ...server, kind: 'live' } : null
  // Defensive: if the subgraph is briefly AHEAD of our read, trust the server.
  if (server && truth.tokenId < server.tokenId) return { ...server, kind: 'live' }

  const sameToken = !!server && truth.tokenId === server.tokenId
  return {
    tokenId: truth.tokenId,
    name: sameToken ? server!.name : `${tokenLabel} #${truth.tokenId}`,
    // Newer token → onchain tokenURI image (cures indexing lag); same token →
    // the subgraph's high-fidelity URL. Either way AuctionHero's onError falls
    // back to generative art if the render is cold.
    image: sameToken ? (server!.image ?? overlayImage) : overlayImage,
    startTimeUnix: truth.startTime || server?.startTimeUnix || 0,
    endTimeUnix: truth.endTime,
    // Top bid / leading bidder from chain (fresh within ~5s) — this is what
    // makes "see my bid" and passive bid-by-others work without subgraph lag.
    topBidEth: truth.highestBidEth ?? (sameToken ? server!.topBidEth : null),
    bidderShort: truth.highestBidder
      ? shortAddress(truth.highestBidder)
      : sameToken
        ? server!.bidderShort
        : null,
    // Server bids are enrichment; AuctionHero merges in the actor's local echoes.
    recentBids: sameToken ? server!.recentBids : [],
    kind: 'live',
  }
}

function DashboardHeroView({
  currentAuction,
  recentTokens,
  totalSupply,
  palette,
  tokenLabel,
  truth,
  overlayImage,
}: Props & { truth: AuctionTruth | null; overlayImage: string | null }) {
  // null = "follow the live auction" (survives a settle that advances the live
  // token id); a concrete id = a past tile the user pinned from the strip.
  const [selectedTokenId, setSelectedTokenId] = useState<number | null>(null)

  const liveTokenId = truth?.tokenId ?? currentAuction?.tokenId ?? null
  const followingLive = selectedTokenId == null || selectedTokenId === liveTokenId
  const liveEndTimeUnix = truth?.endTime ?? currentAuction?.endTimeUnix

  const heroAuction = useMemo<HeroAuction | null>(() => {
    if (followingLive) {
      return buildLiveHero(currentAuction, truth, overlayImage, tokenLabel)
    }
    const t = recentTokens.find((x) => x.tokenId === selectedTokenId)
    if (!t) return buildLiveHero(currentAuction, truth, overlayImage, tokenLabel)
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
  }, [
    currentAuction,
    truth,
    overlayImage,
    followingLive,
    recentTokens,
    selectedTokenId,
    tokenLabel,
  ])

  return (
    <>
      <AuctionHero auction={heroAuction} palette={palette} tokenLabel={tokenLabel} />
      <AuctionHistoryStrip
        tokens={recentTokens}
        totalSupply={totalSupply}
        selectedTokenId={selectedTokenId ?? liveTokenId ?? undefined}
        // Clicking the live tile returns to "follow live" (null) so a later
        // settle keeps advancing the hero; a past tile pins that token.
        onSelect={(id) => setSelectedTokenId(id === liveTokenId ? null : id)}
        liveEndTimeUnix={liveEndTimeUnix}
      />
    </>
  )
}
