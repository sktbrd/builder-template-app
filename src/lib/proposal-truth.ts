/**
 * Pure helpers for the proposal "optimistic onchain bridge" — the proposal
 * detail page reads live vote tallies straight from the Governor
 * (`proposalVotes`, see useProposalVotesTruth) so the Vote summary never waits
 * on subgraph indexing lag after someone casts a vote. The actor's just-cast
 * vote is also kept as a per-session echo (useVoteEcho) so the "Cast your vote"
 * form flips to a "You voted" confirmation immediately — the Governor exposes no
 * `getReceipt`/`hasVoted`, so without the echo we'd have to wait for the
 * subgraph to index the vote before we could tell the actor it landed.
 *
 * Everything here is framework-free and unit-tested in `proposal-truth.test.ts`.
 * The React glue lives in the `use*` hooks.
 */

export type VoteSupport = 'for' | 'against' | 'abstain'

export type VoteTally = {
  forVotes: number
  againstVotes: number
  abstainVotes: number
}

/** Which tally field a support choice increments. */
export const SUPPORT_KEY: Record<VoteSupport, keyof VoteTally> = {
  for: 'forVotes',
  against: 'againstVotes',
  abstain: 'abstainVotes',
}

export function totalCast(t: VoteTally): number {
  return t.forVotes + t.againstVotes + t.abstainVotes
}

/**
 * Map the Governor `proposalVotes(bytes32)` return into a VoteTally.
 *
 * The getter returns `(againstVotes, forVotes, abstainVotes)` — this order is
 * load-bearing and matches the on-chain `GovernorTypesV1.Proposal` struct field
 * order (against, for, abstain). Returns null when the read hasn't resolved.
 */
export function tallyFromChain(
  raw: readonly [bigint, bigint, bigint] | undefined | null
): VoteTally | null {
  if (!raw) return null
  const [against, forV, abstain] = raw
  return {
    againstVotes: Number(against),
    forVotes: Number(forV),
    abstainVotes: Number(abstain),
  }
}

/**
 * Prefer the on-chain truth whenever it is at least as advanced as the
 * subgraph-seeded server tally (i.e. chain has caught up to or moved ahead of
 * the snapshot). The chain is the source of truth, but before its first read
 * resolves (`truth === null`) we keep the server values so SSR/first paint is
 * stable. Equal totals → truth (identical anyway).
 */
export function mergeVoteTally(server: VoteTally, truth: VoteTally | null): VoteTally {
  if (!truth) return server
  return totalCast(truth) >= totalCast(server) ? truth : server
}

/** Add `weight` to the bucket a support choice increments, leaving the rest. */
export function bumpTally(t: VoteTally, support: VoteSupport, weight: number): VoteTally {
  const key = SUPPORT_KEY[support]
  return { ...t, [key]: t[key] + weight }
}

/**
 * Overlay the actor's just-cast vote optimistically. `pending` is the tally as
 * displayed when the vote was submitted plus the actor's weight; we show it only
 * while the real (merged) tally hasn't yet reached that total. The instant the
 * on-chain read includes the vote, totals equalize and we fall back to the real
 * tally — self-reconciling, so the lingering echo never double-counts. Passing
 * `pending: null` (no echo) returns the real tally unchanged.
 */
export function optimisticTally(real: VoteTally, pending: VoteTally | null): VoteTally {
  if (!pending) return real
  return totalCast(real) < totalCast(pending) ? pending : real
}

/**
 * The connected wallet's own vote, found in the subgraph votes list. Used to
 * keep the "You voted X" confirmation across reloads once the vote is indexed
 * (the per-session echo covers the window before indexing). Case-insensitive.
 */
export function findMyVote(
  votes: ReadonlyArray<{ voter: string; support: VoteSupport; weight?: number }>,
  address: string | null | undefined
): { support: VoteSupport; weight: number } | null {
  if (!address) return null
  const lc = address.toLowerCase()
  const mine = votes.find((v) => v.voter.toLowerCase() === lc)
  return mine ? { support: mine.support, weight: mine.weight ?? 0 } : null
}
