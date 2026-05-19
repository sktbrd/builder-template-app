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
import { createPublicClient, formatEther, http } from 'viem'
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
// Uses public transport so ENS works without an Alchemy key configured.
const mainnetClient = createPublicClient({
  chain: mainnet,
  transport: transports[1] ?? http(),
})

function isRateLimited(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err)
  if (msg.includes('429') || /rate.?limit/i.test(msg)) return true
  const status = (err as { response?: { status?: number } })?.response?.status
  return status === 429
}

async function safeFetch<T>(
  label: string,
  fn: () => Promise<T>,
  fallback: T
): Promise<T> {
  const maxAttempts = 3
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (e) {
      if (attempt < maxAttempts && isRateLimited(e)) {
        const backoff = 500 * 2 ** (attempt - 1) + Math.floor(Math.random() * 250)
        await new Promise((r) => setTimeout(r, backoff))
        continue
      }
      console.error(`[dao-data] ${label} failed:`, e)
      return fallback
    }
  }
  return fallback
}

/**
 * State inferred from the subgraph fragment — no on-chain reads.
 * Builder's subgraph exposes voteStart / voteEnd / expiresAt as unix
 * seconds, so we can distinguish Pending vs Active vs Queued without
 * hitting governor.state() and rate-limiting the public RPC.
 */
