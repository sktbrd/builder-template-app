'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

import { ActorIdentity } from '@/components/feed/ActorIdentity'
import type { ProposalSummary } from '@/lib/dao-data'
import { cn } from '@/lib/utils'

import { StatusBadge } from './StatusBadge'
import { VoteBar } from './VoteBar'

type Props = { p: ProposalSummary }

function formatVotingRemaining(secs: number): string {
  if (secs <= 0) return 'Ended'
  const d = Math.floor(secs / 86400)
  const h = Math.floor((secs % 86400) / 3600)
  const m = Math.floor((secs % 3600) / 60)
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

function useCountdown(endUnix: number) {
  const [secs, setSecs] = useState(() =>
    endUnix > 0 ? Math.max(0, endUnix - Math.floor(Date.now() / 1000)) : 0
  )
  useEffect(() => {
    if (!endUnix) return
    const id = setInterval(
      () => setSecs(Math.max(0, endUnix - Math.floor(Date.now() / 1000))),
      60_000
    )
    return () => clearInterval(id)
  }, [endUnix])
  return secs
}

function formatVoteWeight(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}K`
  return Math.round(n).toString()
}

function shortAddress(addr: string): string {
  if (!addr || addr.length < 10) return addr
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

const VOTE_TONE: Record<'for' | 'against' | 'abstain', string> = {
  for: 'text-vote-for',
  against: 'text-vote-against',
  abstain: 'text-vote-abstain',
}

const VOTE_LABEL: Record<'for' | 'against' | 'abstain', string> = {
  for: 'FOR',
  against: 'AGAINST',
  abstain: 'ABSTAIN',
}

export function ProposalActiveCard({ p }: Props) {
  const proposerLabel = p.proposerEns ?? shortAddress(p.proposer)
  const remaining = useCountdown(p.voteEnd)
  const isVoting = p.status === 'active' && p.voteEnd > 0 && remaining > 0
  const votes = p.recentVotes ?? []

  return (
    <Link
      href={`/proposals/${p.id}`}
      className="block rounded-[8px] border border-border bg-bg/40 p-4 transition-colors hover:border-border-strong"
    >
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 flex-1 font-semibold leading-snug text-fg">
          <span className="font-mono text-[12px] text-muted-fg">#{p.id}</span> {p.title}
        </p>
        <StatusBadge status={p.status} />
      </div>

      <p className="mt-1 truncate text-[12px] text-muted-fg">
        by{' '}
        <span
          className={p.proposerEns ? 'font-medium text-fg/80' : 'font-mono text-fg/80'}
        >
          {proposerLabel}
        </span>
      </p>

      <VoteBar
        forV={p.forVotes}
        against={p.againstVotes}
        abstain={p.abstainVotes}
        quorum={p.quorum}
        className="mt-3"
        height={8}
      />

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] font-semibold tabular-nums">
        <span className="text-vote-for">FOR {p.forVotes}</span>
        <span className="text-vote-against">AGAINST {p.againstVotes}</span>
        <span className="text-vote-abstain">ABSTAIN {p.abstainVotes}</span>
        <span className="ml-auto text-muted-fg">
          {isVoting ? (
            <>
              <span className="text-[10px] uppercase tracking-[0.12em] text-muted-fg/80">
                Voting
              </span>{' '}
              <span className="text-fg">{formatVotingRemaining(remaining)}</span>
            </>
          ) : (
            p.endsLabel
          )}
        </span>
      </div>

      {votes.length > 0 && (
        <ul className="mt-3 flex flex-col gap-2 border-t border-border/60 pt-3">
          {votes.map((v, i) => (
            <li key={`${v.voter}-${i}`} className="flex flex-col gap-1">
              <div className="flex items-center gap-1.5 text-[12px] leading-tight">
                <ActorIdentity address={v.voter} size={20} className="text-[12px]" />
                <span className="text-muted-fg">voted</span>
                <span className={cn('font-bold', VOTE_TONE[v.support])}>
                  {VOTE_LABEL[v.support]}
                </span>
                {v.weight > 0 && (
                  <span className="text-muted-fg/80 tabular-nums">
                    ({formatVoteWeight(v.weight)})
                  </span>
                )}
              </div>
              {v.reason && (
                <p className="line-clamp-2 border-l-2 border-border-strong pl-2 text-[12px] leading-snug text-fg-2">
                  {v.reason}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </Link>
  )
}
