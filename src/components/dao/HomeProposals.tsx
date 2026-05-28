import Link from 'next/link'

import { ProposalActiveCard } from '@/components/dao/ProposalActiveCard'
import { StatusBadge } from '@/components/dao/StatusBadge'
import type { ProposalSummary } from '@/lib/dao-data'
import type { ProposalStatus } from '@/lib/types'
import { cn } from '@/lib/utils'

type Props = {
  proposals: ProposalSummary[]
}

const ACTIVE: ProposalStatus[] = ['active', 'pending', 'queued', 'succeeded']

export function HomeProposals({ proposals }: Props) {
  const active = proposals.filter((p) => ACTIVE.includes(p.status))
  const ended = proposals.filter((p) => !ACTIVE.includes(p.status)).slice(0, 4)

  return (
    <section className="rounded-[10px] border border-border bg-surface/60 px-4 py-4">
      <header className="mb-3 flex items-center justify-between gap-3">
        <h2 className="font-display text-xl font-bold tracking-tight">
          Proposals
          {active.length > 0 && (
            <span className="ml-2 text-sm font-normal text-muted-fg">
              {active.length} active
            </span>
          )}
        </h2>
        <Link
          href="/proposals"
          className="text-[12px] font-semibold text-muted-fg transition-colors hover:text-fg"
        >
          View all →
        </Link>
      </header>

      {active.length === 0 && ended.length === 0 ? (
        <div className="rounded-md border border-dashed border-border bg-surface-2 px-4 py-10 text-center text-sm text-muted-fg">
          No proposals yet —{' '}
          <Link href="/proposals/new" className="text-accent-strong hover:underline">
            create the first one
          </Link>
          .
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {active.length > 0 && (
            <ul className="flex flex-col gap-3">
              {active.map((p) => (
                <li key={p.id}>
                  <ProposalActiveCard p={p} />
                </li>
              ))}
            </ul>
          )}

          {ended.length > 0 && (
            <>
              <div className="flex items-center gap-3 pt-1">
                <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-fg">
                  Recently ended
                </span>
                <span className="h-px flex-1 bg-border" />
              </div>
              <ul className="flex flex-col">
                {ended.map((p, i) => (
                  <li
                    key={p.id}
                    className={cn(i < ended.length - 1 && 'border-b border-border/60')}
                  >
                    <ProposalRowCompact p={p} />
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </section>
  )
}

function ProposalRowCompact({ p }: { p: ProposalSummary }) {
  const hasVotes = p.forVotes + p.againstVotes + p.abstainVotes > 0
  return (
    <Link
      href={`/proposals/${p.id}`}
      className="group flex items-center gap-3 px-1 py-2.5 transition-colors hover:bg-surface-2/50"
    >
      <span className="w-9 shrink-0 text-right font-mono text-[11px] font-semibold tabular-nums text-muted-fg">
        #{p.id}
      </span>
      <p className="min-w-0 flex-1 truncate text-[13px] font-semibold text-fg group-hover:text-accent-strong">
        {p.title}
      </p>
      {hasVotes && (
        <span
          aria-label={`Votes ${p.forVotes} for, ${p.againstVotes} against`}
          className="hidden shrink-0 items-center gap-1.5 text-[11px] font-semibold tabular-nums sm:inline-flex"
        >
          <span className="text-vote-for">{p.forVotes}</span>
          <span className="text-muted-fg/50" aria-hidden>
            ·
          </span>
          <span className="text-vote-against">{p.againstVotes}</span>
        </span>
      )}
      <StatusBadge status={p.status} className="shrink-0" />
    </Link>
  )
}
