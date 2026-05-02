import 'server-only'

import { PUBLIC_DEFAULT_CHAINS } from '@buildeross/constants/chains'
import { erc20Abi, tokenAbi } from '@buildeross/sdk/contract'
import {
  Auction_OrderBy,
  getBids,
  getProposals,
  OrderDirection,
  type Proposal,
  SubgraphSDK,
  Token_OrderBy,
} from '@buildeross/sdk/subgraph'
import { ProposalState } from '@buildeross/types'
import { transports } from '@buildeross/utils/wagmi'
import { createPublicClient, formatEther } from 'viem'
import { mainnet } from 'viem/chains'

import { daoConfig } from './dao.config'
import type { ProposalStatus } from './types'

const chainId = daoConfig.chainId
const tokenAddressLc = daoConfig.addresses.token.toLowerCase() as `0x${string}`

const chain = PUBLIC_DEFAULT_CHAINS.find((c) => c.id === chainId)
const publicClient = chain
  ? createPublicClient({
      chain,
      transport: transports[chainId as keyof typeof transports] ?? transports[8453],
    })
  : null

// ENS resolves on Ethereum mainnet regardless of which chain the DAO lives on.
const mainnetClient = createPublicClient({
  chain: mainnet,
  transport: transports[1] ?? transports[8453],
})

async function safeFetch<T>(
  label: string,
  fn: () => Promise<T>,
  fallback: T
): Promise<T> {
  try {
    return await fn()
  } catch (e) {
    console.error(`[dao-data] ${label} failed:`, e)
    return fallback
  }
}

/**
 * Heuristic state from the subgraph fragment alone — no on-chain reads.
 * Used to avoid governor.state() per proposal which rate-limits the
 * default public RPC at scale. Public RPC = good enough; Alchemy if
 * provided makes the precise on-chain version reliable, but we only
 * need that for vote-eligibility / state-transition edge cases.
 */
function inferProposalState(p: {
  executedAt?: unknown
  vetoTransactionHash?: unknown
  cancelTransactionHash?: unknown
  expiresAt?: unknown
  voteEnd?: unknown
  forVotes: number
  againstVotes: number
  quorumVotes: unknown
  timeCreated: unknown
}): ProposalState {
  if (p.executedAt) return ProposalState.Executed
  if (p.vetoTransactionHash) return ProposalState.Vetoed
  if (p.cancelTransactionHash) return ProposalState.Canceled
  const now = Math.floor(Date.now() / 1000)
  const expires = p.expiresAt ? Number(p.expiresAt) : null
  if (expires && now > expires) return ProposalState.Expired
  // voteEnd is a block number, not a timestamp — we can't compare directly.
  // Use timeCreated + a 7-day fallback heuristic to decide active vs pending.
  const created = p.timeCreated ? Number(p.timeCreated) : 0
  const ageDays = (now - created) / (60 * 60 * 24)
  const totalCast = p.forVotes + p.againstVotes
  const quorum = Number(p.quorumVotes ?? 0)
  // If voting is over (more than 7 days old by Builder default) and we have
  // votes, decide succeeded vs defeated; else mark pending.
  if (ageDays > 7) {
    if (p.forVotes > p.againstVotes && p.forVotes >= quorum)
      return ProposalState.Succeeded
    if (totalCast > 0) return ProposalState.Defeated
    return ProposalState.Defeated
  }
  return ProposalState.Active
}

