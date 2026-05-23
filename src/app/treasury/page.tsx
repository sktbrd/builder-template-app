import type { Metadata } from 'next'
import { Suspense } from 'react'

import { type DonutSlice, TreasuryDonut } from '@/components/dao/TreasuryDonut'
import { TokenLogo } from '@/components/dao/TokenLogo'
import { NftSection } from '@/components/dao/NftSection'
import { TreasuryTransfers } from '@/components/dao/TreasuryTransfers'
import { daoConfig } from '@/lib/dao.config'
import { type TreasuryTx, getTreasuryPageData } from '@/lib/dao-data'

export const metadata: Metadata = {
  title: 'Treasury',
}

export const revalidate = 60

// ── Token USD helpers ─────────────────────────────────────────────────────────

const STABLE_SYMBOLS = new Set(['USDC', 'USDT', 'DAI', 'FRAX', 'LUSD', 'USDBC', 'USDS', 'USDGLO', 'GUSD'])
const WETH_SYMBOLS = new Set(['WETH', 'CBETH', 'STETH', 'RETH'])

function tokenUsdValue(balanceRaw: string, decimals: number, symbol: string, ethUsdPrice: number): number {
  const sym = symbol.toUpperCase()
  const human = Number(BigInt(balanceRaw)) / 10 ** decimals
  if (STABLE_SYMBOLS.has(sym)) return human
  if (WETH_SYMBOLS.has(sym)) return human * ethUsdPrice
  return 0
}

// Per-asset slice colors: ETH uses accent, stables green, WETH grey, others orange
const TOKEN_COLORS: Record<string, string> = {
  ETH:  'var(--accent)',
  WETH: '#9a9aa2',
  CBETH: '#9a9aa2',
  USDC: '#5fd28a',
  USDT: '#5fd28a',
  DAI:  '#f9a825',
  FRAX: '#c084fc',
}
const FALLBACK_COLORS = ['#ffb347', '#60a5fa', '#c084fc', '#f472b6', '#34d399']

function tokenColor(symbol: string, fallbackIdx: number): string {
  return TOKEN_COLORS[symbol.toUpperCase()] ?? FALLBACK_COLORS[fallbackIdx % FALLBACK_COLORS.length]
}

function fmtUSD(n: number, dp = 0): string {
  return '$' + n.toLocaleString('en-US', { maximumFractionDigits: dp, minimumFractionDigits: dp })
}

// ── Explorer link ─────────────────────────────────────────────────────────────

