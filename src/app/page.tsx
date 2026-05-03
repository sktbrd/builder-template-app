import Link from 'next/link'

import { ActivityFeed } from '@/components/dao/ActivityFeed'
import { AuctionHero } from '@/components/dao/AuctionHero'
import { OnboardingStrip } from '@/components/dao/OnboardingStrip'
import { ProposalRow } from '@/components/dao/ProposalRow'
import { StatsRow } from '@/components/dao/StatsRow'
import { daoConfig, fallbackArtPalette } from '@/lib/dao.config'
import { getDashboardData } from '@/lib/dao-data'

// Re-fetch every 5min on the server. Subgraph free tier rate-limits aggressively.
export const revalidate = 300

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
