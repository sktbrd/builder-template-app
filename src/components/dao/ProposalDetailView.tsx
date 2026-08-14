import { ETHERSCAN_BASE_URL } from '@buildeross/constants'
import { CHAIN_ID } from '@buildeross/types'
import { isChainIdSupportedByEAS } from '@buildeross/utils/eas'

import { ProposalActions } from '@/components/dao/ProposalActions'
import { ProposalTabs } from '@/components/dao/ProposalTabs'
import { ProposalTransactionList } from '@/components/dao/ProposalTransactionList'
import { ProposalVotesList } from '@/components/dao/ProposalVotesList'
import { StatusBadge } from '@/components/dao/StatusBadge'
import { TreasuryInsufficientBadge } from '@/components/dao/TreasuryInsufficientBadge'
import { VoteCountdownLabel } from '@/components/dao/VoteCountdownLabel'
import { VotePanel } from '@/components/dao/VotePanel'
import { VoteSummary } from '@/components/dao/VoteSummary'
import { WalletPill } from '@/components/dao/WalletPill'
import { Markdown } from '@/components/Markdown'
import { PropdateThread } from '@/components/propdates/PropdateThread'
import { daoConfig } from '@/lib/dao.config'
import type { ProposalDetail } from '@/lib/dao-data'

/**
 * Presentational layout for a single proposal. Pure — it derives everything
 * from `detail` + daoConfig and holds no data fetching, so the real route
 * (`/proposals/[id]`) and the `/dev/proposal` state matrix render byte-identical
 * markup from a real vs. fabricated `ProposalDetail`.
 */
export function ProposalDetailView({ detail }: { detail: ProposalDetail }) {
  const { summary: p, description, transactions } = detail
  // Render the vote panel for both pending and active. Pending shows a
  // "voting opens in X" callout; active enables the choice form + submit.
  const showVotePanel = p.status === 'active' || p.status === 'pending'
  const isActive = p.status === 'active'
  const showPropdates = isChainIdSupportedByEAS(daoConfig.chainId)
  const explorerBase =
    ETHERSCAN_BASE_URL[daoConfig.chainId as CHAIN_ID] || 'https://basescan.org'

  const lifecycleTx =
    detail.executionTransactionHash && p.status === 'executed'
      ? {
          label: 'Executed',
          hash: detail.executionTransactionHash,
          tone: 'success' as const,
        }
      : detail.cancelTransactionHash && p.status === 'cancelled'
        ? {
            label: 'Cancelled',
            hash: detail.cancelTransactionHash,
            tone: 'muted' as const,
          }
        : detail.vetoTransactionHash && p.status === 'vetoed'
          ? {
              label: 'Vetoed',
              hash: detail.vetoTransactionHash,
              tone: 'destructive' as const,
            }
          : null

  return (
    <div
      className={
        showVotePanel
          ? 'grid grid-cols-1 items-start gap-7 lg:grid-cols-[1fr_360px]'
          : 'flex flex-col gap-7'
      }
    >
      <div className="flex flex-col gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-mono text-xs font-semibold text-muted-fg">
              Prop {p.id}
            </span>
            <StatusBadge status={p.status} />
            {p.treasuryInsufficient && <TreasuryInsufficientBadge withLabel />}
            {isActive && p.voteEnd > 0 ? (
              <VoteCountdownLabel voteEnd={p.voteEnd} />
            ) : (
              <span className="text-[12.5px] text-muted-fg">{p.endsLabel}</span>
            )}
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
          <div className="mt-3 flex flex-wrap items-center gap-2 text-[12px]">
            {lifecycleTx && (
              <TxLink
                base={explorerBase}
                label={lifecycleTx.label}
                hash={lifecycleTx.hash}
                tone={lifecycleTx.tone}
              />
            )}
            <TxLink
              base={explorerBase}
              label="Created"
              hash={detail.creationTransactionHash}
            />
          </div>
        </div>

        {/* When the sidebar grid is collapsed (terminal-state proposals),
            ProposalActions still needs a home — render it inline above the
            body sections so it remains discoverable for proposer/vetoer
            viewers without reserving an empty 360px column. */}
        {!showVotePanel && <ProposalActions detail={detail} />}

        <VoteSummary
          proposalIdHash={detail.proposalIdHash}
          forVotes={p.forVotes}
          againstVotes={p.againstVotes}
          abstainVotes={p.abstainVotes}
          quorum={p.quorum}
        />

        <ProposalTabs
          propdatesSupported={showPropdates}
          counts={{
            transactions: transactions.length,
            votes: detail.votes.length,
          }}
          panels={{
            proposal: description ? (
              <div className="mx-auto max-w-[80ch]">
                <Markdown className="max-w-none">{description}</Markdown>
              </div>
            ) : (
              <div className="text-sm text-muted-fg">(No description provided.)</div>
            ),
            transactions: (
              <ProposalTransactionList
                chainId={daoConfig.chainId}
                transactions={transactions.map((t) => ({
                  target: t.target,
                  calldata: t.calldata,
                  valueWei: t.valueWei,
                }))}
                daoTokenAddress={daoConfig.addresses.token}
                nftImages={detail.nftImages}
              />
            ),
            votes: (
              <ProposalVotesList
                votes={detail.votes}
                proposalIdHash={detail.proposalIdHash}
              />
            ),
            propdates: showPropdates ? (
              <PropdateThread proposalIdHash={detail.proposalIdHash} />
            ) : undefined,
          }}
        />
      </div>

      {showVotePanel && (
        <div className="flex flex-col gap-4">
          <VotePanel
            proposalIdHash={detail.proposalIdHash}
            voteStart={detail.voteStart}
            active={isActive}
            votes={detail.votes}
          />
          <ProposalActions detail={detail} />
        </div>
      )}
    </div>
  )
}

function TxLink({
  base,
  label,
  hash,
  tone = 'muted',
}: {
  base: string
  label: string
  hash: string
  tone?: 'muted' | 'success' | 'destructive'
}) {
  const toneClass =
    tone === 'success'
      ? 'border-success/30 bg-success/10 text-success'
      : tone === 'destructive'
        ? 'border-destructive/30 bg-destructive/10 text-destructive'
        : 'border-border bg-surface-2 text-muted-fg hover:text-fg hover:bg-surface-3'

  return (
    <a
      href={`${base}/tx/${hash}`}
      target="_blank"
      rel="noreferrer"
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-mono text-[11px] font-semibold transition-colors ${toneClass}`}
    >
      <span className="tracking-wide">{label}</span>
      <span className="max-w-[14ch] truncate">{shortHash(hash)}</span>
    </a>
  )
}

function shortHash(hash: string): string {
  if (!hash || hash.length < 12) return hash
  return `${hash.slice(0, 6)}…${hash.slice(-4)}`
}
