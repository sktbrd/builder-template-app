import Link from 'next/link'

import { ActivityFeed } from '@/components/dao/ActivityFeed'
import { AuctionHero } from '@/components/dao/AuctionHero'
import { BarChart } from '@/components/dao/BarChart'
import { KpiCard } from '@/components/dao/KpiCard'
import { OnboardingStrip } from '@/components/dao/OnboardingStrip'
import { ProposalRow } from '@/components/dao/ProposalRow'
import { StatsRow } from '@/components/dao/StatsRow'
import { daoConfig, fallbackArtPalette } from '@/lib/dao.config'
import { getDashboardData } from '@/lib/dao-data'
import { formatEth } from '@/lib/utils'

// Re-fetch every 60s on the server.
export const revalidate = 60

export default async function Dashboard() {
  const data = await getDashboardData()

  const tokenLabel = daoConfig.name.split(' ')[0]
  const palette = fallbackArtPalette()

  return (
    <div className="flex flex-col gap-5">
      {/* 1 ── Auction hero (primary focus) */}
      <AuctionHero
        auction={data.currentAuction}
        palette={palette}
        tokenLabel={tokenLabel}
      />

      {/* 2 ── Stats strip (secondary, compact) */}
      <StatsRow
        totalSupply={data.totalSupply}
        ownerCount={data.ownerCount}
        treasuryEth={data.treasuryEth}
        totalAuctionSalesEth={data.totalAuctionSalesEth}
      />

      {/* 3 ── Proposals + Activity */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[2fr_1fr]">
        {/* Recent proposals */}
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
          {data.recentProposals.length > 0 ? (
            <div className="flex flex-col divide-y divide-border">
              {data.recentProposals.slice(0, 5).map((p) => (
                <ProposalRow key={p.id} p={p} />
              ))}
            </div>
          ) : (
            <EmptyState>
              No proposals yet —{' '}
              <Link href="/proposals/new" className="text-accent-strong hover:underline">
                create the first one
              </Link>
              .
            </EmptyState>
          )}
        </section>

        {/* Activity feed */}
        <section className="rounded-xl border border-border bg-surface px-6 py-[22px]">
          <div className="mb-1 flex items-center justify-between gap-3">
            <h2 className="text-xl font-bold tracking-tight">Activity</h2>
          </div>
          <ActivityFeed items={data.recentActivity} />
        </section>
      </div>

      {/* 4 ── Onboarding strip */}
      <OnboardingStrip daoName={daoConfig.name} tagline={daoConfig.tagline} />

      {/* 5 ── Treasury snapshot */}
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
            value={`${formatEth(data.treasuryEth)} ETH`}
            label="Treasury balance"
          />
          <KpiCard
            value={`${formatEth(data.totalAuctionSalesEth)} ETH`}
            label="Total auction sales"
          />
          <KpiCard value={data.ownerCount.toLocaleString('en-US')} label="Holders" />
        </div>
        <div className="rounded-md border border-border bg-surface-2 p-5">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-fg">Auction revenue</p>
              <p className="text-[12px] text-muted-fg">
                last 12 months · hover for details
              </p>
            </div>
            <div className="text-right">
              <p className="text-[13px] font-bold text-fg">
                {formatEth(
                  data.auctionRevenueByMonth.reduce((s, v) => s + v, 0).toFixed(4)
                )}{' '}
                ETH
              </p>
              <p className="text-[11px] text-muted-fg">12-month total</p>
            </div>
          </div>
          <BarChart
            data={data.auctionRevenueByMonth}
            labels={lastTwelveMonthLabels()}
            height={140}
          />
        </div>
      </section>
    </div>
  )
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-dashed border-border bg-surface-2 px-6 py-10 text-center text-sm text-muted-fg">
      {children}
    </div>
  )
}

function lastTwelveMonthLabels(): string[] {
  const out: string[] = []
  const d = new Date()
  for (let i = 11; i >= 0; i--) {
    const dd = new Date(d.getFullYear(), d.getMonth() - i, 1)
    out.push(['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'][dd.getMonth()])
  }
  return out
}
