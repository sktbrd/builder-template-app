'use client'

import { Coins, Pencil, Send, Settings2, Trash2 } from 'lucide-react'

import { WalletPill } from '@/components/dao/WalletPill'
import { daoConfig } from '@/lib/dao.config'
import {
  tokenKey,
  type TokenMetaMap,
  TX_KIND_LABELS,
  type TxDraft,
} from '@/lib/proposal-tx'

type Props = {
  draft: TxDraft
  index: number
  tokenMeta: TokenMetaMap
  onEdit?: () => void
  onRemove?: () => void
}

const KIND_ICON = {
  eth: Send,
  erc20: Coins,
  custom: Settings2,
} as const

const KIND_ICON_CLASS = {
  eth: 'bg-accent/15 text-accent-strong',
  erc20: 'bg-success/15 text-success',
  custom: 'bg-muted-fg/15 text-muted-fg',
} as const

export function SummaryCard({ draft, index, tokenMeta, onEdit, onRemove }: Props) {
  const Icon = KIND_ICON[draft.kind]
  return (
    <div className="flex items-start gap-3 rounded-md border border-border bg-surface-2 px-4 py-3">
      <span
        className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${KIND_ICON_CLASS[draft.kind]}`}
      >
        <Icon className="h-5 w-5" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-muted-fg">
            Tx {index + 1}
          </span>
          <span className="text-sm font-semibold text-fg">
            {TX_KIND_LABELS[draft.kind]}
          </span>
        </div>
        <DraftSummary draft={draft} tokenMeta={tokenMeta} />
      </div>
      {(onEdit || onRemove) && (
        <div className="flex shrink-0 gap-1">
          {onEdit && (
            <button
              type="button"
              onClick={onEdit}
              aria-label="Edit transaction"
              className="rounded-md border border-border bg-surface px-2.5 py-1.5 text-muted-fg hover:text-fg"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          )}
          {onRemove && (
            <button
              type="button"
              onClick={onRemove}
              aria-label="Remove transaction"
              className="rounded-md border border-border bg-surface px-2.5 py-1.5 text-muted-fg hover:text-fg"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function DraftSummary({ draft, tokenMeta }: { draft: TxDraft; tokenMeta: TokenMetaMap }) {
  if (draft.kind === 'eth') {
    return (
      <div className="flex flex-wrap items-center gap-1.5 text-[12.5px]">
        <span className="font-semibold text-fg">
          {formatNumber(draft.valueEth) || '0'} ETH
        </span>
        <span className="text-muted-fg">to</span>
        {draft.recipient ? (
          <WalletPill address={draft.recipient} link={false} size="xs" />
        ) : (
          <span className="text-muted-fg italic">(no recipient)</span>
        )}
      </div>
    )
  }
  if (draft.kind === 'erc20') {
    const meta = tokenMeta[tokenKey(draft.token)]
    const symbol = meta?.symbol ?? findTreasurySymbol(draft.token) ?? 'tokens'
    return (
      <div className="flex flex-wrap items-center gap-1.5 text-[12.5px]">
        <span className="font-semibold text-fg">
          {formatNumber(draft.amount) || '0'} {symbol}
        </span>
        <span className="text-muted-fg">to</span>
        {draft.recipient ? (
          <WalletPill address={draft.recipient} link={false} size="xs" />
        ) : (
          <span className="text-muted-fg italic">(no recipient)</span>
        )}
        {draft.token && (
          <>
            <span className="text-muted-fg">·</span>
            <WalletPill
              address={draft.token}
              link={false}
              size="xs"
              showExplorer
              chainId={daoConfig.chainId}
            />
          </>
        )}
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-1 text-[12.5px]">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-muted-fg">Target</span>
        {draft.target ? (
          <WalletPill
            address={draft.target}
            link={false}
            size="xs"
            showExplorer
            chainId={daoConfig.chainId}
          />
        ) : (
          <span className="text-muted-fg italic">(no target)</span>
        )}
        {draft.valueEth && draft.valueEth !== '0' && (
          <>
            <span className="text-muted-fg">·</span>
            <span className="font-semibold text-fg">
              {formatNumber(draft.valueEth)} ETH
            </span>
          </>
        )}
      </div>
      {draft.calldata && draft.calldata !== '0x' && (
        <div className="truncate font-mono text-[11px] text-muted-fg">
          {draft.calldata}
        </div>
      )}
    </div>
  )
}

function findTreasurySymbol(addr: string): string | undefined {
  const k = tokenKey(addr)
  return daoConfig.treasuryTokens.find((t) => tokenKey(t.address) === k)?.symbol
}

function formatNumber(s: string): string {
  if (!s.trim()) return ''
  const n = Number(s)
  if (!Number.isFinite(n)) return s
  return n.toLocaleString('en-US', { maximumFractionDigits: 6 })
}
