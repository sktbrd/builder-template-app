import type { Metadata } from 'next'

import { AddressChip } from '@/components/dao/AddressChip'
import { BarChart } from '@/components/dao/BarChart'
import { KpiCard } from '@/components/dao/KpiCard'
import { daoConfig } from '@/lib/dao.config'
import { getTreasuryPageData } from '@/lib/dao-data'

export const metadata: Metadata = {
  title: 'Treasury',
}

export const revalidate = 60

export default async function TreasuryPage() {
  const data = await getTreasuryPageData()

  const treasuryDisplay = trimDecimals(data.treasuryEth, 4)
  const salesDisplay = trimDecimals(data.totalAuctionSalesEth, 4)
  const monthLabels = lastTwelveMonthLabels()

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
        <AddressChip addr={truncate(data.treasuryAddress)} />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <KpiCard value={`${treasuryDisplay} ETH`} label="Treasury balance" />
        <KpiCard value={`${salesDisplay} ETH`} label="Total auction sales" />
        <KpiCard value={data.ownerCount.toLocaleString()} label="Owners" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <ChartCard title="Auction revenue" sub="ETH per month">
          <BarChart data={data.auctionRevenueByMonth} labels={monthLabels} />
        </ChartCard>
        <ChartCard title="Proposal activity" sub="proposals / month">
          <BarChart data={data.proposalsByMonth} labels={monthLabels} />
        </ChartCard>
        <ChartCard
          title="Voter activity"
          sub={`votes per recent prop (last ${data.votersByProposal.length})`}
        >
          <BarChart
            data={
              data.votersByProposal.length > 0
                ? data.votersByProposal
                : new Array(12).fill(0)
            }
          />
        </ChartCard>
      </div>

      <section className="rounded-xl border border-border bg-surface px-6 py-[22px]">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-xl font-bold tracking-tight">Token holdings</h2>
        </div>
        {/* ERC-20 holdings (Alchemy / Zora API enrichment) lands separately — */}
        {/* showing the ETH balance only for now. */}
        <div className="rounded-md border border-dashed border-border bg-surface-2 px-4 py-5 text-sm text-muted-fg">
          ETH balance: <strong className="font-semibold text-fg">{treasuryDisplay} ETH</strong>.
          Multi-asset breakdown (ERC-20 holdings via Alchemy) lands in a
          follow-up.
        </div>
      </section>

      <section className="rounded-xl border border-border bg-surface px-6 py-[22px]">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-xl font-bold tracking-tight">NFT holdings</h2>
          <span className="text-[12.5px] text-muted-fg">
            {Math.max(0, data.totalSupply - data.ownerCount).toLocaleString()} in
            treasury
          </span>
        </div>
        {/* NFT artwork rendering needs the metadata renderer — defer to a */}
        {/* follow-up that fetches each token's image URL via the renderer. */}
        <div className="rounded-md border border-dashed border-border bg-surface-2 px-4 py-5 text-sm text-muted-fg">
          DAO-owned token artwork grid lands in a follow-up.
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

function trimDecimals(value: string, max: number): string {
  if (!value || !value.includes('.')) return value
  const [intPart, decPart] = value.split('.')
  return `${intPart}.${decPart.slice(0, max).replace(/0+$/, '') || '0'}`
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

function truncate(addr: string) {
  if (addr.length < 10) return addr
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}
