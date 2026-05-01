import { ChevronLeft } from 'lucide-react'
import Link from 'next/link'

import { StatusBadge } from '@/components/dao/StatusBadge'
import { VoteBar } from '@/components/dao/VoteBar'
import { VotePanel } from '@/components/dao/VotePanel'
import { PROPOSALS } from '@/lib/mockData'

type Params = Promise<{ id: string }>

export default async function ProposalDetailPage({ params }: { params: Params }) {
  const { id } = await params
  const numericId = parseInt(id, 10)
  const p = PROPOSALS.find((x) => x.id === numericId) ?? PROPOSALS[2] // active fallback
  const totalCast = p.forVotes + p.againstVotes + p.abstainVotes

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/proposals"
          className="inline-flex items-center gap-1 text-sm font-semibold text-accent-strong hover:underline"
        >
          <ChevronLeft className="h-4 w-4" />
          All proposals
        </Link>
      </div>

      <div className="grid grid-cols-1 items-start gap-7 lg:grid-cols-[1fr_360px]">
        <div className="flex flex-col gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-mono text-xs font-semibold text-muted-fg">
                Prop {p.id}
              </span>
              <StatusBadge status={p.status} />
              <span className="text-[12.5px] text-muted-fg">{p.endsLabel}</span>
            </div>
            <h1 className="mt-2 font-display text-[clamp(36px,5vw,56px)] font-extrabold leading-[1.04] tracking-[-0.025em]">
              {p.title}
            </h1>
            <div className="mt-2 text-[12.5px] text-muted-fg">
              Proposed by <strong className="font-semibold">{p.proposer}</strong>{' '}
              · {p.date}
            </div>
          </div>

          <section className="rounded-xl border border-border bg-surface px-6 py-[22px]">
            <h3 className="mb-3 text-base font-bold">Vote summary</h3>
            <VoteBar
              forV={p.forVotes}
              against={p.againstVotes}
              abstain={p.abstainVotes}
              quorum={p.quorum}
              height={14}
              showLabels
            />
            <div className="mt-2 text-[12.5px] text-muted-fg">
              Quorum: {p.quorum} · Total cast: {totalCast}
            </div>
          </section>

          <section className="rounded-xl border border-border bg-surface px-6 py-[22px]">
            <h3 className="mb-3 text-base font-bold">Description</h3>
            <div className="flex flex-col gap-3 text-[15px] text-fg-2">
              <p>
                This proposal funds the next phase of collaboration with Builder
                maintainers: upstreaming proven work into the official Builder
                template and submitting the strongest feature tracks to core
                repositories in structured batches.
              </p>
              <p>
                Deliverables include cherry-picked, generic improvements landing
                in{' '}
                <code className="rounded bg-surface-2 px-1 py-0.5 font-mono text-[13px]">
                  BuilderOSS/builder-template-app
                </code>
                , a fork-to-launch checklist, and two upstream PR batches
                covering up to 8 production-tested feature tracks.
              </p>
              <h4 className="mt-2 text-sm font-semibold text-fg">Milestones</h4>
              <ol className="ml-5 list-decimal space-y-1 text-[15px]">
                <li>Official template enhancements — 1.5 ETH</li>
                <li>Upstream PR Batch 1 — 1.25 ETH</li>
                <li>Upstream PR Batch 2 + final reporting — 1.25 ETH</li>
              </ol>
            </div>
          </section>

          <section className="rounded-xl border border-border bg-surface px-6 py-[22px]">
            <h3 className="mb-3 text-base font-bold">Transactions</h3>
            <ul className="flex flex-col gap-2.5">
              <li className="grid grid-cols-1 gap-3 rounded-md bg-surface-2 px-4 py-3 sm:grid-cols-[1fr_1fr_100px]">
                <div>
                  <div className="text-[12.5px] text-muted-fg">Target</div>
                  <div className="font-mono text-xs">0x98bc…D1cF</div>
                </div>
                <div>
                  <div className="text-[12.5px] text-muted-fg">Function</div>
                  <div className="font-mono text-xs">createEscrow(...)</div>
                </div>
                <div>
                  <div className="text-[12.5px] text-muted-fg">Value</div>
                  <div className="text-sm font-bold">4.0 ETH</div>
                </div>
              </li>
            </ul>
          </section>
        </div>

        <VotePanel
          votingPower={4}
          active={p.status === 'active' || p.status === 'pending'}
        />
      </div>
    </div>
  )
}
