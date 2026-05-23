'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

import { daoConfig } from '@/lib/dao.config'

const EXPLORER_BASE: Record<number, string> = {
  1: 'https://etherscan.io',
  10: 'https://optimistic.etherscan.io',
  8453: 'https://basescan.org',
  7777777: 'https://explorer.zora.energy',
}

type Transfer = {
  hash: string
  dir: 'in' | 'out'
  from: string
  to: string
  asset: string
  amount: string
  amountNum: number
  timestamp: number
  blockNum: number
}

type ApiResponse = {
  transfers: Transfer[]
  nextPageKeyIn?: string
  nextPageKeyOut?: string
  error?: string
}

function shortAddr(addr: string) {
  if (!addr || addr.length < 10) return addr
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

function relativeTime(ts: number): string {
  if (!ts) return ''
  const diff = Math.floor(Date.now() / 1000) - ts
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 2592000) return `${Math.floor(diff / 86400)}d ago`
  return `${Math.floor(diff / 2592000)}mo ago`
}

const DIR_FILTERS = ['all', 'in', 'out'] as const
type DirFilter = (typeof DIR_FILTERS)[number]

export function TreasuryTransfers() {
  const [dirFilter, setDirFilter] = useState<DirFilter>('all')
  const [assetFilter, setAssetFilter] = useState<string>('all')
  const [transfers, setTransfers] = useState<Transfer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [nextPageKeyIn, setNextPageKeyIn] = useState<string | undefined>()
  const [nextPageKeyOut, setNextPageKeyOut] = useState<string | undefined>()
  const [loadingMore, setLoadingMore] = useState(false)

  const explorerBase = EXPLORER_BASE[daoConfig.chainId] ?? 'https://basescan.org'

  const load = useCallback(async (dir: DirFilter, reset: boolean) => {
    if (reset) {
      setLoading(true)
      setError(null)
      setTransfers([])
      setNextPageKeyIn(undefined)
      setNextPageKeyOut(undefined)
    } else {
      setLoadingMore(true)
    }

    const params = new URLSearchParams({ dir })
    if (!reset) {
      if (dir !== 'out' && nextPageKeyIn) params.set('pageKey', nextPageKeyIn)
      if (dir !== 'in' && nextPageKeyOut) params.set('pageKey', nextPageKeyOut)
    }

    try {
      const res = await fetch(`/api/treasury/transfers?${params}`)
      const data: ApiResponse = await res.json()
      if (data.error) throw new Error(data.error)
      setTransfers((prev) => reset ? data.transfers : [...prev, ...data.transfers])
      setNextPageKeyIn(data.nextPageKeyIn)
      setNextPageKeyOut(data.nextPageKeyOut)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [nextPageKeyIn, nextPageKeyOut])

  useEffect(() => {
    load(dirFilter, true)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirFilter])

  const assets = useMemo(() => {
    const seen = new Set<string>()
    for (const t of transfers) seen.add(t.asset)
    return Array.from(seen).sort()
  }, [transfers])

  const visible = useMemo(() => {
    return transfers.filter((t) => assetFilter === 'all' || t.asset === assetFilter)
  }, [transfers, assetFilter])

  const hasMore =
    (dirFilter !== 'out' && !!nextPageKeyIn) ||
    (dirFilter !== 'in' && !!nextPageKeyOut)

  return (
    <section className="rounded-[14px] border border-border bg-surface px-6 py-[22px]">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-bold">Transfer history</h2>

        {/* Direction filter */}
        <div className="flex items-center gap-1 rounded-lg border border-border bg-surface-2 p-0.5">
          {DIR_FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => { setDirFilter(f); setAssetFilter('all') }}
              className={
                dirFilter === f
                  ? 'rounded-md bg-surface px-3 py-1 text-[12px] font-semibold text-fg shadow-sm'
                  : 'rounded-md px-3 py-1 text-[12px] font-medium text-muted-fg hover:text-fg'
              }
            >
              {f === 'all' ? 'All' : f === 'in' ? '↓ In' : '↑ Out'}
            </button>
          ))}
        </div>
      </div>

      {/* Asset filter chips */}
      {assets.length > 1 && (
        <div className="mb-4 flex flex-wrap gap-1.5">
          <Chip active={assetFilter === 'all'} onClick={() => setAssetFilter('all')}>All assets</Chip>
          {assets.map((a) => (
            <Chip key={a} active={assetFilter === a} onClick={() => setAssetFilter(a)}>
              {a}
            </Chip>
          ))}
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex flex-col gap-2 py-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-10 rounded-lg bg-surface-2 animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="py-8 text-center text-sm text-muted-fg">
          Could not load transfers: {error}
        </div>
      ) : visible.length === 0 ? (
        <div className="py-8 text-center text-sm text-muted-fg">No transfers found.</div>
      ) : (
        <div className="flex flex-col">
          {visible.map((tx, i) => (
            <TxRow key={`${tx.hash}-${i}`} tx={tx} explorerBase={explorerBase} />
          ))}
        </div>
      )}

      {hasMore && !loading && (
        <div className="mt-4 flex justify-center">
          <button
            type="button"
            onClick={() => load(dirFilter, false)}
            disabled={loadingMore}
            className="rounded-lg border border-border bg-surface-2 px-4 py-2 text-[13px] font-medium hover:bg-surface-3 disabled:opacity-50"
          >
            {loadingMore ? 'Loading…' : 'Load more'}
          </button>
        </div>
      )}
    </section>
  )
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-2.5 py-0.5 text-[12px] font-medium transition-colors ${
        active
          ? 'border-accent bg-accent text-accent-fg'
          : 'border-border bg-surface-2 text-muted-fg hover:text-fg'
      }`}
    >
      {children}
    </button>
  )
}

function TxRow({ tx, explorerBase }: { tx: Transfer; explorerBase: string }) {
  const isIn = tx.dir === 'in'
  const counterpart = isIn ? tx.from : tx.to
  return (
    <a
      href={`${explorerBase}/tx/${tx.hash}`}
      target="_blank"
      rel="noreferrer"
      className="grid items-center gap-3 border-b border-border py-3 text-[13px] last:border-0 hover:bg-surface-2 -mx-2 px-2 rounded-md transition-colors"
      style={{ gridTemplateColumns: '28px 1fr auto auto auto' }}
    >
      {/* direction badge */}
      <span
        className="flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold"
        style={{
          background: isIn
            ? 'color-mix(in oklab, #5fd28a 20%, transparent)'
            : 'color-mix(in oklab, #f06464 20%, transparent)',
          color: isIn ? '#5fd28a' : '#f06464',
        }}
      >
        {isIn ? '↓' : '↑'}
      </span>

      {/* counterpart */}
      <div className="min-w-0">
        <span className="font-mono text-[12px] text-muted-fg">
          {shortAddr(counterpart)}
        </span>
      </div>

      {/* asset */}
      <span className="font-mono text-[12px] text-muted-fg">{tx.asset}</span>

      {/* amount */}
      <span
        className="font-mono font-semibold tabular-nums text-[13px]"
        style={{ color: isIn ? '#5fd28a' : '#f06464' }}
      >
        {isIn ? '+' : '−'}{tx.amount}
      </span>

      {/* time */}
      <span className="font-mono text-[11.5px] text-muted-fg text-right">
        {relativeTime(tx.timestamp)}
      </span>
    </a>
  )
}
