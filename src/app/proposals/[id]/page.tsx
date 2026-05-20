import { isChainIdSupportedByEAS } from '@buildeross/utils/eas'
import { ChevronLeft } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { DecodedTransactions } from '@/components/dao/DecodedTransactions'
import { ProposalActions } from '@/components/dao/ProposalActions'
import { ProposalVotesList } from '@/components/dao/ProposalVotesList'
import { StatusBadge } from '@/components/dao/StatusBadge'
import { TreasuryInsufficientBadge } from '@/components/dao/TreasuryInsufficientBadge'
import { VoteBar } from '@/components/dao/VoteBar'
import { VotePanel } from '@/components/dao/VotePanel'
import { WalletPill } from '@/components/dao/WalletPill'
import { Markdown } from '@/components/Markdown'
import { PropdateThread } from '@/components/propdates/PropdateThread'
import { daoConfig } from '@/lib/dao.config'
import { getProposalByNumber } from '@/lib/dao-data'

export const revalidate = 30

type Params = Promise<{ id: string }>

export default async function ProposalDetailPage({ params }: { params: Params }) {
  const { id } = await params
  if (!/^\d+$/.test(id)) notFound()

  const proposalNumber = parseInt(id, 10)
  if (!Number.isFinite(proposalNumber) || proposalNumber < 0) notFound()

  const detail = await getProposalByNumber(proposalNumber)
  if (!detail) notFound()

  const { summary: p, description, transactions } = detail
  const totalCast = p.forVotes + p.againstVotes + p.abstainVotes
  // Render the vote panel for both pending and active. Pending shows a
  // "voting opens in X" callout; active enables the choice form + submit.
  const showVotePanel = p.status === 'active' || p.status === 'pending'
  const isActive = p.status === 'active'
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
              {p.treasuryInsufficient && <TreasuryInsufficientBadge withLabel />}
              <span className="text-[12.5px] text-muted-fg">{p.endsLabel}</span>
            </div>
            <h1 className="mt-2 font-display text-[clamp(36px,5vw,56px)] font-extrabold leading-[1.04] tracking-[-0.025em]">
              {p.title}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[12.5px] text-muted-fg">
              <span>Proposed by</span>
              <WalletPill
                address={detail.proposerFull}
                ens={detail.proposerEns}
                size="xs"
              />
              <span>· {p.date}</span>
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
            <DecodedTransactions
              chainId={daoConfig.chainId}
              targets={transactions.map((t) => t.target)}
              calldatas={transactions.map((t) => t.calldata)}
              values={transactions.map((t) => t.valueWei.toString())}
            />
          </section>

          <section className="rounded-xl border border-border bg-surface px-6 py-[22px]">
            <h3 className="mb-3 text-base font-bold">
              Votes
              <span className="ml-2 text-[12.5px] font-normal text-muted-fg">
                {detail.votes.length}
              </span>
            </h3>
            <ProposalVotesList votes={detail.votes} />
          </section>

          {showPropdates ? (
            <section className="rounded-xl border border-border bg-surface px-6 py-[22px]">
              <h3 className="mb-3 text-base font-bold">Propdates</h3>
              <PropdateThread proposalIdHash={detail.proposalIdHash} />
            </section>
          ) : null}
        </div>

        <div className="flex flex-col gap-4">
          {showVotePanel && (
            <VotePanel
              proposalIdHash={detail.proposalIdHash}
              voteStart={detail.voteStart}
              active={isActive}
            />
          )}
          <ProposalActions detail={detail} />
        </div>
      </div>
    </div>
  )
}
