import { ArrowUpRight, BadgeCheck, Diamond, Users } from 'lucide-react'
import Link from 'next/link'

import { DaoLogo } from '@/components/DaoLogo'
import { ActivityFeed } from '@/components/dao/ActivityFeed'
import { AuctionArt } from '@/components/dao/AuctionArt'
import { BarChart } from '@/components/dao/BarChart'
import { KpiCard } from '@/components/dao/KpiCard'
import { ProposalCard } from '@/components/dao/ProposalCard'
import { StatTile } from '@/components/dao/StatTile'
import { Button } from '@/components/ui/button'
import { daoConfig } from '@/lib/dao.config'
import {
  ACTIVITY,
  AUCTION,
  CHART_AUCTION,
  PRESETS,
  PROPOSALS,
} from '@/lib/mockData'

const CHAIN_NAMES: Record<number, string> = {
  1: 'Ethereum',
  10: 'Optimism',
  8453: 'Base',
  7777777: 'Zora',
}

export default function Dashboard() {
  // Mock numbers for now (PR #1 ships visual layer). PR #2+ wires live subgraph.
  const preset = PRESETS.builder
  const tokenLabel = daoConfig.name.split(' ')[0]
  const topBid = AUCTION.recentBids[0]
  const chainName = CHAIN_NAMES[daoConfig.chainId] ?? `Chain ${daoConfig.chainId}`

  return (
    <div className="flex flex-col gap-6">
      {/* HERO */}
      <section className="grid grid-cols-1 items-center gap-10 px-2 pb-6 pt-8 md:grid-cols-[1.2fr_1fr]">
        <div className="flex flex-col">
          <div className="mb-4 flex items-center gap-2.5 text-sm font-semibold text-muted-fg">
            <DaoLogo style="stripes" color={daoConfig.theme.accent} size={24} />
            <span>{daoConfig.name}</span>
            <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-accent-strong">
              {chainName}
            </span>
          </div>
          <h1 className="font-display text-[clamp(36px,5vw,56px)] font-extrabold leading-[1.04] tracking-[-0.025em]">
            {daoConfig.name}
          </h1>
          <p className="mt-2 max-w-[540px] text-[17px] text-muted-fg">
            {daoConfig.tagline}
          </p>
          <div className="mt-5 flex flex-wrap gap-x-8 gap-y-4">
            <StatTile
              icon={<BadgeCheck className="h-4 w-4" />}
              label={`Total ${tokenLabel}`}
              value={preset.totalSupply.toLocaleString()}
            />
            <StatTile
              icon={<Diamond className="h-4 w-4" />}
              label="Members"
              value={preset.members.toLocaleString()}
            />
            <StatTile
              icon={<ArrowUpRight className="h-4 w-4" />}
              label="Treasury"
              value={`$${(preset.treasuryUsd / 1000).toFixed(1)}k`}
            />
          </div>
        </div>
        <div className="relative aspect-square overflow-hidden rounded-xl border border-border md:aspect-[1.1/1]">
          <AuctionArt palette={preset.artworkPalette} />
          <div className="absolute bottom-3 left-3 rounded-full border border-border bg-bg/80 px-2.5 py-1 text-xs font-semibold backdrop-blur-md">
            Today&apos;s auction · #{AUCTION.tokenId}
          </div>
        </div>
      </section>

      {/* AUCTION + ACTIVITY */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-[2fr_1fr]">
        <section className="rounded-xl border border-border bg-surface px-6 py-[22px]">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-xl font-bold tracking-tight">Live auction</h2>
            <Link
              href={`/auction/${AUCTION.tokenId}`}
              className="text-sm font-semibold text-accent-strong hover:underline"
            >
              Open auction →
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-[200px_1fr]">
            <div className="aspect-square overflow-hidden rounded-md">
              <AuctionArt palette={preset.artworkPalette} />
            </div>
            <div className="flex flex-col gap-2.5">
              <div className="text-[12.5px] text-muted-fg">
                Latest auction · {AUCTION.date}
              </div>
              <h3 className="font-display text-[28px] font-bold leading-tight tracking-tight">
                {tokenLabel} #{AUCTION.tokenId}
              </h3>
              <div className="my-1 flex flex-wrap gap-x-6 gap-y-3">
                <div>
                  <div className="text-[12.5px] text-muted-fg">Top bid</div>
                  <div className="text-[17px] font-bold">{topBid.amount} ETH</div>
                </div>
                <div>
                  <div className="text-[12.5px] text-muted-fg">Held by</div>
                  <div className="font-mono text-[14px] font-bold">
                    {topBid.addr}
                  </div>
                </div>
                <div>
                  <div className="text-[12.5px] text-muted-fg">Ends in</div>
                  <div className="text-[17px] font-bold">17h 54m</div>
                </div>
              </div>
              <Button asChild className="self-start">
                <Link href={`/auction/${AUCTION.tokenId}`}>Place a bid</Link>
              </Button>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-surface px-6 py-[22px]">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-xl font-bold tracking-tight">Activity</h2>
          </div>
          <ActivityFeed items={ACTIVITY} />
        </section>
      </div>

      {/* RECENT PROPOSALS */}
      <section className="rounded-xl border border-border bg-surface px-6 py-[22px]">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-xl font-bold tracking-tight">Recent proposals</h2>
          <Link
            href="/proposals"
            className="text-sm font-semibold text-accent-strong hover:underline"
          >
            View all →
          </Link>
        </div>
        <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2 lg:grid-cols-3">
          {PROPOSALS.slice(0, 3).map((p) => (
            <ProposalCard key={p.id} p={p} />
          ))}
        </div>
      </section>

      {/* TREASURY SNAPSHOT */}
      <section className="rounded-xl border border-border bg-surface px-6 py-[22px]">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-xl font-bold tracking-tight">Treasury snapshot</h2>
          <Link
            href="/treasury"
            className="text-sm font-semibold text-accent-strong hover:underline"
          >
            Full treasury →
          </Link>
        </div>
        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
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
        <div className="rounded-md border border-border bg-surface p-4">
          <div className="mb-2 flex items-baseline justify-between">
            <div className="text-sm font-semibold">Auction revenue</div>
            <div className="text-[12.5px] text-muted-fg">last 12 months</div>
          </div>
          <BarChart
            data={CHART_AUCTION}
            labels={['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D']}
            height={140}
          />
        </div>
      </section>

      <div className="mt-2 rounded-md border border-dashed border-border px-4 py-3 text-[12.5px] text-muted-fg">
        <strong className="font-semibold text-fg">Note:</strong> dashboard uses
        mock data from <code className="rounded bg-surface-2 px-1 py-0.5 font-mono text-[11.5px]">src/lib/mockData.ts</code>{' '}
        (PR #1 ships visual layer). Subgraph + on-chain wiring lands in a follow-up
        PR per the original plan.
      </div>
    </div>
  )
}
