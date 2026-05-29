'use client'

import { useMemo, useState } from 'react'

import { useVoteEcho } from '@/components/dao/useVoteEcho'
import type { ProposalDetailVote } from '@/lib/dao-data'
import { cn } from '@/lib/utils'

type Props = {
  votes: ProposalDetailVote[]
  /** Proposal id hash — lets the list surface the actor's just-confirmed vote
   *  (from the session echo) before the subgraph indexes it. Omitted by the
   *  /dev fixtures, which have no echo. */
  proposalIdHash?: `0x${string}`
}

function shortAddr(a: string): string {
  return a.length < 10 ? a : `${a.slice(0, 6)}…${a.slice(-4)}`
}

const SUPPORT_STYLES: Record<
  ProposalDetailVote['support'],
  { label: string; classes: string }
> = {
  for: {
    label: 'For',
    classes: 'border-vote-for/30 bg-vote-for/10 text-vote-for',
  },
  against: {
    label: 'Against',
    classes: 'border-vote-against/30 bg-vote-against/10 text-vote-against',
  },
  abstain: {
    label: 'Abstain',
    classes: 'border-border-strong bg-surface-2 text-fg',
  },
}

// Cap the initial render. Big DAOs can have hundreds of votes per proposal and
// rendering them all up front is wasteful when most of them are below the fold.
const INITIAL_LIMIT = 12

type Filter = 'all' | 'for' | 'against' | 'abstain'

export function ProposalVotesList({ votes, proposalIdHash }: Props) {
  const [filter, setFilter] = useState<Filter>('all')
  const [expanded, setExpanded] = useState(false)

  // The actor's just-confirmed vote (recorded on mine) shows here immediately —
  // prepended until the subgraph indexes the real row, then dedup by voter drops
  // the echo. Always-null hook call when there's no proposalIdHash keeps the
  // hook order stable (empty string never matches a stored echo).
  const echo = useVoteEcho(proposalIdHash ?? '')
  const allVotes = useMemo<ProposalDetailVote[]>(() => {
    if (!echo || votes.some((v) => v.voter.toLowerCase() === echo.voter.toLowerCase())) {
      return votes
    }
    const echoed: ProposalDetailVote = {
      voter: echo.voter,
      voterShort: shortAddr(echo.voter),
      voterEns: null,
      support: echo.support,
      weight: echo.weight,
      reason: echo.reason,
    }
    return [echoed, ...votes]
  }, [echo, votes])

  const counts = useMemo(() => {
    const c = { for: 0, against: 0, abstain: 0 }
    for (const v of allVotes) c[v.support]++
    return c
  }, [allVotes])

  const filtered = useMemo(
    () => (filter === 'all' ? allVotes : allVotes.filter((v) => v.support === filter)),
    [allVotes, filter]
  )

  const visible = expanded ? filtered : filtered.slice(0, INITIAL_LIMIT)
  const hidden = filtered.length - visible.length

  if (allVotes.length === 0) {
    return <div className="text-sm text-muted-fg">No votes have been cast yet.</div>
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <FilterChip
          label={`All ${allVotes.length}`}
          active={filter === 'all'}
          onClick={() => setFilter('all')}
        />
        <FilterChip
          label={`For ${counts.for}`}
          active={filter === 'for'}
          color="for"
          onClick={() => setFilter('for')}
        />
        <FilterChip
          label={`Against ${counts.against}`}
          active={filter === 'against'}
          color="against"
          onClick={() => setFilter('against')}
        />
        <FilterChip
          label={`Abstain ${counts.abstain}`}
          active={filter === 'abstain'}
          color="abstain"
          onClick={() => setFilter('abstain')}
        />
      </div>

      {filtered.length === 0 ? (
        <div className="text-sm text-muted-fg">No {filter} votes.</div>
      ) : (
        <ul className="flex flex-col divide-y divide-border rounded-md border border-border bg-surface-2">
          {visible.map((v) => (
            <VoteRow key={v.voter} vote={v} />
          ))}
        </ul>
      )}

      {hidden > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="self-start text-[12.5px] font-semibold text-accent-strong hover:underline"
        >
          Show {hidden} more
        </button>
      )}
    </div>
  )
}

function VoteRow({ vote }: { vote: ProposalDetailVote }) {
  const style = SUPPORT_STYLES[vote.support]
  const display = vote.voterEns ?? vote.voterShort

  return (
    <li className="flex flex-col gap-2 px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={cn(
            'inline-block rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide',
            style.classes
          )}
        >
          {style.label}
        </span>
        <span className="font-mono text-[12.5px] font-semibold text-fg">{display}</span>
        <span className="text-[12.5px] text-muted-fg">
          · {vote.weight} {vote.weight === 1 ? 'vote' : 'votes'}
        </span>
      </div>
      {vote.reason ? (
        <p className="text-[13px] leading-snug text-muted-fg">{vote.reason}</p>
      ) : null}
    </li>
  )
}

function FilterChip({
  label,
  active,
  onClick,
  color,
}: {
  label: string
  active: boolean
  onClick: () => void
  color?: 'for' | 'against' | 'abstain'
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-full border px-2.5 py-1 text-[12px] font-semibold transition-colors',
        active
          ? color === 'for'
            ? 'border-vote-for/30 bg-vote-for/10 text-vote-for'
            : color === 'against'
              ? 'border-vote-against/30 bg-vote-against/10 text-vote-against'
              : 'border-border-strong bg-surface-2 text-fg'
          : 'border-border bg-surface text-muted-fg hover:text-fg'
      )}
    >
      {label}
    </button>
  )
}
