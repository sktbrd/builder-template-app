import 'server-only'

import { PUBLIC_DEFAULT_CHAINS } from '@buildeross/constants/chains'
import {
  Auction_OrderBy,
  getProposals,
  OrderDirection,
  type Proposal,
  SubgraphSDK,
  Token_OrderBy,
} from '@buildeross/sdk/subgraph'
import { ProposalState } from '@buildeross/types'
import { transports } from '@buildeross/utils/wagmi'
import { createPublicClient, formatEther } from 'viem'

import { daoConfig } from './dao.config'
import type { ProposalStatus } from './mockData'

const chainId = daoConfig.chainId
const tokenAddressLc = daoConfig.addresses.token.toLowerCase() as `0x${string}`

const chain = PUBLIC_DEFAULT_CHAINS.find((c) => c.id === chainId)
const publicClient = chain
  ? createPublicClient({
      chain,
      transport:
        transports[chainId as keyof typeof transports] ?? transports[8453],
    })
  : null

async function safeFetch<T>(label: string, fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn()
  } catch (e) {
    console.error(`[dao-data] ${label} failed:`, e)
    return fallback
  }
}

/** Map onchain ProposalState → the 5-state palette the UI cards.  */
export function mapProposalState(state: ProposalState): ProposalStatus {
  switch (state) {
    case ProposalState.Active:
      return 'active'
    case ProposalState.Pending:
    case ProposalState.Succeeded:
    case ProposalState.Queued:
      return 'pending'
    case ProposalState.Defeated:
      return 'defeated'
    case ProposalState.Executed:
      return 'executed'
    case ProposalState.Canceled:
    case ProposalState.Expired:
    case ProposalState.Vetoed:
    default:
      return 'cancelled'
  }
}

export type DashboardProposal = {
  id: number
  proposalNumber: number
  title: string
  status: ProposalStatus
  proposer: string
  date: string
  forVotes: number
  againstVotes: number
  abstainVotes: number
  quorum: number
  endsLabel: string
  requested: { eth: number; usdc: number }
}

export type DashboardData = {
  totalSupply: number
  ownerCount: number
  treasuryEth: string // formatted "1.2345"
  totalAuctionSalesEth: string // formatted
  currentAuction: {
    tokenId: number
    name: string
    image: string | null
    endTimeUnix: number
    topBidEth: string | null
    bidderShort: string | null
  } | null
  recentProposals: DashboardProposal[]
  auctionRevenueByMonth: number[] // last 12 buckets, ETH
}

