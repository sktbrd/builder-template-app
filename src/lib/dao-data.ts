import 'server-only'

import { PUBLIC_DEFAULT_CHAINS } from '@buildeross/constants/chains'
import { erc20Abi, tokenAbi } from '@buildeross/sdk/contract'
import {
  Auction_OrderBy,
  FeedEventType,
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
import { decodeProposalTx } from './proposal-tx-decoder'
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
  /** Full 0x address of the proposer. */
  proposer: string
  /** Reverse-resolved ENS / basename, when one exists. */
  proposerEns: string | null
  date: string
  forVotes: number
  againstVotes: number
  abstainVotes: number
  quorum: number
  endsLabel: string
  /** Voting end unix seconds — used to render a live countdown on active props. */
  voteEnd: number
  requested: { eth: number; usdc: number }
  /**
   * True when the proposal's requested ETH or any tracked ERC-20 transfer
   * exceeds the treasury's current balance. Only computed for proposals that
   * could still execute (pending / active / succeeded / queued); resolved
   * proposals (executed / defeated / vetoed / expired / cancelled) are false.
   */
  treasuryInsufficient: boolean
  /** First image URL found in the proposal's markdown description, if any. */
  thumbnail: string | null
  /**
   * Per-proposer activity in the recent window — used to surface a small
   * reputation badge next to the proposer pill on lists. `null` when the
   * caller didn't compute stats.
   */
  proposerStats: ProposerStats | null
  /**
   * Last few votes (newest first) inlined for the homepage proposal card.
   * Only populated for proposals where votes feel useful (active / recently
   * decided) — empty array otherwise to keep the payload tight.
   */
  recentVotes: ProposalVoteSummary[]
}

export type ProposalVoteSummary = {
  voter: string
  /** Reverse-resolved ENS for the voter, when available. */
  voterEns: string | null
  support: 'for' | 'against' | 'abstain'
  weight: number
  reason: string | null
}

export type ProposerStats = {
  /** Total proposals by this proposer in the data window. */
  total: number
  /** Proposals that reached a passing state (Succeeded / Queued / Executed). */
  passed: number
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
    startTimeUnix: number
    endTimeUnix: number
    topBidEth: string | null
    bidderShort: string | null
    /**
     * Most-recent bids for this auction, newest first. Bounded to keep the
     * homepage data budget tight — the hero only surfaces the top few with
     * their comments. Empty when there are no bids yet.
     */
    recentBids: Array<{
      id: string
      amountEth: string
      bidder: string
      bidderShort: string
      comment: string | null
    }>
  } | null
  recentProposals: ProposalSummary[]
  recentActivity: DashboardActivityItem[]
  auctionRevenueByMonth: number[] // last 12 buckets, ETH
  /**
   * Most-recently-minted tokens (current auction first) for the homepage
   * history strip. Capped at 16 to stay within the lite-template's
   * "bounded last N" data budget.
   */
  recentTokens: RecentTokenSummary[]
}

