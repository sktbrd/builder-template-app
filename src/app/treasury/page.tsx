import { ETHERSCAN_BASE_URL } from '@buildeross/constants'
import { CHAIN_ID } from '@buildeross/types'
import type { Metadata } from 'next'
import { Suspense } from 'react'

import { NftSection } from '@/components/dao/NftSection'
import { TokenLogo } from '@/components/dao/TokenLogo'
import { type DonutSlice, TreasuryDonut } from '@/components/dao/TreasuryDonut'
import { TreasuryTransfers } from '@/components/dao/TreasuryTransfers'
import { daoConfig } from '@/lib/dao.config'
import { getTreasuryPageData, type TreasuryTx } from '@/lib/dao-data'
import {
  ETH_EQUIVALENT_SYMBOLS as WETH_SYMBOLS,
  holdingUsdValue,
  STABLE_SYMBOLS,
} from '@/lib/treasury-tokens'

export const metadata: Metadata = {
  title: 'Treasury',
}

export const revalidate = 60

// ── Token USD helpers ─────────────────────────────────────────────────────────

// Per-asset slice colors: ETH uses accent, stables green, WETH grey, others orange
const TOKEN_COLORS: Record<string, string> = {
  ETH: 'var(--accent)',
  WETH: '#9a9aa2',
  CBETH: '#9a9aa2',
  USDC: '#5fd28a',
  USDT: '#5fd28a',
  DAI: '#f9a825',
  FRAX: '#c084fc',
}
const FALLBACK_COLORS = ['#ffb347', '#60a5fa', '#c084fc', '#f472b6', '#34d399']

function tokenColor(symbol: string, fallbackIdx: number): string {
  return (
    TOKEN_COLORS[symbol.toUpperCase()] ??
    FALLBACK_COLORS[fallbackIdx % FALLBACK_COLORS.length]
  )
}

function fmtUSD(n: number, dp = 0): string {
  return (
    '$' +
    n.toLocaleString('en-US', { maximumFractionDigits: dp, minimumFractionDigits: dp })
  )
}

