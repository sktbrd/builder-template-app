'use client'

import { useWeb3Ready } from '@/app/web3-providers'
import { useVoteEcho } from '@/components/dao/useVoteEcho'
import { VoteBar } from '@/components/dao/VoteBar'
import {
  bumpTally,
  mergeVoteTally,
  optimisticTally,
  totalCast,
  type VoteTally,
} from '@/lib/proposal-truth'

import { useProposalVotesTruth } from './useProposalTruth'

type Props = {
  proposalIdHash: `0x${string}`
  forVotes: number
  againstVotes: number
  abstainVotes: number
  quorum: number
}

function serverTally(p: Props): VoteTally {
  return {
    forVotes: p.forVotes,
    againstVotes: p.againstVotes,
    abstainVotes: p.abstainVotes,
  }
}

/**
 * Vote summary card with the onchain bridge: seeded from the subgraph-rendered
 * server tallies, it overlays the live Governor `proposalVotes` read
 * (useProposalVotesTruth) whenever chain is ahead — so a freshly cast vote (and
 * other voters' votes) show up without waiting on subgraph indexing. On top of
 * that it overlays the actor's own vote (useVoteEcho), which is recorded only
 * once their tx mines: the bar bumps by their weight on confirmation, then
 * reconciles to the chain read as it catches up. Nothing moves before the tx
 * lands. Before wagmi mounts (useWeb3Ready) it renders the plain server values,
 * so SSR/first paint match (no hydration drift).
 */
export function VoteSummary(props: Props) {
  const ready = useWeb3Ready()
  if (!ready) return <VoteSummaryView quorum={props.quorum} tally={serverTally(props)} />
  return <VoteSummaryConnected {...props} />
}

function VoteSummaryConnected(props: Props) {
  const { tally: truth } = useProposalVotesTruth(props.proposalIdHash)
  const echo = useVoteEcho(props.proposalIdHash)
  const real = mergeVoteTally(serverTally(props), truth)
  const pending = echo ? bumpTally(echo.base, echo.support, echo.weight) : null
  const tally = optimisticTally(real, pending)
  return <VoteSummaryView quorum={props.quorum} tally={tally} />
}

function VoteSummaryView({ tally, quorum }: { tally: VoteTally; quorum: number }) {
  return (
    <section className="rounded-xl border border-border bg-surface px-4 py-5 sm:px-6 sm:py-[22px]">
      <h3 className="mb-3 text-base font-bold">Vote summary</h3>
      <VoteBar
        forV={tally.forVotes}
        against={tally.againstVotes}
        abstain={tally.abstainVotes}
        quorum={quorum}
        height={14}
        showLabels
      />
      <div className="mt-2 text-[12.5px] text-muted-fg">
        Quorum: {quorum} · Total cast: {totalCast(tally)}
      </div>
    </section>
  )
}
