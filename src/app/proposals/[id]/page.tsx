import { isChainIdSupportedByEAS } from '@buildeross/utils/eas'
import { ChevronLeft } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { StatusBadge } from '@/components/dao/StatusBadge'
import { VoteBar } from '@/components/dao/VoteBar'
import { VotePanel } from '@/components/dao/VotePanel'
import { Markdown } from '@/components/Markdown'
import { PropdateThread } from '@/components/propdates/PropdateThread'
import { daoConfig } from '@/lib/dao.config'
import { getProposalByNumber } from '@/lib/dao-data'

export const revalidate = 30

type Params = Promise<{ id: string }>

export default async function ProposalDetailPage({ params }: { params: Params }) {
  const { id } = await params
  const proposalNumber = parseInt(id, 10)
  if (!Number.isFinite(proposalNumber) || proposalNumber < 0) notFound()

  const detail = await getProposalByNumber(proposalNumber)
  if (!detail) notFound()

  const { summary: p, description, transactions } = detail
  const totalCast = p.forVotes + p.againstVotes + p.abstainVotes
  const isVotable = p.status === 'active' || p.status === 'pending'
  const showPropdates = isChainIdSupportedByEAS(daoConfig.chainId)

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
              Proposed by <strong className="font-semibold">{p.proposer}</strong> ·{' '}
              {p.date}
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
            {description ? (
              <Markdown>{description}</Markdown>
            ) : (
              <div className="text-sm text-muted-fg">(No description provided.)</div>
            )}
          </section>

          <section className="rounded-xl border border-border bg-surface px-6 py-[22px]">
            <h3 className="mb-3 text-base font-bold">
              Transactions
              <span className="ml-2 text-[12.5px] font-normal text-muted-fg">
                {transactions.length}
              </span>
            </h3>
            {transactions.length === 0 ? (
              <div className="text-sm text-muted-fg">
                (No transactions on this proposal.)
              </div>
            ) : (
              <ul className="flex flex-col gap-2.5">
                {transactions.map((t, i) => (
                  <li
                    key={i}
                    className="grid grid-cols-1 gap-3 rounded-md bg-surface-2 px-4 py-3 sm:grid-cols-[1fr_1fr_120px]"
                  >
                    <div>
                      <div className="text-[12.5px] text-muted-fg">Target</div>
                      <div className="font-mono text-xs">{t.targetShort}</div>
                    </div>
                    <div>
                      <div className="text-[12.5px] text-muted-fg">Calldata</div>
                      <div className="font-mono text-xs">{t.calldataPreview}</div>
                    </div>
                    <div>
                      <div className="text-[12.5px] text-muted-fg">Value</div>
                      <div className="text-sm font-bold">
                        {trimDecimals(t.valueEth, 4)} ETH
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {/* Function-name + arg decoding lands with the upstream tx-decoder hook. */}
          </section>

          {showPropdates ? (
            <section className="rounded-xl border border-border bg-surface px-6 py-[22px]">
              <h3 className="mb-3 text-base font-bold">Propdates</h3>
              <PropdateThread proposalIdHash={detail.proposalIdHash} />
            </section>
          ) : null}
        </div>

        <VotePanel
          proposalIdHash={detail.proposalIdHash}
          voteStart={detail.voteStart}
          active={isVotable}
        />
      </div>
    </div>
  )
}

function trimDecimals(value: string, max: number): string {
  if (!value) return value
  if (!value.includes('.')) return value
  const [intPart, decPart] = value.split('.')
  return `${intPart}.${decPart.slice(0, max).replace(/0+$/, '') || '0'}`
}
