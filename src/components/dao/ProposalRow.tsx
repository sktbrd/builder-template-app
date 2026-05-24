import Link from 'next/link'

import type { ProposalSummary } from '@/lib/dao-data'

import { StatusBadge } from './StatusBadge'
import { TreasuryInsufficientBadge } from './TreasuryInsufficientBadge'
import { VoteBar } from './VoteBar'

export function ProposalRow({ p }: { p: ProposalSummary }) {
  const total = p.forVotes + p.againstVotes + p.abstainVotes
  const hasReq = p.requested.eth > 0 || p.requested.usdc > 0
  const proposerLabel = p.proposerEns ?? shortAddress(p.proposer)

  return (
    <Link
      href={`/proposals/${p.id}`}
      className="group flex items-center gap-4 rounded-lg px-3 py-3 transition-colors hover:bg-surface-2"
    >
      <span className="w-10 shrink-0 text-right font-mono text-xs font-semibold tabular-nums text-muted-fg">
        #{p.id}
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold leading-5 text-fg group-hover:text-accent-strong">
          {p.title}
        </p>
        <div className="mt-1 flex min-w-0 items-center gap-1.5 truncate text-[11px] leading-4 text-muted-fg">
          <span
            className={
              p.proposerEns
                ? 'truncate font-medium text-fg/80'
                : 'truncate font-mono text-fg/80'
            }
          >
            {proposerLabel}
          </span>
          {p.proposerStats && p.proposerStats.total > 1 && (
            <span
              title={`${p.proposerStats.passed}/${p.proposerStats.total} passed (recent window)`}
              className="shrink-0 rounded-full border border-border bg-surface px-1.5 py-0 text-[10px] font-medium tabular-nums text-muted-fg"
            >
              {p.proposerStats.total}× · {p.proposerStats.passed}✓
            </span>
          )}
          <span aria-hidden>·</span>
          <span className="shrink-0 tabular-nums">{p.date}</span>
          {hasReq && (
            <>
              <span aria-hidden>·</span>
              <span className="shrink-0 tabular-nums">
                {p.requested.eth > 0 && `${p.requested.eth} ETH`}
                {p.requested.eth > 0 && p.requested.usdc > 0 && ' / '}
                {p.requested.usdc > 0 &&
                  `${p.requested.usdc.toLocaleString('en-US')} USDC`}
              </span>
            </>
          )}
          {p.treasuryInsufficient && <TreasuryInsufficientBadge />}
        </div>
      </div>

      <div className="hidden w-24 shrink-0 sm:block">
        <VoteBar
          forV={p.forVotes}
          against={p.againstVotes}
          abstain={p.abstainVotes}
          quorum={p.quorum}
          height={5}
        />
        <p className="mt-1 text-center text-[10px] tabular-nums text-muted-fg">
          {total.toLocaleString('en-US')} votes
        </p>
      </div>

      <div className="flex w-[88px] shrink-0 justify-end">
        <StatusBadge status={p.status} />
      </div>
    </Link>
  )
}

function shortAddress(addr: string): string {
  if (!addr || addr.length < 10) return addr
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}
