'use client'

import { encodeFunctionData, formatEther, parseEther, parseUnits } from 'viem'

import { ProposalActions } from '@/components/dao/ProposalActions'
import { ProposalDetailView } from '@/components/dao/ProposalDetailView'
import { ProposalTransactionList } from '@/components/dao/ProposalTransactionList'
import { ProposalVotesList } from '@/components/dao/ProposalVotesList'
import { StatusBadge } from '@/components/dao/StatusBadge'
import { TreasuryInsufficientBadge } from '@/components/dao/TreasuryInsufficientBadge'
import { VoteBar } from '@/components/dao/VoteBar'
import { VotingPowerExplainer } from '@/components/dao/VotingPowerExplainer'
import { daoConfig } from '@/lib/dao.config'
import type {
  ProposalDetail,
  ProposalDetailVote,
  ProposalSummary,
  ProposalTransaction,
} from '@/lib/dao-data'
import type { ProposalStatus } from '@/lib/types'

// Countdowns and relative labels run live from page load — `now` is sampled
// once so every fixture is consistent within a render.
const now = Math.floor(Date.now() / 1000)
const DAY = 86_400
const HOUR = 3_600
const MIN = 60

const STATUSES: ProposalStatus[] = [
  'pending',
  'active',
  'cancelled',
  'defeated',
  'succeeded',
  'queued',
  'expired',
  'executed',
  'vetoed',
]

// ── Fixtures ───────────────────────────────────────────────────

const HASH = ('0x' + 'ab'.repeat(32)) as `0x${string}`
const DESC_HASH = ('0x' + 'cd'.repeat(32)) as `0x${string}`
const PROPOSER = '0x3a21d6f2c8b1a09e4f5c7d8e9a0b1c2d3e4f5ead'
const RECIPIENT = '0x1b3c4d5e6f7081920a1b2c3d4e5f60718293a4b5'
const USDC_BASE = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913'
const RANDOM_ERC20 = '0x4200000000000000000000000000000000000042'