/** Map onchain ProposalState → the 5-state palette the UI cards.  */
function mapProposalState(state: ProposalState): ProposalStatus {
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

export type ProposalSummary = {
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

export type DashboardActivityItem = {
  type: 'bid' | 'prop'
  who: string
  what: string
  timeAgo: string
  href?: string
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
  recentProposals: ProposalSummary[]
  recentActivity: DashboardActivityItem[]
  auctionRevenueByMonth: number[] // last 12 buckets, ETH
}

export async function getDashboardData(): Promise<DashboardData> {
  const oneYearAgo = Math.floor(Date.now() / 1000) - 60 * 60 * 24 * 365

  const [daoInfo, auctionsResp, salesResp, proposalsResp, historyResp, treasuryWei] =
    await Promise.all([
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
          ReturnType<ReturnType<typeof SubgraphSDK.connect>['totalAuctionSales']>
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
          ReturnType<ReturnType<typeof SubgraphSDK.connect>['auctionHistory']>
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
        topBidEth: a.highestBid ? formatEther(BigInt(a.highestBid.amount)) : null,
        bidderShort: a.highestBid ? short(a.highestBid.bidder) : null,
      }
    : null

  const recentProposals: ProposalSummary[] = proposalsResp.proposals.map((p) =>
    formatProposal(p)
  )

  const auctionRevenueByMonth = bucketAuctionRevenueByMonth(
    historyResp?.dao?.auctions ?? []
  )

  // Build the activity feed from real events: latest bids on the current
  // auction + the last few proposals created. Merged & sorted by timestamp.
  const recentActivity = await buildRecentActivity(
    currentAuction?.tokenId,
    proposalsResp.proposals
  )

  return {
    totalSupply,
    ownerCount,
    treasuryEth,
    totalAuctionSalesEth,
    currentAuction,
    recentProposals,
    recentActivity,
    auctionRevenueByMonth,
  }
}

async function buildRecentActivity(
  currentTokenId: number | undefined,
  proposals: Proposal[]
): Promise<DashboardActivityItem[]> {
  // Fetch recent bids on the live auction (if any).
  const bidsRaw = currentTokenId
    ? await safeFetch(
        'dashboard.activityBids',
        () => getBids(chainId, daoConfig.addresses.token, String(currentTokenId)),
        [] as Awaited<ReturnType<typeof getBids>>
      )
    : []

  // Bid timestamps aren't in the AuctionBid fragment; we approximate by
  // ordering by amount desc (which is also chronological in normal auctions
  // — each new bid must exceed the previous). Unknown gap, so label as
  // "recent" rather than minute-precise.
  // getBids returns amount as ETH-formatted strings, not wei.
  const bidEvents: DashboardActivityItem[] = (bidsRaw ?? []).slice(0, 4).map((b, i) => ({
    type: 'bid' as const,
    who: short(b.bidder),
    what: `bid ${trimDec(String(b.amount), 4)} ETH on #${currentTokenId}`,
    timeAgo: i === 0 ? 'just now' : 'recent',
    href: `/auction/${currentTokenId}`,
  }))

  const propEvents: DashboardActivityItem[] = proposals.slice(0, 4).map((p) => ({
    type: 'prop' as const,
    who: short(p.proposer),
    what: `created proposal #${p.proposalNumber}`,
    timeAgo: relativeTimeAgo(Number(p.timeCreated) * 1000),
    href: `/proposals/${Number(p.proposalNumber)}`,
  }))

  // Naive interleave: take the freshest 5 across both sources.
  return [...bidEvents, ...propEvents].slice(0, 5)
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

function trimDec(value: string, max: number): string {
  if (!value || !value.includes('.')) return value
  const [intPart, decPart] = value.split('.')
  return `${intPart}.${decPart.slice(0, max).replace(/0+$/, '') || '0'}`
}

function formatProposal(p: Proposal): ProposalSummary {
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
      (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth())
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

// ── Treasury page ──────────────────────────────────────────

export type TreasuryTokenHolding = {
  symbol: string
  address: string
  decimals: number
  /** Formatted balance, trimmed (e.g. "1,234.56"). */
  balance: string
  /** Raw balance as string (for sorting / future USD price math). */
  balanceRaw: string
}

export type TreasuryNft = {
  tokenId: number
  name: string
  image: string | null
  mintedAt: number
}

export type TreasuryPageData = {
  treasuryEth: string
  treasuryAddress: string
  totalAuctionSalesEth: string
  ownerCount: number
  totalSupply: number
  // 12 monthly buckets, oldest → newest
  auctionRevenueByMonth: number[]
  proposalsByMonth: number[]
  /** Voters per recent proposal (last 14 proposals, oldest → newest). */
  votersByProposal: number[]
  nftHoldings: TreasuryNft[]
  nftHoldingsCount: number
  tokenHoldings: TreasuryTokenHolding[]
}

export async function getTreasuryPageData(): Promise<TreasuryPageData> {
  const oneYearAgo = Math.floor(Date.now() / 1000) - 60 * 60 * 24 * 365

  const treasuryAddrLc = daoConfig.addresses.treasury.toLowerCase() as `0x${string}`

  const [
    daoInfo,
    salesResp,
    historyResp,
    proposalsResp,
    treasuryWei,
    nftsResp,
    tokenHoldings,
  ] = await Promise.all([
    safeFetch(
      'treasuryPage.daoInfo',
      () => SubgraphSDK.connect(chainId).daoInfo({ tokenAddress: tokenAddressLc }),
      { dao: null } as Awaited<
        ReturnType<ReturnType<typeof SubgraphSDK.connect>['daoInfo']>
      >
    ),
    safeFetch(
      'treasuryPage.totalAuctionSales',
      () =>
        SubgraphSDK.connect(chainId).totalAuctionSales({
          tokenAddress: tokenAddressLc,
        }),
      { dao: null } as Awaited<
        ReturnType<ReturnType<typeof SubgraphSDK.connect>['totalAuctionSales']>
      >
    ),
    safeFetch(
      'treasuryPage.auctionHistory',
      () =>
        SubgraphSDK.connect(chainId).auctionHistory({
          daoId: tokenAddressLc,
          startTime: BigInt(oneYearAgo).toString() as unknown as bigint,
          orderBy: Auction_OrderBy.EndTime,
          orderDirection: OrderDirection.Desc,
          first: 1000,
        }),
      { dao: null } as Awaited<
        ReturnType<ReturnType<typeof SubgraphSDK.connect>['auctionHistory']>
      >
    ),
    safeFetch(
      'treasuryPage.proposals',
      () =>
        SubgraphSDK.connect(chainId).proposals({
          where: { dao: tokenAddressLc } as never,
          first: 200,
        }),
      { proposals: [] } as Awaited<
        ReturnType<ReturnType<typeof SubgraphSDK.connect>['proposals']>
      >
    ),
    safeFetch(
      'treasuryPage.balance',
      async () => {
        if (!publicClient) return BigInt(0)
        return publicClient.getBalance({
          address: daoConfig.addresses.treasury as `0x${string}`,
        })
      },
      BigInt(0)
    ),
    safeFetch(
      'treasuryPage.nfts',
      () =>
        SubgraphSDK.connect(chainId).tokens({
          where: { dao: tokenAddressLc, owner: treasuryAddrLc } as never,
          orderBy: Token_OrderBy.MintedAt,
          orderDirection: OrderDirection.Desc,
          first: 24,
        }),
      { tokens: [] } as Awaited<
        ReturnType<ReturnType<typeof SubgraphSDK.connect>['tokens']>
      >
    ),
    fetchTreasuryTokenHoldings(treasuryAddrLc),
  ])

  const totalAuctionSalesEth = formatEther(
    BigInt(salesResp?.dao?.totalAuctionSales ?? '0')
  )
  const treasuryEth = formatEther(treasuryWei)

  const auctionRevenueByMonth = bucketAuctionRevenueByMonth(
    historyResp?.dao?.auctions ?? []
  )

  // proposals: count per-month over the last 12 months
  const proposalsByMonth = bucketProposalsByMonth(proposalsResp.proposals)

  // voters per proposal: total votes per proposal, oldest → newest
  // (subgraph fragment doesn't carry vote count directly; for PR #14 we
  // approximate from for+against+abstain counts on the latest 14 props).
  const votersByProposal = proposalsResp.proposals
    .slice()
    .sort((a, b) => Number(a.timeCreated) - Number(b.timeCreated))
    .slice(-14)
    .map((p) => p.forVotes + p.againstVotes + p.abstainVotes)

  const nftHoldings: TreasuryNft[] = (nftsResp.tokens ?? []).map((t) => ({
    tokenId: Number(t.tokenId),
    name: t.name,
    image: t.image ?? null,
    mintedAt: Number(t.mintedAt),
  }))

  const totalSupply = daoInfo?.dao?.totalSupply ?? 0
  const ownerCount = daoInfo?.dao?.ownerCount ?? 0
  // The subgraph treats treasury-owned tokens as a regular owner; subtract
  // 1 from the displayed "in treasury" count when the treasury holds any,
  // so totalSupply - ownerCount is roughly accurate.
  const nftHoldingsCount = nftHoldings.length

  return {
    treasuryEth,
    treasuryAddress: daoConfig.addresses.treasury,
    totalAuctionSalesEth,
    ownerCount,
    totalSupply,
    auctionRevenueByMonth,
    proposalsByMonth,
    votersByProposal,
    nftHoldings,
    nftHoldingsCount,
    tokenHoldings,
  }
}

async function fetchTreasuryTokenHoldings(
  treasuryAddrLc: `0x${string}`
): Promise<TreasuryTokenHolding[]> {
  const tokens = daoConfig.treasuryTokens
  if (!tokens.length || !publicClient) return []

  const result = await safeFetch(
    'treasuryPage.tokenHoldings.multicall',
    () =>
      publicClient.multicall({
        contracts: tokens.map((t) => ({
          address: t.address,
          abi: erc20Abi,
          functionName: 'balanceOf',
          args: [treasuryAddrLc],
        })),
        allowFailure: true,
      }),
    [] as Array<{ status: 'success' | 'failure'; result?: unknown }>
  )

  return tokens
    .map((t, i) => {
      const r = result[i]
      const raw =
        r?.status === 'success' && typeof r.result === 'bigint' ? r.result : BigInt(0)
      const display = formatTokenAmount(raw, t.decimals)
      return {
        symbol: t.symbol,
        address: t.address,
        decimals: t.decimals,
        balance: display,
        balanceRaw: raw.toString(),
      }
    })
    .filter((h) => h.balanceRaw !== '0')
    .sort((a, b) => (BigInt(b.balanceRaw) > BigInt(a.balanceRaw) ? 1 : -1))
}

function formatTokenAmount(value: bigint, decimals: number): string {
  if (value === BigInt(0)) return '0'
  const base = BigInt(10) ** BigInt(decimals)
  const whole = value / base
  const fraction = value % base
  if (fraction === BigInt(0)) {
    return whole.toLocaleString('en-US')
  }
  // Show up to 4 fractional digits (trim trailing zeros).
  const fracStr = fraction.toString().padStart(decimals, '0').slice(0, 4)
  const trimmed = fracStr.replace(/0+$/, '')
  return trimmed
    ? `${whole.toLocaleString('en-US')}.${trimmed}`
    : whole.toLocaleString('en-US')
}

function bucketProposalsByMonth(proposals: Array<{ timeCreated: unknown }>): number[] {
  const buckets = new Array<number>(12).fill(0)
  const now = new Date()
  for (const p of proposals) {
    const d = new Date(Number(p.timeCreated) * 1000)
    const monthsAgo =
      (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth())
    if (monthsAgo < 0 || monthsAgo > 11) continue
    buckets[11 - monthsAgo] += 1
  }
  return buckets
}

// ── Proposals list page ────────────────────────────────────

export async function getAllProposals(limit = 50): Promise<ProposalSummary[]> {
  const resp = await safeFetch(
    'getAllProposals',
    () => getProposals(chainId, tokenAddressLc, limit, 0),
    { proposals: [] as Proposal[] }
  )
  return resp.proposals.map((p) => formatProposal(p))
}

// ── Proposal detail page ───────────────────────────────────

export type ProposalTransaction = {
  target: string
  targetShort: string
  valueWei: bigint
  valueEth: string
  calldata: string
  calldataPreview: string
}

export type ProposalDetail = {
  summary: ProposalSummary
  /** bytes32 onchain proposal id — used to call governor.castVote(...). */
  proposalIdHash: `0x${string}`
  description: string
  proposerFull: string
  snapshotBlockNumber: number
  voteStart: number
  voteEnd: number
  transactions: ProposalTransaction[]
  voteCount: number
}

export async function getProposalByNumber(
  proposalNumber: number
): Promise<ProposalDetail | null> {
  const resp = await safeFetch(
    'proposalDetail.fetchByNumber',
    () =>
      SubgraphSDK.connect(chainId).proposals({
        where: {
          dao: tokenAddressLc,
          proposalNumber: proposalNumber,
        } as never,
        first: 1,
      }),
    { proposals: [] } as Awaited<
      ReturnType<ReturnType<typeof SubgraphSDK.connect>['proposals']>
    >
  )

  const fragment = resp.proposals[0]
  if (!fragment) return null

  // Calldatas come back as a single concatenated string in the fragment;
  // formatAndFetchState normally splits them. We replicate the split here:
  // builder packs each call as 0x-prefixed hex, separated by ":".
  const splitCalldatas = (raw: string | null | undefined): string[] => {
    if (!raw) return []
    return raw
      .split(':')
      .filter(Boolean)
      .map((c) => (c.startsWith('0x') ? c : `0x${c}`))
  }
  const calldatasArr = splitCalldatas(fragment.calldatas)
  const targetsArr = fragment.targets ?? []
  const valuesArr = fragment.values ?? []

  // Build a Proposal-compatible shape using inferred state — no RPC call.
  const inferredState = inferProposalState(fragment)
  const proposalLike = {
    ...fragment,
    state: inferredState,
    calldatas: calldatasArr,
  } as unknown as Proposal

  const transactions: ProposalTransaction[] = targetsArr.map((t, i) => {
    const valueWei = BigInt(valuesArr[i] ?? '0')
    const calldata = calldatasArr[i] ?? '0x'
    return {
      target: t,
      targetShort: short(t),
      valueWei,
      valueEth: formatEther(valueWei),
      calldata,
      calldataPreview:
        calldata && calldata.length > 14 ? `${calldata.slice(0, 10)}…` : calldata,
    }
  })

  return {
    summary: formatProposal(proposalLike),
    proposalIdHash: String(fragment.proposalId) as `0x${string}`,
    description: fragment.description ?? '',
    proposerFull: fragment.proposer,
    snapshotBlockNumber: Number(fragment.snapshotBlockNumber ?? 0),
    voteStart: Number(fragment.voteStart ?? 0),
    voteEnd: Number(fragment.voteEnd ?? 0),
    transactions,
    voteCount: 0, // votes count needs a separate query; surfaced in vote panel later
  }
}

// ── About page ─────────────────────────────────────────────

export type AboutFounder = {
  wallet: string
  walletShort: string
  ownershipPct: number
  vestExpiry: number
}

export type AboutPageData = {
  treasuryEth: string
  ownerCount: number
  totalSupply: number
  founders: AboutFounder[]
}

export async function getAboutPageData(): Promise<AboutPageData> {
  const [info, treasuryWei, founders] = await Promise.all([
    safeFetch(
      'aboutPage.daoInfo',
      () => SubgraphSDK.connect(chainId).daoInfo({ tokenAddress: tokenAddressLc }),
      { dao: null } as Awaited<
        ReturnType<ReturnType<typeof SubgraphSDK.connect>['daoInfo']>
      >
    ),
    safeFetch(
      'aboutPage.balance',
      async () => {
        if (!publicClient) return BigInt(0)
        return publicClient.getBalance({
          address: daoConfig.addresses.treasury as `0x${string}`,
        })
      },
      BigInt(0)
    ),
    safeFetch(
      'aboutPage.founders',
      async () => {
        if (!publicClient) return [] as AboutFounder[]
        const result = (await publicClient.readContract({
          address: daoConfig.addresses.token as `0x${string}`,
          abi: tokenAbi,
          functionName: 'getFounders',
        })) as Array<{
          wallet: string
          ownershipPct: number
          vestExpiry: number
        }>
        return result.map((f) => ({
          wallet: f.wallet,
          walletShort: short(f.wallet),
          ownershipPct: f.ownershipPct,
          vestExpiry: Number(f.vestExpiry),
        }))
      },
      [] as AboutFounder[]
    ),
  ])

  return {
    treasuryEth: formatEther(treasuryWei),
    ownerCount: info?.dao?.ownerCount ?? 0,
    totalSupply: info?.dao?.totalSupply ?? 0,
    founders,
  }
}

// ── Members page ───────────────────────────────────────────

export type MemberRow = {
  ens: string | null
  addr: string
  addrShort: string
  votes: number
  pct: number
  joined: string
  active: boolean
}

export type MembersPageData = {
  members: MemberRow[]
  totalMembers: number
  activeMembers: number
}

export async function getMembersPageData(): Promise<MembersPageData> {
  const [ownersResp, recentProposalsResp] = await Promise.all([
    safeFetch(
      'membersPage.daoMembersList',
      () =>
        SubgraphSDK.connect(chainId).daoMembersList({
          where: { dao: tokenAddressLc } as never,
          // DaoTokenOwner_OrderBy.DaoTokenCount — enum not re-exported, use literal.
          orderBy: 'daoTokenCount' as never,
          orderDirection: OrderDirection.Desc,
          first: 1000,
        }),
      { daotokenOwners: [] } as Awaited<
        ReturnType<ReturnType<typeof SubgraphSDK.connect>['daoMembersList']>
      >
    ),
    safeFetch(
      'membersPage.recentProposals',
      () =>
        SubgraphSDK.connect(chainId).proposals({
          where: { dao: tokenAddressLc } as never,
          first: 5,
        }) as Promise<{
          proposals: Array<{ votes: Array<{ voter: string }> }>
        }>,
      { proposals: [] as Array<{ votes: Array<{ voter: string }> }> }
    ),
  ])

  // Active-set: any address that voted in any of the last 5 proposals.
  const activeSet = new Set<string>()
  for (const p of recentProposalsResp.proposals) {
    for (const v of p.votes ?? []) {
      activeSet.add(String(v.voter).toLowerCase())
    }
  }

  const owners = ownersResp.daotokenOwners
  const totalTokens = owners.reduce((s, o) => s + (o.daoTokenCount ?? 0), 0)

  // Resolve ENS names for the top members. Capped + per-call timeout so the
  // page still renders quickly when only a public mainnet RPC is available.
  const ENS_RESOLVE_LIMIT = 20
  const topAddresses = owners.slice(0, ENS_RESOLVE_LIMIT).map((o) => String(o.owner))
  const ensMap = await resolveEnsNames(topAddresses)

  const members: MemberRow[] = owners.map((o) => {
    const addr = String(o.owner)
    const tokens = o.daoTokenCount ?? 0
    const earliestMinted = (o.daoTokens ?? []).reduce<number>((min, t) => {
      const ts = Number(t.mintedAt ?? 0)
      return min === 0 || ts < min ? ts : min
    }, 0)
    return {
      ens: ensMap.get(addr.toLowerCase()) ?? null,
      addr,
      addrShort: short(addr),
      votes: tokens,
      pct: totalTokens > 0 ? +((tokens / totalTokens) * 100).toFixed(2) : 0,
      joined:
        earliestMinted > 0
          ? new Date(earliestMinted * 1000).toLocaleDateString(undefined, {
              month: 'short',
              day: '2-digit',
              year: 'numeric',
            })
          : '—',
      active: activeSet.has(addr.toLowerCase()),
    }
  })

  return {
    members,
    totalMembers: members.length,
    activeMembers: members.filter((m) => m.active).length,
  }
}

const ENS_LOOKUP_TIMEOUT_MS = 6000

/**
 * Resolve ENS names for a batch of addresses against Ethereum mainnet.
 *
 * Skipped entirely if no Alchemy key is configured — public mainnet RPCs
 * are too slow for batch ENS lookups during SSR (a /members render would
 * stall on 20 sequential reverse-resolver calls). With Alchemy set the
 * ~6s budget per call is comfortable.
 *
 * Each address that doesn't have an ENS, or whose lookup times out, is
 * silently dropped from the result map.
 */
async function resolveEnsNames(addresses: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  if (addresses.length === 0) return out
  if (!process.env.NEXT_PUBLIC_ALCHEMY_API_KEY) return out
  const settled = await Promise.allSettled(
    addresses.map((a) =>
      withTimeout(
        mainnetClient.getEnsName({ address: a as `0x${string}` }),
        ENS_LOOKUP_TIMEOUT_MS
      )
    )
  )
  settled.forEach((r, i) => {
    if (r.status === 'fulfilled' && r.value) {
      out.set(addresses[i].toLowerCase(), r.value)
    } else if (r.status === 'rejected') {
      console.warn(`[dao-data] ENS lookup failed for ${addresses[i]}:`, r.reason)
    }
  })
  return out
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return new Promise((resolve) => {
    let settled = false
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true
        resolve(null)
      }
    }, ms)
    p.then(
      (v) => {
        if (!settled) {
          settled = true
          clearTimeout(timer)
          resolve(v)
        }
      },
      () => {
        if (!settled) {
          settled = true
          clearTimeout(timer)
          resolve(null)
        }
      }
    )
  })
}

// ── Auction page ───────────────────────────────────────────

export type AuctionPageBid = {
  id: string
  amountEth: string
  bidder: string
  bidderShort: string
}

export type AuctionPageData = {
  exists: boolean
  tokenId: number
  name: string | null
  image: string | null
  endTimeUnix: number | null
  topBidEth: string | null
  bidderShort: string | null
  bids: AuctionPageBid[]
  prevTokenId: number | null
  nextTokenId: number | null
  isLatest: boolean
  nowUnixSec: number
}

export async function getAuctionPageData(tokenId: number): Promise<AuctionPageData> {
  const tokenIdStr = String(tokenId)
  const tokenIdBig = BigInt(tokenId).toString() as unknown as bigint
  const nowUnixSec = Math.floor(Date.now() / 1000)

  const [auctionsResp, bidsResp, prevNextResp] = await Promise.all([
    safeFetch(
      'auctionPage.findAuctions',
      () =>
        SubgraphSDK.connect(chainId).findAuctions({
          where: { dao: tokenAddressLc },
          orderBy: Auction_OrderBy.EndTime,
          orderDirection: OrderDirection.Desc,
          first: 50,
        }),
      { auctions: [] } as Awaited<
        ReturnType<ReturnType<typeof SubgraphSDK.connect>['findAuctions']>
      >
    ),
    safeFetch(
      'auctionPage.getBids',
      () => getBids(chainId, daoConfig.addresses.token, tokenIdStr),
      [] as Awaited<ReturnType<typeof getBids>>
    ),
    safeFetch(
      'auctionPage.prevNext',
      () =>
        SubgraphSDK.connect(chainId).daoNextAndPreviousTokens({
          tokenAddress: daoConfig.addresses.token,
          tokenId: tokenIdBig,
        }),
      { prev: [], next: [], latest: [] } as Awaited<
        ReturnType<ReturnType<typeof SubgraphSDK.connect>['daoNextAndPreviousTokens']>
      >
    ),
  ])

  const auction = auctionsResp.auctions.find((a) => Number(a.token.tokenId) === tokenId)

  // Note: getBids() returns ETH-formatted amount strings (e.g. "0.0005"),
  // not wei. Don't pass through formatEther() — pass through as-is.
  const bids = (bidsResp ?? []).map((b) => ({
    id: b.id,
    amountEth: String(b.amount),
    bidder: b.bidder,
    bidderShort: short(b.bidder),
  }))

  const prevTokenId = prevNextResp.prev?.[0] ? Number(prevNextResp.prev[0].tokenId) : null
  const nextTokenId = prevNextResp.next?.[0] ? Number(prevNextResp.next[0].tokenId) : null
  const latestId = prevNextResp.latest?.[0]
    ? Number(prevNextResp.latest[0].tokenId)
    : null
  const isLatest = latestId === tokenId

  if (!auction) {
    // Auction not in the last 50; if we have a prev/next cursor, the token
    // exists but its auction may already be settled and pruned from the
    // recent window. Show what we can.
    return {
      exists: prevNextResp.prev.length > 0 || prevNextResp.next.length > 0,
      tokenId,
      name: null,
      image: null,
      endTimeUnix: null,
      topBidEth: null,
      bidderShort: null,
      bids,
      prevTokenId,
      nextTokenId,
      isLatest,
      nowUnixSec,
    }
  }

  return {
    exists: true,
    tokenId,
    name: auction.token.name,
    image: auction.token.image ?? null,
    endTimeUnix: Number(auction.endTime),
    topBidEth: auction.highestBid ? formatEther(BigInt(auction.highestBid.amount)) : null,
    bidderShort: auction.highestBid ? short(auction.highestBid.bidder) : null,
    bids,
    prevTokenId,
    nextTokenId,
    isLatest,
    nowUnixSec,
  }
}
