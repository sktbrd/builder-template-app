'use client'

import { governorAbi } from '@buildeross/sdk/contract'
import { useCallback } from 'react'
import { type Address } from 'viem'
import { useReadContract } from 'wagmi'

import { daoConfig } from '@/lib/dao.config'
import { tallyFromChain, type VoteTally } from '@/lib/proposal-truth'

// This hook owns its own polling: the global QueryClient default is
// refetchInterval:false (web3-providers.tsx), so live-tally freshness for a
// passive viewer comes from here explicitly, not the shared default.
const POLL_MS = 5000

/**
 * Live vote tallies straight from the Governor `proposalVotes(id)` getter — the
 * authoritative, lag-free source. The detail page's Vote summary is seeded from
 * the subgraph (getProposalByNumber), which lags chain by indexing latency, so
 * VoteSummary overlays THIS whenever chain is ahead. Polls every ~5s for every
 * viewer, so a passerby sees others' votes land without a refresh.
 *
 * VoteSummary and VotePanel both call this with the same args — react-query
 * coalesces them into one shared query, so VotePanel's `refetch()` on a freshly
 * mined vote updates the Vote summary instantly (the tx is mined, so chain
 * already reflects it). Must only mount once wagmi's provider is up
 * (gate on useWeb3Ready), like the other onchain reads.
 */
export function useProposalVotesTruth(proposalIdHash: `0x${string}`): {
  tally: VoteTally | null
  refetch: () => void
} {
  const { data, refetch } = useReadContract({
    address: daoConfig.addresses.governor as Address,
    abi: governorAbi,
    functionName: 'proposalVotes',
    args: [proposalIdHash],
    chainId: daoConfig.chainId,
    query: { refetchInterval: POLL_MS, staleTime: POLL_MS },
  })

  // Stable identity so consumers can list it in effect deps without churn.
  const refetchTally = useCallback(() => void refetch(), [refetch])

  return {
    tally: tallyFromChain(data as readonly [bigint, bigint, bigint] | undefined),
    refetch: refetchTally,
  }
}