function explorerName(chainId: number): string {
  switch (chainId) {
    case CHAIN_ID.ETHEREUM:
      return 'Etherscan'
    case CHAIN_ID.OPTIMISM:
      return 'Optimistic'
    case CHAIN_ID.BASE:
      return 'Basescan'
    case CHAIN_ID.ZORA:
      return 'Zorascan'
    default:
      return 'Explorer'
  }
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function TreasuryPage() {
  const data = await getTreasuryPageData()
  const { ethUsdPrice } = data

  const ethBal = parseFloat(data.treasuryEth)
  const ethUsd = ethBal * ethUsdPrice

  const tokenAssets = data.tokenHoldings.map((t, i) => {
    // Shared valuation: real Alchemy usdValue first, symbol heuristic only for
    // trusted allowlist tokens. Unpriced assets render an em dash, not $0.
    const { usd, priced } = holdingUsdValue(t, ethUsdPrice)
    const color = tokenColor(t.symbol, i)
    return { ...t, usd, color, priced }
  })

  const totalUsd = ethUsd + tokenAssets.reduce((s, t) => s + (t.priced ? t.usd : 0), 0)

  // Donut slices (only include priced assets with a positive USD value)
  const slices: DonutSlice[] = [
    ...(ethUsd > 0 ? [{ name: 'ETH', color: 'var(--accent)', value: ethUsd }] : []),
    ...tokenAssets
      .filter((t) => t.priced && t.usd > 0)
      .map((t) => ({
        name: t.symbol,
        color: t.color,
        value: t.usd,
      })),
  ]

  // Show donut fallback if no USD prices resolved
  const hasUsd = totalUsd > 0

  const explorer = {
    name: explorerName(daoConfig.chainId),
    base: ETHERSCAN_BASE_URL[daoConfig.chainId as CHAIN_ID] || 'https://basescan.org',
  }

  return (
    <div className="flex flex-col gap-7">
      {/* ── Header ── */}
      <div>
        <p className="mb-3 text-[11.5px] font-semibold uppercase tracking-wider text-accent">
          Allocation · live
        </p>
        <h1 className="font-display text-[clamp(40px,5vw,64px)] font-extrabold leading-[1.02] tracking-[-0.025em]">
          Treasury
        </h1>
        <p className="mt-2 max-w-xl text-[15.5px] text-muted-fg">
          {hasUsd
            ? `${fmtUSD(totalUsd)} across the priced assets held by ${daoConfig.name}. Small balances under $5 are hidden.`
            : `Holdings and financial position of the ${daoConfig.name} treasury.`}
        </p>
      </div>

      {/* ── Two-column grid ── */}
      <div className="grid grid-cols-1 gap-7 lg:grid-cols-[380px_1fr] xl:grid-cols-[440px_1fr]">
        {/* Left column: donut + asset rows + NFT mini-grid */}
        <div className="flex flex-col gap-4">
          {/* Donut card */}
          <div className="rounded-[14px] border border-border bg-surface px-6 py-7 text-center">
            {hasUsd ? (
              <TreasuryDonut slices={slices} totalUsd={totalUsd} />
            ) : (
              <div className="py-10 text-sm text-muted-fg">
                USD prices unavailable — showing balances only.
              </div>
            )}
          </div>

          {/* Asset rows */}
          <div className="flex flex-col gap-3">
            {/* ETH row */}
            <AssetRow
              logo={<TokenLogo symbol="ETH" chainId={daoConfig.chainId} size={36} />}
              name="Ether"
              sub="Native asset"
              color="var(--accent)"
              bal={`${trimDecimals(data.treasuryEth, 4)} ETH`}
              usd={ethUsd}
              pct={totalUsd > 0 ? ethUsd / totalUsd : 0}
              showUsd={hasUsd}
              priced={ethUsd > 0}
            />

            {/* ERC-20 rows */}
            {tokenAssets.map((t) => (
              <AssetRow
                key={t.address}
                logo={
                  <TokenLogo
                    address={t.address}
                    symbol={t.symbol}
                    chainId={daoConfig.chainId}
                    size={36}
                  />
                }
                name={t.symbol}
                sub={
                  STABLE_SYMBOLS.has(t.symbol.toUpperCase())
                    ? 'Stable reserve'
                    : WETH_SYMBOLS.has(t.symbol.toUpperCase())
                      ? 'Wrapped'
                      : 'ERC-20'
                }
                color={t.color}
                bal={`${trimDecimals(t.balance, 4)} ${t.symbol}`}
                usd={t.usd}
                pct={totalUsd > 0 ? t.usd / totalUsd : 0}
                showUsd={hasUsd}
                priced={t.priced}
              />
            ))}
          </div>

          {/* NFT mini-grid */}
          {data.nftHoldings.length > 0 && (
            <NftSection nfts={data.nftHoldings} count={data.nftHoldingsCount} />
          )}
        </div>

        {/* Right column: recent transactions, height-capped to the left column
            (absolute inset on lg+ so it can never stretch the grid row) with
            the tx list scrolling internally. */}
        <div className="lg:relative">
          <div className="flex max-h-[520px] flex-col lg:absolute lg:inset-0 lg:max-h-none">
            <TxCard
              txs={data.recentTxs}
              explorer={explorer}
              treasuryAddress={data.treasuryAddress}
            />
          </div>
        </div>
      </div>

      {/* ── Full transfer history (client-side, Alchemy-powered) ── */}
      {process.env.NEXT_PUBLIC_ALCHEMY_API_KEY && (
        <Suspense
          fallback={
            <div className="h-40 rounded-[14px] border border-border bg-surface animate-pulse" />
          }
        >
          <TreasuryTransfers
            knownAssets={[
              { symbol: 'ETH' },
              ...tokenAssets.map((t) => ({ symbol: t.symbol, address: t.address })),
            ]}
          />
        </Suspense>
      )}
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function AssetRow({
  logo,
  name,
  sub,
  color,
  bal,
  usd,
  pct,
  showUsd,
  priced,
}: {
  logo: React.ReactNode
  name: string
  sub: string
  color: string
  bal: string
  usd: number
  pct: number
  showUsd: boolean
  /** False when we have no USD price for this asset (e.g. content coins). */
  priced: boolean
}) {
  return (
    // Two-line card sized for the narrow allocation column: identity + amounts
    // on top, share bar below. (The old 5-column grid assumed the wide column.)
    <div className="rounded-xl border border-border bg-surface px-[18px] py-3.5 hover:bg-surface-2">
      <div className="flex items-center gap-3">
        <div className="shrink-0">{logo}</div>

        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold">{name}</div>
          <div className="mt-0.5 text-xs text-muted-fg">{sub}</div>
        </div>

        <div className="shrink-0 text-right">
          <div className="font-mono text-[13.5px] tabular-nums">{bal}</div>
          {/* Unpriced assets show an em dash rather than a misleading $0. */}
          {showUsd && (
            <div className="mt-0.5 font-mono text-xs tabular-nums text-muted-fg">
              {priced ? fmtUSD(usd) : '—'}
            </div>
          )}
        </div>
      </div>

      {showUsd && priced && (
        <div className="mt-3 flex items-center gap-2">
          <div className="h-1 min-w-0 flex-1 overflow-hidden rounded-full bg-surface-3">
            <div
              className="h-full rounded-full transition-[width]"
              style={{ width: `${pct * 100}%`, background: color }}
            />
          </div>
          <div className="shrink-0 text-xs text-muted-fg tabular-nums">
            {(pct * 100).toFixed(1)}%
          </div>
        </div>
      )}
    </div>
  )
}

function TxCard({
  txs,
  explorer,
  treasuryAddress,
}: {
  txs: TreasuryTx[]
  explorer: { name: string; base: string }
  treasuryAddress: string
}) {
  return (
    <div className="flex h-full flex-col rounded-[14px] border border-border bg-surface px-6 py-[22px]">
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h3 className="text-base font-bold">Recent transactions</h3>
        <span className="text-[12.5px] text-muted-fg">
          From treasury safe · last 30 days
        </span>
      </div>

      {/* min-h-0 lets the flex child actually shrink so the list scrolls
          inside the height-capped card instead of growing it. */}
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto pr-1">
        {txs.length === 0 && (
          <div className="py-8 text-center text-sm text-muted-fg">
            No transactions in the last 30 days.
          </div>
        )}
        {txs.map((tx, i) => (
          <a
            href={`${explorer.base}/tx/${tx.hash}`}
            target="_blank"
            rel="noreferrer"
            key={i}
            className="flex items-center gap-3 border-b border-border py-3 text-[13.5px] last:border-0 hover:bg-surface-2 sm:grid sm:gap-4"
            style={{ gridTemplateColumns: '28px 1fr auto auto auto' }}
          >
            {/* direction badge */}
            <span
              className={
                'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ' +
                (tx.dir === 'in'
                  ? 'bg-success/20 text-success'
                  : 'bg-destructive/20 text-destructive')
              }
            >
              {tx.dir === 'in' ? '↓' : '↑'}
            </span>

            {/* who */}
            <div className="min-w-0 flex-1">
              <div className="truncate font-semibold">{tx.who}</div>
              <div className="mt-0.5 font-mono text-[11px] text-muted-fg sm:hidden">
                {tx.relativeTime}
              </div>
            </div>

            {/* tag — hidden on mobile */}
            <div className="hidden font-mono text-[11.5px] text-muted-fg sm:block">
              {tx.tag}
            </div>

            {/* amount */}
            <div
              className={
                'shrink-0 text-right font-mono font-semibold tabular-nums ' +
                (tx.dir === 'in' ? 'text-success' : 'text-destructive')
              }
            >
              {tx.dir === 'in' ? '+' : '−'}
              {tx.amount} {tx.symbol}
            </div>

            {/* time — hidden on mobile */}
            <div className="hidden text-right font-mono text-[11.5px] text-muted-fg sm:block">
              {tx.relativeTime}
            </div>
          </a>
        ))}
      </div>

      <div className="mt-auto flex justify-end pt-3.5">
        <a
          href={`${explorer.base}/address/${treasuryAddress}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-border bg-surface-2 px-4 py-2.5 font-mono text-[12px] hover:bg-surface-3"
        >
          View all on {explorer.name} ↗
        </a>
      </div>
    </div>
  )
}

function trimDecimals(value: string, max: number): string {
  if (!value || !value.includes('.')) return value
  const [intPart, decPart] = value.split('.')
  return `${intPart}.${decPart.slice(0, max).replace(/0+$/, '') || '0'}`
}
