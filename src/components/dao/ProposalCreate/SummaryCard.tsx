'use client'

import {
  Brush,
  CloudRain,
  Coins,
  Flag,
  ImageIcon,
  Layers,
  Package,
  PauseCircle,
  Pencil,
  Pin,
  RefreshCw,
  Send,
  Settings2,
  Timer,
  Trash2,
  UserCheck,
  Wallet,
} from 'lucide-react'

import { WalletPill } from '@/components/dao/WalletPill'
import { daoConfig } from '@/lib/dao.config'
import {
  CUSTOM_LIKE_KINDS,
  tokenKey,
  type TokenMetaMap,
  TX_KIND_LABELS,
  type TxDraft,
  type TxKind,
} from '@/lib/proposal-tx'

type Props = {
  draft: TxDraft
  index: number
  tokenMeta: TokenMetaMap
  onEdit?: () => void
  onRemove?: () => void
}

const KIND_ICON: Record<TxKind, React.ElementType> = {
  eth: Send,
  erc20: Coins,
  nft: ImageIcon,
  custom: Settings2,
  stream: Timer,
  airdrop: CloudRain,
  milestone: Flag,
  mint_gov: Layers,
  delegate: UserCheck,
  pause_auction: PauseCircle,
  walletconnect: Wallet,
  pin_asset: Pin,
  droposal: Package,
  add_artwork: Brush,
  replace_artwork: RefreshCw,
}

const KIND_ICON_CLASS: Record<TxKind, string> = {
  eth: 'bg-accent/15 text-accent-strong',
  erc20: 'bg-success/15 text-success',
  nft: 'bg-orange-500/15 text-orange-500',
  custom: 'bg-muted-fg/15 text-muted-fg',
  stream: 'bg-cyan-500/15 text-cyan-500',
  airdrop: 'bg-sky-500/15 text-sky-500',
  milestone: 'bg-rose-500/15 text-rose-500',
  mint_gov: 'bg-emerald-500/15 text-emerald-500',
  delegate: 'bg-violet-500/15 text-violet-500',
  pause_auction: 'bg-red-500/15 text-red-500',
  walletconnect: 'bg-blue-500/15 text-blue-500',
  pin_asset: 'bg-amber-500/15 text-amber-500',
  droposal: 'bg-indigo-500/15 text-indigo-500',
  add_artwork: 'bg-pink-500/15 text-pink-500',
  replace_artwork: 'bg-teal-500/15 text-teal-500',
}

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
          <span className="text-sm font-semibold text-fg">{TX_KIND_LABELS[draft.kind]}</span>
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
        <span className="font-semibold text-fg">{formatNumber(draft.valueEth) || '0'} ETH</span>
        <span className="text-muted-fg">to</span>
        {draft.recipient ? (
          <WalletPill address={draft.recipient} link={false} size="xs" />
        ) : (
          <span className="italic text-muted-fg">(no recipient)</span>
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
          <span className="italic text-muted-fg">(no recipient)</span>
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

  if (draft.kind === 'nft') {
    return (
      <div className="flex flex-wrap items-center gap-1.5 text-[12.5px]">
        <span className="font-semibold text-fg">Token #{draft.tokenId || '?'}</span>
        <span className="text-muted-fg">from</span>
        {draft.contract ? (
          <WalletPill
            address={draft.contract}
            link={false}
            size="xs"
            showExplorer
            chainId={daoConfig.chainId}
          />
        ) : (
          <span className="italic text-muted-fg">(no contract)</span>
        )}
        <span className="text-muted-fg">to</span>
        {draft.recipient ? (
          <WalletPill address={draft.recipient} link={false} size="xs" />
        ) : (
          <span className="italic text-muted-fg">(no recipient)</span>
        )}
      </div>
    )
  }

  if (draft.kind === 'mint_gov') {
    return (
      <div className="flex flex-wrap items-center gap-1.5 text-[12.5px]">
        <span className="text-muted-fg">Mint to</span>
        {draft.recipient ? (
          <WalletPill address={draft.recipient} link={false} size="xs" />
        ) : (
          <span className="italic text-muted-fg">(no recipient)</span>
        )}
      </div>
    )
  }

  if (draft.kind === 'delegate') {
    return (
      <div className="flex flex-wrap items-center gap-1.5 text-[12.5px]">
        <span className="text-muted-fg">Delegate to</span>
        {draft.delegatee ? (
          <WalletPill address={draft.delegatee} link={false} size="xs" />
        ) : (
          <span className="italic text-muted-fg">(no delegate)</span>
        )}
      </div>
    )
  }

  if (draft.kind === 'pause_auction') {
    return (
      <div className="text-[12.5px]">
        <span className="font-semibold text-fg capitalize">{draft.action}</span>
        <span className="text-muted-fg"> the auction house</span>
      </div>
    )
  }

  // custom + all custom-like kinds
  if (draft.kind === 'custom' || CUSTOM_LIKE_KINDS.has(draft.kind)) {
    const d = draft as Extract<TxDraft, { target: string; valueEth: string; calldata: string }>
    return (
      <div className="flex flex-col gap-1 text-[12.5px]">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-muted-fg">Target</span>
          {d.target ? (
            <WalletPill
              address={d.target}
              link={false}
              size="xs"
              showExplorer
              chainId={daoConfig.chainId}
            />
          ) : (
            <span className="italic text-muted-fg">(no target)</span>
          )}
          {d.valueEth && d.valueEth !== '0' && (
            <>
              <span className="text-muted-fg">·</span>
              <span className="font-semibold text-fg">{formatNumber(d.valueEth)} ETH</span>
            </>
          )}
        </div>
        {d.calldata && d.calldata !== '0x' && (
          <div className="truncate font-mono text-[11px] text-muted-fg">{d.calldata}</div>
        )}
      </div>
    )
  }

  return null
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
