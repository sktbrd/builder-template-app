import { DashboardHero } from '@/components/dao/DashboardHero'
import { HomeFeed } from '@/components/dao/HomeFeed'
import { HomeMetaStrip } from '@/components/dao/HomeMetaStrip'
import { HomeProposals } from '@/components/dao/HomeProposals'
import { daoConfig, fallbackArtPalette } from '@/lib/dao.config'
import { getDashboardData } from '@/lib/dao-data'

// Re-fetch every 5min on the server. Subgraph free tier rate-limits aggressively.
export const revalidate = 300

const ACTIVE_PROPOSAL_STATES = new Set(['active', 'pending', 'queued', 'succeeded'])

export default async function Dashboard() {
  const data = await getDashboardData()

  const tokenLabel = daoConfig.name.split(' ')[0]
  const palette = fallbackArtPalette()
  const activeProposalCount = data.recentProposals.filter((p) =>
    ACTIVE_PROPOSAL_STATES.has(p.status)
  ).length

  return (
    <div className="flex flex-col gap-3">
      <DashboardHero
        currentAuction={data.currentAuction}
        recentTokens={data.recentTokens}
        totalSupply={data.totalSupply}
        palette={palette}
        tokenLabel={tokenLabel}
      />

      <HomeMetaStrip
        totalSupply={data.totalSupply}
        ownerCount={data.ownerCount}
        treasuryEth={data.treasuryEth}
        totalAuctionSalesEth={data.totalAuctionSalesEth}
        activeProposalCount={activeProposalCount}
      />

      {/* Lower content sits inside a forced-dark themed panel so the layout
       * mirrors nouns.game's high-contrast top→bottom split regardless of
       * whether the user is in light or dark mode. The data-theme attribute
       * re-binds every --bg/--surface/--border var inside this subtree to
       * its dark-mode value (see globals.css). Main is unpadded on the
       * dashboard, so the panel handles its own internal padding only. */}
      <section
        data-theme="dark"
        className="mt-2 bg-bg px-4 py-8 text-fg sm:px-6 sm:py-10"
      >
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <HomeFeed />
          <HomeProposals proposals={data.recentProposals} />
        </div>
      </section>
    </div>
  )
}