function inferProposalState(p: {
  executedAt?: unknown
  vetoTransactionHash?: unknown
  cancelTransactionHash?: unknown
  expiresAt?: unknown
  voteStart?: unknown
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

  const voteStart = p.voteStart ? Number(p.voteStart) : 0
  const voteEnd = p.voteEnd ? Number(p.voteEnd) : 0

  // Voting hasn't opened yet.
  if (voteStart > 0 && now < voteStart) return ProposalState.Pending
  // Voting is in progress.
  if (voteEnd > 0 && now < voteEnd) return ProposalState.Active

  // Voting closed — outcome from tallies. expiresAt being set implies the
  // proposal has been queued (governor populates it on queue).
  const quorum = Number(p.quorumVotes ?? 0)
  if (p.forVotes > p.againstVotes && p.forVotes >= quorum) {
    return expires ? ProposalState.Queued : ProposalState.Succeeded
  }
  return ProposalState.Defeated
}

/** Map onchain ProposalState → the 9-state palette used by Builder/Gnars. */
function mapProposalState(state: ProposalState): ProposalStatus {
  switch (state) {
    case ProposalState.Pending:
      return 'pending'
    case ProposalState.Active:
      return 'active'
    case ProposalState.Canceled:
      return 'cancelled'
    case ProposalState.Defeated:
      return 'defeated'
    case ProposalState.Succeeded:
      return 'succeeded'
    case ProposalState.Queued:
      return 'queued'
    case ProposalState.Expired:
      return 'expired'
    case ProposalState.Executed:
      return 'executed'
    case ProposalState.Vetoed:
      return 'vetoed'
    default:
      return 'pending'
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
  if (status === 'pending') {
    return 'Voting opens soon'
  }
  if (status === 'active') {
    return days <= 0 ? 'Active now' : `Started ${days}d ago`
  }
  if (status === 'queued') {
    return 'Awaiting execution'
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
  /** keccak256(description) precomputed by the subgraph. Needed to call
   * governor.execute(...). */
  descriptionHash: `0x${string}`
  description: string
  proposerFull: string
  /** Reverse-resolved ENS / basename for the proposer, when one exists. */
  proposerEns: string | null
  snapshotBlockNumber: number
  voteStart: number
  voteEnd: number
  transactions: ProposalTransaction[]
  voteCount: number
  /** Onchain votes cast on this proposal. Already returned by the
   * `proposals(...)` query — we just surface them now. */
  votes: ProposalDetailVote[]
}

export type ProposalDetailVote = {
  voter: string
  voterShort: string
  /** ENS, when we have one. */
  voterEns: string | null
  /** 0 = against, 1 = for, 2 = abstain. */
  support: 'for' | 'against' | 'abstain'
  weight: number
  reason: string | null
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

  // The `proposals(where, first:1)` query already returns `votes` nested on
  // each proposal (see sdk.generated.js — `...ProposalVote` is part of the
  // doc), but the typed return doesn't include them. Bypass the cast and
  // pull them off the raw response.
  const rawVotes = (fragment as unknown as { votes?: Array<RawProposalVote> }).votes ?? []

  // Resolve ENS for the proposer + the top 20 voters in one batched call.
  const proposerLc = String(fragment.proposer).toLowerCase()
  const voterAddrs = rawVotes.slice(0, 20).map((v) => String(v.voter))
  const ensMap = await resolveEnsNames([fragment.proposer, ...voterAddrs])
  const proposerEns = ensMap.get(proposerLc) ?? null

  const votes: ProposalDetailVote[] = rawVotes
    .slice()
    // Subgraph returns votes in insertion order; we want most recent first.
    // ProposalVote fragment doesn't expose a timestamp, so reverse is the
    // best we can do without a separate per-vote query.
    .reverse()
    .map((v) => ({
      voter: String(v.voter),
      voterShort: short(String(v.voter)),
      voterEns: ensMap.get(String(v.voter).toLowerCase()) ?? null,
      support: mapVoteSupport(v.support),
      weight: Number(v.weight ?? 0),
      reason: v.reason ?? null,
    }))

  return {
    summary: formatProposal(proposalLike),
    proposalIdHash: String(fragment.proposalId) as `0x${string}`,
    descriptionHash: String(fragment.descriptionHash) as `0x${string}`,
    description: fragment.description ?? '',
    proposerFull: fragment.proposer,
    proposerEns,
    snapshotBlockNumber: Number(fragment.snapshotBlockNumber ?? 0),
    voteStart: Number(fragment.voteStart ?? 0),
    voteEnd: Number(fragment.voteEnd ?? 0),
    transactions,
    voteCount: votes.length,
    votes,
  }
}

type RawProposalVote = {
  voter: string
  support: number | string | 'AGAINST' | 'FOR' | 'ABSTAIN'
  weight: number | string | null | undefined
  reason: string | null | undefined
}

function mapVoteSupport(
  support: RawProposalVote['support']
): 'for' | 'against' | 'abstain' {
  // The subgraph enum can come back either as the integer (0/1/2) or the
  // string label. Handle both rather than assume.
  const s = String(support).toUpperCase()
  if (s === '1' || s === 'FOR') return 'for'
  if (s === '2' || s === 'ABSTAIN') return 'abstain'
  return 'against'
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

// ── Member detail page ────────────────────────────────────

export type MemberDetailToken = {
  tokenId: number
  mintedAt: number
  /** Subgraph-stored token image URI (ipfs:// or http://). null when the
   * subgraph hasn't indexed it yet. */
  image: string | null
  name: string | null
}

export type MemberDetailVote = {
  proposalNumber: number
  proposalTitle: string
  proposalStatus: ProposalStatus
  support: 'for' | 'against' | 'abstain'
  weight: number
  reason: string | null
  timestamp: number
}

export type MemberDetailProposal = {
  proposalNumber: number
  title: string
  status: ProposalStatus
  date: string
}

export type MemberDetailDelegator = {
  addr: string
  addrShort: string
  ens: string | null
  tokenCount: number
}

export type MemberDetail = {
  address: string
  addressShort: string
  ens: string | null
  /** Tokens this address physically owns (count + the token ids/mints). */
  tokensHeld: number
  tokens: MemberDetailToken[]
  /** Live voting power (sum of own + delegated-in). 0 if not a `daoVoter`. */
  votingPower: number
  /** Delegate target. Equal to `address` when self-delegated. null if owner record missing. */
  delegate: string | null
  delegateShort: string | null
  delegateEns: string | null
  delegators: MemberDetailDelegator[]
  votesCast: MemberDetailVote[]
  proposalsAuthored: MemberDetailProposal[]
  /** First mint timestamp the member is associated with (own + delegated), unix seconds; 0 if none. */
  joinedAt: number
  /** Active = voted on any of the last 5 proposals (same heuristic as members list). */
  active: boolean
}

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

export async function getMemberDetail(rawAddress: string): Promise<MemberDetail | null> {
  if (!rawAddress || !/^0x[0-9a-fA-F]{40}$/.test(rawAddress)) return null
  const address = rawAddress.toLowerCase() as `0x${string}`
  if (address === ZERO_ADDRESS) return null

  const ownerId = `${tokenAddressLc}:${address}`
  const voterId = `${tokenAddressLc}:${address}`

  const [membership, votesResp, authoredResp, delegatorsResp, recentProposalsResp] =
    await Promise.all([
      safeFetch(
        'memberDetail.membership',
        () => SubgraphSDK.connect(chainId).daoMembership({ ownerId, voterId }),
        { daotokenOwner: null, daovoter: null } as Awaited<
          ReturnType<ReturnType<typeof SubgraphSDK.connect>['daoMembership']>
        >
      ),
      safeFetch(
        'memberDetail.votes',
        () => fetchVotesByVoter(address),
        [] as RawMemberVote[]
      ),
      safeFetch(
        'memberDetail.authored',
        () =>
          SubgraphSDK.connect(chainId).proposals({
            where: { dao: tokenAddressLc, proposer: address } as never,
            first: 50,
          }),
        { proposals: [] } as Awaited<
          ReturnType<ReturnType<typeof SubgraphSDK.connect>['proposals']>
        >
      ),
      safeFetch(
        'memberDetail.delegators',
        () =>
          SubgraphSDK.connect(chainId).daoMembersList({
            where: {
              dao: tokenAddressLc,
              delegate: address,
              owner_not: address,
            } as never,
            orderBy: 'daoTokenCount' as never,
            orderDirection: OrderDirection.Desc,
            first: 50,
          }),
        { daotokenOwners: [] } as Awaited<
          ReturnType<ReturnType<typeof SubgraphSDK.connect>['daoMembersList']>
        >
      ),
      safeFetch(
        'memberDetail.recentProposals',
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

  const owner = membership.daotokenOwner
  const voter = membership.daovoter
  const hasNoFootprint =
    !owner &&
    !voter &&
    votesResp.length === 0 &&
    authoredResp.proposals.length === 0 &&
    delegatorsResp.daotokenOwners.length === 0
  if (hasNoFootprint) return null

  // ENS for owner + delegate + top delegators (cap 20).
  const delegateAddr = owner?.delegate ? String(owner.delegate).toLowerCase() : null
  const topDelegators = delegatorsResp.daotokenOwners.slice(0, 18)
  const ensTargets = [
    address,
    ...(delegateAddr && delegateAddr !== address ? [delegateAddr] : []),
    ...topDelegators.map((d) => String(d.owner)),
  ]
  const ensMap = await resolveEnsNames(ensTargets)

  const rawTokens = (owner?.daoTokens ?? [])
    .map((t) => ({ tokenId: Number(t.tokenId), mintedAt: Number(t.mintedAt ?? 0) }))
    .sort((a, b) => a.tokenId - b.tokenId)

  // Pull the Token entities for the held tokenIds so we can render artwork.
  // Capped at 200 to keep the query payload bounded for whale wallets.
  const TOKENS_IMAGE_CAP = 200
  const imageById = new Map<number, { image: string | null; name: string | null }>()
  if (rawTokens.length > 0) {
    const tokenIds = rawTokens.slice(0, TOKENS_IMAGE_CAP).map((t) => t.tokenId)
    const tokensResp = await safeFetch(
      'memberDetail.tokenImages',
      () =>
        SubgraphSDK.connect(chainId).tokens({
          where: {
            tokenContract: tokenAddressLc,
            tokenId_in: tokenIds.map((id) => BigInt(id).toString()) as never,
          } as never,
          first: TOKENS_IMAGE_CAP,
        }),
      { tokens: [] } as Awaited<
        ReturnType<ReturnType<typeof SubgraphSDK.connect>['tokens']>
      >
    )
    for (const t of tokensResp.tokens) {
      imageById.set(Number(t.tokenId), {
        image: t.image ?? null,
        name: t.name ?? null,
      })
    }
  }

  const tokens: MemberDetailToken[] = rawTokens.map((t) => ({
    ...t,
    image: imageById.get(t.tokenId)?.image ?? null,
    name: imageById.get(t.tokenId)?.name ?? null,
  }))

  const joinedAt = tokens.reduce<number>(
    (min, t) => (min === 0 || (t.mintedAt > 0 && t.mintedAt < min) ? t.mintedAt : min),
    0
  )

  const votesCast: MemberDetailVote[] = votesResp.map((v) => {
    const propStatus = inferProposalState(v.proposal)
    return {
      proposalNumber: Number(v.proposal.proposalNumber),
      proposalTitle: v.proposal.title ?? `Proposal ${v.proposal.proposalNumber}`,
      proposalStatus: mapProposalState(propStatus),
      support: mapVoteSupport(v.support),
      weight: Number(v.weight ?? 0),
      reason: v.reason && v.reason.trim().length > 0 ? v.reason : null,
      timestamp: Number(v.timestamp ?? 0),
    }
  })

  const proposalsAuthored: MemberDetailProposal[] = authoredResp.proposals.map((p) => {
    const state = inferProposalState(p)
    return {
      proposalNumber: Number(p.proposalNumber),
      title: p.title ?? `Proposal ${p.proposalNumber}`,
      status: mapProposalState(state),
      date: new Date(Number(p.timeCreated) * 1000).toLocaleDateString(undefined, {
        month: 'short',
        day: '2-digit',
        year: 'numeric',
      }),
    }
  })

  const delegators: MemberDetailDelegator[] = delegatorsResp.daotokenOwners.map((d) => {
    const addr = String(d.owner)
    return {
      addr,
      addrShort: short(addr),
      ens: ensMap.get(addr.toLowerCase()) ?? null,
      tokenCount: d.daoTokenCount ?? 0,
    }
  })

  // Active heuristic — voted on any of the last 5 proposals.
  const activeSet = new Set<string>()
  for (const p of recentProposalsResp.proposals) {
    for (const v of p.votes ?? []) activeSet.add(String(v.voter).toLowerCase())
  }

  return {
    address,
    addressShort: short(address),
    ens: ensMap.get(address) ?? null,
    tokensHeld: owner?.daoTokenCount ?? tokens.length,
    tokens,
    votingPower: voter?.daoTokenCount ?? 0,
    delegate: delegateAddr,
    delegateShort: delegateAddr ? short(delegateAddr) : null,
    delegateEns:
      delegateAddr && delegateAddr !== address
        ? (ensMap.get(delegateAddr) ?? null)
        : null,
    delegators,
    votesCast,
    proposalsAuthored,
    joinedAt,
    active: activeSet.has(address),
  }
}

type RawMemberVote = {
  support: number | string
  weight: number | string | null
  reason: string | null
  timestamp: number | string
  proposal: {
    proposalNumber: number | string
    title: string | null
    executedAt: unknown
    vetoTransactionHash: unknown
    cancelTransactionHash: unknown
    expiresAt: unknown
    voteStart: unknown
    voteEnd: unknown
    forVotes: number
    againstVotes: number
    quorumVotes: unknown
    timeCreated: unknown
  }
}

/**
 * Fetch a member's vote history with the proposal context inlined.
 *
 * The generated SDK only exposes `userProposalVote` (capped at `first: 1`),
 * so we send a raw POST to the same subgraph endpoint. Filter is
 * `voter == address` scoped to this DAO via the nested `proposal_.dao` filter.
 */
async function fetchVotesByVoter(voter: `0x${string}`): Promise<RawMemberVote[]> {
  const { PUBLIC_SUBGRAPH_URL } = await import('@buildeross/constants')
  const url = PUBLIC_SUBGRAPH_URL.get(chainId)
  if (!url) return []
  const query = `
    query MemberVotes($voter: Bytes!, $dao: String!, $first: Int!) {
      proposalVotes(
        where: { voter: $voter, proposal_: { dao: $dao } }
        orderBy: timestamp
        orderDirection: desc
        first: $first
      ) {
        support
        weight
        reason
        timestamp
        proposal {
          proposalNumber
          title
          executedAt
          vetoTransactionHash
          cancelTransactionHash
          expiresAt
          voteStart
          voteEnd
          forVotes
          againstVotes
          quorumVotes
          timeCreated
        }
      }
    }
  `
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query,
      variables: { voter, dao: tokenAddressLc, first: 50 },
    }),
  })
  if (!resp.ok) throw new Error(`subgraph ${resp.status}`)
  const json = (await resp.json()) as {
    data?: { proposalVotes?: RawMemberVote[] }
    errors?: unknown
  }
  if (json.errors) throw new Error(JSON.stringify(json.errors))
  return json.data?.proposalVotes ?? []
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
