import { describe, expect, it } from 'vitest'

import {
  findMyVote,
  mergeVoteTally,
  tallyFromChain,
  totalCast,
  type VoteTally,
} from './proposal-truth'

const tally = (over: Partial<VoteTally> = {}): VoteTally => ({
  forVotes: 0,
  againstVotes: 0,
  abstainVotes: 0,
  ...over,
})

describe('totalCast', () => {
  it('sums all three buckets', () => {
    expect(totalCast(tally({ forVotes: 10, againstVotes: 3, abstainVotes: 2 }))).toBe(15)
  })
})

describe('tallyFromChain', () => {
  it('returns null when the read has not resolved', () => {
    expect(tallyFromChain(undefined)).toBeNull()
    expect(tallyFromChain(null)).toBeNull()
  })

  it('maps the proposalVotes tuple in (against, for, abstain) order', () => {
    // proposalVotes returns (againstVotes, forVotes, abstainVotes)
    const t = tallyFromChain([BigInt(3), BigInt(10), BigInt(2)])
    expect(t).toEqual({ againstVotes: 3, forVotes: 10, abstainVotes: 2 })
  })
})

describe('mergeVoteTally', () => {
  const server = tally({ forVotes: 5, againstVotes: 1, abstainVotes: 0 }) // total 6

  it('keeps server values before the chain read resolves', () => {
    expect(mergeVoteTally(server, null)).toBe(server)
  })

  it('prefers chain truth when it is ahead of the subgraph snapshot', () => {
    const truth = tally({ forVotes: 7, againstVotes: 1, abstainVotes: 0 }) // total 8
    expect(mergeVoteTally(server, truth)).toBe(truth)
  })

  it('prefers chain truth when totals are equal (chain is source of truth)', () => {
    const truth = tally({ forVotes: 4, againstVotes: 2, abstainVotes: 0 }) // total 6
    expect(mergeVoteTally(server, truth)).toBe(truth)
  })

  it('falls back to server if the chain read is briefly behind', () => {
    const truth = tally({ forVotes: 4, againstVotes: 1, abstainVotes: 0 }) // total 5
    expect(mergeVoteTally(server, truth)).toBe(server)
  })
})

describe('findMyVote', () => {
  const votes = [
    {
      voter: '0xAbC0000000000000000000000000000000000001',
      support: 'for' as const,
      weight: 12,
    },
    {
      voter: '0xDeF0000000000000000000000000000000000002',
      support: 'against' as const,
      weight: 4,
    },
  ]

  it('returns null without a connected address', () => {
    expect(findMyVote(votes, null)).toBeNull()
    expect(findMyVote(votes, undefined)).toBeNull()
  })

  it('matches the connected wallet case-insensitively', () => {
    expect(findMyVote(votes, '0xabc0000000000000000000000000000000000001')).toEqual({
      support: 'for',
      weight: 12,
    })
  })

  it('returns null when the wallet has not voted', () => {
    expect(findMyVote(votes, '0x9990000000000000000000000000000000000009')).toBeNull()
  })

  it('defaults weight to 0 when absent', () => {
    expect(findMyVote([{ voter: '0x1', support: 'abstain' }], '0x1')).toEqual({
      support: 'abstain',
      weight: 0,
    })
  })
})
