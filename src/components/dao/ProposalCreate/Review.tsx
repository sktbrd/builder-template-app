'use client'

import { governorAbi, tokenAbi } from '@buildeross/sdk/contract'
import { AlertTriangle } from 'lucide-react'
import { useMemo, useState } from 'react'
import { type Address, formatUnits } from 'viem'
import { useAccount, useReadContracts } from 'wagmi'

import { Markdown } from '@/components/Markdown'
import { daoConfig } from '@/lib/dao.config'
import {
  encodeDraftToTxs,
  summarizeDraftsMarkdown,
  type TokenMetaMap,
  type TxDraft,
} from '@/lib/proposal-tx'
import { useProposalFeasibility } from '@/lib/use-proposal-feasibility'

import { SummaryCard } from './SummaryCard'

type Props = {
  title: string
  description: string
  drafts: TxDraft[]
  tokenMeta: TokenMetaMap
  /**
   * Whether to auto-append the decoded transactions section to the
   * proposal description on submit. Toggle in the Review UI.
   */
  includeDecodedSummary: boolean
  onIncludeDecodedSummaryChange: (next: boolean) => void
}

export function Review({
  title,
  description,
  drafts,
  tokenMeta,
  includeDecodedSummary,
  onIncludeDecodedSummaryChange,
}: Props) {
  const decodedSummary = summarizeDraftsMarkdown(drafts, tokenMeta)
  const [showDecoded, setShowDecoded] = useState(false)
  const { warnings, ethRequiredWei, erc20Required, balances } = useProposalFeasibility(
    drafts,
    tokenMeta
  )

  // ── Governor parameters (current settings, snapshotted at creation).
  const { address } = useAccount()
  const { data: govReads } = useReadContracts({
    contracts: [
      {
        address: daoConfig.addresses.governor as Address,
        abi: governorAbi,
        functionName: 'votingDelay' as const,
        chainId: daoConfig.chainId,
      },
      {
        address: daoConfig.addresses.governor as Address,
        abi: governorAbi,
        functionName: 'votingPeriod' as const,
        chainId: daoConfig.chainId,
      },
      {
        address: daoConfig.addresses.governor as Address,
        abi: governorAbi,
        functionName: 'quorum' as const,
        chainId: daoConfig.chainId,
      },
      {
        address: daoConfig.addresses.governor as Address,
        abi: governorAbi,
        functionName: 'proposalThreshold' as const,
        chainId: daoConfig.chainId,
      },
    ],
  })
  const { data: voteReads } = useReadContracts({
    contracts: address
      ? [
          {
            address: daoConfig.addresses.token as Address,
            abi: tokenAbi,
            functionName: 'getVotes' as const,
            args: [address] as const,
            chainId: daoConfig.chainId,
          },
        ]
      : [],
    query: { enabled: !!address },
  })

  const votingDelaySec = readNumber(govReads?.[0])
  const votingPeriodSec = readNumber(govReads?.[1])
  const quorumVotes = readNumber(govReads?.[2])
  const thresholdVotes = readNumber(govReads?.[3])
  const myVotes = readNumber(voteReads?.[0])
  const showGovernance =
    votingDelaySec != null || votingPeriodSec != null || quorumVotes != null

  // ── Real encoded call count (expands drafts that auto-prepend approvals).
  const encodedCount = useMemo(() => {
    try {
      let total = 0
      for (const d of drafts) {
        const txs = encodeDraftToTxs(d, tokenMeta, {
          treasury: daoConfig.addresses.treasury,
          token: daoConfig.addresses.token,
          auction: daoConfig.addresses.auction,
        })
        if (txs === null) return null
        total += txs.length
      }
      return total
    } catch {
      return null
    }
  }, [drafts, tokenMeta])
  const approvalCount = encodedCount != null ? encodedCount - drafts.length : 0

  // ── Treasury impact rows (native ETH + each ERC-20 with a positive outflow).
  const erc20Impact = erc20Required.filter((a) => a.required > BigInt(0))
  const showTreasuryImpact = ethRequiredWei > BigInt(0) || erc20Impact.length > 0

  return (
    <div className="flex flex-col gap-5">
      {warnings.length > 0 && (
        <section>
          <div className="flex items-start gap-3 rounded-md border border-warning bg-warning/10 px-4 py-3 text-[12.5px] text-warning">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="flex-1">
              <div className="font-semibold">
                Pre-flight checks failed for {warnings.length} item
                {warnings.length === 1 ? '' : 's'}
              </div>
              <ul className="mt-1.5 ml-4 list-disc space-y-1">
                {warnings.map((w) => (
                  <li key={w.id}>{w.message}</li>
                ))}
              </ul>
              <p className="mt-2 text-[11.5px] opacity-80">
                You can still submit, but the proposal will revert on execution unless the
                treasury state changes. Consider editing the offending transactions.
              </p>
            </div>
          </div>
        </section>
      )}
      <section>
        <h3 className="text-base font-bold">Title</h3>
        <p className="mt-2 text-lg font-semibold text-fg">{title || '(empty)'}</p>
      </section>

      <section>
        <h3 className="text-base font-bold">Description</h3>
        <div className="mt-2 rounded-md border border-dashed border-border bg-surface-2 px-4 py-3">
          {description ? (
            <Markdown>{description}</Markdown>
          ) : (
            <div className="text-sm text-muted-fg">(empty)</div>
          )}
        </div>
      </section>

      <section>
        <h3 className="text-base font-bold">
          Transactions{' '}
          <span className="ml-1 text-[12.5px] font-normal text-muted-fg">
            {drafts.length}
          </span>
        </h3>
        {encodedCount != null && drafts.length > 0 && (
          <p className="mt-1 text-[12px] text-muted-fg">
            {encodedCount} on-chain call{encodedCount === 1 ? '' : 's'}
            {approvalCount > 0
              ? ` (${approvalCount} auto-included approval${
                  approvalCount === 1 ? '' : 's'
                })`
              : ''}
          </p>
        )}
        {drafts.length === 0 ? (
          <div className="mt-2 rounded-md border border-dashed border-border bg-surface-2 px-4 py-3 text-sm text-muted-fg">
            No transactions queued.
          </div>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {drafts.map((d, i) => (
              <li key={i}>
                <SummaryCard draft={d} index={i} tokenMeta={tokenMeta} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {showTreasuryImpact && (
        <section>
          <h3 className="text-base font-bold">Treasury impact</h3>
          <ul className="mt-2 flex flex-col gap-2">
            {ethRequiredWei > BigInt(0) && (
              <TreasuryRow
                label="ETH"
                required={ethRequiredWei}
                balance={balances.ethWei}
                decimals={18}
              />
            )}
            {erc20Impact.map((a) => (
              <TreasuryRow
                key={a.token}
                label={a.symbol || a.token}
                required={a.required}
                balance={balances.erc20[a.token.toLowerCase()]}
                decimals={a.decimals}
              />
            ))}
          </ul>
        </section>
      )}

      {showGovernance && (
        <section>
          <h3 className="text-base font-bold">Governance parameters</h3>
          <div className="mt-2 rounded-md border border-border bg-surface-2 px-4 py-3 text-[12.5px] text-muted-fg">
            <p className="text-fg">
              Voting opens ~{formatDuration(votingDelaySec)} after submission and runs{' '}
              {formatDuration(votingPeriodSec)}.
            </p>
            {quorumVotes != null && (
              <p className="mt-1">
                Current quorum:{' '}
                <span className="font-semibold text-fg">
                  {quorumVotes} {quorumVotes === 1 ? 'vote' : 'votes'}
                </span>
                .
              </p>
            )}
            {(myVotes != null || thresholdVotes != null) && (
              <p className="mt-1">
                You are proposing with{' '}
                <span className="font-semibold text-fg">
                  {myVotes ?? '—'} {myVotes === 1 ? 'vote' : 'votes'}
                </span>
                {thresholdVotes != null ? ` (threshold ${thresholdVotes}).` : '.'}
              </p>
            )}
            <p className="mt-1.5 text-[11.5px] opacity-80">
              These are the governor&apos;s current settings — they can change and are
              snapshotted when the proposal is created.
            </p>
          </div>
        </section>
      )}

      {drafts.length > 0 && (
        <section>
          <div className="flex items-start gap-3 rounded-md border border-border bg-surface-2 px-4 py-3">
            <button
              type="button"
              role="switch"
              aria-checked={includeDecodedSummary}
              onClick={() => onIncludeDecodedSummaryChange(!includeDecodedSummary)}
              className="relative mt-1 h-5 w-9 flex-shrink-0 rounded-full border transition-colors"
              style={{
                background: includeDecodedSummary ? 'var(--accent)' : 'var(--surface-3)',
                borderColor: includeDecodedSummary ? 'var(--accent)' : 'var(--border)',
              }}
            >
              <span
                className="absolute left-0 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform"
                style={{
                  transform: includeDecodedSummary
                    ? 'translateX(18px)'
                    : 'translateX(2px)',
                }}
              />
            </button>
            <div className="flex-1 text-[12.5px]">
              <div className="font-semibold text-fg">
                Append a decoded-transactions section to the proposal description
              </div>
              <p className="mt-0.5 text-muted-fg">
                Voters see what each call does without having to decode calldata.
                Recommended for proposals with structured kinds
                (NFT/ERC-20/milestone/airdrop/etc.).
              </p>
              <button
                type="button"
                onClick={() => setShowDecoded((s) => !s)}
                className="mt-1 text-[11.5px] font-semibold text-accent-strong hover:underline"
              >
                {showDecoded ? 'Hide preview' : 'Preview'}
              </button>
              {showDecoded && (
                <div className="mt-2 rounded-md border border-dashed border-border bg-surface px-3 py-2">
                  <Markdown>{decodedSummary}</Markdown>
                </div>
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  )
}

function TreasuryRow({
  label,
  required,
  balance,
  decimals,
}: {
  label: string
  required: bigint
  balance?: bigint
  decimals: number
}) {
  const insufficient = balance != null && balance < required
  const sufficient = balance != null && balance >= required
  return (
    <li
      className={
        insufficient
          ? 'flex items-center justify-between gap-3 rounded-md border border-warning bg-warning/10 px-4 py-2.5 text-[12.5px] text-warning'
          : 'flex items-center justify-between gap-3 rounded-md border border-border bg-surface-2 px-4 py-2.5 text-[12.5px]'
      }
    >
      <span className="font-semibold text-fg">
        Spends {fmtAmount(required, decimals)} {label}
      </span>
      <span className={sufficient ? 'text-success' : insufficient ? '' : 'text-muted-fg'}>
        treasury holds {balance != null ? fmtAmount(balance, decimals) : '…'}
      </span>
    </li>
  )
}

/** Narrow a wagmi read result to its numeric value (bigint → number), else null. */
function readNumber(
  read: { status: string; result?: unknown } | undefined
): number | null {
  if (!read || read.status !== 'success') return null
  return typeof read.result === 'bigint' ? Number(read.result) : null
}

/** Format a bigint base-unit amount to a short decimal string (≤4 fraction digits). */
function fmtAmount(v: bigint, decimals: number): string {
  const [whole, frac] = formatUnits(v, decimals).split('.')
  if (!frac) return whole
  const trimmed = frac.slice(0, 4).replace(/0+$/, '')
  return trimmed ? `${whole}.${trimmed}` : whole
}

/** Render a duration in seconds as a compact human string (days/hours/minutes). */
function formatDuration(seconds: number | null): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds <= 0) return '—'
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const parts: string[] = []
  if (days) parts.push(`${days} day${days === 1 ? '' : 's'}`)
  if (hours) parts.push(`${hours} hour${hours === 1 ? '' : 's'}`)
  if (minutes && !days) parts.push(`${minutes} minute${minutes === 1 ? '' : 's'}`)
  return parts.length ? parts.join(' ') : `${seconds}s`
}
