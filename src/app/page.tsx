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
import { getDashboardData } from '@/lib/dao-data'
import { ACTIVITY, PRESETS } from '@/lib/mockData'

const CHAIN_NAMES: Record<number, string> = {
  1: 'Ethereum',
  10: 'Optimism',
  8453: 'Base',
  7777777: 'Zora',
}

// Re-fetch every 60s on the server.
export const revalidate = 60

export default async function Dashboard() {
  const data = await getDashboardData()

  const tokenLabel = daoConfig.name.split(' ')[0]
  const chainName = CHAIN_NAMES[daoConfig.chainId] ?? `Chain ${daoConfig.chainId}`
  const palette = PRESETS.builder.artworkPalette
  const auction = data.currentAuction

  const treasuryEthDisplay = trimDecimals(data.treasuryEth, 4)
  const auctionSalesEthDisplay = trimDecimals(data.totalAuctionSalesEth, 4)
  const topBidDisplay = auction?.topBidEth
    ? `${trimDecimals(auction.topBidEth, 4)} ETH`
    : 'No bids yet'
  const endsIn = auction
    ? formatEndsIn(auction.endTimeUnix)
    : '—'

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
              value={data.totalSupply.toLocaleString()}
            />
            <StatTile
              icon={<Users className="h-4 w-4" />}
              label="Members"
              value={data.ownerCount.toLocaleString()}
            />
            <StatTile
              icon={<Diamond className="h-4 w-4" />}
              label="Treasury"
              value={`${treasuryEthDisplay} ETH`}
            />
          </div>
        </div>
        <div className="relative aspect-square overflow-hidden rounded-xl border border-border md:aspect-[1.1/1]">
          {auction?.image ? (
            // External token artwork — using a plain img keeps PR #10 free of
            // next/image domain config; tighten later with a remotePatterns entry.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={resolveIpfs(auction.image)}
              alt={auction.name ?? `${tokenLabel} #${auction.tokenId}`}
              className="h-full w-full object-cover"
            />
          ) : (
            <AuctionArt palette={palette} />
          )}
          {auction && (
            <div className="absolute bottom-3 left-3 rounded-full border border-border bg-bg/80 px-2.5 py-1 text-xs font-semibold backdrop-blur-md">
              Today&apos;s auction · #{auction.tokenId}
            </div>
          )}
        </div>
      </section>

      {/* AUCTION + ACTIVITY */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-[2fr_1fr]">
        <section className="rounded-xl border border-border bg-surface px-6 py-[22px]">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-xl font-bold tracking-tight">Live auction</h2>
            {auction && (
              <Link
                href={`/auction/${auction.tokenId}`}
                className="text-sm font-semibold text-accent-strong hover:underline"
              >
                Open auction →
              </Link>
            )}
          </div>
          {auction ? (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-[200px_1fr]">
              <div className="aspect-square overflow-hidden rounded-md bg-surface-2">
                {auction.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={resolveIpfs(auction.image)}
                    alt={auction.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <AuctionArt palette={palette} />
                )}
              </div>
              <div className="flex flex-col gap-2.5">
                <div className="text-[12.5px] text-muted-fg">
                  {auction.name}
                </div>
                <h3 className="font-display text-[28px] font-bold leading-tight tracking-tight">
                  {tokenLabel} #{auction.tokenId}
                </h3>
                <div className="my-1 flex flex-wrap gap-x-6 gap-y-3">
                  <div>
                    <div className="text-[12.5px] text-muted-fg">Top bid</div>
                    <div className="text-[17px] font-bold">{topBidDisplay}</div>
                  </div>
                  {auction.bidderShort && (
                    <div>
                      <div className="text-[12.5px] text-muted-fg">Held by</div>
                      <div className="font-mono text-[14px] font-bold">
                        {auction.bidderShort}
                      </div>
                    </div>
                  )}
                  <div>
                    <div className="text-[12.5px] text-muted-fg">Ends in</div>
                    <div className="text-[17px] font-bold">{endsIn}</div>
                  </div>
                </div>
                <Button asChild className="self-start">
                  <Link href={`/auction/${auction.tokenId}`}>Place a bid</Link>
                </Button>
              </div>
            </div>
          ) : (
            <div className="rounded-md border border-dashed border-border bg-surface-2 px-6 py-10 text-center text-sm text-muted-fg">
              No auctions yet — check back soon.
            </div>
          )}
        </section>

        <section className="rounded-xl border border-border bg-surface px-6 py-[22px]">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-xl font-bold tracking-tight">Activity</h2>
          </div>
          {/* Activity feed still on mocks. Wiring it requires merging recent */}
          {/* bids + votes + proposal-created events; lands in a follow-up PR. */}
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
        {data.recentProposals.length > 0 ? (
          <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2 lg:grid-cols-3">
            {data.recentProposals.slice(0, 3).map((p) => (
              <ProposalCard key={p.id} p={p} />
            ))}
          </div>
        ) : (
          <div className="rounded-md border border-dashed border-border bg-surface-2 px-6 py-10 text-center text-sm text-muted-fg">
            No proposals yet — be the first to{' '}
            <Link href="/proposals" className="text-accent-strong hover:underline">
              create one
            </Link>
            .
          </div>
        )}
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
            value={`${treasuryEthDisplay} ETH`}
            label="Treasury balance"
          />
          <KpiCard
            value={`${auctionSalesEthDisplay} ETH`}
            label="Total auction sales"
          />
          <KpiCard
            value={data.ownerCount.toLocaleString()}
            label="Owners"
          />
        </div>
        <div className="rounded-md border border-border bg-surface p-4">
          <div className="mb-2 flex items-baseline justify-between">
            <div className="text-sm font-semibold">Auction revenue</div>
            <div className="text-[12.5px] text-muted-fg">last 12 months</div>
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

function trimDecimals(value: string, max: number): string {
  if (!value || !value.includes('.')) return value
  const [intPart, decPart] = value.split('.')
  return `${intPart}.${decPart.slice(0, max).replace(/0+$/, '') || '0'}`
}

function formatEndsIn(unixSec: number): string {
  const diff = unixSec * 1000 - Date.now()
  if (diff <= 0) return 'Ended'
  const h = Math.floor(diff / (1000 * 60 * 60))
  const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
  if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h`
  return `${h}h ${m}m`
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

function resolveIpfs(uri: string): string {
  if (uri.startsWith('ipfs://')) {
    return `https://gateway.pinata.cloud/ipfs/${uri.slice(7)}`
  }
  return uri
}
