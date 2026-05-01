import type { Metadata } from 'next'

import { AddressChip } from '@/components/dao/AddressChip'
import { AnalyticsBarChart } from '@/components/dao/AnalyticsBarChart'
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
        <KpiCard value={data.ownerCount.toLocaleString('en-US')} label="Owners" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <ChartCard title="Auction revenue" sub="ETH per month">
          <AnalyticsBarChart
            data={zip(monthLabels, data.auctionRevenueByMonth)}
            valueSuffix="ETH"
            precision={3}
          />
        </ChartCard>
        <ChartCard title="Proposal activity" sub="proposals / month">
          <AnalyticsBarChart
            data={zip(monthLabels, data.proposalsByMonth)}
            valueSuffix="proposals"
            precision={0}
          />
        </ChartCard>
        <ChartCard
          title="Voter activity"
          sub={`votes per recent prop (last ${data.votersByProposal.length})`}
        >
          <AnalyticsBarChart
            data={(data.votersByProposal.length > 0
              ? data.votersByProposal
              : new Array(12).fill(0)
            ).map((v, i) => ({ label: `#${i + 1}`, value: v }))}
            valueSuffix="votes"
            precision={0}
          />
        </ChartCard>
      </div>

      <section className="rounded-xl border border-border bg-surface px-6 py-[22px]">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-xl font-bold tracking-tight">Token holdings</h2>
        </div>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <Th>Asset</Th>
              <Th>Balance</Th>
            </tr>
          </thead>
          <tbody>
            <tr className="hover:bg-surface-2">
              <Td>
                <div className="flex items-center gap-2.5">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-surface-3 text-xs font-bold">
                    Ξ
                  </span>
                  Ether
                </div>
              </Td>
              <Td>
                <strong className="font-semibold">{treasuryDisplay} ETH</strong>
              </Td>
            </tr>
            {data.tokenHoldings.map((t) => (
              <tr key={t.address} className="hover:bg-surface-2">
                <Td>
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-surface-3 text-xs font-bold">
                      {t.symbol.slice(0, 1)}
                    </span>
                    {t.symbol}
                  </div>
                </Td>
                <Td>
                  <strong className="font-semibold">
                    {t.balance} {t.symbol}
                  </strong>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
        {data.tokenHoldings.length === 0 && (
          <div className="mt-3 text-[12.5px] text-muted-fg">
            Add ERC-20 contracts to track in{' '}
            <code className="rounded bg-surface-2 px-1 py-0.5 font-mono text-[11.5px]">
              daoConfig.treasuryTokens
            </code>
            . See{' '}
            <code className="rounded bg-surface-2 px-1 py-0.5 font-mono text-[11.5px]">
              src/lib/treasury-tokens.ts
            </code>{' '}
            for opt-in defaults.
          </div>
        )}
      </section>

      <section className="rounded-xl border border-border bg-surface px-6 py-[22px]">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-xl font-bold tracking-tight">NFT holdings</h2>
          <span className="text-[12.5px] text-muted-fg">
            {data.nftHoldingsCount.toLocaleString('en-US')} in treasury
            {data.nftHoldingsCount === 24 && '+'}
          </span>
        </div>
        {data.nftHoldings.length === 0 ? (
          <div className="rounded-md border border-dashed border-border bg-surface-2 px-4 py-5 text-sm text-muted-fg">
            Treasury holds no DAO tokens currently.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {data.nftHoldings.map((nft) => (
              <a
                key={nft.tokenId}
                href={`/auction/${nft.tokenId}`}
                className="relative aspect-square overflow-hidden rounded-md border border-border bg-surface-2 transition-[transform,border-color] hover:-translate-y-px hover:border-border-strong"
              >
                {nft.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={resolveIpfs(nft.image)}
                    alt={nft.name}
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                ) : null}
                <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-bg/85 px-2.5 py-1.5 text-xs font-semibold backdrop-blur-md">
                  <span>#{nft.tokenId}</span>
                  <span className="text-muted-fg">
                    {new Date(nft.mintedAt * 1000).toLocaleDateString('en-US', {
                      month: 'short',
                      day: '2-digit',
                      year: '2-digit',
                    })}
                  </span>
                </div>
              </a>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function Th({ children }: { children?: React.ReactNode }) {
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

function zip(
  labels: string[],
  values: number[]
): Array<{ label: string; value: number }> {
  return labels.map((label, i) => ({ label, value: values[i] ?? 0 }))
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

function resolveIpfs(uri: string): string {
  if (uri.startsWith('ipfs://')) {
    return `https://gateway.pinata.cloud/ipfs/${uri.slice(7)}`
  }
  return uri
}
