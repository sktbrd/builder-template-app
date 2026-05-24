'use client'

import { AlertTriangle } from 'lucide-react'
import { useState } from 'react'

import { Markdown } from '@/components/Markdown'
import {
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
  const { warnings } = useProposalFeasibility(drafts, tokenMeta)
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
