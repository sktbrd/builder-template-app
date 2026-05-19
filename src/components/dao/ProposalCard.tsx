import Link from 'next/link'

import type { ProposalSummary } from '@/lib/dao-data'

import { StatusBadge } from './StatusBadge'
import { TreasuryInsufficientBadge } from './TreasuryInsufficientBadge'
import { VoteBar } from './VoteBar'
import { WalletPill } from './WalletPill'

export function ProposalCard({ p }: { p: ProposalSummary }) {
  const total = p.forVotes + p.againstVotes + p.abstainVotes
  const hasReq = p.requested.eth > 0 || p.requested.usdc > 0

  return (
    <Link
      href={`/proposals/${p.id}`}
      className="group flex flex-col gap-2.5 rounded-xl border border-border bg-surface px-[18px] py-4 text-left text-fg transition-[transform,border-color] hover:-translate-y-px hover:border-border-strong"
    >
      <div className="flex items-center justify-between">
        <span className="font-mono text-xs font-semibold text-muted-fg">Prop {p.id}</span>
        <StatusBadge status={p.status} />
      </div>
      <div className="text-[15px] font-semibold leading-snug text-fg">{p.title}</div>
      <div className="flex min-w-0 items-center gap-1.5 text-[12.5px] text-muted-fg">
        <span className="shrink-0">by</span>
        <WalletPill address={p.proposer} ens={p.proposerEns} link={false} size="xs" />
        <span className="shrink-0">· {p.date}</span>
      </div>
      <div className="mt-auto pt-1">
        <div className="mb-1 text-[12.5px] text-muted-fg">Voting progress</div>
        <VoteBar
          forV={p.forVotes}
          against={p.againstVotes}
          abstain={p.abstainVotes}
          quorum={p.quorum}
          height={6}
        />
        <div className="mt-1 text-[12.5px] text-muted-fg">
          {total} votes · {p.endsLabel}
        </div>
      </div>
      {hasReq && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2">
          <span className="text-[12.5px] text-muted-fg">Requested</span>
          <div className="flex items-center gap-2">
            {p.treasuryInsufficient && <TreasuryInsufficientBadge />}
            <span className="text-sm font-bold">
              {p.requested.eth > 0 && `${p.requested.eth} ETH`}
              {p.requested.eth > 0 && p.requested.usdc > 0 && ' · '}
              {p.requested.usdc > 0 && `${p.requested.usdc.toLocaleString('en-US')} USDC`}
            </span>
          </div>
        </div>
      )}
    </Link>
  )
}