function short(addr: string) {
  return addr.length < 10 ? addr : `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

function fakeAddr(i: number) {
  return '0x' + (0x2000 + i).toString(16).padStart(40, '0')
}

// Mirrors the (fixed) relativeLabel in dao-data so each fixture's header copy
// matches exactly what the real route would render for the same dates.
function ago(sec: number): string {
  const days = Math.floor((now - sec) / DAY)
  if (days < 1) return 'today'
  if (days === 1) return '1 day ago'
  if (days < 30) return `${days} days ago`
  const months = Math.floor(days / 30)
  return months === 1 ? '1 month ago' : `${months} months ago`
}

type Offsets = {
  timeCreated: number
  voteStart: number
  voteEnd: number
  expiresAt?: number | null
  executedAt?: number | null
}

function endsLabelFor(status: ProposalStatus, o: Offsets): string {
  if (status === 'pending') return 'Voting opens soon'
  if (status === 'active') {
    const days = Math.floor((now - o.voteStart) / DAY)
    return days <= 0 ? 'Active now' : `Started ${days}d ago`
  }
  if (status === 'succeeded') return 'Ready to queue'
  if (status === 'queued') return 'Awaiting execution'
  if (status === 'executed' && o.executedAt) return `Executed ${ago(o.executedAt)}`
  if (status === 'expired' && o.expiresAt) return `Expired ${ago(o.expiresAt)}`
  if (status === 'defeated') return `Voting ended ${ago(o.voteEnd)}`
  return `Created ${ago(o.timeCreated)}`
}

type Tallies = { for: number; against: number; abstain: number; quorum: number }

function buildDetail(
  status: ProposalStatus,
  o: Offsets,
  over: {
    title?: string
    tallies?: Tallies
    treasuryInsufficient?: boolean
    description?: string
    transactions?: ProposalTransaction[]
    votes?: ProposalDetailVote[]
    nftImages?: Record<string, string>
    proposerEns?: string | null
  } = {}
): ProposalDetail {
  const t = over.tallies ?? { for: 0, against: 0, abstain: 0, quorum: 10 }
  const summary: ProposalSummary = {
    id: 42,
    proposalNumber: 42,
    title: over.title ?? `Demo ${status} proposal`,
    status,
    proposer: PROPOSER,
    proposerEns: over.proposerEns ?? null,
    date: new Date(o.timeCreated * 1000).toLocaleDateString(undefined, {
      month: 'short',
      day: '2-digit',
      year: 'numeric',
    }),
    forVotes: t.for,
    againstVotes: t.against,
    abstainVotes: t.abstain,
    quorum: t.quorum,
    endsLabel: endsLabelFor(status, o),
    voteEnd: o.voteEnd,
    requested: { eth: 0, usdc: 0 },
    treasuryInsufficient: over.treasuryInsufficient ?? false,
    thumbnail: null,
    proposerStats: null,
    recentVotes: [],
  }
  return {
    summary,
    proposalIdHash: HASH,
    descriptionHash: DESC_HASH,
    description: over.description ?? '',
    proposerFull: PROPOSER,
    proposerEns: over.proposerEns ?? null,
    snapshotBlockNumber: 0,
    voteStart: o.voteStart,
    voteEnd: o.voteEnd,
    transactions: over.transactions ?? [],
    nftImages: over.nftImages ?? {},
    voteCount: (over.votes ?? []).length,
    votes: over.votes ?? [],
  }
}

// ── Transaction calldata builders ──────────────────────────────

const ERC20_ABI = [
  {
    type: 'function',
    name: 'transfer',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const

const ERC721_ABI = [
  {
    type: 'function',
    name: 'transferFrom',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'from', type: 'address' },
      { name: 'to', type: 'address' },
      { name: 'tokenId', type: 'uint256' },
    ],
    outputs: [],
  },
] as const

function tx(target: string, calldata: string, valueWei = BigInt(0)): ProposalTransaction {
  return {
    target,
    targetShort: short(target),
    valueWei,
    valueEth: formatEther(valueWei),
    calldata,
    calldataPreview: calldata.length > 14 ? `${calldata.slice(0, 10)}…` : calldata,
  }
}

const erc20Transfer = (to: string, amount: bigint) =>
  encodeFunctionData({
    abi: ERC20_ABI,
    functionName: 'transfer',
    args: [to as `0x${string}`, amount],
  })

const erc721Transfer = (from: string, to: string, tokenId: bigint) =>
  encodeFunctionData({
    abi: ERC721_ABI,
    functionName: 'transferFrom',
    args: [from as `0x${string}`, to as `0x${string}`, tokenId],
  })

const SAMPLE_MD = `## Summary

This proposal funds the next quarter of protocol development across three
workstreams. It requests **12.5 ETH** plus **1,500 USDC** from the treasury.

### Milestones

1. Ship the new auction settlement flow
2. Migrate the subgraph to the v3 schema
3. Audit + launch the governance dashboard

See the [forum thread](https://example.com) for full context.

> Voting opens after the standard delay.`

// ── State fixtures (full ProposalDetailView) ───────────────────

const stateTiles: { title: string; description: string; detail: ProposalDetail }[] = [
  {
    title: 'Pending — voting opens in 6h',
    description:
      'now < voteStart · VotePanel shows a live "opens in" countdown (no choice form). endsLabel = "Voting opens soon".',
    detail: buildDetail(
      'pending',
      { timeCreated: now - HOUR, voteStart: now + 6 * HOUR, voteEnd: now + 30 * HOUR },
      { tallies: { for: 0, against: 0, abstain: 0, quorum: 8 } }
    ),
  },
  {
    title: 'Active — voting open',
    description:
      'voteStart ≤ now < voteEnd · header shows a LIVE "Voting ends in 2d 6h" countdown (not creation age); choice form enabled.',
    detail: buildDetail(
      'active',
      {
        timeCreated: now - 3 * DAY,
        voteStart: now - 2 * DAY,
        voteEnd: now + 2 * DAY + 6 * HOUR,
      },
      { tallies: { for: 18, against: 4, abstain: 2, quorum: 10 }, description: SAMPLE_MD }
    ),
  },
  {
    title: 'Succeeded — passed, not yet queued',
    description:
      'now > voteEnd, for>against & for≥quorum, no expiresAt · endsLabel = "Ready to queue" (was creation age). ProposalActions shows Queue.',
    detail: buildDetail(
      'succeeded',
      { timeCreated: now - 4 * DAY, voteStart: now - 3 * DAY, voteEnd: now - DAY },
      { tallies: { for: 620, against: 90, abstain: 20, quorum: 400 } }
    ),
  },
  {
    title: 'Queued — in timelock',
    description:
      'passed + expiresAt in the future · endsLabel = "Awaiting execution". Execute card reads proposalEta() onchain → "Checking timelock…" here (see the timelock matrix below for the eta states).',
    detail: buildDetail(
      'queued',
      {
        timeCreated: now - 9 * DAY,
        voteStart: now - 8 * DAY,
        voteEnd: now - DAY,
        expiresAt: now + 2 * DAY,
      },
      { tallies: { for: 120, against: 20, abstain: 0, quorum: 100 } }
    ),
  },
  {
    title: 'Defeated — against won',
    description:
      'now > voteEnd, against>for · endsLabel = "Voting ended 1 day ago" (anchored on voteEnd, not creation).',
    detail: buildDetail(
      'defeated',
      { timeCreated: now - 3 * DAY, voteStart: now - 2 * DAY, voteEnd: now - DAY },
      { tallies: { for: 12, against: 40, abstain: 3, quorum: 30 } }
    ),
  },
  {
    title: 'Defeated — quorum not met',
    description:
      'for>against but for<quorum · quorum marker sits to the RIGHT of the For segment in VoteBar.',
    detail: buildDetail(
      'defeated',
      { timeCreated: now - 3 * DAY, voteStart: now - 2 * DAY, voteEnd: now - DAY },
      { tallies: { for: 12, against: 3, abstain: 0, quorum: 30 } }
    ),
  },
  {
    title: 'Expired — timelock grace lapsed',
    description:
      'expiresAt set & in the past (checked before vote windows) · endsLabel = "Expired today" (anchored on expiresAt).',
    detail: buildDetail(
      'expired',
      {
        timeCreated: now - 16 * DAY,
        voteStart: now - 14 * DAY,
        voteEnd: now - 12 * DAY,
        expiresAt: now - HOUR,
      },
      { tallies: { for: 40, against: 2, abstain: 0, quorum: 20 } }
    ),
  },
  {
    title: 'Executed — ran 2 days ago',
    description:
      'executedAt set (highest precedence) · endsLabel = "Executed 2 days ago" (was "9 days ago" creation-age). Empty description state shown.',
    detail: buildDetail(
      'executed',
      {
        timeCreated: now - 9 * DAY,
        voteStart: now - 8 * DAY,
        voteEnd: now - 5 * DAY,
        expiresAt: now - DAY,
        executedAt: now - 2 * DAY,
      },
      { tallies: { for: 120, against: 18, abstain: 6, quorum: 100 }, description: '' }
    ),
  },
  {
    title: 'Cancelled — voteEnd still in the future',
    description:
      'cancelTransactionHash wins over the Active window · proves a cancelled prop with a future voteEnd still resolves cancelled. endsLabel = "Created 5 days ago".',
    detail: buildDetail(
      'cancelled',
      { timeCreated: now - 5 * DAY, voteStart: now - 3 * DAY, voteEnd: now + 2 * DAY },
      { tallies: { for: 12, against: 3, abstain: 0, quorum: 10 } }
    ),
  },
  {
    title: 'Vetoed',
    description:
      'vetoTransactionHash set · destructive badge. endsLabel = "Created 2 days ago" (no vetoedAt on the fragment).',
    detail: buildDetail(
      'vetoed',
      {
        timeCreated: now - 2 * DAY,
        voteStart: now - 36 * HOUR,
        voteEnd: now - 12 * HOUR,
      },
      { tallies: { for: 5, against: 2, abstain: 0, quorum: 10 } }
    ),
  },
  {
    title: 'Treasury-insufficient (succeeded)',
    description:
      'live status + treasuryInsufficient=true · "Insufficient treasury" chip in the header next to the badge.',
    detail: buildDetail(
      'succeeded',
      { timeCreated: now - 4 * DAY, voteStart: now - 3 * DAY, voteEnd: now - DAY },
      {
        tallies: { for: 620, against: 90, abstain: 20, quorum: 400 },
        treasuryInsufficient: true,
        description: SAMPLE_MD,
      }
    ),
  },
]

// ── Transaction-list variants ──────────────────────────────────

const txTiles: {
  title: string
  description: string
  txs: ProposalTransaction[]
  nftImages?: Record<string, string>
}[] = [
  {
    title: 'No transactions',
    description: 'transactions.length === 0',
    txs: [],
  },
  {
    title: 'Send ETH',
    description: "calldata '0x' + value → send-eth",
    txs: [tx(RECIPIENT, '0x', parseEther('0.25'))],
  },
  {
    title: 'Send USDC',
    description: 'ERC-20 transfer to Base USDC → send-usdc, 1,500 USDC',
    txs: [tx(USDC_BASE, erc20Transfer(RECIPIENT, parseUnits('1500', 6)))],
  },
  {
    title: 'Send tokens (unknown ERC-20)',
    description:
      'transfer on an address not in the allowlist → "(unknown amount) tokens"',
    txs: [tx(RANDOM_ERC20, erc20Transfer(RECIPIENT, parseUnits('100', 18)))],
  },
  {
    title: 'Send NFT (DAO token, with artwork)',
    description: 'transferFrom on the DAO token + nftImages → artwork thumbnail',
    txs: [
      tx(
        daoConfig.addresses.token,
        erc721Transfer(daoConfig.addresses.treasury, RECIPIENT, BigInt(42))
      ),
    ],
    nftImages: { '42': daoConfig.image },
  },
  {
    title: 'Custom call',
    description: 'unknown selector → custom card with raw calldata',
    txs: [
      tx(
        RECIPIENT,
        '0xdeadbeef0000000000000000000000000000000000000000000000000000000000000001'
      ),
    ],
  },
  {
    title: 'Multiple transactions',
    description: 'mixed batch → count badge + row variety',
    txs: [
      tx(RECIPIENT, '0x', parseEther('1')),
      tx(USDC_BASE, erc20Transfer(RECIPIENT, parseUnits('500', 6))),
      tx(RECIPIENT, '0xabcdef01'),
    ],
  },
]

// ── Vote-list variants ─────────────────────────────────────────

const v = (
  voter: string,
  support: ProposalDetailVote['support'],
  weight: number,
  reason: string | null = null,
  ens: string | null = null
): ProposalDetailVote => ({
  voter,
  voterShort: short(voter),
  voterEns: ens,
  support,
  weight,
  reason,
})

const fewVotes: ProposalDetailVote[] = [
  v(
    fakeAddr(1),
    'for',
    120,
    'Strongly support — this unblocks the Q3 roadmap.',
    'alice.eth'
  ),
  v(fakeAddr(2), 'against', 64, 'Treasury impact is too high right now.'),
  v(fakeAddr(3), 'abstain', 1, null),
]

const manyVotes: ProposalDetailVote[] = Array.from({ length: 18 }, (_, i) =>
  v(
    fakeAddr(100 + i),
    (['for', 'against', 'abstain'] as const)[i % 3],
    Math.max(1, 90 - i * 4),
    i % 4 === 0 ? `Reason ${i + 1}: rationale for this vote.` : null,
    i % 5 === 0 ? `voter${i}.eth` : null
  )
)

const allForVotes: ProposalDetailVote[] = [
  v(fakeAddr(50), 'for', 30, 'Yes.'),
  v(fakeAddr(51), 'for', 22),
  v(fakeAddr(52), 'for', 12, 'Agreed.'),
  v(fakeAddr(53), 'abstain', 4),
  v(fakeAddr(54), 'abstain', 2),
]

const voteTiles: { title: string; description: string; votes: ProposalDetailVote[] }[] = [
  { title: 'No votes', description: 'empty state', votes: [] },
  {
    title: 'Few votes (mixed, reasons, ENS)',
    description: 'for+reason+ENS · against+reason · abstain no-reason',
    votes: fewVotes,
  },
  {
    title: '18 votes — expand',
    description: 'renders 12, then "Show 6 more"',
    votes: manyVotes,
  },
  {
    title: 'Filter empty state',
    description: '5 for / 0 against / 2 abstain · select "Against" → "No against votes."',
    votes: allForVotes,
  },
]

// ── VoteBar variants ───────────────────────────────────────────

const voteBarTiles: { title: string; props: Parameters<typeof VoteBar>[0] }[] = [
  {
    title: 'Populated, quorum mid-bar',
    props: { forV: 18, against: 4, abstain: 2, quorum: 10, height: 14, showLabels: true },
  },
  {
    title: 'Quorum > total (pinned 100%)',
    props: { forV: 3, against: 1, abstain: 0, quorum: 50, height: 14, showLabels: true },
  },
  {
    title: 'No quorum marker (quorum 0)',
    props: { forV: 8, against: 2, abstain: 1, quorum: 0, height: 14, showLabels: true },
  },
  {
    title: 'Empty (0 / 0 / 0)',
    props: { forV: 0, against: 0, abstain: 0, quorum: 5, height: 14, showLabels: true },
  },
]

// ── VotingPowerExplainer variants ──────────────────────────────

const powerTiles: { title: string; props: Parameters<typeof VotingPowerExplainer>[0] }[] =
  [
    { title: "none — can't vote", props: { scenario: 'none' } },
    { title: 'delegated away', props: { scenario: 'delegated' } },
    { title: 'eligible (12 votes)', props: { scenario: 'eligible', votingPower: 12 } },
    {
      title: 'pending · opens in 2d',
      props: { scenario: 'pending', voteStart: now + 2 * DAY },
    },
    {
      title: 'pending · opens in 6h',
      props: { scenario: 'pending', voteStart: now + 6 * HOUR },
    },
    {
      title: 'pending · opens in 45m',
      props: { scenario: 'pending', voteStart: now + 45 * MIN },
    },
    {
      title: 'pending · opens in 30s',
      props: { scenario: 'pending', voteStart: now + 30 },
    },
    {
      title: 'incoming (override-only, unreachable in prod)',
      props: { scenario: 'incoming' },
    },
  ]

// ── ProposalActions: role × timelock matrix ────────────────────

type ActionProps = Parameters<typeof ProposalActions>[0]

const queuedDetail = buildDetail('queued', {
  timeCreated: now - 9 * DAY,
  voteStart: now - 8 * DAY,
  voteEnd: now - DAY,
  expiresAt: now + 2 * DAY,
})
const succeededDetail = buildDetail('succeeded', {
  timeCreated: now - 4 * DAY,
  voteStart: now - 3 * DAY,
  voteEnd: now - DAY,
})
const pendingDetail = buildDetail('pending', {
  timeCreated: now - HOUR,
  voteStart: now + 6 * HOUR,
  voteEnd: now + 30 * HOUR,
})
const activeDetail = buildDetail('active', {
  timeCreated: now - 3 * DAY,
  voteStart: now - 2 * DAY,
  voteEnd: now + 2 * DAY,
})

const actionTiles: { title: string; description: string; props: ActionProps }[] = [
  {
    title: 'Pending · proposer',
    description: 'Cancel only',
    props: { detail: pendingDetail, statusOverride: 'pending', isProposerOverride: true },
  },
  {
    title: 'Pending · vetoer',
    description: 'Veto only',
    props: { detail: pendingDetail, statusOverride: 'pending', isVetoerOverride: true },
  },
  {
    title: 'Active · proposer',
    description: 'Cancel only',
    props: { detail: activeDetail, statusOverride: 'active', isProposerOverride: true },
  },
  {
    title: 'Active · vetoer',
    description: 'Veto only',
    props: { detail: activeDetail, statusOverride: 'active', isVetoerOverride: true },
  },
  {
    title: 'Succeeded · anyone',
    description: 'Queue (no role gate)',
    props: { detail: succeededDetail, statusOverride: 'succeeded' },
  },
  {
    title: 'Succeeded · proposer + vetoer',
    description: 'Queue + Cancel + Veto',
    props: {
      detail: succeededDetail,
      statusOverride: 'succeeded',
      isProposerOverride: true,
      isVetoerOverride: true,
    },
  },
  {
    title: 'Queued · eta in 2 days',
    description: 'Execute disabled · "Available in 2d 0h"',
    props: { detail: queuedDetail, statusOverride: 'queued', etaOverride: now + 2 * DAY },
  },
  {
    title: 'Queued · eta in 90s',
    description: 'Execute disabled · "Available in 1m"',
    props: { detail: queuedDetail, statusOverride: 'queued', etaOverride: now + 90 },
  },
  {
    title: 'Queued · timelock elapsed',
    description: 'Execute ENABLED · "Timelock elapsed."',
    props: { detail: queuedDetail, statusOverride: 'queued', etaOverride: now - 1 },
  },
  {
    title: 'Queued · eta unknown',
    description: 'read in flight · "Checking timelock…"',
    props: { detail: queuedDetail, statusOverride: 'queued', etaOverride: null },
  },
  {
    title: 'Queued · proposer + vetoer, elapsed',
    description: 'Execute + Cancel + Veto',
    props: {
      detail: queuedDetail,
      statusOverride: 'queued',
      etaOverride: now - 1,
      isProposerOverride: true,
      isVetoerOverride: true,
    },
  },
]

// ── Layout primitives ──────────────────────────────────────────

function Section({
  title,
  blurb,
  children,
}: {
  title: string
  blurb: string
  children: React.ReactNode
}) {
  return (
    <section className="flex flex-col gap-5">
      <div className="border-b border-border pb-2">
        <h2 className="font-display text-2xl font-extrabold text-fg">{title}</h2>
        <p className="mt-0.5 text-sm text-muted-fg">{blurb}</p>
      </div>
      {children}
    </section>
  )
}

function Tile({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-3">
      <div>
        <h3 className="text-base font-bold text-fg">{title}</h3>
        {description ? <p className="text-[13px] text-muted-fg">{description}</p> : null}
      </div>
      {children}
    </div>
  )
}

export default function ProposalStatesPage() {
  return (
    <div className="flex flex-col gap-14 py-6">
      <header className="border-b border-border pb-4">
        <h1 className="font-display text-3xl font-extrabold text-fg">
          Proposal detail — all states
        </h1>
        <p className="mt-1 text-sm text-muted-fg">
          Visual matrix of every render path. Countdowns and relative labels run live from
          page load; fixtures stamp every time field relative to <code>now</code>.
        </p>
      </header>

      <Section
        title="Governor states"
        blurb="The full ProposalDetailView for each of the 9 states, with the dates that realize them through inferProposalState."
      >
        <div className="flex flex-col gap-12">
          {stateTiles.map((s) => (
            <Tile key={s.title} title={s.title} description={s.description}>
              <ProposalDetailView detail={s.detail} />
            </Tile>
          ))}
        </div>
      </Section>

      <Section
        title="ProposalActions — role × timelock"
        blurb="Dev-only overrides (statusOverride / isProposerOverride / isVetoerOverride / etaOverride) drive states that otherwise depend on chain reads + the connected wallet. Anon viewers see no aside on pending/active."
      >
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          {actionTiles.map((a) => (
            <Tile key={a.title} title={a.title} description={a.description}>
              <ProposalActions {...a.props} />
            </Tile>
          ))}
        </div>
      </Section>

      <Section
        title="VotingPowerExplainer"
        blurb="The callout above the vote form. Pending offsets exercise every formatOpensIn branch."
      >
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {powerTiles.map((p) => (
            <Tile key={p.title} title={p.title}>
              <VotingPowerExplainer {...p.props} />
            </Tile>
          ))}
        </div>
      </Section>

      <Section
        title="Transactions"
        blurb="ProposalTransactionList across the decoded tx taxonomy."
      >
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {txTiles.map((t) => (
            <Tile key={t.title} title={t.title} description={t.description}>
              <ProposalTransactionList
                chainId={daoConfig.chainId}
                transactions={t.txs}
                daoTokenAddress={daoConfig.addresses.token}
                nftImages={t.nftImages}
              />
            </Tile>
          ))}
        </div>
      </Section>

      <Section
        title="Votes list"
        blurb="ProposalVotesList states, filters, and the expand control."
      >
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {voteTiles.map((t) => (
            <Tile key={t.title} title={t.title} description={t.description}>
              <ProposalVotesList votes={t.votes} />
            </Tile>
          ))}
        </div>
      </Section>

      <Section title="VoteBar" blurb="Tally bar + quorum marker edge cases.">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {voteBarTiles.map((t) => (
            <Tile key={t.title} title={t.title}>
              <VoteBar {...t.props} />
            </Tile>
          ))}
        </div>
      </Section>

      <Section title="Status badges" blurb="All 9 statuses in both variants.">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            {STATUSES.map((s) => (
              <StatusBadge key={`badge-${s}`} status={s} />
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {STATUSES.map((s) => (
              <StatusBadge key={`chip-${s}`} status={s} variant="chip" />
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <TreasuryInsufficientBadge withLabel />
            <TreasuryInsufficientBadge />
          </div>
        </div>
      </Section>
    </div>
  )
}
