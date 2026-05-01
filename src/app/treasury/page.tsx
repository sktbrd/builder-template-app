import type { Metadata } from 'next'

import { AddressChip } from '@/components/dao/AddressChip'
import { AuctionArt } from '@/components/dao/AuctionArt'
import { BarChart } from '@/components/dao/BarChart'
import { KpiCard } from '@/components/dao/KpiCard'
import { daoConfig } from '@/lib/dao.config'
import {
  CHART_AUCTION,
  CHART_MEMBERS,
  CHART_PROPOSALS,
  PRESETS,
} from '@/lib/mockData'

export const metadata: Metadata = {
  title: 'Treasury',
}

const MONTHS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D']

export default function TreasuryPage() {
  const preset = PRESETS.builder
  const treasuryAddr = daoConfig.addresses.treasury

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-[clamp(36px,5vw,56px)] font-extrabold leading-[1.04] tracking-[-0.025em]">
            Treasury
          </h1>
          <p className="mt-1 text-muted-fg">
            Overview of the {daoConfig.name} treasury holdings and financial
            position.
          </p>
        </div>
        <AddressChip addr={truncate(treasuryAddr)} />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <KpiCard
          value={`$${preset.treasuryUsd.toLocaleString(undefined, {
            maximumFractionDigits: 0,
          })}`}
          label="Total treasury value"
        />
        <KpiCard value={`${preset.treasuryEth} ETH`} label="ETH balance" />
        <KpiCard
          value={`${preset.auctionSales} ETH`}
          label="Total auction sales"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <ChartCard title="Auction revenue" sub="ETH per month">
          <BarChart data={CHART_AUCTION} labels={MONTHS} />
        </ChartCard>
        <ChartCard title="Proposal activity" sub="proposals / month">
          <BarChart data={CHART_PROPOSALS} labels={MONTHS} />
        </ChartCard>
        <ChartCard title="Member activity" sub="voters per recent prop">
          <BarChart data={CHART_MEMBERS} />
        </ChartCard>
      </div>

      <section className="rounded-xl border border-border bg-surface px-6 py-[22px]">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-xl font-bold tracking-tight">Token holdings</h2>
          <span className="text-[17px] font-bold">$1,909.63</span>
        </div>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <Th>Asset</Th>
              <Th>Balance</Th>
              <Th>Value (USD)</Th>
            </tr>
          </thead>
          <tbody>
            <tr className="hover:bg-surface-2">
              <Td>
                <div className="flex items-center gap-2.5">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-surface-3 text-xs font-bold">
                    Z
                  </span>
                  Zora
                </div>
              </Td>
              <Td>152,790 ZORA</Td>
              <Td>$1,909.63</Td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="rounded-xl border border-border bg-surface px-6 py-[22px]">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-xl font-bold tracking-tight">NFT holdings</h2>
          <span className="text-[12.5px] text-muted-fg">
            {(preset.totalSupply - preset.members).toLocaleString()} in treasury
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="relative aspect-square overflow-hidden rounded-md border border-border bg-surface-2"
            >
              <AuctionArt palette={preset.artworkPalette} />
              <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-bg/85 px-2.5 py-1.5 text-xs font-semibold backdrop-blur-md">
                <span>#{i}</span>
                <span className="text-muted-fg">3/13/2026</span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

function ChartCard({
  title,
  sub,
  children,
}: {
  title: string
  sub: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-md border border-border bg-surface p-4">
      <div className="mb-2 flex items-baseline justify-between">
        <div className="text-sm font-semibold">{title}</div>
        <div className="text-[12.5px] text-muted-fg">{sub}</div>
      </div>
      {children}
    </div>
  )
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="border-b border-border px-3.5 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-fg">
      {children}
    </th>
  )
}

function Td({ children }: { children: React.ReactNode }) {
  return (
    <td className="border-b border-border px-3.5 py-2.5 last:border-b-0">
      {children}
    </td>
  )
}

function truncate(addr: string) {
  if (addr.length < 10) return addr
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}
