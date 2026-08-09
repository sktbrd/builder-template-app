'use client'

import { auctionAbi, tokenAbi } from '@buildeross/sdk/contract'
import { type Address, formatEther, zeroAddress } from 'viem'
import { useReadContract } from 'wagmi'

import { parseTokenImage } from '@/lib/auction-truth'
import { daoConfig } from '@/lib/dao.config'

/**
 * Core auction state read straight from the Auction House `auction()` getter —
 * the authoritative, lag-free source. The subgraph (getDashboardData) lags chain
 * by indexing latency, so the homepage hero overlays THIS whenever chain is
 * ahead of the subgraph (post-settle / fresh-mint), then defers back once they
 * agree. See DashboardHero.
 */
export type AuctionTruth = {
  tokenId: number
  highestBidWei: bigint
  /** formatEther(highestBidWei) or null when there are no bids yet. */
  highestBidEth: string | null
  highestBidder: string | null
  startTime: number
  endTime: number
  settled: boolean
}

// This hook owns its own polling: the global QueryClient default is
// refetchInterval:false (web3-providers.tsx), so live-auction freshness for a
// passive viewer comes from here explicitly, not the shared default.
const POLL_MS = 5000

/**
 * Polls `auction()` every ~5s for EVERY viewer (connected or not) via wagmi's
 * public client — hits the RPC, not the rate-limited subgraph. Returns null
 * until the first read resolves. Must only be mounted once wagmi's provider is
 * up (gate on useWeb3Ready), like BidForm / SettleAuctionAction.
 */
export function useAuctionTruth(): { truth: AuctionTruth | null; refetch: () => void } {
  const { data, refetch } = useReadContract({
    address: daoConfig.addresses.auction as Address,
    abi: auctionAbi,
    functionName: 'auction',
    chainId: daoConfig.chainId,
    query: { refetchInterval: POLL_MS, staleTime: POLL_MS },
  })

  let truth: AuctionTruth | null = null
  if (data) {
    const [tokenId, highestBid, highestBidder, startTime, endTime, settled] =
      data as readonly [bigint, bigint, string, number, number, boolean]
    truth = {
      tokenId: Number(tokenId),
      highestBidWei: highestBid,
      highestBidEth: highestBid > BigInt(0) ? formatEther(highestBid) : null,
      highestBidder:
        highestBidder && highestBidder.toLowerCase() !== zeroAddress
          ? highestBidder
          : null,
      startTime: Number(startTime),
      endTime: Number(endTime),
      settled,
    }
  }

  return { truth, refetch: () => void refetch() }
}

/**
 * Resolves a token's art URL from its onchain `tokenURI` — used only for the
 * optimistic window where the subgraph hasn't indexed a freshly-minted token
 * yet. Disabled (no read) when `tokenId` is undefined. The returned URL is the
 * same nouns.build renderer URL the subgraph stores, so it cures indexing lag
 * but NOT renderer cold-start — the hero's <img onError> fallback covers that.
 */
export function useTokenImage(tokenId: number | undefined): string | null {
  const { data } = useReadContract({
    address: daoConfig.addresses.token as Address,
    abi: tokenAbi,
    functionName: 'tokenURI',
    args: [BigInt(tokenId ?? 0)],
    chainId: daoConfig.chainId,
    query: { enabled: tokenId != null, staleTime: 60_000, refetchInterval: false },
  })
  return parseTokenImage(typeof data === 'string' ? data : null)
}