export async function getDashboardData(): Promise<DashboardData> {
  const oneYearAgo = Math.floor(Date.now() / 1000) - 60 * 60 * 24 * 365

  const [
    daoInfo,
    auctionsResp,
    salesResp,
    proposalsResp,
    historyResp,
    treasuryWei,
  ] = await Promise.all([
    safeFetch(
      'daoInfo',
      () => SubgraphSDK.connect(chainId).daoInfo({ tokenAddress: tokenAddressLc }),
      { dao: null } as Awaited<
        ReturnType<ReturnType<typeof SubgraphSDK.connect>['daoInfo']>
      >
    ),
    safeFetch(
      'findAuctions',
      () =>
        SubgraphSDK.connect(chainId).findAuctions({
          where: { dao: tokenAddressLc },
          orderBy: Auction_OrderBy.EndTime,
          orderDirection: OrderDirection.Desc,
          first: 1,
        }),
      { auctions: [] } as Awaited<
        ReturnType<ReturnType<typeof SubgraphSDK.connect>['findAuctions']>
      >
    ),
    safeFetch(
      'totalAuctionSales',
      () =>
        SubgraphSDK.connect(chainId).totalAuctionSales({
          tokenAddress: tokenAddressLc,
        }),
      { dao: null } as Awaited<
        ReturnType<
          ReturnType<typeof SubgraphSDK.connect>['totalAuctionSales']
        >
      >
    ),
    safeFetch('proposals', () => getProposals(chainId, tokenAddressLc, 6, 0), {
      proposals: [] as Proposal[],
    }),
    safeFetch(
      'auctionHistory',
      () =>
        SubgraphSDK.connect(chainId).auctionHistory({
          daoId: tokenAddressLc,
          startTime: BigInt(oneYearAgo).toString() as unknown as bigint,
          orderBy: Auction_OrderBy.EndTime,
          orderDirection: OrderDirection.Desc,
          first: 1000,
        }),
      { dao: null } as Awaited<
        ReturnType<
          ReturnType<typeof SubgraphSDK.connect>['auctionHistory']
        >
      >
    ),
    safeFetch(
      'treasuryBalance',
      async () => {
        if (!publicClient) return BigInt(0)
        return publicClient.getBalance({
          address: daoConfig.addresses.treasury as `0x${string}`,
        })
      },
      BigInt(0)
    ),
  ])

  const totalSupply = daoInfo?.dao?.totalSupply ?? 0
  const ownerCount = daoInfo?.dao?.ownerCount ?? 0
  const totalAuctionSalesEth = formatEther(
    BigInt(salesResp?.dao?.totalAuctionSales ?? '0')
  )
  const treasuryEth = formatEther(treasuryWei)

  const a = auctionsResp.auctions[0]
  const currentAuction = a
    ? {
        tokenId: Number(a.token.tokenId),
        name: a.token.name,
        image: a.token.image ?? null,
        endTimeUnix: Number(a.endTime),
        topBidEth: a.highestBid
          ? formatEther(BigInt(a.highestBid.amount))
          : null,
        bidderShort: a.highestBid ? short(a.highestBid.bidder) : null,
      }
    : null

  const recentProposals: DashboardProposal[] = proposalsResp.proposals.map(
    (p) => formatProposal(p)
  )

  const auctionRevenueByMonth = bucketAuctionRevenueByMonth(
    historyResp?.dao?.auctions ?? []
  )

  return {
    totalSupply,
    ownerCount,
    treasuryEth,
    totalAuctionSalesEth,
    currentAuction,
    recentProposals,
    auctionRevenueByMonth,
  }
}

function formatProposal(p: Proposal): DashboardProposal {
  const status = mapProposalState(p.state)
  const created = Number(p.timeCreated) * 1000
  const date = new Date(created).toLocaleDateString(undefined, {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  })
  return {
    id: Number(p.proposalNumber),
    proposalNumber: Number(p.proposalNumber),
    title: p.title ?? `Proposal ${p.proposalNumber}`,
    status,
    proposer: short(p.proposer),
    date,
    forVotes: Number(p.forVotes ?? 0),
    againstVotes: Number(p.againstVotes ?? 0),
    abstainVotes: Number(p.abstainVotes ?? 0),
    quorum: Number(p.quorumVotes ?? 0),
    endsLabel: relativeLabel(status, created),
    requested: { eth: 0, usdc: 0 }, // requested-amount decode lands with the
    // upstream tx-decoder hook (not on the dashboard surface for now)
  }
}

function relativeLabel(status: ProposalStatus, createdMs: number) {
  const now = Date.now()
  const ageMs = now - createdMs
  const days = Math.floor(ageMs / (1000 * 60 * 60 * 24))
  if (status === 'active' || status === 'pending') {
    return days <= 0 ? 'Active now' : `Started ${days}d ago`
  }
  if (days < 1) return 'today'
  if (days === 1) return '1 day ago'
  if (days < 30) return `${days} days ago`
  const months = Math.floor(days / 30)
  return months === 1 ? '1 month ago' : `${months} months ago`
}

function bucketAuctionRevenueByMonth(
  auctions: Array<{
    endTime: unknown
    settled: boolean
    winningBid?: { amount: unknown } | null
  }>
): number[] {
  const buckets = new Array<number>(12).fill(0)
  const now = new Date()
  // Index 0 = oldest of the 12, 11 = current month
  for (const a of auctions) {
    if (!a.settled || !a.winningBid) continue
    const d = new Date(Number(a.endTime) * 1000)
    const monthsAgo =
      (now.getFullYear() - d.getFullYear()) * 12 +
      (now.getMonth() - d.getMonth())
    if (monthsAgo < 0 || monthsAgo > 11) continue
    const idx = 11 - monthsAgo
    const eth = Number(formatEther(BigInt((a.winningBid.amount as string) ?? '0')))
    buckets[idx] += eth
  }
  return buckets
}

function short(addr: string) {
  if (!addr || addr.length < 10) return addr
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}