export type RecentTokenSummary = {
  tokenId: number
  name: string | null
  image: string | null
  /** Owner address lowercased. */
  owner: string
  /**
   * Display label for the owner pill on the strip. "Treasury" when the
   * treasury holds it; otherwise the owner's ENS name, falling back to the
   * short address.
   */
  ownerLabel: string
  /** Unix seconds when the token was minted (i.e. auction started). */
  mintedAt: number
  /** Winning bid in ETH, trimmed; null when the auction settled with no bid. */
  topBidEth: string | null
  /** Auction end time as unix seconds; null when the auction record isn't in
   *  the recent-year history window. */
  endedAtUnix: number | null
  /** True when this token corresponds to the live (unsettled) auction. */
  isLive: boolean
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
    recentTokensResp,
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
        ReturnType<ReturnType<typeof SubgraphSDK.connect>['totalAuctionSales']>
      >
    ),
    // 10 keeps enough headroom for the homepage proposals column to render
    // "Active" + a short "Recently ended" section without a second query.
    safeFetch('proposals', () => getProposals(chainId, tokenAddressLc, 10, 0), {
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
    // Last 16 tokens for the homepage history strip. Bounded list, no
    // pagination — quiet DAOs see fewer; busy DAOs cap out here.
    safeFetch(
      'recentTokens',
      () =>
        SubgraphSDK.connect(chainId).tokens({
          where: { dao: tokenAddressLc } as never,
          orderBy: Token_OrderBy.MintedAt,
          orderDirection: OrderDirection.Desc,
          first: 16,
        }),
      { tokens: [] } as Awaited<
        ReturnType<ReturnType<typeof SubgraphSDK.connect>['tokens']>
      >
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
        // Filled in below from the matching token's mintedAt — the auction
        // fragment doesn't carry startTime.
        startTimeUnix: 0,
        endTimeUnix: Number(a.endTime),
        topBidEth: a.highestBid ? formatEther(BigInt(a.highestBid.amount)) : null,
        bidderShort: a.highestBid ? short(a.highestBid.bidder) : null,
        // Filled in below by `getBids` — bounded to the most recent few so
        // the homepage hero can surface the latest bidders' comments without
        // dragging in the full bid history.
        recentBids: [] as NonNullable<DashboardData['currentAuction']>['recentBids'],
      }
    : null

  const recentProposers = Array.from(
    new Set(proposalsResp.proposals.map((p) => p.proposer))
  )

  // Only inline votes for live proposals — the homepage active card uses them,
  // the recently-ended rows don't, so we don't pay ENS resolution for those.
  type ProposalWithVotes = Proposal & {
    votes?: Array<{ voter: string }>
    state: ProposalState
  }
  const activeProposalsForVotes = proposalsResp.proposals.filter((p) =>
    isLiveStatus(mapProposalState(p.state))
  ) as ProposalWithVotes[]
  const activeVoters = Array.from(
    new Set(
      activeProposalsForVotes.flatMap((p) =>
        (p.votes ?? []).slice(-5).map((v) => String(v.voter))
      )
    )
  )

  const [recentProposerEns, voterEnsMap, treasuryBalances, currentAuctionBids] =
    await Promise.all([
      resolveEnsNames(recentProposers),
      activeVoters.length > 0
        ? resolveEnsNames(activeVoters)
        : Promise.resolve(new Map<string, string>()),
      fetchTreasuryBalances(),
      // Fetch the live auction's bids only — past tokens collapse to just their
      // winning bid on the hero, so we never need their full history here.
      currentAuction
        ? safeFetch(
            'currentAuction.getBids',
            () =>
              getBids(chainId, daoConfig.addresses.token, String(currentAuction.tokenId)),
            [] as Awaited<ReturnType<typeof getBids>>
          )
        : Promise.resolve([] as Awaited<ReturnType<typeof getBids>>),
    ])

  // getBids returns ETH-formatted amounts (matching how AuctionPageBid handles
  // them). Truncate to the most-recent 5 so the hero list stays compact.
  if (currentAuction) {
    currentAuction.recentBids = (currentAuctionBids ?? []).slice(0, 5).map((b) => ({
      id: String(b.id),
      amountEth: String(b.amount),
      bidder: String(b.bidder),
      bidderShort: short(String(b.bidder)),
      comment: (b as { comment?: string | null }).comment ?? null,
    }))
  }
  const recentProposerStats = computeProposerStats(proposalsResp.proposals)
  const recentProposals: ProposalSummary[] = proposalsResp.proposals.map((p) =>
    formatProposal(p, {
      proposerEns: recentProposerEns.get(String(p.proposer).toLowerCase()) ?? null,
      treasury: treasuryBalances,
      proposerStats: recentProposerStats.get(String(p.proposer).toLowerCase()) ?? null,
      voterEns: voterEnsMap,
      includeVotes: isLiveStatus(mapProposalState(p.state)),
    })
  )

  const auctionRevenueByMonth = bucketAuctionRevenueByMonth(
    historyResp?.dao?.auctions ?? []
  )

  // Build the activity feed from real events: latest bids + latest
  // proposals. Merged & sorted by actual timestamp.
  const recentActivity = await buildRecentActivity(proposalsResp.proposals)

  // Build a lookup from `auctionHistory` (already fetched for revenue bucketing
  // above) so each recent token can carry its winning bid + end time without a
  // separate query. auctionHistory ids are "tokenAddr:tokenId".
  const auctionByTokenId = new Map<number, { amountWei: bigint; endTime: number }>()
  for (const a of historyResp?.dao?.auctions ?? []) {
    const idStr = String(a.id)
    const tokenPart = idStr.includes(':') ? (idStr.split(':').pop() ?? '0') : idStr
    const tokenId = Number.parseInt(tokenPart, 10)
    if (!Number.isFinite(tokenId)) continue
    let amountWei = BigInt(0)
    try {
      amountWei = a.winningBid ? BigInt(String(a.winningBid.amount)) : BigInt(0)
    } catch {
      // ignore malformed
    }
    auctionByTokenId.set(tokenId, {
      amountWei,
      endTime: Number(a.endTime ?? 0),
    })
  }

  const treasuryLc = daoConfig.addresses.treasury.toLowerCase()
  const liveTokenId = currentAuction?.tokenId
  // Resolve ENS for the recent winners so the strip shows names, not just
  // truncated addresses (bounded batch — only the tokens shown on the strip).
  const winnerEns = await resolveEnsNames(
    (recentTokensResp.tokens ?? [])
      .map((t) => String(t.owner ?? '').toLowerCase())
      .filter((a) => a && a !== treasuryLc)
  )
  const recentTokens: RecentTokenSummary[] = (recentTokensResp.tokens ?? []).map((t) => {
    const ownerLc = String(t.owner ?? '').toLowerCase()
    const tokenId = Number(t.tokenId)
    const auctionRow = auctionByTokenId.get(tokenId)
    const topBidEth =
      auctionRow && auctionRow.amountWei > BigInt(0)
        ? formatEther(auctionRow.amountWei)
        : null
    return {
      tokenId,
      name: t.name ?? null,
      image: t.image ?? null,
      owner: ownerLc,
      ownerLabel:
        ownerLc === treasuryLc ? 'Treasury' : (winnerEns.get(ownerLc) ?? short(ownerLc)),
      mintedAt: Number(t.mintedAt ?? 0),
      topBidEth,
      endedAtUnix: auctionRow?.endTime ?? null,
      isLive: liveTokenId === tokenId,
    }
  })

  // The findAuctions/CurrentAuctionFragment doesn't carry startTime — derive
  // it from the matching token's mintedAt instead.
  if (currentAuction) {
    const live = recentTokens.find((rt) => rt.tokenId === currentAuction.tokenId)
    if (live) currentAuction.startTimeUnix = live.mintedAt
  }

  return {
    totalSupply,
    ownerCount,
    treasuryEth,
    totalAuctionSalesEth,
    currentAuction,
    recentProposals,
    recentActivity,
    auctionRevenueByMonth,
    recentTokens,
  }
}

async function buildRecentActivity(
  proposals: Proposal[]
): Promise<DashboardActivityItem[]> {
  // feedEvents carries real per-bid timestamps; getBids does not.
  // No time filter — quieter DAOs would otherwise show an empty Bids tab.
  // Sized to roughly match the proposals column height, not a full feed.
  const bidsResp = await safeFetch(
    'dashboard.activityBids',
    () =>
      SubgraphSDK.connect(chainId).feedEvents({
        first: 8,
        where: {
          dao: tokenAddressLc,
          type: FeedEventType.AuctionBidPlaced,
        },
      }),
    { feedEvents: [] } as Awaited<
      ReturnType<ReturnType<typeof SubgraphSDK.connect>['feedEvents']>
    >
  )

  type FeedEvt = (typeof bidsResp.feedEvents)[number]
  type BidEvt = Extract<FeedEvt, { __typename: 'AuctionBidPlacedEvent' }>

  const bidEvents = (bidsResp.feedEvents ?? [])
    .filter((e): e is BidEvt => e.__typename === 'AuctionBidPlacedEvent')
    .map((e) => {
      const tokenId = Number(e.auction.token.tokenId)
      const amountEth = trimDec(formatEther(BigInt(String(e.bid.amount))), 4)
      const ts = Number(e.timestamp)
      return {
        type: 'bid' as const,
        who: short(e.bid.bidder),
        what: `bid ${amountEth} ETH on #${tokenId}`,
        timeAgo: relativeTimeAgo(ts * 1000),
        href: `/auction/${tokenId}`,
        _ts: ts,
      }
    })

  const propEvents = proposals.slice(0, 6).map((p) => ({
    type: 'prop' as const,
    who: short(p.proposer),
    what: `created proposal #${p.proposalNumber}`,
    timeAgo: relativeTimeAgo(Number(p.timeCreated) * 1000),
    href: `/proposals/${Number(p.proposalNumber)}`,
    _ts: Number(p.timeCreated),
  }))

  // 6 items keeps the Activity card's natural height ≈ the 5-row
  // Recent Proposals card; grid stretching handles shorter Bids/Props tabs.
  return [...bidEvents, ...propEvents]
    .sort((a, b) => b._ts - a._ts)
    .slice(0, 6)
    .map(({ _ts: _, ...rest }) => rest)
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

type FormatProposalOptions = {
  proposerEns?: string | null
  /** Treasury holdings — ETH wei + per-token (lowercase addr) raw amounts. */
  treasury?: TreasuryBalances
  /** Per-proposer reputation stats computed across the data window. */
  proposerStats?: ProposerStats | null
  /**
   * Map of voter addr (lowercased) → ENS, for inlining onto recentVotes.
   * Caller pre-resolves so we batch the lookups outside the formatter.
   */
  voterEns?: Map<string, string>
  /** When true, surface the proposal's last few votes on the summary. */
  includeVotes?: boolean
}

function formatProposal(p: Proposal, opts: FormatProposalOptions = {}): ProposalSummary {
  const status = mapProposalState(p.state)
  const created = Number(p.timeCreated) * 1000
  // The subgraph fragment carries voteStart/voteEnd/expiresAt/executedAt (unix
  // seconds) but the typed shape doesn't expose them — same cast pattern as
  // `votes` below. Missing fields read as 0 so callers degrade gracefully.
  const sec = (k: string) => Number((p as unknown as Record<string, unknown>)[k] ?? 0)
  const date = new Date(created).toLocaleDateString(undefined, {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  })

  const decoded = decodeRequestedAmounts(
    p.targets ?? [],
    splitCalldatas(p.calldatas as unknown as string | string[] | null | undefined),
    p.values ?? []
  )
  const requested = formatRequestedForCard(decoded)
  const treasuryInsufficient =
    opts.treasury && isLiveStatus(status)
      ? isInsufficientVsTreasury(decoded, opts.treasury)
      : false

  // votes are nested on the proposal fragment by the subgraph but the typed
  // shape doesn't expose them — same cast as in `getProposalByNumber`.
  const rawVotes = (p as unknown as { votes?: Array<RawProposalVote> }).votes ?? []
  const recentVotes: ProposalVoteSummary[] = opts.includeVotes
    ? rawVotes
        .slice()
        // Insertion order — newest last per subgraph; reverse to newest-first.
        .reverse()
        .slice(0, 5)
        .map((v) => ({
          voter: String(v.voter),
          voterEns: opts.voterEns?.get(String(v.voter).toLowerCase()) ?? null,
          support: mapVoteSupport(v.support),
          weight: Number(v.weight ?? 0),
          reason: v.reason && v.reason.trim().length > 0 ? v.reason : null,
        }))
    : []

  return {
    id: Number(p.proposalNumber),
    proposalNumber: Number(p.proposalNumber),
    title: p.title ?? `Proposal ${p.proposalNumber}`,
    status,
    proposer: p.proposer,
    proposerEns: opts.proposerEns ?? null,
    date,
    forVotes: Number(p.forVotes ?? 0),
    againstVotes: Number(p.againstVotes ?? 0),
    abstainVotes: Number(p.abstainVotes ?? 0),
    quorum: Number(p.quorumVotes ?? 0),
    endsLabel: relativeLabel(status, created, {
      voteStartMs: sec('voteStart') * 1000,
      voteEndMs: sec('voteEnd') * 1000,
      expiresMs: sec('expiresAt') * 1000,
      executedMs: sec('executedAt') * 1000,
    }),
    voteEnd: sec('voteEnd'),
    requested,
    treasuryInsufficient,
    thumbnail: extractFirstImage(p.description ?? ''),
    proposerStats: opts.proposerStats ?? null,
    recentVotes,
  }
}

/**
 * Tally per-proposer activity from a slice of recent proposals. The result
 * is bounded by the same limit the caller passed to `getAllProposals` — i.e.
 * "recent window" reputation, not all-time.
 */
export function computeProposerStats(proposals: Proposal[]): Map<string, ProposerStats> {
  const out = new Map<string, ProposerStats>()
  for (const p of proposals) {
    const key = String(p.proposer).toLowerCase()
    const entry = out.get(key) ?? { total: 0, passed: 0 }
    entry.total += 1
    const state = mapProposalState(p.state)
    if (state === 'executed' || state === 'queued' || state === 'succeeded') {
      entry.passed += 1
    }
    out.set(key, entry)
  }
  return out
}

function extractFirstImage(markdown: string): string | null {
  const match = markdown.match(/!\[.*?\]\((https?:\/\/[^)\s]+)\)/)
  return match?.[1] ?? null
}

// ── Requested-amount decode + treasury-insufficient check ──

type DecodedRequested = {
  ethWei: bigint
  /** lowercase token addr → raw amount (in token's base units) */
  byToken: Map<string, bigint>
}

export type TreasuryBalances = {
  ethWei: bigint
  /** lowercase token addr → raw balance */
  byToken: Map<string, bigint>
}

const ERC20_TRANSFER_SELECTOR = '0xa9059cbb' // transfer(address,uint256)

/**
 * `Proposal.calldatas` ships in two shapes depending on the read path:
 *  - `getProposals(...)` (list helper) already pre-splits to `string[]`.
 *  - `SubgraphSDK.connect(...).proposals(...)` returns the raw colon-separated
 *    string straight from the subgraph.
 *
 * The TS types claim `Maybe<string>` in both cases, but the array shape is
 * load-bearing at runtime — accept both and normalize.
 */
function splitCalldatas(raw: string | string[] | null | undefined): string[] {
  if (!raw) return []
  const parts = Array.isArray(raw) ? raw : raw.split(':')
  // Keep every segment positionally aligned with targets[]/values[]. An empty
  // segment is an ETH-only transfer (no calldata) and must normalize to '0x',
  // NOT be dropped — filtering it shifts later calldatas onto the wrong target,
  // mismatching the on-chain proposal hash so execute() reverts (and rendering
  // decoded-tx cards against the wrong target).
  return parts.map((c) => {
    const t = (c ?? '').trim()
    if (!t || t === '0x') return '0x'
    return t.startsWith('0x') ? t : `0x${t}`
  })
}

function decodeRequestedAmounts(
  targets: readonly string[],
  calldatas: readonly string[],
  values: readonly string[]
): DecodedRequested {
  let ethWei = BigInt(0)
  const byToken = new Map<string, bigint>()

  const len = Math.max(targets.length, calldatas.length, values.length)
  for (let i = 0; i < len; i++) {
    const v = values[i]
    if (v) {
      try {
        ethWei += BigInt(v)
      } catch {
        // ignore malformed
      }
    }
    const cd = calldatas[i]
    const tgt = targets[i]
    if (cd && tgt && cd.toLowerCase().startsWith(ERC20_TRANSFER_SELECTOR)) {
      // Standard ERC-20 transfer: 4-byte selector + 32-byte recipient + 32-byte
      // amount. In hex chars that's 2 (0x) + 8 + 64 + 64 = 138.
      if (cd.length >= 138) {
        const amountHex = `0x${cd.slice(74, 138)}`
        try {
          const amount = BigInt(amountHex)
          const key = tgt.toLowerCase()
          byToken.set(key, (byToken.get(key) ?? BigInt(0)) + amount)
        } catch {
          // ignore unparseable amount
        }
      }
    }
  }

  return { ethWei, byToken }
}

function formatRequestedForCard(d: DecodedRequested): { eth: number; usdc: number } {
  const eth = Number(formatEther(d.ethWei))
  // Sum stablecoin requests across configured treasury tokens whose symbol
  // matches "USDC". Other ERC-20 requests don't show on the card (they still
  // contribute to the insufficient check).
  let usdcRaw = BigInt(0)
  let usdcDecimals = 6
  for (const t of daoConfig.treasuryTokens) {
    if (t.symbol === 'USDC') {
      const raw = d.byToken.get(t.address.toLowerCase()) ?? BigInt(0)
      usdcRaw += raw
      usdcDecimals = t.decimals
    }
  }
  const base = BigInt(10) ** BigInt(usdcDecimals)
  const usdc = Number(usdcRaw / base)
  return { eth, usdc }
}

function isInsufficientVsTreasury(
  requested: DecodedRequested,
  treasury: TreasuryBalances
): boolean {
  if (requested.ethWei > treasury.ethWei) return true
  for (const [addr, amount] of requested.byToken) {
    const balance = treasury.byToken.get(addr) ?? BigInt(0)
    if (amount > balance) return true
  }
  return false
}

/** Only proposals that could still execute get checked. */
function isLiveStatus(status: ProposalStatus): boolean {
  return (
    status === 'pending' ||
    status === 'active' ||
    status === 'succeeded' ||
    status === 'queued'
  )
}

/**
 * Reads the treasury's ETH balance + ERC-20 balances for every token listed in
 * `daoConfig.treasuryTokens`. Used by the "insufficient treasury" badge logic.
 * Returns zero balances if `publicClient` is unavailable.
 */
async function fetchTreasuryBalances(): Promise<TreasuryBalances> {
  const byToken = new Map<string, bigint>()
  if (!publicClient) return { ethWei: BigInt(0), byToken }

  const tokens = daoConfig.treasuryTokens
  const [ethWei, balances] = await Promise.all([
    safeFetch(
      'treasuryBalances.eth',
      () =>
        publicClient.getBalance({
          address: daoConfig.addresses.treasury as `0x${string}`,
        }),
      BigInt(0)
    ),
    tokens.length === 0
      ? Promise.resolve([] as Array<{ status: 'success' | 'failure'; result?: unknown }>)
      : safeFetch(
          'treasuryBalances.tokens',
          () =>
            publicClient.multicall({
              contracts: tokens.map((t) => ({
                address: t.address,
                abi: erc20Abi,
                functionName: 'balanceOf',
                args: [daoConfig.addresses.treasury as `0x${string}`],
              })),
              allowFailure: true,
            }),
          [] as Array<{ status: 'success' | 'failure'; result?: unknown }>
        ),
  ])

  balances.forEach((r, i) => {
    const raw =
      r?.status === 'success' && typeof r.result === 'bigint' ? r.result : BigInt(0)
    byToken.set(tokens[i].address.toLowerCase(), raw)
  })

  return { ethWei, byToken }
}

/**
 * The header label rendered right after the StatusBadge. It must describe the
 * *event* that defines the current state, not the creation age — otherwise a
 * proposal that executed 2 days ago but was created 9 days ago reads
 * "Executed · 9 days ago". The optional `ev` timestamps (ms) let
 * terminal/decided states anchor on the real event; absent fields fall back to
 * a neutral "Created …".
 */
function relativeLabel(
  status: ProposalStatus,
  createdMs: number,
  ev: {
    voteStartMs?: number
    voteEndMs?: number
    expiresMs?: number
    executedMs?: number
  } = {}
) {
  const now = Date.now()
  const ago = (ms: number) => {
    const days = Math.floor((now - ms) / 86_400_000)
    if (days < 1) return 'today'
    if (days === 1) return '1 day ago'
    if (days < 30) return `${days} days ago`
    const months = Math.floor(days / 30)
    return months === 1 ? '1 month ago' : `${months} months ago`
  }
  if (status === 'pending') return 'Voting opens soon'
  if (status === 'active') {
    // Anchor on voteStart (when voting actually opened), not creation — a
    // votingDelay can push them across a day boundary.
    const base = ev.voteStartMs && ev.voteStartMs > 0 ? ev.voteStartMs : createdMs
    const days = Math.floor((now - base) / 86_400_000)
    return days <= 0 ? 'Active now' : `Started ${days}d ago`
  }
  if (status === 'succeeded') return 'Ready to queue'
  if (status === 'queued') return 'Awaiting execution'
  if (status === 'executed' && ev.executedMs) return `Executed ${ago(ev.executedMs)}`
  if (status === 'expired' && ev.expiresMs) return `Expired ${ago(ev.expiresMs)}`
  if (status === 'defeated' && ev.voteEndMs) return `Voting ended ${ago(ev.voteEndMs)}`
  // vetoed / cancelled carry no event timestamp on the fetched fragment.
  return `Created ${ago(createdMs)}`
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

export type TreasuryTx = {
  dir: 'in' | 'out'
  who: string
  addr: string
  tag: string
  amount: string
  symbol: string
  timestamp: number
  relativeTime: string
  proposalNumber?: number
}

export type TreasuryPageData = {
  treasuryEth: string
  treasuryAddress: string
  totalAuctionSalesEth: string
  ownerCount: number
  totalSupply: number
  ethUsdPrice: number
  // 12 monthly buckets, oldest → newest
  auctionRevenueByMonth: number[]
  proposalsByMonth: number[]
  /** Voters per recent proposal (last 14 proposals, oldest → newest). */
  votersByProposal: number[]
  nftHoldings: TreasuryNft[]
  nftHoldingsCount: number
  tokenHoldings: TreasuryTokenHolding[]
  recentTxs: TreasuryTx[]
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
          first: 500,
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

  const ethUsdPrice = await fetchEthUsdPrice()

  // ── Recent transactions (inflows from auctions, outflows from executed proposals) ──
  const auctionTxs: TreasuryTx[] = (historyResp?.dao?.auctions ?? [])
    .filter((a) => a.winningBid?.amount)
    .map((a) => {
      const idStr = String(a.id)
      const tokenPart = idStr.includes(':') ? (idStr.split(':').pop() ?? '0') : idStr
      const tokenId = Number.parseInt(tokenPart, 10) || 0
      const amountEth = Number(formatEther(BigInt(String(a.winningBid!.amount))))
      return {
        dir: 'in' as const,
        who: `Auction #${tokenId}`,
        addr: short(daoConfig.addresses.auction),
        tag: 'Auction settle',
        amount: amountEth.toFixed(4).replace(/\.?0+$/, '') || '0',
        symbol: 'ETH',
        timestamp: Number(a.endTime),
        relativeTime: txRelativeTime(Number(a.endTime)),
      }
    })

  // Decode per-token transfers from executed proposals
  const knownTokens = daoConfig.treasuryTokens
  const proposalTxs: TreasuryTx[] = []
  for (const p of (proposalsResp?.proposals ?? []).filter((p) => p.executedAt)) {
    const transfers = decodePropTransfers(
      p.targets as unknown as string[],
      p.calldatas as unknown as string[],
      p.values as unknown as string[],
      knownTokens
    )
    if (transfers.length === 0) continue
    const propWho = p.title
      ? p.title.length > 32
        ? p.title.slice(0, 30) + '…'
        : p.title
      : `Prop #${p.proposalNumber}`
    for (const t of transfers) {
      proposalTxs.push({
        dir: 'out',
        who: propWho,
        addr: short(String(p.proposer)),
        tag: `Prop #${p.proposalNumber}`,
        amount: t.amount,
        symbol: t.symbol,
        timestamp: Number(p.executedAt),
        relativeTime: txRelativeTime(Number(p.executedAt)),
        proposalNumber: p.proposalNumber,
      })
    }
  }

  const recentTxs = [...auctionTxs, ...proposalTxs]
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 16)

  return {
    treasuryEth,
    treasuryAddress: daoConfig.addresses.treasury,
    totalAuctionSalesEth,
    ownerCount,
    totalSupply,
    ethUsdPrice,
    auctionRevenueByMonth,
    proposalsByMonth,
    votersByProposal,
    nftHoldings,
    nftHoldingsCount,
    tokenHoldings,
    recentTxs,
  }
}

function decodePropTransfers(
  targets: string[],
  calldatas: string[],
  values: string[],
  knownTokens: Array<{ address: string; symbol: string; decimals: number }>
): Array<{ symbol: string; amount: string }> {
  const tokenMap = new Map(knownTokens.map((t) => [t.address.toLowerCase(), t]))
  const bySymbol = new Map<string, number>()

  const len = Math.max(targets?.length ?? 0, calldatas?.length ?? 0, values?.length ?? 0)
  for (let i = 0; i < len; i++) {
    const cd = calldatas?.[i] ?? '0x'
    const target = (targets?.[i] ?? '').toLowerCase()
    const value = values?.[i] ?? '0'

    // Native ETH transfer
    try {
      if (BigInt(value) > 0) {
        const eth = Number(formatEther(BigInt(value)))
        bySymbol.set('ETH', (bySymbol.get('ETH') ?? 0) + eth)
      }
    } catch {}

    // ERC-20 transfer(address,uint256)
    const selector = cd.startsWith('0x') ? cd.slice(2, 10) : cd.slice(0, 8)
    if (selector === ERC20_TRANSFER_SELECTOR.slice(2)) {
      const token = tokenMap.get(target)
      if (token) {
        try {
          const full = cd.startsWith('0x') ? cd : '0x' + cd
          // 0x + 8 (selector) + 64 (address pad) + 64 (amount) = 138 chars
          const amountHex = '0x' + full.slice(74, 138)
          const human = Number(BigInt(amountHex)) / 10 ** token.decimals
          bySymbol.set(token.symbol, (bySymbol.get(token.symbol) ?? 0) + human)
        } catch {}
      }
    }
  }

  return Array.from(bySymbol.entries()).map(([symbol, total]) => ({
    symbol,
    amount:
      symbol === 'ETH'
        ? total.toFixed(4).replace(/\.?0+$/, '') || '0'
        : total.toLocaleString('en-US', { maximumFractionDigits: 2 }),
  }))
}

async function fetchEthUsdPrice(): Promise<number> {
  try {
    const res = await fetch('https://api.coinbase.com/v2/exchange-rates?currency=ETH', {
      next: { revalidate: 120 },
    })
    if (!res.ok) return 0
    const json = await res.json()
    const p = parseFloat(json?.data?.rates?.USD ?? '0')
    return isNaN(p) ? 0 : p
  } catch {
    return 0
  }
}

function txRelativeTime(timestamp: number): string {
  const diff = Math.floor(Date.now() / 1000) - timestamp
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 86400 * 30) return `${Math.floor(diff / 86400)} days ago`
  return `${Math.floor(diff / (86400 * 30))} mo ago`
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
  const proposers = Array.from(new Set(resp.proposals.map((p) => p.proposer)))
  const [ensMap, treasuryBalances] = await Promise.all([
    resolveEnsNames(proposers),
    fetchTreasuryBalances(),
  ])
  const statsByProposer = computeProposerStats(resp.proposals)
  return resp.proposals.map((p) =>
    formatProposal(p, {
      proposerEns: ensMap.get(String(p.proposer).toLowerCase()) ?? null,
      treasury: treasuryBalances,
      proposerStats: statsByProposer.get(String(p.proposer).toLowerCase()) ?? null,
    })
  )
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
  /** Image URLs for NFT transfers on the DAO's own token contract, keyed by
   * tokenId (as decimal string). Empty when no send-NFT calls reference the
   * DAO token. Other ERC-721s aren't enriched here. */
  nftImages: Record<string, string>
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

  // `Proposal.calldatas` is a single colon-separated string per Builder's
  // encoding; the module-level `splitCalldatas` rebuilds the array form.
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

  // Enrich: for ERC-721 transfers that target the DAO's own token contract,
  // batch-fetch the artwork from the Builder subgraph so the proposal detail
  // page can render an image instead of a generic icon.
  const nftTokenIdsForDao: string[] = []
  for (const tx of transactions) {
    const decoded = decodeProposalTx(
      { target: tx.target, calldata: tx.calldata, valueWei: tx.valueWei },
      chainId
    )
    if (
      decoded.type === 'send-nfts' &&
      decoded.tokenId != null &&
      decoded.target.toLowerCase() === tokenAddressLc
    ) {
      nftTokenIdsForDao.push(decoded.tokenId.toString())
    }
  }
  const nftImages: Record<string, string> = {}
  if (nftTokenIdsForDao.length > 0) {
    const tokensResp = await safeFetch(
      'proposalDetail.nftImages',
      () =>
        SubgraphSDK.connect(chainId).tokens({
          where: {
            tokenContract: tokenAddressLc,
            tokenId_in: nftTokenIdsForDao as never,
          } as never,
          first: nftTokenIdsForDao.length,
        }),
      { tokens: [] } as Awaited<
        ReturnType<ReturnType<typeof SubgraphSDK.connect>['tokens']>
      >
    )
    for (const t of tokensResp.tokens ?? []) {
      if (t.image) nftImages[String(t.tokenId)] = t.image
    }
  }

  // The `proposals(where, first:1)` query already returns `votes` nested on
  // each proposal (see sdk.generated.js — `...ProposalVote` is part of the
  // doc), but the typed return doesn't include them. Bypass the cast and
  // pull them off the raw response.
  const rawVotes = (fragment as unknown as { votes?: Array<RawProposalVote> }).votes ?? []

  // Subgraph returns votes in insertion order; the list renders newest-first,
  // so reverse first and resolve ENS over the *rendered* leading window —
  // otherwise (for >ENS_RESOLVE_LIMIT votes) ENS is spent on the oldest rows
  // while the visible top rows fall back to bare addresses.
  const ENS_RESOLVE_LIMIT = 20
  const orderedVotes = rawVotes.slice().reverse()

  // Resolve ENS for the proposer + the top voters in one batched call.
  // Treasury balances are fetched in parallel for the insufficient-treasury
  // badge on the summary.
  const proposerLc = String(fragment.proposer).toLowerCase()
  const voterAddrs = orderedVotes.slice(0, ENS_RESOLVE_LIMIT).map((v) => String(v.voter))
  const [ensMap, treasuryBalances] = await Promise.all([
    resolveEnsNames([fragment.proposer, ...voterAddrs]),
    fetchTreasuryBalances(),
  ])
  const proposerEns = ensMap.get(proposerLc) ?? null

  const votes: ProposalDetailVote[] = orderedVotes.map((v) => ({
    voter: String(v.voter),
    voterShort: short(String(v.voter)),
    voterEns: ensMap.get(String(v.voter).toLowerCase()) ?? null,
    support: mapVoteSupport(v.support),
    weight: Number(v.weight ?? 0),
    // Match the homepage guard — a whitespace-only reason would render a blank
    // paragraph on the votes list.
    reason: v.reason && v.reason.trim().length > 0 ? v.reason : null,
  }))

  return {
    summary: formatProposal(proposalLike, {
      proposerEns,
      treasury: treasuryBalances,
    }),
    proposalIdHash: String(fragment.proposalId) as `0x${string}`,
    descriptionHash: String(fragment.descriptionHash) as `0x${string}`,
    description: fragment.description ?? '',
    proposerFull: fragment.proposer,
    proposerEns,
    snapshotBlockNumber: Number(fragment.snapshotBlockNumber ?? 0),
    voteStart: Number(fragment.voteStart ?? 0),
    voteEnd: Number(fragment.voteEnd ?? 0),
    transactions,
    nftImages,
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
  /** Reverse-resolved ENS / basename, when one exists. */
  ens: string | null
  ownershipPct: number
  vestExpiry: number
}

export type AboutPageData = {
  treasuryEth: string
  ownerCount: number
  totalSupply: number
  description: string | null
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
          ens: null as string | null,
          ownershipPct: f.ownershipPct,
          vestExpiry: Number(f.vestExpiry),
        }))
      },
      [] as AboutFounder[]
    ),
  ])

  const founderEnsMap = await resolveEnsNames(founders.map((f) => f.wallet))
  const foundersWithEns = founders.map((f) => ({
    ...f,
    ens: founderEnsMap.get(f.wallet.toLowerCase()) ?? null,
  }))

  return {
    treasuryEth: formatEther(treasuryWei),
    ownerCount: info?.dao?.ownerCount ?? 0,
    totalSupply: info?.dao?.totalSupply ?? 0,
    description: info?.dao?.description ?? null,
    founders: foundersWithEns,
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

export type AuctionPricePoint = {
  /** Token ID parsed from the subgraph auction id (`<dao>:<tokenId>`). */
  tokenId: number
  /** Unix seconds. */
  endTime: number
  /** Winning bid in ETH. */
  ethAmount: number
}

/**
 * Auction price history for the chart view. Settled auctions only,
 * sorted oldest-to-newest. Bounded by `days` so the SVG point count
 * stays reasonable on long-lived DAOs.
 */
/**
 * Lightweight ERC-20 treasury holdings — used by the "Send ERC-20" proposal
 * form to render a quick-pick row with live balances. Returns only tokens
 * the treasury actually holds, sorted by balance desc.
 */
export async function getTreasuryTokenHoldings(): Promise<TreasuryTokenHolding[]> {
  const treasuryAddrLc = daoConfig.addresses.treasury.toLowerCase() as `0x${string}`
  return fetchTreasuryTokenHoldings(treasuryAddrLc)
}

/**
 * Lightweight version of the treasury NFT query — just the NFTs, no balances,
 * auctions, or proposal data. Used by the "Send NFT" proposal form.
 */
export async function getTreasuryNftHoldings(): Promise<TreasuryNft[]> {
  const treasuryAddrLc = daoConfig.addresses.treasury.toLowerCase()
  const resp = await safeFetch(
    'treasuryNftHoldings',
    () =>
      SubgraphSDK.connect(chainId).tokens({
        where: { dao: tokenAddressLc, owner: treasuryAddrLc } as never,
        orderBy: Token_OrderBy.MintedAt,
        orderDirection: OrderDirection.Desc,
        first: 500,
      }),
    { tokens: [] } as Awaited<
      ReturnType<ReturnType<typeof SubgraphSDK.connect>['tokens']>
    >
  )
  return (resp.tokens ?? []).map((t) => ({
    tokenId: Number(t.tokenId),
    name: t.name,
    image: t.image ?? null,
    mintedAt: Number(t.mintedAt),
  }))
}

export async function getAuctionPriceHistory(days = 365): Promise<AuctionPricePoint[]> {
  const startTime = Math.floor(Date.now() / 1000) - days * 86400
  const resp = await safeFetch(
    'auctionPriceHistory',
    () =>
      SubgraphSDK.connect(chainId).auctionHistory({
        daoId: tokenAddressLc,
        startTime: BigInt(startTime).toString() as unknown as bigint,
        orderBy: Auction_OrderBy.EndTime,
        orderDirection: OrderDirection.Asc,
        first: 1000,
      }),
    { dao: null } as Awaited<
      ReturnType<ReturnType<typeof SubgraphSDK.connect>['auctionHistory']>
    >
  )
  const auctions = resp?.dao?.auctions ?? []
  return auctions
    .filter((a) => a.settled && a.winningBid)
    .map((a) => {
      const idStr = String(a.id)
      const tokenPart = idStr.includes(':') ? (idStr.split(':').pop() ?? '0') : idStr
      return {
        tokenId: Number.parseInt(tokenPart, 10) || 0,
        endTime: Number(a.endTime),
        ethAmount: Number(formatEther(BigInt(a.winningBid!.amount))),
      }
    })
}