const EXPLORER: Record<number, { name: string; base: string }> = {
  1:       { name: 'Etherscan',  base: 'https://etherscan.io' },
  10:      { name: 'Optimistic', base: 'https://optimistic.etherscan.io' },
  8453:    { name: 'Basescan',   base: 'https://basescan.org' },
  7777777: { name: 'Zorascan',  base: 'https://explorer.zora.energy' },
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function TreasuryPage() {
  const data = await getTreasuryPageData()
  const { ethUsdPrice } = data

  const ethBal   = parseFloat(data.treasuryEth)
  const ethUsd   = ethBal * ethUsdPrice

  const tokenAssets = data.tokenHoldings.map((t, i) => {
    const usd   = tokenUsdValue(t.balanceRaw, t.decimals, t.symbol, ethUsdPrice)
    const color = tokenColor(t.symbol, i)
    return { ...t, usd, color }
  })

  const totalUsd = ethUsd + tokenAssets.reduce((s, t) => s + t.usd, 0)

  // Donut slices (only include assets with known USD value)
  const slices: DonutSlice[] = [
    ...(ethUsd > 0 ? [{ name: 'ETH', color: 'var(--accent)', value: ethUsd }] : []),
    ...tokenAssets.filter((t) => t.usd > 0).map((t) => ({
      name: t.symbol,
      color: t.color,
      value: t.usd,
    })),
  ]

  // Show donut fallback if no USD prices resolved
  const hasUsd = totalUsd > 0

  const explorer = EXPLORER[daoConfig.chainId] ?? { name: 'Explorer', base: 'https://basescan.org' }

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
            ? `Composition of ${fmtUSD(totalUsd)} across ${daoConfig.name}'s ETH, stables, and in-treasury collection.`
            : `Holdings and financial position of the ${daoConfig.name} treasury.`}
        </p>
      </div>

      {/* ── Two-column grid ── */}
      <div className="grid grid-cols-1 items-start gap-7 lg:grid-cols-[380px_1fr]">

        {/* Left column: donut + NFT mini-grid */}
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

          {/* NFT mini-grid */}
          {data.nftHoldings.length > 0 && (
            <NftSection nfts={data.nftHoldings} count={data.nftHoldingsCount} />
          )}
        </div>

        {/* Right column: asset rows + tx card */}
        <div className="flex flex-col gap-4">

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
            />

            {/* ERC-20 rows */}
            {tokenAssets.map((t) => (
              <AssetRow
                key={t.address}
                logo={<TokenLogo address={t.address} symbol={t.symbol} chainId={daoConfig.chainId} size={36} />}
                name={t.symbol}
                sub={STABLE_SYMBOLS.has(t.symbol.toUpperCase()) ? 'Stable reserve' : WETH_SYMBOLS.has(t.symbol.toUpperCase()) ? 'Wrapped' : 'ERC-20'}
                color={t.color}
                bal={`${t.balance} ${t.symbol}`}
                usd={t.usd}
                pct={totalUsd > 0 ? t.usd / totalUsd : 0}
                showUsd={hasUsd}
              />
            ))}

          </div>

          {/* Recent transactions */}
          <TxCard txs={data.recentTxs} explorer={explorer} treasuryAddress={data.treasuryAddress} />
        </div>
      </div>

      {/* ── Full transfer history (client-side, Alchemy-powered) ── */}
      {process.env.NEXT_PUBLIC_ALCHEMY_API_KEY && (
        <Suspense fallback={<div className="h-40 rounded-[14px] border border-border bg-surface animate-pulse" />}>
          <TreasuryTransfers />
        </Suspense>
      )}
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function AssetRow({
  logo, name, sub, color, bal, usd, pct, showUsd,
}: {
  logo: React.ReactNode
  name: string
  sub: string
  color: string
  bal: string
  usd: number
  pct: number
  showUsd: boolean
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-border bg-surface px-[18px] py-3.5 hover:bg-surface-2 sm:grid sm:items-center"
      style={{ gridTemplateColumns: showUsd ? '40px 1fr 1fr 1fr 1fr' : '40px 1fr 1fr' }}
    >
      {/* icon */}
      <div className="shrink-0">{logo}</div>

      {/* name */}
      <div className="min-w-0 flex-1 sm:flex-none">
        <div className="font-semibold">{name}</div>
        <div className="mt-0.5 text-xs text-muted-fg">{sub}</div>
      </div>

      {/* balance */}
      <div className="ml-auto font-mono text-[13.5px] tabular-nums sm:ml-0 sm:text-right">{bal}</div>

      {/* USD + bar — only when price data available */}
      {showUsd && (
        <>
          <div className="w-full text-right font-mono text-[13.5px] tabular-nums text-muted-fg sm:w-auto">
            {fmtUSD(usd)}
          </div>
          <div className="w-full sm:w-auto">
            <div className="h-1 overflow-hidden rounded-full bg-surface-3">
              <div
                className="h-full rounded-full transition-[width]"
                style={{ width: `${pct * 100}%`, background: color }}
              />
            </div>
            <div className="mt-1 text-right text-xs text-muted-fg tabular-nums">
              {(pct * 100).toFixed(1)}%
            </div>
          </div>
        </>
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
    <div className="rounded-[14px] border border-border bg-surface px-6 py-[22px]">
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h3 className="text-base font-bold">Recent transactions</h3>
        <span className="text-[12.5px] text-muted-fg">From treasury safe · last 30 days</span>
      </div>

      <div className="flex flex-col">
        {txs.length === 0 && (
          <div className="py-8 text-center text-sm text-muted-fg">
            No transactions in the last 30 days.
          </div>
        )}
        {txs.map((tx, i) => (
          <div
            key={i}
            className="flex items-center gap-3 border-b border-border py-3 text-[13.5px] last:border-0 sm:grid sm:gap-4"
            style={{ gridTemplateColumns: '28px 1fr auto auto auto' }}
          >
            {/* direction badge */}
            <span
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold"
              style={{
                background: tx.dir === 'in'
                  ? 'color-mix(in oklab, #5fd28a 22%, transparent)'
                  : 'color-mix(in oklab, #f06464 22%, transparent)',
                color: tx.dir === 'in' ? '#5fd28a' : '#f06464',
              }}
            >
              {tx.dir === 'in' ? '↓' : '↑'}
            </span>

            {/* who */}
            <div className="min-w-0 flex-1">
              <div className="truncate font-semibold">{tx.who}</div>
            </div>

            {/* tag — hidden on mobile */}
            <div className="hidden font-mono text-[11.5px] text-muted-fg sm:block">{tx.tag}</div>

            {/* amount */}
            <div
              className="shrink-0 text-right font-mono font-semibold tabular-nums"
              style={{ color: tx.dir === 'in' ? '#5fd28a' : '#f06464' }}
            >
              {tx.dir === 'in' ? '+' : '−'}{tx.amount} {tx.symbol}
            </div>

            {/* time — hidden on mobile */}
            <div className="hidden text-right font-mono text-[11.5px] text-muted-fg sm:block">
              {tx.relativeTime}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3.5 flex justify-end">
        <a
          href={`${explorer.base}/address/${treasuryAddress}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface-2 px-3 py-1.5 font-mono text-[12px] hover:bg-surface-3"
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

