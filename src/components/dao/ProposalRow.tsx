import Link from 'next/link'

import type { ProposalSummary } from '@/lib/dao-data'

import { StatusBadge } from './StatusBadge'
import { TreasuryInsufficientBadge } from './TreasuryInsufficientBadge'
import { VoteBar } from './VoteBar'
import { WalletPill } from './WalletPill'

export function ProposalRow({ p }: { p: ProposalSummary }) {
  const total = p.forVotes + p.againstVotes + p.abstainVotes
  const hasReq = p.requested.eth > 0 || p.requested.usdc > 0

  return (
    <Link
      href={`/proposals/${p.id}`}
      className="group flex items-center gap-4 rounded-lg px-3 py-3 transition-colors hover:bg-surface-2"
    >
      <span className="w-12 shrink-0 font-mono text-xs font-semibold text-muted-fg">
        #{p.id}
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-fg group-hover:text-accent-strong">
          {p.title}
        </p>
        <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-1.5 text-[11px] text-muted-fg">
          <WalletPill address={p.proposer} ens={p.proposerEns} link={false} size="xs" />
          <span>· {p.date}</span>
          {hasReq && (
            <span>
              {' · '}
              {p.requested.eth > 0 && `${p.requested.eth} ETH`}
              {p.requested.eth > 0 && p.requested.usdc > 0 && ' / '}
              {p.requested.usdc > 0 && `${p.requested.usdc.toLocaleString('en-US')} USDC`}
            </span>
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
        <p className="mt-1 text-center text-[10px] text-muted-fg">{total} votes</p>
      </div>

      <div className="shrink-0">
        <StatusBadge status={p.status} />
      </div>
    </Link>
  )
}
